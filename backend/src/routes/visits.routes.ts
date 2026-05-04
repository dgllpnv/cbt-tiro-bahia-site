import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createVisitSchema = z.object({
  memberId: z.string().uuid('ID do associado invalido'),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  checkInTime: z.string().datetime({ offset: true, message: 'Horario de check-in invalido' }),
  laneId: z.string().uuid('ID da baia invalido').optional(),
  purpose: z.string().optional(),
  instructorName: z.string().optional(),
  notes: z.string().optional(),
  isGuestVisit: z.boolean().optional(),
  guestName: z.string().optional(),
  guestDocument: z.string().optional(),
});

const updateVisitSchema = z.object({
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  checkInTime: z.string().datetime({ offset: true }).optional(),
  checkOutTime: z.string().datetime({ offset: true }).nullable().optional(),
  laneId: z.string().uuid('ID da baia invalido').nullable().optional(),
  purpose: z.string().nullable().optional(),
  instructorName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isGuestVisit: z.boolean().optional(),
  guestName: z.string().nullable().optional(),
  guestDocument: z.string().nullable().optional(),
});

// =====================================================
// GET / — List visits (ADMIN sees all, ASSOCIATE sees own)
// =====================================================

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const { memberId, startDate, endDate } = req.query;

    const where: any = {};

    // ASSOCIATE can only see own visits
    if (req.user!.role !== 'ADMIN') {
      where.memberId = req.user!.id;
    } else if (memberId && typeof memberId === 'string') {
      where.memberId = memberId;
    }

    // Date filters
    if (startDate || endDate) {
      where.visitDate = {};
      if (startDate && typeof startDate === 'string') {
        where.visitDate.gte = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        where.visitDate.lte = new Date(endDate);
      }
    }

    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where,
        orderBy: { visitDate: 'desc' },
        skip,
        take: limit,
        include: {
          member: {
            select: { id: true, fullName: true, memberNumber: true, photoUrl: true },
          },
          lane: {
            select: { id: true, number: true, name: true, status: true },
          },
        },
      }),
      prisma.visit.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: visits,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('[VISITS] Erro ao listar visitas:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar visitas' });
  }
});

// =====================================================
// GET /today — Today's visits (ADMIN only)
// =====================================================

router.get('/today', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const visits = await prisma.visit.findMany({
      where: {
        visitDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { checkInTime: 'desc' },
      include: {
        member: {
          select: { id: true, fullName: true, memberNumber: true, photoUrl: true },
        },
        lane: {
          select: { id: true, number: true, name: true, status: true },
        },
        details: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, caliber: true, shotsFired: true, notes: true, createdAt: true },
        },
      },
    });

    res.json({
      success: true,
      data: visits,
    });
  } catch (error) {
    console.error('[VISITS] Erro ao buscar visitas de hoje:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar visitas de hoje' });
  }
});

// =====================================================
// GET /:id — Get visit by ID (ADMIN or visit owner)
// =====================================================

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        member: {
          select: { id: true, fullName: true, memberNumber: true, photoUrl: true },
        },
        lane: {
          select: { id: true, number: true, name: true, status: true },
        },
        details: {
          orderBy: { createdAt: 'desc' },
        },
        transactions: {
          orderBy: { transactionDate: 'desc' },
          include: {
            items: true,
          },
        },
      },
    });

    if (!visit) {
      res.status(404).json({ success: false, error: 'Visita nao encontrada' });
      return;
    }

    // ASSOCIATE can only see own visits
    if (req.user!.role !== 'ADMIN' && visit.memberId !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Acesso negado. Permissao insuficiente' });
      return;
    }

    res.json({ success: true, data: visit });
  } catch (error) {
    console.error('[VISITS] Erro ao buscar visita:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar visita' });
  }
});

// =====================================================
// POST / — Create visit (ADMIN only)
// =====================================================

router.post('/', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = createVisitSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
      return;
    }

    const data = validation.data;

    // Validate memberId exists
    const member = await prisma.user.findUnique({
      where: { id: data.memberId },
      select: { id: true, fullName: true, isActive: true },
    });

    if (!member) {
      res.status(404).json({ success: false, error: 'Associado nao encontrado' });
      return;
    }

    if (!member.isActive) {
      res.status(400).json({ success: false, error: 'Associado esta inativo' });
      return;
    }

    // When a lane is assigned to the visit, validate its availability before
    // creating the visit so members cannot share a lane accidentally.
    if (data.laneId) {
      const lane = await prisma.lane.findUnique({
        where: { id: data.laneId },
        select: { id: true, name: true, number: true, status: true, isActive: true },
      });

      if (!lane) {
        res.status(404).json({ success: false, error: 'Baia nao encontrada' });
        return;
      }

      if (!lane.isActive) {
        res.status(400).json({ success: false, error: 'Baia esta inativa' });
        return;
      }

      if (lane.status === 'OCCUPIED') {
        const laneLabel = lane.name || `Baia ${String(lane.number).padStart(2, '0')}`;
        res.status(400).json({ success: false, error: `${laneLabel} ja esta ocupada` });
        return;
      }

      if (lane.status === 'MAINTENANCE') {
        const laneLabel = lane.name || `Baia ${String(lane.number).padStart(2, '0')}`;
        res.status(400).json({ success: false, error: `${laneLabel} esta em manutencao` });
        return;
      }
    }

    // Atomically create the visit and (if a lane was assigned) mark the lane
    // as OCCUPIED with the current member so the bay panel stays coherent.
    const visit = await prisma.$transaction(async (tx) => {
      const created = await tx.visit.create({
        data: {
          memberId: data.memberId,
          registeredById: req.user!.id,
          visitDate: new Date(data.visitDate),
          checkInTime: new Date(data.checkInTime),
          laneId: data.laneId || null,
          purpose: data.purpose || null,
          instructorName: data.instructorName || null,
          notes: data.notes || null,
          isGuestVisit: data.isGuestVisit || false,
          guestName: data.guestName || null,
          guestDocument: data.guestDocument || null,
        },
        include: {
          member: {
            select: { id: true, fullName: true, memberNumber: true, photoUrl: true },
          },
          lane: {
            select: { id: true, number: true, name: true, status: true },
          },
        },
      });

      if (data.laneId) {
        await tx.lane.update({
          where: { id: data.laneId },
          data: {
            status: 'OCCUPIED',
            currentMemberId: data.memberId,
            sessionStartTime: new Date(data.checkInTime),
          },
        });
      }

      return created;
    });

    console.log(`[VISITS] Visita criada para ${member.fullName} por ${req.user!.email}`);

    await createAuditLog({
      performedById: req.user!.id,
      action: 'CREATE',
      entityType: 'Visit',
      entityId: visit.id,
      userId: data.memberId,
      newData: { laneId: data.laneId, purpose: data.purpose, isGuestVisit: data.isGuestVisit },
      description: `Visita criada para ${member.fullName}`,
      ipAddress: req.ip as string | undefined,
    });

    res.status(201).json({ success: true, data: visit });
  } catch (error) {
    console.error('[VISITS] Erro ao criar visita:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar visita' });
  }
});

// =====================================================
// PUT /:id — Update visit (ADMIN only)
// =====================================================

router.put('/:id', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.visit.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Visita nao encontrada' });
      return;
    }

    const validation = updateVisitSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
      return;
    }

    const data = validation.data;

    const updateData: any = { ...data };

    if (data.visitDate !== undefined) {
      updateData.visitDate = new Date(data.visitDate);
    }
    if (data.checkInTime !== undefined) {
      updateData.checkInTime = new Date(data.checkInTime);
    }
    if (data.checkOutTime !== undefined) {
      updateData.checkOutTime = data.checkOutTime ? new Date(data.checkOutTime) : null;
    }

    const visit = await prisma.visit.update({
      where: { id },
      data: updateData,
      include: {
        member: {
          select: { id: true, fullName: true, memberNumber: true, photoUrl: true },
        },
        lane: {
          select: { id: true, number: true, name: true, status: true },
        },
      },
    });

    console.log(`[VISITS] Visita ${id} atualizada por ${req.user!.email}`);

    await createAuditLog({
      performedById: req.user!.id,
      action: 'UPDATE',
      entityType: 'Visit',
      entityId: id,
      userId: existing.memberId,
      previousData: existing,
      newData: updateData,
      description: `Visita ${id} atualizada`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: visit });
  } catch (error) {
    console.error('[VISITS] Erro ao atualizar visita:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar visita' });
  }
});

// =====================================================
// PATCH /:id/checkout — Check out visit (ADMIN only)
// =====================================================

router.patch('/:id/checkout', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.visit.findUnique({
      where: { id },
      include: { lane: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Visita nao encontrada' });
      return;
    }

    if (existing.checkOutTime) {
      res.status(400).json({ success: false, error: 'Visita ja possui check-out registrado' });
      return;
    }

    // Use a transaction to update visit and free lane atomically
    const visit = await prisma.$transaction(async (tx) => {
      // Free the lane if one was assigned
      if (existing.laneId) {
        await tx.lane.update({
          where: { id: existing.laneId },
          data: {
            status: 'AVAILABLE',
            currentMemberId: null,
            sessionStartTime: null,
          },
        });
      }

      return tx.visit.update({
        where: { id },
        data: { checkOutTime: new Date() },
        include: {
          member: {
            select: { id: true, fullName: true, memberNumber: true, photoUrl: true },
          },
          lane: {
            select: { id: true, number: true, name: true, status: true },
          },
        },
      });
    });

    console.log(`[VISITS] Check-out registrado para visita ${id} por ${req.user!.email}`);

    await createAuditLog({
      performedById: req.user!.id,
      action: 'STATUS_CHANGE',
      entityType: 'Visit',
      entityId: id,
      userId: existing.memberId,
      previousData: { checkOutTime: null },
      newData: { checkOutTime: visit.checkOutTime },
      description: `Check-out registrado para visita ${id}`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: visit });
  } catch (error) {
    console.error('[VISITS] Erro ao registrar check-out:', error);
    res.status(500).json({ success: false, error: 'Erro ao registrar check-out' });
  }
});

// =====================================================
// DELETE /:id — Delete visit (ADMIN only)
// =====================================================

router.delete('/:id', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.visit.findUnique({
      where: { id },
      include: {
        transactions: { select: { id: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Visita nao encontrada' });
      return;
    }

    // Cannot delete if there are linked transactions
    if (existing.transactions.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Nao e possivel excluir visita com transacoes vinculadas',
      });
      return;
    }

    await prisma.visit.delete({ where: { id } });

    console.log(`[VISITS] Visita ${id} excluida por ${req.user!.email}`);

    await createAuditLog({
      performedById: req.user!.id,
      action: 'DELETE',
      entityType: 'Visit',
      entityId: id,
      userId: existing.memberId,
      previousData: { memberId: existing.memberId, visitDate: existing.visitDate },
      description: `Visita ${id} excluida`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: { message: 'Visita excluida com sucesso' } });
  } catch (error) {
    console.error('[VISITS] Erro ao excluir visita:', error);
    res.status(500).json({ success: false, error: 'Erro ao excluir visita' });
  }
});

export default router;
