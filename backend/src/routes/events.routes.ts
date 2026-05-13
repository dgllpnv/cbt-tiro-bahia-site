import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';

const router = Router();
router.use(authMiddleware);

// GET /api/events — List events (all users)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;
    const upcoming = req.query.upcoming === 'true';

    const where: any = {};
    if (upcoming) {
      where.eventDate = { gte: new Date() };
    }
    if (req.query.eventType) {
      where.eventType = req.query.eventType;
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { eventDate: upcoming ? 'asc' : 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { participations: true } },
        },
      }),
      prisma.event.count({ where }),
    ]);

    res.json({
      success: true,
      data: events,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Erro ao listar eventos:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar eventos' });
  }
});

// GET /api/events/:id — Event detail with participants
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        participations: {
          include: { member: { select: { id: true, fullName: true, memberNumber: true } } },
          orderBy: { placement: 'asc' },
        },
      },
    });

    if (!event) {
      res.status(404).json({ success: false, error: 'Evento nao encontrado' });
      return;
    }

    res.json({ success: true, data: event });
  } catch (error) {
    console.error('Erro ao buscar evento:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar evento' });
  }
});

// POST /api/events — Create event (ADMIN)
const createEventSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  eventType: z.enum(['TRAINING', 'COMPETITION', 'COURSE', 'WORKSHOP']),
  eventDate: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  maxParticipants: z.number().int().positive().optional(),
  isPublic: z.boolean().optional(),
  registrationDeadline: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
});

router.post('/', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createEventSchema.parse(req.body);

    const event = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        eventType: data.eventType,
        eventDate: new Date(data.eventDate),
        startTime: data.startTime ? new Date(data.startTime) : null,
        endTime: data.endTime ? new Date(data.endTime) : null,
        location: data.location,
        maxParticipants: data.maxParticipants,
        isPublic: data.isPublic ?? true,
        registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
        imageUrl: data.imageUrl || null,
      },
    });

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao criar evento:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar evento' });
  }
});

// PUT /api/events/:id — Update event (ADMIN)
router.put('/:id', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Evento nao encontrado' });
      return;
    }

    const data = createEventSchema.partial().parse(req.body);

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...data,
        eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : undefined,
        imageUrl: data.imageUrl === '' ? null : data.imageUrl,
      },
    });

    res.json({ success: true, data: event });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao atualizar evento:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar evento' });
  }
});

// DELETE /api/events/:id — Delete event (ADMIN)
router.delete('/:id', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Evento nao encontrado' });
      return;
    }
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Evento excluido' });
  } catch (error) {
    console.error('Erro ao excluir evento:', error);
    res.status(500).json({ success: false, error: 'Erro ao excluir evento' });
  }
});

// POST /api/events/:id/participate — Register participation (ADMIN)
const participateSchema = z.object({
  memberId: z.string().uuid(),
  caliberUsed: z.string().optional(),
  countsAsHabituality: z.boolean().optional(),
});

router.post('/:id/participate', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, caliberUsed, countsAsHabituality } = participateSchema.parse(req.body);

    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) {
      res.status(404).json({ success: false, error: 'Evento nao encontrado' });
      return;
    }

    const member = await prisma.user.findUnique({ where: { id: memberId } });
    if (!member) {
      res.status(404).json({ success: false, error: 'Membro nao encontrado' });
      return;
    }

    const participation = await prisma.eventParticipation.create({
      data: {
        eventId: req.params.id,
        memberId,
        caliberUsed,
        countsAsHabituality: countsAsHabituality ?? true,
      },
      include: { member: { select: { id: true, fullName: true, memberNumber: true } } },
    });

    // Auto-create habituality record if applicable
    if (participation.countsAsHabituality && caliberUsed) {
      await prisma.habitualityRecord.create({
        data: {
          memberId,
          caliber: caliberUsed,
          activityDate: event.eventDate,
          activityType: event.eventType === 'COMPETITION' ? 'COMPETITION' : 'TRAINING',
          eventId: req.params.id,
          description: `Participacao: ${event.title}`,
          verifiedById: req.user!.id,
        },
      });
    }

    res.status(201).json({ success: true, data: participation });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ success: false, error: 'Membro ja inscrito neste evento' });
      return;
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao registrar participacao:', error);
    res.status(500).json({ success: false, error: 'Erro ao registrar participacao' });
  }
});

// PUT /api/events/:id/results — Update results/placements (ADMIN)
const resultsSchema = z.object({
  results: z.array(z.object({
    participationId: z.string().uuid(),
    placement: z.number().int().positive().optional(),
    score: z.number().optional(),
    notes: z.string().optional(),
  })),
});

router.put('/:id/results', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { results } = resultsSchema.parse(req.body);

    await prisma.$transaction(
      results.map((r) =>
        prisma.eventParticipation.update({
          where: { id: r.participationId },
          data: { placement: r.placement, score: r.score, notes: r.notes },
        })
      )
    );

    res.json({ success: true, message: 'Resultados atualizados' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao atualizar resultados:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar resultados' });
  }
});

export default router;
