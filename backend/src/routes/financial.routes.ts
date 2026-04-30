import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
} from 'date-fns';

const router = Router();

// All routes require auth + ADMIN
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// =====================================================
// Helper: get date range for a period
// =====================================================
function getDateRange(period: string, referenceDate: Date): { start: Date; end: Date } {
  switch (period) {
    case 'day':
      return { start: startOfDay(referenceDate), end: endOfDay(referenceDate) };
    case 'week':
      return { start: startOfWeek(referenceDate, { weekStartsOn: 0 }), end: endOfWeek(referenceDate, { weekStartsOn: 0 }) };
    case 'month':
      return { start: startOfMonth(referenceDate), end: endOfMonth(referenceDate) };
    case 'year':
      return { start: startOfYear(referenceDate), end: endOfYear(referenceDate) };
    default:
      return { start: startOfMonth(referenceDate), end: endOfMonth(referenceDate) };
  }
}

// =====================================================
// GET /api/financial/summary — Revenue summary
// =====================================================
router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const period = (req.query.period as string) || 'month';
    const referenceDate = req.query.date ? new Date(req.query.date as string) : new Date();
    const { start, end } = getDateRange(period, referenceDate);

    const [revenueResult, expenseResult, transactionCount] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          transactionDate: { gte: start, lte: end },
        },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: {
          expenseDate: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: {
          transactionDate: { gte: start, lte: end },
        },
      }),
    ]);

    const revenue = Number(revenueResult._sum.totalAmount || 0);
    const expenses = Number(expenseResult._sum.amount || 0);
    const profit = revenue - expenses;

    res.json({
      success: true,
      data: {
        revenue,
        expenses,
        profit,
        transactionCount,
        period,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar resumo financeiro:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar resumo financeiro' });
  }
});

// =====================================================
// GET /api/financial/revenue — Revenue breakdown
// =====================================================
router.get('/revenue', async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const groupBy = (req.query.groupBy as string) || 'type';

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, error: 'startDate e endDate sao obrigatorios' });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (groupBy === 'type') {
      const results = await prisma.transaction.groupBy({
        by: ['type'],
        where: {
          transactionDate: { gte: start, lte: end },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
      });

      const data = results.map((r) => ({
        label: r.type,
        total: Number(r._sum.totalAmount || 0),
        count: r._count.id,
      }));

      res.json({ success: true, data });
    } else if (groupBy === 'day' || groupBy === 'month') {
      // Use raw query for date grouping
      const dateFormat = groupBy === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';
      const results = await prisma.$queryRawUnsafe<
        Array<{ label: string; total: number; count: bigint }>
      >(
        `SELECT TO_CHAR("transactionDate", $1) as label,
                SUM("totalAmount")::float as total,
                COUNT(*)::bigint as count
         FROM "Transaction"
         WHERE "transactionDate" >= $2 AND "transactionDate" <= $3
         GROUP BY label
         ORDER BY label ASC`,
        dateFormat,
        start,
        end,
      );

      const data = results.map((r) => ({
        label: r.label,
        total: Number(r.total || 0),
        count: Number(r.count),
      }));

      res.json({ success: true, data });
    } else {
      res.status(400).json({ success: false, error: 'groupBy deve ser type, day ou month' });
    }
  } catch (error) {
    console.error('Erro ao buscar detalhamento de receita:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar detalhamento de receita' });
  }
});

// =====================================================
// GET /api/financial/expenses — List expenses
// =====================================================
router.get('/expenses', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const category = req.query.category as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate);
      if (endDate) where.expenseDate.lte = new Date(endDate);
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { expenseDate: 'desc' },
        skip,
        take: limit,
        include: {
          registeredBy: {
            select: { id: true, fullName: true },
          },
        },
      }),
      prisma.expense.count({ where }),
    ]);

    res.json({
      success: true,
      data: expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao listar despesas:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar despesas' });
  }
});

// =====================================================
// POST /api/financial/expenses — Create expense
// =====================================================
const createExpenseSchema = z.object({
  category: z.enum([
    'INVENTORY_PURCHASE', 'MAINTENANCE', 'UTILITIES', 'STAFF',
    'INSURANCE', 'AMMUNITION_RESTOCK', 'EQUIPMENT_PURCHASE', 'OTHER',
  ], { errorMap: () => ({ message: 'Categoria de despesa invalida' }) }),
  description: z.string().min(3, 'Descricao deve ter pelo menos 3 caracteres'),
  amount: z.number().positive('Valor deve ser positivo'),
  vendor: z.string().optional(),
  invoiceNumber: z.string().optional(),
  expenseDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Data invalida'),
  notes: z.string().optional(),
});

router.post('/expenses', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createExpenseSchema.parse(req.body);

    const expense = await prisma.expense.create({
      data: {
        category: data.category,
        description: data.description,
        amount: data.amount,
        vendor: data.vendor || null,
        invoiceNumber: data.invoiceNumber || null,
        expenseDate: new Date(data.expenseDate),
        notes: data.notes || null,
        registeredById: req.user!.id,
      },
      include: {
        registeredBy: {
          select: { id: true, fullName: true },
        },
      },
    });

    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao criar despesa:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar despesa' });
  }
});

// =====================================================
// PUT /api/financial/expenses/:id — Update expense
// =====================================================
const updateExpenseSchema = z.object({
  category: z.enum([
    'INVENTORY_PURCHASE', 'MAINTENANCE', 'UTILITIES', 'STAFF',
    'INSURANCE', 'AMMUNITION_RESTOCK', 'EQUIPMENT_PURCHASE', 'OTHER',
  ]).optional(),
  description: z.string().min(3).optional(),
  amount: z.number().positive().optional(),
  vendor: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  expenseDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Data invalida').optional(),
  notes: z.string().optional().nullable(),
});

router.put('/expenses/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Despesa nao encontrada' });
      return;
    }

    const data = updateExpenseSchema.parse(req.body);

    const updateData: any = { ...data };
    if (data.expenseDate) {
      updateData.expenseDate = new Date(data.expenseDate);
    }

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        registeredBy: {
          select: { id: true, fullName: true },
        },
      },
    });

    res.json({ success: true, data: expense });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao atualizar despesa:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar despesa' });
  }
});

// =====================================================
// DELETE /api/financial/expenses/:id — Delete expense
// =====================================================
router.delete('/expenses/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Despesa nao encontrada' });
      return;
    }

    await prisma.expense.delete({ where: { id: req.params.id } });

    res.json({ success: true, message: 'Despesa excluida com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir despesa:', error);
    res.status(500).json({ success: false, error: 'Erro ao excluir despesa' });
  }
});

export default router;
