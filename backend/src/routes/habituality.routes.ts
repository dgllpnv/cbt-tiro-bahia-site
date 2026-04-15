import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';

const router = Router();
router.use(authMiddleware);

// GET /api/habituality/member/:id — Records for a member
router.get('/member/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = req.params.id;

    // ASSOCIATE can only see own, ADMIN can see any
    if (req.user?.role !== 'ADMIN' && req.user?.id !== memberId) {
      res.status(403).json({ success: false, error: 'Permissao negada' });
      return;
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const records = await prisma.habitualityRecord.findMany({
      where: {
        memberId,
        activityDate: { gte: startDate, lte: endDate },
      },
      orderBy: { activityDate: 'desc' },
      include: {
        event: { select: { id: true, title: true, eventType: true } },
        visit: { select: { id: true, visitDate: true } },
        verifiedBy: { select: { id: true, fullName: true } },
      },
    });

    res.json({ success: true, data: records });
  } catch (error) {
    console.error('Erro ao buscar habitualidade:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar habitualidade' });
  }
});

// GET /api/habituality/member/:id/summary — Summary per caliber
router.get('/member/:id/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = req.params.id;

    if (req.user?.role !== 'ADMIN' && req.user?.id !== memberId) {
      res.status(403).json({ success: false, error: 'Permissao negada' });
      return;
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const records = await prisma.habitualityRecord.groupBy({
      by: ['caliber'],
      where: {
        memberId,
        activityDate: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
    });

    const summary = records.map((r) => ({
      caliber: r.caliber,
      count: r._count.id,
      required: 8,
      compliant: r._count.id >= 8,
    }));

    res.json({ success: true, data: { year, summary } });
  } catch (error) {
    console.error('Erro ao buscar resumo habitualidade:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar resumo' });
  }
});

// POST /api/habituality — Register record (ADMIN)
const createSchema = z.object({
  memberId: z.string().uuid(),
  caliber: z.string().min(1),
  activityDate: z.string(),
  activityType: z.enum(['TRAINING', 'COMPETITION']),
  visitId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  description: z.string().optional(),
});

router.post('/', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createSchema.parse(req.body);

    const record = await prisma.habitualityRecord.create({
      data: {
        memberId: data.memberId,
        caliber: data.caliber,
        activityDate: new Date(data.activityDate),
        activityType: data.activityType,
        visitId: data.visitId,
        eventId: data.eventId,
        description: data.description,
        verifiedById: req.user!.id,
      },
    });

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao registrar habitualidade:', error);
    res.status(500).json({ success: false, error: 'Erro ao registrar' });
  }
});

// GET /api/habituality/alerts — Members below minimum (ADMIN)
router.get('/alerts', requireRole('ADMIN'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const year = new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const associates = await prisma.user.findMany({
      where: { role: 'ASSOCIATE', status: 'ACTIVE' },
      select: { id: true, fullName: true, memberNumber: true, cr: true },
    });

    const records = await prisma.habitualityRecord.groupBy({
      by: ['memberId', 'caliber'],
      where: { activityDate: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });

    const memberMap = new Map<string, { caliber: string; count: number }[]>();
    for (const r of records) {
      if (!memberMap.has(r.memberId)) memberMap.set(r.memberId, []);
      memberMap.get(r.memberId)!.push({ caliber: r.caliber, count: r._count.id });
    }

    const alerts = associates
      .map((a) => {
        const calibers = memberMap.get(a.id) || [];
        const belowMinimum = calibers.filter((c) => c.count < 8);
        return { ...a, calibers, belowMinimum, hasAlert: belowMinimum.length > 0 || calibers.length === 0 };
      })
      .filter((a) => a.hasAlert);

    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('Erro ao buscar alertas:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar alertas' });
  }
});

export default router;
