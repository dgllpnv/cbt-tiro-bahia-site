import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';

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

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        annuityValidUntil: {
          gte: now,
          lte: futureDate,
        },
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

    res.json({ success: true, data: users });
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

    // Create payment and update member atomically
    const payment = await prisma.$transaction(async (tx) => {
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

      // Update user's annuityValidUntil
      await tx.user.update({
        where: { id: data.memberId },
        data: { annuityValidUntil: validUntil },
      });

      return newPayment;
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
