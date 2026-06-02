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

router.post('/', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
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

// =====================================================
// POST /api/habituality/manual — Lancamento retroativo de sessao completa
//
// Cria uma "Visit fantasma" (notes prefixados com [MANUAL]) + VisitDetail
// por linha + HabitualityRecord por calibre unico. Tudo em uma transaction.
// Reaproveita 100% da infra existente (Livro de Habitualidade, Declaracao
// Individual e contagem de "8 por calibre/ano" leem dessas tabelas).
//
// Restrito a ADMIN: cashier nao tem poder de lancamento retroativo.
// =====================================================

const manualDetailSchema = z.object({
  caliber: z.string().min(1, 'Calibre obrigatorio'),
  firearmName: z.string().max(100).optional(),
  shotsFired: z.number().int().min(1, 'Minimo 1 tiro por linha'),
  ammunitionType: z.enum(['RELOADED', 'FACTORY']).nullable().optional(),
});

const manualSessionSchema = z.object({
  memberId: z.string().uuid(),
  activityDate: z.string(), // ISO date (YYYY-MM-DD)
  activityType: z.enum(['TRAINING', 'COMPETITION']),
  notes: z.string().max(500).optional(),
  details: z.array(manualDetailSchema).min(1, 'Adicione ao menos uma linha de tiro'),
});

router.post('/manual', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = manualSessionSchema.parse(req.body);

    // Verifica que o membro existe (e nao e visitante — visitante nao
    // tem habitualidade porque nao tem CR).
    const member = await prisma.user.findUnique({
      where: { id: data.memberId },
      select: { id: true, role: true, clubId: true, fullName: true },
    });
    if (!member) {
      res.status(404).json({ success: false, error: 'Associado nao encontrado' });
      return;
    }
    if (member.role === 'VISITOR') {
      res.status(400).json({ success: false, error: 'Visitante nao acumula habitualidade' });
      return;
    }

    // Data do lancamento (ISO "YYYY-MM-DD" → meia-noite local).
    const activityDate = new Date(data.activityDate);
    if (Number.isNaN(activityDate.getTime())) {
      res.status(400).json({ success: false, error: 'Data invalida' });
      return;
    }

    // Marca de auditoria visivel: nas notes do Visit fica claro que foi
    // retroativo + quem lancou + quando. Buscamos o nome do admin pra
    // facilitar leitura na UI (sem precisar resolver registeredById).
    const adminName = req.user!.email; // simples e auditavel
    const todayIso = new Date().toISOString().slice(0, 10);
    const marker = `[MANUAL] Lancamento retroativo por ${adminName} em ${todayIso}` +
      (data.notes ? ` — ${data.notes}` : '');

    const result = await prisma.$transaction(async (tx) => {
      // Visit fantasma — checkInTime = activityDate 12:00 (meio-dia) como
      // representacao convencional. checkOutTime fica null (nao houve sessao
      // fisica do clube). laneId tambem null. registeredById = admin atual.
      const checkInTime = new Date(activityDate);
      checkInTime.setHours(12, 0, 0, 0);

      const visit = await tx.visit.create({
        data: {
          clubId: member.clubId,
          memberId: data.memberId,
          registeredById: req.user!.id,
          visitDate: activityDate,
          checkInTime,
          notes: marker,
        },
      });

      // VisitDetails — 1 por linha do form
      await tx.visitDetail.createMany({
        data: data.details.map((d) => ({
          visitId: visit.id,
          memberId: data.memberId,
          caliber: d.caliber,
          firearmName: d.firearmName?.trim() || null,
          shotsFired: d.shotsFired,
          ammunitionType: d.ammunitionType ?? null,
        })),
      });

      // HabitualityRecord — 1 por calibre unico. activityType vem do form.
      // description marca origem manual (aparece no portal e nos PDFs).
      const uniqueCalibers = Array.from(new Set(data.details.map((d) => d.caliber)));
      await tx.habitualityRecord.createMany({
        data: uniqueCalibers.map((caliber) => ({
          clubId: member.clubId,
          memberId: data.memberId,
          caliber,
          activityDate,
          activityType: data.activityType,
          visitId: visit.id,
          description: marker,
          verifiedById: req.user!.id,
        })),
      });

      return { visitId: visit.id, calibers: uniqueCalibers.length, details: data.details.length };
    });

    console.log(
      `[HABITUALITY] Sessao MANUAL criada por ${adminName} para membro ${member.fullName}: ` +
        `${result.details} linha(s), ${result.calibers} calibre(s) na data ${data.activityDate}`,
    );

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message, details: error.errors });
      return;
    }
    console.error('[HABITUALITY] Erro no lancamento manual:', error);
    res.status(500).json({ success: false, error: 'Erro ao lancar sessao manual' });
  }
});

// GET /api/habituality/alerts — Members below minimum (ADMIN)
router.get('/alerts', requireRole('ADMIN', 'CASHIER'), async (_req: Request, res: Response): Promise<void> => {
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
