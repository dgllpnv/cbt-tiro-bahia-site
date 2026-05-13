import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Auditoria restrita a ADMIN — cashier nao precisa ver logs do sistema.
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// =====================================================
// GET /api/audit-logs — List audit logs
// =====================================================
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const action = req.query.action as string | undefined;
    const entityType = req.query.entityType as string | undefined;
    const performedById = req.query.performedById as string | undefined;
    const userId = req.query.userId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const where: any = {};

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (performedById) {
      where.performedById = performedById;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          performedBy: {
            select: { id: true, fullName: true },
          },
          user: {
            select: { id: true, fullName: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao listar logs de auditoria:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar logs de auditoria' });
  }
});

// =====================================================
// GET /api/audit-logs/:id — Single audit log detail
// =====================================================
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const log = await prisma.auditLog.findUnique({
      where: { id: req.params.id },
      include: {
        performedBy: {
          select: { id: true, fullName: true },
        },
        user: {
          select: { id: true, fullName: true },
        },
      },
    });

    if (!log) {
      res.status(404).json({ success: false, error: 'Log de auditoria nao encontrado' });
      return;
    }

    res.json({ success: true, data: log });
  } catch (error) {
    console.error('Erro ao buscar log de auditoria:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar log de auditoria' });
  }
});

export default router;
