import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// All routes require auth + ADMIN
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// =====================================================
// GET /api/transactions — List transactions
// =====================================================
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

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

    res.json({ success: true, message: 'Transacao cancelada com sucesso' });
  } catch (error) {
    console.error('Erro ao cancelar transacao:', error);
    res.status(500).json({ success: false, error: 'Erro ao cancelar transacao' });
  }
});

export default router;
