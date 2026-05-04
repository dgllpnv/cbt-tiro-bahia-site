import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// =====================================================
// GET /api/annuities — List all payments (ADMIN only)
// =====================================================
router.get('/', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (req.query.memberId) {
      where.memberId = req.query.memberId as string;
    }

    if (req.query.referenceYear) {
      where.referenceYear = parseInt(req.query.referenceYear as string);
    }

    const [payments, total] = await Promise.all([
      prisma.annuityPayment.findMany({
        where,
        orderBy: { paymentDate: 'desc' },
        skip,
        take: limit,
        include: {
          member: {
            select: { id: true, fullName: true, memberNumber: true },
          },
        },
      }),
      prisma.annuityPayment.count({ where }),
    ]);

    res.json({
      success: true,
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao listar anuidades:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar anuidades' });
  }
});

// =====================================================
// GET /api/annuities/expiring — Expiring annuities (ADMIN only)
// =====================================================
router.get('/expiring', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const days = Math.max(1, parseInt(req.query.days as string) || 30);
    const includeOverdue = req.query.includeOverdue === 'true';

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    // Quando includeOverdue=true, retorna tambem quem ja venceu (annuityValidUntil < now).
    const annuityFilter = includeOverdue
      ? { lte: futureDate }
      : { gte: now, lte: futureDate };

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: 'ASSOCIATE',
        annuityValidUntil: annuityFilter,
      },
      select: {
        id: true,
        fullName: true,
        memberNumber: true,
        email: true,
        phone: true,
        annuityValidUntil: true,
      },
      orderBy: { annuityValidUntil: 'asc' },
    });

    // Anexa daysRemaining (negativo = vencida)
    const enriched = users.map((u) => {
      const validUntil = u.annuityValidUntil ? new Date(u.annuityValidUntil) : null;
      const daysRemaining = validUntil
        ? Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return { ...u, daysRemaining };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Erro ao buscar anuidades vencendo:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar anuidades vencendo' });
  }
});

// =====================================================
// GET /api/annuities/member/:memberId — Annuity history (ADMIN or self)
// =====================================================
router.get('/member/:memberId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;

    // ADMIN or the member themselves
    if (req.user?.role !== 'ADMIN' && req.user?.id !== memberId) {
      res.status(403).json({ success: false, error: 'Acesso negado. Permissao insuficiente' });
      return;
    }

    const payments = await prisma.annuityPayment.findMany({
      where: { memberId },
      orderBy: { paymentDate: 'desc' },
      include: {
        member: {
          select: { id: true, fullName: true, memberNumber: true, annuityValidUntil: true },
        },
      },
    });

    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('Erro ao buscar historico de anuidades:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar historico de anuidades' });
  }
});

// =====================================================
// POST /api/annuities — Register annuity payment (ADMIN only)
// =====================================================
const createAnnuitySchema = z.object({
  memberId: z.string().uuid('ID do membro invalido'),
  amount: z.number().min(0.01, 'Valor deve ser positivo'),
  paymentMethod: z.string().optional().nullable(),
  referenceYear: z.number().int().min(2000).max(2100),
  notes: z.string().optional().nullable(),
});

router.post('/', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createAnnuitySchema.parse(req.body);

    // Find the member
    const member = await prisma.user.findUnique({
      where: { id: data.memberId },
    });

    if (!member) {
      res.status(404).json({ success: false, error: 'Membro nao encontrado' });
      return;
    }

    // Calculate validFrom and validUntil
    const now = new Date();
    let validFrom: Date;

    if (member.annuityValidUntil && member.annuityValidUntil > now) {
      // If current annuity is still valid, start day after it expires
      validFrom = new Date(member.annuityValidUntil);
      validFrom.setDate(validFrom.getDate() + 1);
    } else {
      // Otherwise start today
      validFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // validUntil = validFrom + 1 year
    const validUntil = new Date(validFrom);
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    // Cria pagamento + atualiza user + cria Transaction COMPLETED de forma atomica.
    // O Transaction garante que a anuidade aparece em /admin/lancamentos, dashboard
    // (monthRevenue) e /admin/financeiro (summary/revenue), que so agregam Transaction.
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
    const result = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.annuityPayment.create({
        data: {
          memberId: data.memberId,
          amount: data.amount,
          paymentMethod: data.paymentMethod || null,
          referenceYear: data.referenceYear,
          validFrom,
          validUntil,
          notes: data.notes || null,
          registeredById: req.user!.id,
        },
        include: {
          member: {
            select: { id: true, fullName: true, memberNumber: true },
          },
        },
      });

      // Atualiza User.annuityValidUntil
      await tx.user.update({
        where: { id: data.memberId },
        data: { annuityValidUntil: validUntil },
      });

      // Cria Transaction espelhada (lancamento financeiro) com 1 item descritivo
      const txDescription = `Anuidade ${data.referenceYear}`;
      const txNotes =
        data.notes ||
        `Vigencia ${fmtDate(validFrom)} a ${fmtDate(validUntil)}`;
      const newTransaction = await tx.transaction.create({
        data: {
          memberId: data.memberId,
          registeredById: req.user!.id,
          type: 'ANNUITY_PAYMENT',
          status: 'COMPLETED',
          totalAmount: data.amount,
          paymentMethod: data.paymentMethod || null,
          notes: txNotes,
          transactionDate: new Date(),
          items: {
            create: [
              {
                description: txDescription,
                quantity: 1,
                unitPrice: data.amount,
                subtotal: data.amount,
              },
            ],
          },
        },
      });

      return { payment: newPayment, transaction: newTransaction };
    });
    const payment = result.payment;

    await createAuditLog({
      performedById: req.user!.id,
      action: 'PAYMENT_RECEIVED',
      entityType: 'Annuity',
      entityId: payment.id,
      userId: data.memberId,
      newData: {
        amount: data.amount,
        referenceYear: data.referenceYear,
        validFrom,
        validUntil,
        paymentMethod: data.paymentMethod ?? null,
        transactionId: result.transaction.id,
      },
      description: `Anuidade ${data.referenceYear} paga (R$ ${data.amount.toFixed(2)})`,
      ipAddress: req.ip as string | undefined,
    });

    // Registra tambem CREATE/Transaction para coerencia com vendas regulares
    await createAuditLog({
      performedById: req.user!.id,
      action: 'CREATE',
      entityType: 'Transaction',
      entityId: result.transaction.id,
      userId: data.memberId,
      newData: {
        type: 'ANNUITY_PAYMENT',
        totalAmount: data.amount,
        paymentMethod: data.paymentMethod ?? null,
        annuityPaymentId: payment.id,
      },
      description: `Lancamento de anuidade ${data.referenceYear} (R$ ${data.amount.toFixed(2)})`,
      ipAddress: req.ip as string | undefined,
    });

    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao registrar anuidade:', error);
    res.status(500).json({ success: false, error: 'Erro ao registrar anuidade' });
  }
});

export default router;
