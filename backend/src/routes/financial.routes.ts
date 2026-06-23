import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  differenceInCalendarDays, addDays,
} from 'date-fns';

const router = Router();

router.use(authMiddleware);

// =====================================================
// GET /api/financial/daily-closing
// Fechamento do dia. Acessivel a ADMIN e CASHIER.
// Retorna receita/despesa/saldo do dia atual + breakdown por
// forma de pagamento e por tipo + lista de transacoes e despesas.
// NAO aceita parametro de data — sempre hoje (por design,
// CASHIER nao pode escolher periodo).
// =====================================================
router.get('/daily-closing', requireRole('ADMIN', 'CASHIER'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const start = startOfDay(now);
    const end = endOfDay(now);

    const [
      revAgg, expAgg, txCountAgg,
      paymentRows, typeRows,
      transactions, expenses,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: { transactionDate: { gte: start, lte: end }, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: { transactionDate: { gte: start, lte: end }, status: 'COMPLETED' },
      }),
      prisma.transaction.groupBy({
        by: ['paymentMethod'],
        where: { transactionDate: { gte: start, lte: end }, status: 'COMPLETED' },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.transaction.groupBy({
        by: ['type'],
        where: { transactionDate: { gte: start, lte: end }, status: 'COMPLETED' },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.transaction.findMany({
        where: { transactionDate: { gte: start, lte: end }, status: 'COMPLETED' },
        orderBy: { transactionDate: 'desc' },
        include: {
          member: { select: { id: true, fullName: true, memberNumber: true } },
          registeredBy: { select: { id: true, fullName: true } },
          items: { select: { description: true, quantity: true, subtotal: true } },
        },
        take: 200,
      }),
      prisma.expense.findMany({
        where: { expenseDate: { gte: start, lte: end } },
        orderBy: { expenseDate: 'desc' },
        include: { registeredBy: { select: { id: true, fullName: true } } },
        take: 200,
      }),
    ]);

    const revenue = Number(revAgg._sum.totalAmount ?? 0);
    const expensesTotal = Number(expAgg._sum.amount ?? 0);
    const balance = revenue - expensesTotal;

    const paymentBreakdown = paymentRows
      .map((r) => ({
        method: r.paymentMethod ?? '—',
        total: Number(r._sum.totalAmount ?? 0),
        count: r._count.id,
      }))
      .sort((a, b) => b.total - a.total);

    const typeBreakdown = typeRows
      .map((r) => ({
        type: r.type,
        total: Number(r._sum.totalAmount ?? 0),
        count: r._count.id,
      }))
      .sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      data: {
        date: start.toISOString(),
        endOfDay: end.toISOString(),
        totals: {
          revenue,
          expenses: expensesTotal,
          balance,
          transactionCount: txCountAgg,
          expenseCount: expenses.length,
        },
        paymentBreakdown,
        typeBreakdown,
        transactions: transactions.map((t) => ({
          id: t.id,
          transactionDate: t.transactionDate.toISOString(),
          type: t.type,
          totalAmount: Number(t.totalAmount),
          paymentMethod: t.paymentMethod,
          notes: t.notes,
          member: t.member ? { id: t.member.id, fullName: t.member.fullName, memberNumber: t.member.memberNumber } : null,
          registeredBy: t.registeredBy ? { id: t.registeredBy.id, fullName: t.registeredBy.fullName } : null,
          items: t.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            subtotal: Number(i.subtotal),
          })),
        })),
        expenses: expenses.map((e) => ({
          id: e.id,
          expenseDate: e.expenseDate.toISOString(),
          category: e.category,
          description: e.description,
          amount: Number(e.amount),
          vendor: e.vendor,
          registeredBy: e.registeredBy ? { id: e.registeredBy.id, fullName: e.registeredBy.fullName } : null,
        })),
      },
    });
  } catch (error) {
    console.error('Erro ao montar fechamento do dia:', error);
    res.status(500).json({ success: false, error: 'Erro ao montar fechamento do dia' });
  }
});

// Demais rotas: somente ADMIN
router.use(requireRole('ADMIN'));

// =====================================================
// GET /api/financial/period-closing?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Fechamento de um periodo arbitrario. Admin-only (declarado apos o
// router.use(requireRole('ADMIN')) acima — a pagina Financeiro tambem
// e admin-only). Mesmo formato do daily-closing, mas para o intervalo
// escolhido. Lista TODAS as transacoes e despesas do periodo, com um
// teto de seguranca (CAP); sinaliza `truncated` se atingido para o PDF
// avisar o usuario.
// =====================================================
const PERIOD_CLOSING_CAP = 5000;

router.get('/period-closing', async (req: Request, res: Response): Promise<void> => {
  try {
    const startStr = (req.query.startDate as string) || '';
    const endStr = (req.query.endDate as string) || '';

    const startParsed = new Date(startStr);
    const endParsed = new Date(endStr);
    if (
      !startStr || !endStr ||
      Number.isNaN(startParsed.getTime()) || Number.isNaN(endParsed.getTime())
    ) {
      res.status(400).json({ success: false, error: 'Informe startDate e endDate validos (YYYY-MM-DD)' });
      return;
    }

    const start = startOfDay(startParsed);
    const end = endOfDay(endParsed);
    if (end < start) {
      res.status(400).json({ success: false, error: 'endDate nao pode ser anterior a startDate' });
      return;
    }

    const [
      revAgg, expAgg, txCountAgg,
      paymentRows, typeRows,
      transactions, expenses,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: { transactionDate: { gte: start, lte: end }, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: { transactionDate: { gte: start, lte: end }, status: 'COMPLETED' },
      }),
      prisma.transaction.groupBy({
        by: ['paymentMethod'],
        where: { transactionDate: { gte: start, lte: end }, status: 'COMPLETED' },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.transaction.groupBy({
        by: ['type'],
        where: { transactionDate: { gte: start, lte: end }, status: 'COMPLETED' },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.transaction.findMany({
        where: { transactionDate: { gte: start, lte: end }, status: 'COMPLETED' },
        orderBy: { transactionDate: 'asc' },
        include: {
          member: { select: { id: true, fullName: true, memberNumber: true } },
          registeredBy: { select: { id: true, fullName: true } },
          items: { select: { description: true, quantity: true, subtotal: true } },
        },
        take: PERIOD_CLOSING_CAP,
      }),
      prisma.expense.findMany({
        where: { expenseDate: { gte: start, lte: end } },
        orderBy: { expenseDate: 'asc' },
        include: { registeredBy: { select: { id: true, fullName: true } } },
        take: PERIOD_CLOSING_CAP,
      }),
    ]);

    const revenue = Number(revAgg._sum.totalAmount ?? 0);
    const expensesTotal = Number(expAgg._sum.amount ?? 0);
    const balance = revenue - expensesTotal;

    const paymentBreakdown = paymentRows
      .map((r) => ({
        method: r.paymentMethod ?? '—',
        total: Number(r._sum.totalAmount ?? 0),
        count: r._count.id,
      }))
      .sort((a, b) => b.total - a.total);

    const typeBreakdown = typeRows
      .map((r) => ({
        type: r.type,
        total: Number(r._sum.totalAmount ?? 0),
        count: r._count.id,
      }))
      .sort((a, b) => b.total - a.total);

    const truncated =
      transactions.length >= PERIOD_CLOSING_CAP || expenses.length >= PERIOD_CLOSING_CAP;

    res.json({
      success: true,
      data: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        truncated,
        totals: {
          revenue,
          expenses: expensesTotal,
          balance,
          transactionCount: txCountAgg,
          expenseCount: expenses.length,
        },
        paymentBreakdown,
        typeBreakdown,
        transactions: transactions.map((t) => ({
          id: t.id,
          transactionDate: t.transactionDate.toISOString(),
          type: t.type,
          totalAmount: Number(t.totalAmount),
          paymentMethod: t.paymentMethod,
          notes: t.notes,
          member: t.member
            ? { id: t.member.id, fullName: t.member.fullName, memberNumber: t.member.memberNumber }
            : null,
          registeredBy: t.registeredBy
            ? { id: t.registeredBy.id, fullName: t.registeredBy.fullName }
            : null,
          items: t.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            subtotal: Number(i.subtotal),
          })),
        })),
        expenses: expenses.map((e) => ({
          id: e.id,
          expenseDate: e.expenseDate.toISOString(),
          category: e.category,
          description: e.description,
          amount: Number(e.amount),
          vendor: e.vendor,
          registeredBy: e.registeredBy
            ? { id: e.registeredBy.id, fullName: e.registeredBy.fullName }
            : null,
        })),
      },
    });
  } catch (error) {
    console.error('Erro ao montar fechamento por periodo:', error);
    res.status(500).json({ success: false, error: 'Erro ao montar fechamento por periodo' });
  }
});

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
          status: 'COMPLETED',
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
          status: 'COMPLETED',
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
          status: 'COMPLETED',
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
           AND "status" = 'COMPLETED'
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

// =====================================================
// GET /api/financial/dashboard?startDate&endDate
// Pacote consolidado para a tela /admin/financeiro:
// KPIs comparativos, serie temporal, breakdowns e top produtos.
// =====================================================
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    if (!startDate || !endDate) {
      res.status(400).json({ success: false, error: 'startDate e endDate sao obrigatorios' });
      return;
    }
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));
    if (start > end) {
      res.status(400).json({ success: false, error: 'startDate deve ser anterior a endDate' });
      return;
    }

    // Periodo anterior (mesma duracao deslocada para tras).
    const days = differenceInCalendarDays(end, start) + 1;
    const prevEnd = endOfDay(addDays(start, -1));
    const prevStart = startOfDay(addDays(prevEnd, -(days - 1)));

    const COMPLETED = 'COMPLETED' as const;

    // === Agregacoes do periodo atual e anterior em paralelo ===
    const [
      revAgg, expAgg, txCountAgg,
      prevRevAgg, prevExpAgg, prevTxCountAgg,
      revenueByTypeRaw, expensesByCategoryRaw,
      paymentMethodsRaw,
      seriesRows, prevSeriesRows,
      topProductsRaw,
      expiringCount, overdueCount,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: { transactionDate: { gte: start, lte: end }, status: COMPLETED },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: { transactionDate: { gte: start, lte: end }, status: COMPLETED },
      }),
      prisma.transaction.aggregate({
        where: { transactionDate: { gte: prevStart, lte: prevEnd }, status: COMPLETED },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: prevStart, lte: prevEnd } },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: { transactionDate: { gte: prevStart, lte: prevEnd }, status: COMPLETED },
      }),
      prisma.transaction.groupBy({
        by: ['type'],
        where: { transactionDate: { gte: start, lte: end }, status: COMPLETED },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.expense.groupBy({
        by: ['category'],
        where: { expenseDate: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.transaction.groupBy({
        by: ['paymentMethod'],
        where: { transactionDate: { gte: start, lte: end }, status: COMPLETED },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // Serie temporal — granularidade auto: dia se <=31, mes se mais.
      (async () => {
        const fmt = days <= 31 ? 'YYYY-MM-DD' : 'YYYY-MM';
        // Junta receita (Transaction COMPLETED) e despesa (Expense) por bucket
        const rev = await prisma.$queryRawUnsafe<Array<{ label: string; total: number }>>(
          `SELECT TO_CHAR("transactionDate", $1) as label,
                  COALESCE(SUM("totalAmount"), 0)::float as total
           FROM "Transaction"
           WHERE "transactionDate" >= $2 AND "transactionDate" <= $3
             AND "status" = 'COMPLETED'
           GROUP BY label
           ORDER BY label ASC`,
          fmt, start, end,
        );
        const exp = await prisma.$queryRawUnsafe<Array<{ label: string; total: number }>>(
          `SELECT TO_CHAR("expenseDate", $1) as label,
                  COALESCE(SUM("amount"), 0)::float as total
           FROM "Expense"
           WHERE "expenseDate" >= $2 AND "expenseDate" <= $3
           GROUP BY label
           ORDER BY label ASC`,
          fmt, start, end,
        );
        return { rev, exp };
      })(),
      (async () => {
        const fmt = days <= 31 ? 'YYYY-MM-DD' : 'YYYY-MM';
        const rev = await prisma.$queryRawUnsafe<Array<{ label: string; total: number }>>(
          `SELECT TO_CHAR("transactionDate", $1) as label,
                  COALESCE(SUM("totalAmount"), 0)::float as total
           FROM "Transaction"
           WHERE "transactionDate" >= $2 AND "transactionDate" <= $3
             AND "status" = 'COMPLETED'
           GROUP BY label
           ORDER BY label ASC`,
          fmt, prevStart, prevEnd,
        );
        return { rev };
      })(),
      // Top produtos — agrega itens de transacoes COMPLETED no periodo
      prisma.transactionItem.groupBy({
        by: ['productId'],
        where: {
          productId: { not: null },
          transaction: { transactionDate: { gte: start, lte: end }, status: COMPLETED },
        },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { subtotal: 'desc' } },
        take: 5,
      }),
      // Anuidades a vencer em 30d
      prisma.user.count({
        where: {
          isActive: true,
          annuityValidUntil: { gte: new Date(), lte: addDays(new Date(), 30) },
        },
      }),
      // Anuidades vencidas (active members)
      prisma.user.count({
        where: {
          isActive: true,
          role: 'ASSOCIATE',
          annuityValidUntil: { lt: new Date() },
        },
      }),
    ]);

    // Cruzar topProducts com Product (nome + costPrice)
    const productIds = topProductsRaw
      .map((p) => p.productId)
      .filter((id): id is string => !!id);
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, costPrice: true, unitPrice: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    const topProducts = topProductsRaw.map((p) => {
      const prod = productMap.get(p.productId!);
      const qty = p._sum.quantity ?? 0;
      const revenue = Number(p._sum.subtotal ?? 0);
      const costTotal = prod?.costPrice ? Number(prod.costPrice) * qty : null;
      const margin = costTotal != null ? revenue - costTotal : null;
      const marginPct = costTotal != null && revenue > 0 ? (margin! / revenue) * 100 : null;
      return {
        productId: p.productId,
        name: prod?.name ?? '—',
        qty,
        revenue,
        costTotal,
        margin,
        marginPct,
      };
    });

    // Series merge — mescla buckets de receita e despesa pelo label
    const seriesMap = new Map<string, { date: string; revenue: number; expenses: number }>();
    for (const r of seriesRows.rev) {
      seriesMap.set(r.label, { date: r.label, revenue: Number(r.total) || 0, expenses: 0 });
    }
    for (const e of seriesRows.exp) {
      const existing = seriesMap.get(e.label) ?? { date: e.label, revenue: 0, expenses: 0 };
      existing.expenses = Number(e.total) || 0;
      seriesMap.set(e.label, existing);
    }
    const series = Array.from(seriesMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({ ...s, result: s.revenue - s.expenses }));

    // KPIs
    const revenue = Number(revAgg._sum.totalAmount ?? 0);
    const expenses = Number(expAgg._sum.amount ?? 0);
    const result = revenue - expenses;
    const margin = revenue > 0 ? (result / revenue) * 100 : 0;
    const txCount = txCountAgg;
    const avgTicket = txCount > 0 ? revenue / txCount : 0;

    const prevRevenue = Number(prevRevAgg._sum.totalAmount ?? 0);
    const prevExpenses = Number(prevExpAgg._sum.amount ?? 0);
    const prevResult = prevRevenue - prevExpenses;
    const prevMargin = prevRevenue > 0 ? (prevResult / prevRevenue) * 100 : 0;
    const prevTxCount = prevTxCountAgg;
    const prevAvgTicket = prevTxCount > 0 ? prevRevenue / prevTxCount : 0;

    const pctDelta = (curr: number, prev: number): number | null => {
      if (prev === 0) return curr === 0 ? 0 : null; // null = sem base de comparacao
      return ((curr - prev) / Math.abs(prev)) * 100;
    };

    // revenueByType — soma + count, com totalGeral para o frontend calcular share se quiser
    const totalRevenueByType = revenueByTypeRaw.reduce(
      (s, r) => s + Number(r._sum.totalAmount ?? 0),
      0,
    );
    const revenueByType = revenueByTypeRaw
      .map((r) => ({
        key: r.type as string,
        total: Number(r._sum.totalAmount ?? 0),
        count: r._count.id,
        share: totalRevenueByType > 0 ? Number(r._sum.totalAmount ?? 0) / totalRevenueByType : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const totalExpensesByCategory = expensesByCategoryRaw.reduce(
      (s, r) => s + Number(r._sum.amount ?? 0),
      0,
    );
    const expensesByCategory = expensesByCategoryRaw
      .map((r) => ({
        key: r.category as string,
        total: Number(r._sum.amount ?? 0),
        count: r._count.id,
        share:
          totalExpensesByCategory > 0
            ? Number(r._sum.amount ?? 0) / totalExpensesByCategory
            : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const totalPaymentMethods = paymentMethodsRaw.reduce(
      (s, r) => s + Number(r._sum.totalAmount ?? 0),
      0,
    );
    const paymentMethods = paymentMethodsRaw
      .map((r) => ({
        method: r.paymentMethod ?? '—',
        total: Number(r._sum.totalAmount ?? 0),
        count: r._count.id,
        share:
          totalPaymentMethods > 0 ? Number(r._sum.totalAmount ?? 0) / totalPaymentMethods : 0,
      }))
      .sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      data: {
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          days,
          granularity: days <= 31 ? 'day' : 'month',
        },
        prev: {
          startDate: prevStart.toISOString(),
          endDate: prevEnd.toISOString(),
        },
        kpis: {
          revenue: { value: revenue, prevValue: prevRevenue, deltaPct: pctDelta(revenue, prevRevenue) },
          expenses: { value: expenses, prevValue: prevExpenses, deltaPct: pctDelta(expenses, prevExpenses) },
          result: { value: result, prevValue: prevResult, deltaPct: pctDelta(result, prevResult) },
          margin: { value: margin, prevValue: prevMargin, deltaPct: margin - prevMargin }, // pontos pp
          avgTicket: { value: avgTicket, prevValue: prevAvgTicket, deltaPct: pctDelta(avgTicket, prevAvgTicket) },
          txCount: { value: txCount, prevValue: prevTxCount, deltaPct: pctDelta(txCount, prevTxCount) },
          expiringCount: { value: expiringCount },
          overdueCount: { value: overdueCount },
        },
        series,
        prevSeries: prevSeriesRows.rev.map((r) => ({ date: r.label, revenue: Number(r.total) || 0 })),
        revenueByType,
        expensesByCategory,
        paymentMethods,
        topProducts,
      },
    });
  } catch (error) {
    console.error('Erro ao montar dashboard financeiro:', error);
    res.status(500).json({ success: false, error: 'Erro ao montar dashboard financeiro' });
  }
});

export default router;
