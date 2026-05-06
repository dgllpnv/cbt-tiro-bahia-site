import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';

const router = Router();
router.use(authMiddleware);

// GET /api/lanes — All lanes with status
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const lanes = await prisma.lane.findMany({
      where: { isActive: true },
      orderBy: { number: 'asc' },
      include: {
        currentMember: { select: { id: true, fullName: true, memberNumber: true } },
      },
    });
    res.json({ success: true, data: lanes });
  } catch (error) {
    console.error('Erro ao listar baias:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar baias' });
  }
});

// GET /api/lanes/status — Summary
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const lanes = await prisma.lane.findMany({ where: { isActive: true } });
    const summary = {
      total: lanes.length,
      available: lanes.filter(l => l.status === 'AVAILABLE').length,
      occupied: lanes.filter(l => l.status === 'OCCUPIED').length,
      maintenance: lanes.filter(l => l.status === 'MAINTENANCE').length,
      reserved: lanes.filter(l => l.status === 'RESERVED').length,
    };
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Erro ao buscar status das baias:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar status' });
  }
});

// PATCH /api/lanes/:id/status — Update status (ADMIN)
const updateStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED']),
  notes: z.string().optional(),
});

router.patch('/:id/status', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, notes } = updateStatusSchema.parse(req.body);

    const updateData: any = { status, notes };
    if (status === 'AVAILABLE') {
      updateData.currentMemberId = null;
      updateData.sessionStartTime = null;
    }

    const lane = await prisma.lane.update({
      where: { id: req.params.id },
      data: updateData,
      include: { currentMember: { select: { id: true, fullName: true } } },
    });

    res.json({ success: true, data: lane });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao atualizar baia:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar baia' });
  }
});

// PATCH /api/lanes/:id/assign — Assign member (ADMIN)
const assignSchema = z.object({
  memberId: z.string().uuid(),
});

router.patch('/:id/assign', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = assignSchema.parse(req.body);

    const member = await prisma.user.findUnique({ where: { id: memberId } });
    if (!member) {
      res.status(404).json({ success: false, error: 'Membro nao encontrado' });
      return;
    }

    const lane = await prisma.lane.update({
      where: { id: req.params.id },
      data: {
        status: 'OCCUPIED',
        currentMemberId: memberId,
        sessionStartTime: new Date(),
      },
      include: { currentMember: { select: { id: true, fullName: true, memberNumber: true } } },
    });

    res.json({ success: true, data: lane });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao atribuir baia:', error);
    res.status(500).json({ success: false, error: 'Erro ao atribuir baia' });
  }
});

export default router;
