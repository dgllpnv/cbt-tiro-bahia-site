import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

// Acervo pessoal do associado (armas proprias). Admin/Caixa gerenciam;
// o proprio associado le apenas as suas (read-only no portal).
const router = Router();
router.use(authMiddleware);

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const FIREARM_CATEGORIES = ['PISTOL', 'REVOLVER', 'RIFLE', 'SHOTGUN'] as const;
const REGISTRATION_BODIES = ['EXERCITO', 'PF'] as const;

const createSchema = z.object({
  memberId: z.string().uuid(),
  category: z.enum(FIREARM_CATEGORIES, { errorMap: () => ({ message: 'Categoria de arma invalida' }) }),
  brand: z.string().max(80).optional().nullable(),
  model: z.string().max(80).optional().nullable(),
  caliber: z.string().max(40).optional().nullable(),
  serialNumber: z.string().max(60).optional().nullable(),
  registrationId: z.string().max(60).optional().nullable(),
  registrationBody: z.enum(REGISTRATION_BODIES).optional().nullable(),
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const updateSchema = createSchema.partial().omit({ memberId: true });

// =====================================================
// GET /api/member-firearms/member/:memberId — Lista armas ativas
// Admin/Caixa veem de qualquer membro; associado so as proprias.
// =====================================================

router.get('/member/:memberId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const role = req.user!.role;
    const isStaff = role === 'ADMIN' || role === 'CASHIER';

    if (!isStaff && req.user!.id !== memberId) {
      res.status(403).json({ success: false, error: 'Acesso negado' });
      return;
    }

    const firearms = await prisma.memberFirearm.findMany({
      where: { memberId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: firearms });
  } catch (error) {
    console.error('[FIREARMS] Erro ao listar armas:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar armas do associado' });
  }
});

// =====================================================
// POST /api/member-firearms — Cadastra arma (Admin/Caixa)
// =====================================================

router.post('/', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createSchema.parse(req.body);

    const member = await prisma.user.findUnique({
      where: { id: data.memberId },
      select: { id: true, fullName: true, isActive: true, role: true },
    });
    if (!member || !member.isActive) {
      res.status(404).json({ success: false, error: 'Associado nao encontrado ou inativo' });
      return;
    }
    if (member.role === 'VISITOR') {
      res.status(400).json({ success: false, error: 'Visitantes nao possuem acervo' });
      return;
    }

    const firearm = await prisma.memberFirearm.create({
      data: {
        memberId: data.memberId,
        category: data.category,
        brand: data.brand ?? null,
        model: data.model ?? null,
        caliber: data.caliber ?? null,
        serialNumber: data.serialNumber ?? null,
        registrationId: data.registrationId ?? null,
        registrationBody: data.registrationBody ?? null,
        acquisitionDate: data.acquisitionDate ? new Date(data.acquisitionDate) : null,
        notes: data.notes ?? null,
      },
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'CREATE',
      entityType: 'MemberFirearm',
      entityId: firearm.id,
      userId: data.memberId,
      newData: { category: firearm.category, model: firearm.model, serialNumber: firearm.serialNumber },
      description: `Arma cadastrada no acervo de ${member.fullName}`,
      ipAddress: req.ip as string | undefined,
    });

    res.status(201).json({ success: true, data: firearm });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message, details: error.errors });
      return;
    }
    console.error('[FIREARMS] Erro ao cadastrar arma:', error);
    res.status(500).json({ success: false, error: 'Erro ao cadastrar arma' });
  }
});

// =====================================================
// PATCH /api/member-firearms/:id — Edita arma (Admin/Caixa)
// =====================================================

router.patch('/:id', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = updateSchema.parse(req.body);

    const existing = await prisma.memberFirearm.findUnique({
      where: { id },
      select: { id: true, memberId: true },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Arma nao encontrada' });
      return;
    }

    const firearm = await prisma.memberFirearm.update({
      where: { id },
      data: {
        category: data.category,
        brand: data.brand,
        model: data.model,
        caliber: data.caliber,
        serialNumber: data.serialNumber,
        registrationId: data.registrationId,
        registrationBody: data.registrationBody,
        acquisitionDate:
          data.acquisitionDate === undefined
            ? undefined
            : data.acquisitionDate
              ? new Date(data.acquisitionDate)
              : null,
        notes: data.notes,
      },
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'UPDATE',
      entityType: 'MemberFirearm',
      entityId: id,
      userId: existing.memberId,
      newData: { category: firearm.category, model: firearm.model },
      description: `Arma do acervo atualizada`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: firearm });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message, details: error.errors });
      return;
    }
    console.error('[FIREARMS] Erro ao editar arma:', error);
    res.status(500).json({ success: false, error: 'Erro ao editar arma' });
  }
});

// =====================================================
// DELETE /api/member-firearms/:id — Soft delete (Admin/Caixa)
// =====================================================

router.delete('/:id', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.memberFirearm.findUnique({
      where: { id },
      select: { id: true, memberId: true, model: true },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Arma nao encontrada' });
      return;
    }

    await prisma.memberFirearm.update({ where: { id }, data: { isActive: false } });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'DELETE',
      entityType: 'MemberFirearm',
      entityId: id,
      userId: existing.memberId,
      previousData: { isActive: true },
      newData: { isActive: false },
      description: `Arma removida do acervo`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: { id, isActive: false } });
  } catch (error) {
    console.error('[FIREARMS] Erro ao remover arma:', error);
    res.status(500).json({ success: false, error: 'Erro ao remover arma' });
  }
});

export default router;
