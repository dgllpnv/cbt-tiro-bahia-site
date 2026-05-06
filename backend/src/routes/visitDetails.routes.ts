import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createVisitDetailSchema = z.object({
  caliber: z.string().min(1, 'Calibre e obrigatorio'),
  firearmName: z.string().max(100).optional(),
  shotsFired: z.number().int().min(1, 'Quantidade de tiros deve ser no minimo 1'),
  notes: z.string().optional(),
});

const updateVisitDetailSchema = z.object({
  caliber: z.string().min(1, 'Calibre e obrigatorio').optional(),
  firearmName: z.string().max(100).nullable().optional(),
  shotsFired: z.number().int().min(1, 'Quantidade de tiros deve ser no minimo 1').optional(),
  notes: z.string().nullable().optional(),
});

// =====================================================
// HELPER: Check if user owns the visit
// =====================================================

async function getVisitWithOwnership(visitId: string) {
  return prisma.visit.findUnique({
    where: { id: visitId },
    select: { id: true, memberId: true },
  });
}

// =====================================================
// GET /visit/:visitId — List details for a visit
// =====================================================

router.get('/visit/:visitId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { visitId } = req.params;

    const visit = await getVisitWithOwnership(visitId);

    if (!visit) {
      res.status(404).json({ success: false, error: 'Visita nao encontrada' });
      return;
    }

    // ASSOCIATE can only see own visit details
    if (req.user!.role !== 'ADMIN' && visit.memberId !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Acesso negado. Permissao insuficiente' });
      return;
    }

    const details = await prisma.visitDetail.findMany({
      where: { visitId },
      orderBy: { createdAt: 'desc' },
      include: {
        member: {
          select: { id: true, fullName: true, memberNumber: true },
        },
      },
    });

    res.json({ success: true, data: details });
  } catch (error) {
    console.error('[VISIT_DETAILS] Erro ao listar detalhes da visita:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar detalhes da visita' });
  }
});

// =====================================================
// POST /visit/:visitId — Add detail to a visit
// =====================================================

router.post('/visit/:visitId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { visitId } = req.params;

    const visit = await getVisitWithOwnership(visitId);

    if (!visit) {
      res.status(404).json({ success: false, error: 'Visita nao encontrada' });
      return;
    }

    // ASSOCIATE can only add details to own visit
    if (req.user!.role !== 'ADMIN' && visit.memberId !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Acesso negado. Permissao insuficiente' });
      return;
    }

    const validation = createVisitDetailSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
      return;
    }

    const data = validation.data;

    const detail = await prisma.visitDetail.create({
      data: {
        visitId,
        memberId: visit.memberId,
        caliber: data.caliber,
        firearmName: data.firearmName?.trim() || null,
        shotsFired: data.shotsFired,
        notes: data.notes || null,
      },
      include: {
        member: {
          select: { id: true, fullName: true, memberNumber: true },
        },
      },
    });

    console.log(`[VISIT_DETAILS] Detalhe adicionado a visita ${visitId} por ${req.user!.email}`);

    res.status(201).json({ success: true, data: detail });
  } catch (error) {
    console.error('[VISIT_DETAILS] Erro ao adicionar detalhe:', error);
    res.status(500).json({ success: false, error: 'Erro ao adicionar detalhe da visita' });
  }
});

// =====================================================
// PUT /:id — Update visit detail
// =====================================================

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.visitDetail.findUnique({
      where: { id },
      include: {
        visit: { select: { memberId: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Detalhe da visita nao encontrado' });
      return;
    }

    // ASSOCIATE can only update own visit details
    if (req.user!.role !== 'ADMIN' && existing.visit.memberId !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Acesso negado. Permissao insuficiente' });
      return;
    }

    const validation = updateVisitDetailSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
      return;
    }

    const data = validation.data;

    const detail = await prisma.visitDetail.update({
      where: { id },
      data,
      include: {
        member: {
          select: { id: true, fullName: true, memberNumber: true },
        },
      },
    });

    console.log(`[VISIT_DETAILS] Detalhe ${id} atualizado por ${req.user!.email}`);

    res.json({ success: true, data: detail });
  } catch (error) {
    console.error('[VISIT_DETAILS] Erro ao atualizar detalhe:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar detalhe da visita' });
  }
});

// =====================================================
// DELETE /:id — Delete visit detail
// =====================================================

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.visitDetail.findUnique({
      where: { id },
      include: {
        visit: { select: { memberId: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Detalhe da visita nao encontrado' });
      return;
    }

    // ASSOCIATE can only delete own visit details
    if (req.user!.role !== 'ADMIN' && existing.visit.memberId !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Acesso negado. Permissao insuficiente' });
      return;
    }

    await prisma.visitDetail.delete({ where: { id } });

    console.log(`[VISIT_DETAILS] Detalhe ${id} excluido por ${req.user!.email}`);

    res.json({ success: true, data: { message: 'Detalhe da visita excluido com sucesso' } });
  } catch (error) {
    console.error('[VISIT_DETAILS] Erro ao excluir detalhe:', error);
    res.status(500).json({ success: false, error: 'Erro ao excluir detalhe da visita' });
  }
});

export default router;
