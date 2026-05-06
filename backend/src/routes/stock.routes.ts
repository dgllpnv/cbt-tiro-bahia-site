import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();

// All routes require auth + ADMIN
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// =====================================================
// GET /api/stock — List all stock items
// =====================================================
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const belowMinimum = req.query.belowMinimum === 'true';
    const category = req.query.category as string | undefined;

    const where: any = {};

    if (belowMinimum) {
      where.currentStock = { lte: prisma.stockItem.fields.minimumStock };
    }

    if (category) {
      where.product = { category };
    }

    // For belowMinimum we need raw filter since we compare two columns
    let stockWhere: any = {};
    if (category) {
      stockWhere.product = { category };
    }

    const [items, total] = await Promise.all([
      prisma.stockItem.findMany({
        where: stockWhere,
        orderBy: { product: { name: 'asc' } },
        skip,
        take: limit,
        include: {
          product: {
            select: { id: true, name: true, category: true, caliber: true, unit: true, unitPrice: true },
          },
        },
      }),
      prisma.stockItem.count({ where: stockWhere }),
    ]);

    // Filter belowMinimum in application layer (comparing two columns)
    let filteredItems = items;
    let filteredTotal = total;
    if (belowMinimum) {
      filteredItems = items.filter((item) => item.currentStock <= item.minimumStock);
      // For accurate pagination with belowMinimum, we need a separate count
      const allItems = await prisma.stockItem.findMany({
        where: stockWhere,
        select: { currentStock: true, minimumStock: true },
      });
      filteredTotal = allItems.filter((item) => item.currentStock <= item.minimumStock).length;
    }

    res.json({
      success: true,
      data: filteredItems,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao listar itens de estoque:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar itens de estoque' });
  }
});

// =====================================================
// GET /api/stock/low — Items below minimum stock
// =====================================================
router.get('/low', async (_req: Request, res: Response): Promise<void> => {
  try {
    const allItems = await prisma.stockItem.findMany({
      include: {
        product: {
          select: { id: true, name: true, category: true, caliber: true, unit: true },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });

    const lowStockItems = allItems.filter((item) => item.currentStock <= item.minimumStock);

    res.json({
      success: true,
      data: lowStockItems,
    });
  } catch (error) {
    console.error('Erro ao buscar itens com estoque baixo:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar itens com estoque baixo' });
  }
});

// =====================================================
// GET /api/stock/movements — Global stock movement log
// =====================================================
router.get('/movements', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const productId = req.query.productId as string | undefined;
    const movementType = req.query.movementType as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const where: any = {};

    if (productId) {
      where.stockItem = { productId };
    }

    if (movementType) {
      where.movementType = movementType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          stockItem: {
            include: {
              product: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    res.json({
      success: true,
      data: movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao listar movimentacoes de estoque:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar movimentacoes de estoque' });
  }
});

// =====================================================
// GET /api/stock/:productId — Stock detail for a product
// =====================================================
router.get('/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const stockItem = await prisma.stockItem.findFirst({
      where: { productId: req.params.productId },
      include: {
        product: {
          select: { id: true, name: true, category: true, caliber: true, unit: true },
        },
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!stockItem) {
      res.status(404).json({ success: false, error: 'Item de estoque nao encontrado' });
      return;
    }

    res.json({ success: true, data: stockItem });
  } catch (error) {
    console.error('Erro ao buscar detalhe do estoque:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar detalhe do estoque' });
  }
});

// =====================================================
// POST /api/stock/adjust — Manual stock adjustment
// =====================================================
const adjustStockSchema = z.object({
  productId: z.string().uuid('ID do produto invalido'),
  quantity: z.number().int().positive('Quantidade deve ser um numero positivo'),
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'], {
    errorMap: () => ({ message: 'Tipo deve ser ADJUSTMENT_IN ou ADJUSTMENT_OUT' }),
  }),
  notes: z.string().optional(),
});

router.post('/adjust', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = adjustStockSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const stockItem = await tx.stockItem.findFirst({
        where: { productId: data.productId },
      });

      if (!stockItem) {
        throw new Error('STOCK_NOT_FOUND');
      }

      const previousStock = stockItem.currentStock;
      let newStock: number;

      if (data.type === 'ADJUSTMENT_IN') {
        newStock = previousStock + data.quantity;
      } else {
        if (previousStock < data.quantity) {
          throw new Error('INSUFFICIENT_STOCK');
        }
        newStock = previousStock - data.quantity;
      }

      const movement = await tx.stockMovement.create({
        data: {
          stockItemId: stockItem.id,
          movementType: data.type,
          quantity: data.quantity,
          previousStock,
          newStock,
          notes: data.notes || null,
          performedById: req.user!.id,
        },
      });

      const updatedStockItem = await tx.stockItem.update({
        where: { id: stockItem.id },
        data: { currentStock: newStock },
        include: {
          product: {
            select: { id: true, name: true, category: true, caliber: true, unit: true, unitPrice: true },
          },
        },
      });

      return { stockItem: updatedStockItem, movement };
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'STOCK_ADJUSTMENT',
      entityType: 'StockItem',
      entityId: result.stockItem.id,
      previousData: { previousStock: result.movement.previousStock },
      newData: {
        newStock: result.movement.newStock,
        delta: data.type === 'ADJUSTMENT_IN' ? data.quantity : -data.quantity,
        movementType: data.type,
      },
      description: `Estoque de "${result.stockItem.product.name}" ajustado (${data.type === 'ADJUSTMENT_IN' ? '+' : '-'}${data.quantity})`,
      ipAddress: req.ip as string | undefined,
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    if (error instanceof Error) {
      if (error.message === 'STOCK_NOT_FOUND') {
        res.status(404).json({ success: false, error: 'Item de estoque nao encontrado para este produto' });
        return;
      }
      if (error.message === 'INSUFFICIENT_STOCK') {
        res.status(400).json({ success: false, error: 'Estoque insuficiente para esta saida' });
        return;
      }
    }
    console.error('Erro ao ajustar estoque:', error);
    res.status(500).json({ success: false, error: 'Erro ao ajustar estoque' });
  }
});

// =====================================================
// PATCH /api/stock/:productId/minimum — Atualiza apenas o estoque minimo
// (usado pela tela de Produtos ao editar metadados sem mexer em quantidade)
// =====================================================
const minimumSchema = z.object({
  minimumStock: z.number().int().min(0, 'Minimo deve ser >= 0'),
});

router.patch('/:productId/minimum', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = minimumSchema.parse(req.body);
    const stockItem = await prisma.stockItem.findFirst({
      where: { productId: req.params.productId },
      select: { id: true },
    });
    if (!stockItem) {
      res.status(404).json({ success: false, error: 'Item de estoque nao encontrado' });
      return;
    }
    const updated = await prisma.stockItem.update({
      where: { id: stockItem.id },
      data: { minimumStock: data.minimumStock },
      select: { id: true, minimumStock: true },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('Erro ao atualizar minimo:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar minimo' });
  }
});

export default router;
