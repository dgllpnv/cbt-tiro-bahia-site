import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();

// All routes require auth + ADMIN ou CASHIER (operacao de balcao)
router.use(authMiddleware);
router.use(requireRole('ADMIN', 'CASHIER'));

// =====================================================
// GET /api/transactions — List transactions
// =====================================================
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Por default lista apenas transacoes COMPLETED. Permite filtrar via ?status=DRAFT
    // para a UI de comandas em aberto.
    if (req.query.status) {
      where.status = req.query.status as string;
    } else {
      where.status = 'COMPLETED';
    }

    if (req.query.type) {
      where.type = req.query.type as string;
    }

    if (req.query.memberId) {
      where.memberId = req.query.memberId as string;
    }

    if (req.query.startDate || req.query.endDate) {
      where.transactionDate = {};
      if (req.query.startDate) {
        where.transactionDate.gte = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        where.transactionDate.lte = new Date(req.query.endDate as string);
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
        include: {
          member: {
            select: { id: true, fullName: true },
          },
          registeredBy: {
            select: { id: true, fullName: true },
          },
          items: true,
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao listar transacoes:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar transacoes' });
  }
});

// =====================================================
// GET /api/transactions/:id — Transaction detail
// =====================================================
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: {
        member: {
          select: { id: true, fullName: true },
        },
        registeredBy: {
          select: { id: true, fullName: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!transaction) {
      res.status(404).json({ success: false, error: 'Transacao nao encontrada' });
      return;
    }

    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('Erro ao buscar transacao:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar transacao' });
  }
});

// =====================================================
// POST /api/transactions — Create transaction with items
// =====================================================
const transactionItemSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  description: z.string().min(1, 'Descricao e obrigatoria'),
  quantity: z.number().int().min(1, 'Quantidade deve ser pelo menos 1'),
  unitPrice: z.number().min(0, 'Preco unitario deve ser positivo'),
});

const createTransactionSchema = z.object({
  memberId: z.string().uuid('ID do membro invalido'),
  type: z.enum([
    'AMMUNITION_SALE',
    'TARGET_SALE',
    'EQUIPMENT_RENTAL',
    'MAGAZINE_RENTAL',
    'LANE_RENTAL',
    'ANNUITY_PAYMENT',
    'COURSE_ENROLLMENT',
    'GUEST_ENTRY',
    'OTHER_SALE',
  ]),
  paymentMethod: z.string().optional().nullable(),
  discount: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  visitId: z.string().uuid().optional().nullable(),
  items: z.array(transactionItemSchema).min(1, 'Pelo menos um item e obrigatorio'),
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createTransactionSchema.parse(req.body);

    // Calculate subtotals and total
    const itemsWithSubtotal = data.items.map((item) => ({
      ...item,
      subtotal: item.quantity * item.unitPrice,
    }));

    const rawTotal = itemsWithSubtotal.reduce((sum, item) => sum + item.subtotal, 0);
    const discount = data.discount || 0;
    const totalAmount = Math.max(0, rawTotal - discount);

    // Validate stock for items with productId before the transaction
    const productItems = itemsWithSubtotal.filter((item) => item.productId);
    for (const item of productItems) {
      const stockItem = await prisma.stockItem.findFirst({
        where: { productId: item.productId! },
      });

      if (!stockItem) {
        res.status(400).json({
          success: false,
          error: `Produto ${item.description} nao possui estoque cadastrado`,
        });
        return;
      }

      if (stockItem.currentStock < item.quantity) {
        res.status(400).json({
          success: false,
          error: `Estoque insuficiente para ${item.description}. Disponivel: ${stockItem.currentStock}, solicitado: ${item.quantity}`,
        });
        return;
      }
    }

    // Create transaction atomically
    const transaction = await prisma.$transaction(async (tx) => {
      // Create the transaction record
      const newTransaction = await tx.transaction.create({
        data: {
          memberId: data.memberId,
          type: data.type,
          totalAmount,
          discount: discount,
          paymentMethod: data.paymentMethod || null,
          notes: data.notes || null,
          visitId: data.visitId || null,
          registeredById: req.user!.id,
          items: {
            create: itemsWithSubtotal.map((item) => ({
              productId: item.productId || null,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
        },
        include: {
          member: {
            select: { id: true, fullName: true },
          },
          registeredBy: {
            select: { id: true, fullName: true },
          },
          items: true,
        },
      });

      // Deduct stock for items with productId
      for (const item of productItems) {
        const stockItem = await tx.stockItem.findFirst({
          where: { productId: item.productId! },
        });

        if (stockItem) {
          const previousStock = stockItem.currentStock;
          const newStock = previousStock - item.quantity;

          await tx.stockItem.update({
            where: { id: stockItem.id },
            data: { currentStock: newStock },
          });

          await tx.stockMovement.create({
            data: {
              stockItemId: stockItem.id,
              movementType: 'SALE_OUT',
              quantity: item.quantity,
              previousStock,
              newStock,
              referenceId: newTransaction.id,
              referenceType: 'Transaction',
              notes: `Venda - ${item.description}`,
              performedById: req.user!.id,
            },
          });
        }
      }

      return newTransaction;
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'CREATE',
      entityType: 'Transaction',
      entityId: transaction.id,
      userId: data.memberId,
      newData: {
        type: data.type,
        totalAmount,
        paymentMethod: data.paymentMethod ?? null,
        itemCount: itemsWithSubtotal.length,
        visitId: data.visitId ?? null,
      },
      description: `Venda registrada (${data.type}, R$ ${totalAmount.toFixed(2)})`,
      ipAddress: req.ip as string | undefined,
    });

    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao criar transacao:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar transacao' });
  }
});

// =====================================================
// DELETE /api/transactions/:id — Void/cancel transaction
// =====================================================
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Transacao nao encontrada' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Reverse stock movements for items with productId
      const productItems = existing.items.filter((item) => item.productId);

      for (const item of productItems) {
        const stockItem = await tx.stockItem.findFirst({
          where: { productId: item.productId! },
        });

        if (stockItem) {
          const previousStock = stockItem.currentStock;
          const newStock = previousStock + item.quantity;

          await tx.stockItem.update({
            where: { id: stockItem.id },
            data: { currentStock: newStock },
          });

          await tx.stockMovement.create({
            data: {
              stockItemId: stockItem.id,
              movementType: 'RETURN_IN',
              quantity: item.quantity,
              previousStock,
              newStock,
              referenceId: existing.id,
              referenceType: 'Transaction',
              notes: `Estorno - ${item.description}`,
              performedById: req.user!.id,
            },
          });
        }
      }

      // Delete transaction (items cascade due to onDelete: Cascade)
      await tx.transaction.delete({ where: { id: req.params.id } });
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'DELETE',
      entityType: 'Transaction',
      entityId: existing.id,
      userId: existing.memberId,
      previousData: {
        type: existing.type,
        totalAmount: Number(existing.totalAmount),
        itemCount: existing.items.length,
      },
      description: `Venda ${existing.id} estornada / cancelada`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, message: 'Transacao cancelada com sucesso' });
  } catch (error) {
    console.error('Erro ao cancelar transacao:', error);
    res.status(500).json({ success: false, error: 'Erro ao cancelar transacao' });
  }
});

// =====================================================
// Comanda aberta (Transaction com status=DRAFT) por visita
// =====================================================

const draftItemSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  description: z.string().min(1, 'Descricao e obrigatoria'),
  quantity: z.number().int().min(1, 'Quantidade deve ser pelo menos 1'),
  unitPrice: z.number().min(0, 'Preco unitario deve ser positivo'),
});

// =====================================================
// GET /api/transactions/draft/visit/:visitId — Busca a comanda DRAFT da visita
// (retorna 200 com null se nao existir — permite o front decidir criar quando precisar)
// =====================================================
router.get('/draft/visit/:visitId', async (req: Request, res: Response): Promise<void> => {
  try {
    const draft = await prisma.transaction.findFirst({
      where: { visitId: req.params.visitId, status: 'DRAFT' },
      include: {
        member: { select: { id: true, fullName: true, memberNumber: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: draft });
  } catch (error) {
    console.error('Erro ao buscar comanda em aberto:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar comanda em aberto' });
  }
});

// =====================================================
// POST /api/transactions/draft — Cria (ou retorna existente) comanda DRAFT
// Body: { memberId, visitId? }
// Idempotente: se ja existir DRAFT para a visita, retorna a mesma.
// =====================================================
const createDraftSchema = z.object({
  memberId: z.string().uuid('ID do membro invalido'),
  visitId: z.string().uuid().optional().nullable(),
});

router.post('/draft', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createDraftSchema.parse(req.body);

    // Se ja existe DRAFT para a visita, retorna ela (uma comanda por visita)
    if (data.visitId) {
      const existing = await prisma.transaction.findFirst({
        where: { visitId: data.visitId, status: 'DRAFT' },
        include: {
          member: { select: { id: true, fullName: true, memberNumber: true } },
          items: true,
        },
      });
      if (existing) {
        res.json({ success: true, data: existing });
        return;
      }
    }

    const draft = await prisma.transaction.create({
      data: {
        memberId: data.memberId,
        visitId: data.visitId ?? null,
        registeredById: req.user!.id,
        type: 'OTHER_SALE',
        status: 'DRAFT',
        totalAmount: 0,
        discount: 0,
      },
      include: {
        member: { select: { id: true, fullName: true, memberNumber: true } },
        items: true,
      },
    });

    res.status(201).json({ success: true, data: draft });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao criar comanda:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar comanda' });
  }
});

// =====================================================
// POST /api/transactions/:id/items — Adiciona item a comanda DRAFT
// =====================================================
router.post('/:id/items', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = draftItemSchema.parse(req.body);
    const subtotal = data.quantity * data.unitPrice;

    const existing = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Comanda nao encontrada' });
      return;
    }
    if (existing.status !== 'DRAFT') {
      res.status(400).json({ success: false, error: 'So e possivel adicionar itens em comanda aberta' });
      return;
    }

    // Estoque eh validado/debitado no finalize, nao aqui (comanda aberta).
    const updated = await prisma.$transaction(async (tx) => {
      await tx.transactionItem.create({
        data: {
          transactionId: existing.id,
          productId: data.productId ?? null,
          description: data.description,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          subtotal,
        },
      });

      const items = await tx.transactionItem.findMany({ where: { transactionId: existing.id } });
      const newTotal = items.reduce((sum, it) => sum + Number(it.subtotal), 0);

      return tx.transaction.update({
        where: { id: existing.id },
        data: { totalAmount: Math.max(0, newTotal - Number(existing.discount ?? 0)) },
        include: {
          member: { select: { id: true, fullName: true, memberNumber: true } },
          items: true,
        },
      });
    });

    res.status(201).json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao adicionar item a comanda:', error);
    res.status(500).json({ success: false, error: 'Erro ao adicionar item a comanda' });
  }
});

// =====================================================
// DELETE /api/transactions/:id/items/:itemId — Remove item da comanda DRAFT
// =====================================================
router.delete('/:id/items/:itemId', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Comanda nao encontrada' });
      return;
    }
    if (existing.status !== 'DRAFT') {
      res.status(400).json({ success: false, error: 'So e possivel editar itens em comanda aberta' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.transactionItem.delete({ where: { id: req.params.itemId } });

      const items = await tx.transactionItem.findMany({ where: { transactionId: existing.id } });
      const newTotal = items.reduce((sum, it) => sum + Number(it.subtotal), 0);

      return tx.transaction.update({
        where: { id: existing.id },
        data: { totalAmount: Math.max(0, newTotal - Number(existing.discount ?? 0)) },
        include: {
          member: { select: { id: true, fullName: true, memberNumber: true } },
          items: true,
        },
      });
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Item nao encontrado' });
      return;
    }
    console.error('Erro ao remover item da comanda:', error);
    res.status(500).json({ success: false, error: 'Erro ao remover item da comanda' });
  }
});

// =====================================================
// PATCH /api/transactions/:id/finalize — Fecha a comanda
// Body: { paymentMethod, discount?, notes?, type? }
// Aplica desconto, debita estoque, status=COMPLETED, registra audit log.
// =====================================================
const finalizeSchema = z.object({
  paymentMethod: z.string().min(1, 'Forma de pagamento e obrigatoria'),
  discount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  type: z.enum([
    'AMMUNITION_SALE', 'TARGET_SALE', 'EQUIPMENT_RENTAL', 'MAGAZINE_RENTAL',
    'LANE_RENTAL', 'ANNUITY_PAYMENT', 'COURSE_ENROLLMENT', 'GUEST_ENTRY', 'OTHER_SALE',
  ]).optional(),
});

router.patch('/:id/finalize', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = finalizeSchema.parse(req.body);

    const existing = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Comanda nao encontrada' });
      return;
    }
    if (existing.status !== 'DRAFT') {
      res.status(400).json({ success: false, error: 'Comanda ja foi finalizada' });
      return;
    }
    if (existing.items.length === 0) {
      res.status(400).json({ success: false, error: 'Adicione pelo menos um item antes de fechar a conta' });
      return;
    }

    const productItems = existing.items.filter((it) => it.productId);

    // Validacao de estoque ANTES da transacao para nao prender locks desnecessarios
    for (const item of productItems) {
      const stockItem = await prisma.stockItem.findFirst({ where: { productId: item.productId! } });
      if (!stockItem) {
        res.status(400).json({
          success: false,
          error: `Produto "${item.description}" nao possui estoque cadastrado`,
        });
        return;
      }
      if (stockItem.currentStock < item.quantity) {
        res.status(400).json({
          success: false,
          error: `Estoque insuficiente para "${item.description}". Disponivel: ${stockItem.currentStock}, solicitado: ${item.quantity}`,
        });
        return;
      }
    }

    const rawTotal = existing.items.reduce((sum, it) => sum + Number(it.subtotal), 0);
    const discount = data.discount ?? 0;
    const totalAmount = Math.max(0, rawTotal - discount);

    const finalized = await prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id: existing.id },
        data: {
          status: 'COMPLETED',
          paymentMethod: data.paymentMethod,
          discount,
          totalAmount,
          notes: data.notes ?? existing.notes,
          type: data.type ?? existing.type,
          transactionDate: new Date(),
        },
        include: {
          member: { select: { id: true, fullName: true, memberNumber: true } },
          items: true,
        },
      });

      // Debita estoque + registra movimentos
      for (const item of productItems) {
        const stockItem = await tx.stockItem.findFirst({ where: { productId: item.productId! } });
        if (!stockItem) continue;
        const previousStock = stockItem.currentStock;
        const newStock = previousStock - item.quantity;

        await tx.stockItem.update({
          where: { id: stockItem.id },
          data: { currentStock: newStock },
        });

        await tx.stockMovement.create({
          data: {
            stockItemId: stockItem.id,
            movementType: 'SALE_OUT',
            quantity: item.quantity,
            previousStock,
            newStock,
            referenceId: updated.id,
            referenceType: 'Transaction',
            notes: `Venda - ${item.description}`,
            performedById: req.user!.id,
          },
        });
      }

      return updated;
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'CREATE',
      entityType: 'Transaction',
      entityId: finalized.id,
      userId: finalized.memberId,
      newData: {
        type: finalized.type,
        totalAmount,
        discount,
        paymentMethod: finalized.paymentMethod,
        itemCount: existing.items.length,
        visitId: finalized.visitId,
      },
      description: `Comanda fechada (${finalized.type}, R$ ${totalAmount.toFixed(2)})`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: finalized });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao finalizar comanda:', error);
    res.status(500).json({ success: false, error: 'Erro ao finalizar comanda' });
  }
});

export default router;
