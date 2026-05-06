import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);

const CLUB_ID = 'cbt-bahia';

// =====================================================
// GET /api/club-settings — qualquer usuario autenticado le
// =====================================================
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.clubSettings.findUnique({
      where: { clubId: CLUB_ID },
    });

    if (!settings) {
      res.status(404).json({ success: false, error: 'Configuracoes do clube nao encontradas' });
      return;
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('[CLUB_SETTINGS] Erro ao ler configuracoes:', error);
    res.status(500).json({ success: false, error: 'Erro ao ler configuracoes do clube' });
  }
});

// =====================================================
// PATCH /api/club-settings — apenas ADMIN
// =====================================================
const updateSchema = z.object({
  clubName: z.string().min(2).optional(),
  annuityAmount: z.number().min(0).optional(),
  totalLanes: z.number().int().min(1).optional(),
  logoUrl: z.string().nullable().optional(),

  cnpj: z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ deve ter o formato 00.000.000/0001-00')
    .nullable()
    .optional(),
  crPj: z.string().max(50).nullable().optional(),
  crPjIssueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, 'Data invalida')
    .nullable()
    .optional(),
  addressLine: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().length(2, 'UF deve ter 2 caracteres').nullable().optional(),
  zipCode: z
    .string()
    .regex(/^\d{5}-\d{3}$/, 'CEP deve ter o formato 00000-000')
    .nullable()
    .optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email('E-mail invalido').nullable().optional(),
  responsibleName: z.string().nullable().optional(),
  responsibleCpf: z
    .string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF deve ter o formato 000.000.000-00')
    .nullable()
    .optional(),
  responsibleRole: z.string().nullable().optional(),
});

router.patch('/', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = updateSchema.parse(req.body);

    const existing = await prisma.clubSettings.findUnique({ where: { clubId: CLUB_ID } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Configuracoes do clube nao encontradas' });
      return;
    }

    const updateData: any = { ...data };
    if (data.crPjIssueDate !== undefined) {
      updateData.crPjIssueDate = data.crPjIssueDate ? new Date(data.crPjIssueDate) : null;
    }

    const updated = await prisma.clubSettings.update({
      where: { clubId: CLUB_ID },
      data: updateData,
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'UPDATE',
      entityType: 'ClubSettings',
      entityId: updated.id,
      previousData: existing,
      newData: updated,
      description: 'Configuracoes do clube atualizadas',
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message, details: error.errors });
      return;
    }
    console.error('[CLUB_SETTINGS] Erro ao atualizar configuracoes:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar configuracoes do clube' });
  }
});

export default router;
