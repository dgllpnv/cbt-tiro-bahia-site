import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();

// All routes require authentication + ADMIN role
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createEquipmentSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  equipmentType: z.enum(
    ['FIREARM', 'HOLSTER', 'EAR_PROTECTION', 'EYE_PROTECTION', 'MAGAZINE', 'OTHER'],
    { errorMap: () => ({ message: 'Tipo de equipamento invalido' }) },
  ),
  serialNumber: z.string().optional(),
  registrationId: z.string().optional(),
  caliber: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  condition: z.enum(
    ['EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_REPAIR', 'DECOMMISSIONED'],
    { errorMap: () => ({ message: 'Condicao invalida' }) },
  ).optional(),
  isAvailable: z.boolean().optional(),
  notes: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  metadata: z.any().optional(),
});

const updateEquipmentSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  description: z.string().nullable().optional(),
  equipmentType: z.enum(
    ['FIREARM', 'HOLSTER', 'EAR_PROTECTION', 'EYE_PROTECTION', 'MAGAZINE', 'OTHER'],
  ).optional(),
  serialNumber: z.string().nullable().optional(),
  registrationId: z.string().nullable().optional(),
  caliber: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  condition: z.enum(
    ['EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_REPAIR', 'DECOMMISSIONED'],
  ).optional(),
  isAvailable: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional().or(z.literal('')),
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  metadata: z.any().optional(),
});

const updateConditionSchema = z.object({
  condition: z.enum(
    ['EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_REPAIR', 'DECOMMISSIONED'],
    { errorMap: () => ({ message: 'Condicao invalida' }) },
  ),
});

// =====================================================
// GET / — List equipment
// Query params: equipmentType, isAvailable, isActive, condition, search,
//               includeActiveLoans (=true para incluir loan ativo + member)
// =====================================================

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const { equipmentType, isAvailable, isActive, condition, search, includeActiveLoans } = req.query;

    const where: any = {};

    if (isActive !== undefined && typeof isActive === 'string') {
      where.isActive = isActive === 'true';
    }

    if (equipmentType && typeof equipmentType === 'string') {
      where.equipmentType = equipmentType;
    }

    if (isAvailable !== undefined && typeof isAvailable === 'string') {
      where.isAvailable = isAvailable === 'true';
    }

    if (condition && typeof condition === 'string') {
      where.condition = condition;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { serialNumber: { contains: searchTerm, mode: 'insensitive' } },
        { brand: { contains: searchTerm, mode: 'insensitive' } },
        { model: { contains: searchTerm, mode: 'insensitive' } },
        { caliber: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const include = includeActiveLoans === 'true'
      ? {
          loans: {
            where: { status: 'ACTIVE' as const },
            take: 1,
            include: {
              member: {
                select: { id: true, fullName: true, memberNumber: true, role: true },
              },
            },
          },
        }
      : undefined;

    const [equipment, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include,
      }),
      prisma.equipment.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: equipment,
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
    console.error('[EQUIPMENT] Erro ao listar equipamentos:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar equipamentos' });
  }
});

// =====================================================
// GET /dashboard — KPIs e agregados de equipamentos
// Query: from, to (default ultimos 30 dias)
// IMPORTANTE: precisa vir ANTES de GET /:id para nao colidir
// =====================================================

router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const from = req.query.from ? new Date(req.query.from as string) : defaultFrom;
    const to = req.query.to ? new Date(req.query.to as string) : now;

    const [
      activeLoans,
      overdueLoans,
      totalEquipment,
      inUse,
      available,
      needsRepair,
      byTypeRaw,
      byConditionRaw,
      topUsedRaw,
      recentMovements,
    ] = await Promise.all([
      prisma.equipmentLoan.count({ where: { status: 'ACTIVE' } }),
      prisma.equipmentLoan.count({
        where: { status: 'ACTIVE', expectedReturn: { lt: now, not: null } },
      }),
      prisma.equipment.count({ where: { isActive: true } }),
      prisma.equipment.count({ where: { isActive: true, isAvailable: false } }),
      prisma.equipment.count({ where: { isActive: true, isAvailable: true } }),
      prisma.equipment.count({
        where: { isActive: true, condition: { in: ['NEEDS_REPAIR', 'DECOMMISSIONED'] } },
      }),
      prisma.equipment.groupBy({
        by: ['equipmentType'],
        where: { isActive: true },
        _count: { _all: true },
      }),
      prisma.equipment.groupBy({
        by: ['condition'],
        where: { isActive: true },
        _count: { _all: true },
      }),
      prisma.equipmentLoan.groupBy({
        by: ['equipmentId'],
        where: { loanDate: { gte: from, lte: to } },
        _count: { _all: true },
        orderBy: { _count: { equipmentId: 'desc' } },
        take: 10,
      }),
      prisma.equipmentLoan.findMany({
        orderBy: { loanDate: 'desc' },
        take: 20,
        include: {
          equipment: { select: { id: true, name: true, equipmentType: true } },
          member: { select: { id: true, fullName: true, memberNumber: true, role: true } },
          issuedBy: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    // Para byType com inUse/available, fazer queries adicionais por tipo
    const byTypeWithStatus = await Promise.all(
      byTypeRaw.map(async (t) => {
        const [typeInUse, typeAvailable] = await Promise.all([
          prisma.equipment.count({
            where: { isActive: true, isAvailable: false, equipmentType: t.equipmentType },
          }),
          prisma.equipment.count({
            where: { isActive: true, isAvailable: true, equipmentType: t.equipmentType },
          }),
        ]);
        return {
          equipmentType: t.equipmentType,
          total: t._count._all,
          inUse: typeInUse,
          available: typeAvailable,
        };
      }),
    );

    // Hidrata topUsed com nome e tipo do equipamento
    const topUsedIds = topUsedRaw.map((t) => t.equipmentId);
    const topEquipment = topUsedIds.length
      ? await prisma.equipment.findMany({
          where: { id: { in: topUsedIds } },
          select: { id: true, name: true, equipmentType: true },
        })
      : [];
    const topEquipmentMap = new Map(topEquipment.map((e) => [e.id, e]));
    const topUsed = topUsedRaw
      .map((t) => {
        const eq = topEquipmentMap.get(t.equipmentId);
        return eq
          ? {
              equipment: eq,
              loanCount: t._count._all,
            }
          : null;
      })
      .filter(Boolean);

    const totalForUtilization = inUse + available;
    const utilizationPct = totalForUtilization > 0 ? (inUse / totalForUtilization) * 100 : 0;

    res.json({
      success: true,
      data: {
        period: { from, to },
        totals: {
          activeLoans,
          overdueLoans,
          totalEquipment,
          inUse,
          available,
          needsRepair,
        },
        utilizationPct,
        byType: byTypeWithStatus,
        byCondition: byConditionRaw.map((c) => ({
          condition: c.condition,
          count: c._count._all,
        })),
        topUsed,
        recentMovements,
      },
    });
  } catch (error) {
    console.error('[EQUIPMENT] Erro no dashboard:', error);
    res.status(500).json({ success: false, error: 'Erro ao carregar dashboard de equipamentos' });
  }
});

// =====================================================
// GET /:id — Get equipment by ID (with loan history limitado a 10)
// =====================================================

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        loans: {
          orderBy: { loanDate: 'desc' },
          take: 10,
          include: {
            member: {
              select: { id: true, fullName: true, memberNumber: true, role: true },
            },
            issuedBy: {
              select: { id: true, fullName: true },
            },
            returnedBy: {
              select: { id: true, fullName: true },
            },
            transferredFrom: {
              select: { id: true, member: { select: { id: true, fullName: true } } },
            },
          },
        },
      },
    });

    if (!equipment) {
      res.status(404).json({ success: false, error: 'Equipamento nao encontrado' });
      return;
    }

    res.json({ success: true, data: equipment });
  } catch (error) {
    console.error('[EQUIPMENT] Erro ao buscar equipamento:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar equipamento' });
  }
});

// =====================================================
// GET /:id/history — Historico completo de loans do equipamento
// Query: from, to, memberId
// =====================================================

router.get('/:id/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const equipment = await prisma.equipment.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!equipment) {
      res.status(404).json({ success: false, error: 'Equipamento nao encontrado' });
      return;
    }

    const where: any = { equipmentId: id };

    if (req.query.from || req.query.to) {
      where.loanDate = {};
      if (req.query.from) where.loanDate.gte = new Date(req.query.from as string);
      if (req.query.to) where.loanDate.lte = new Date(req.query.to as string);
    }

    if (req.query.memberId) {
      where.memberId = req.query.memberId as string;
    }

    const loans = await prisma.equipmentLoan.findMany({
      where,
      orderBy: { loanDate: 'desc' },
      include: {
        member: { select: { id: true, fullName: true, memberNumber: true, role: true } },
        issuedBy: { select: { id: true, fullName: true } },
        returnedBy: { select: { id: true, fullName: true } },
        transferredFrom: {
          select: { id: true, member: { select: { id: true, fullName: true } } },
        },
      },
    });

    res.json({ success: true, data: { equipment, loans } });
  } catch (error) {
    console.error('[EQUIPMENT] Erro ao buscar historico:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar historico do equipamento' });
  }
});

// =====================================================
// POST / — Create equipment
// =====================================================

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = createEquipmentSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
        details: validation.error.errors,
      });
      return;
    }

    const data = validation.data;

    // Check serial number uniqueness if provided
    if (data.serialNumber) {
      const existingSerial = await prisma.equipment.findUnique({
        where: { serialNumber: data.serialNumber },
        select: { id: true },
      });

      if (existingSerial) {
        res.status(409).json({ success: false, error: 'Numero de serie ja esta em uso' });
        return;
      }
    }

    const equipment = await prisma.equipment.create({
      data: {
        name: data.name,
        description: data.description || null,
        equipmentType: data.equipmentType,
        serialNumber: data.serialNumber || null,
        registrationId: data.registrationId || null,
        caliber: data.caliber || null,
        brand: data.brand || null,
        model: data.model || null,
        condition: data.condition || 'GOOD',
        isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
        notes: data.notes || null,
        imageUrl: data.imageUrl === '' ? null : data.imageUrl || null,
        acquisitionDate: data.acquisitionDate ? new Date(data.acquisitionDate) : null,
        metadata: data.metadata || null,
      },
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'CREATE',
      entityType: 'Equipment',
      entityId: equipment.id,
      newData: {
        name: equipment.name,
        equipmentType: equipment.equipmentType,
        serialNumber: equipment.serialNumber,
        condition: equipment.condition,
      },
      description: `Equipamento ${equipment.name} cadastrado por ${req.user!.email}`,
      ipAddress: req.ip as string | undefined,
    });

    res.status(201).json({ success: true, data: equipment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('[EQUIPMENT] Erro ao criar equipamento:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar equipamento' });
  }
});

// =====================================================
// PUT /:id — Update equipment
// =====================================================

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.equipment.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Equipamento nao encontrado' });
      return;
    }

    const validation = updateEquipmentSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
        details: validation.error.errors,
      });
      return;
    }

    const data = validation.data;

    // Check serial number uniqueness if changed
    if (data.serialNumber && data.serialNumber !== existing.serialNumber) {
      const existingSerial = await prisma.equipment.findFirst({
        where: { serialNumber: data.serialNumber, id: { not: id } },
        select: { id: true },
      });

      if (existingSerial) {
        res.status(409).json({ success: false, error: 'Numero de serie ja esta em uso' });
        return;
      }
    }

    const updateData: any = { ...data };

    if (data.acquisitionDate !== undefined) {
      updateData.acquisitionDate = data.acquisitionDate ? new Date(data.acquisitionDate) : null;
    }
    if (data.imageUrl === '') {
      updateData.imageUrl = null;
    }

    const equipment = await prisma.equipment.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'UPDATE',
      entityType: 'Equipment',
      entityId: id,
      previousData: {
        name: existing.name,
        condition: existing.condition,
        serialNumber: existing.serialNumber,
        isAvailable: existing.isAvailable,
      },
      newData: {
        name: equipment.name,
        condition: equipment.condition,
        serialNumber: equipment.serialNumber,
        isAvailable: equipment.isAvailable,
      },
      description: `Equipamento ${equipment.name} atualizado por ${req.user!.email}`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: equipment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('[EQUIPMENT] Erro ao atualizar equipamento:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar equipamento' });
  }
});

// =====================================================
// PATCH /:id/condition — Update condition only
// =====================================================

router.patch('/:id/condition', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.equipment.findUnique({
      where: { id },
      select: { id: true, name: true, condition: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Equipamento nao encontrado' });
      return;
    }

    const validation = updateConditionSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
      return;
    }

    const { condition } = validation.data;

    const equipment = await prisma.equipment.update({
      where: { id },
      data: { condition },
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'STATUS_CHANGE',
      entityType: 'Equipment',
      entityId: id,
      previousData: { condition: existing.condition },
      newData: { condition },
      description: `Condicao de ${existing.name} alterada de ${existing.condition} para ${condition}`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: equipment });
  } catch (error) {
    console.error('[EQUIPMENT] Erro ao atualizar condicao:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar condicao do equipamento' });
  }
});

// =====================================================
// DELETE /:id — Soft delete (isActive=false, isAvailable=false)
// =====================================================

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.equipment.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true, isAvailable: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Equipamento nao encontrado' });
      return;
    }

    const equipment = await prisma.equipment.update({
      where: { id },
      data: {
        isActive: false,
        isAvailable: false,
      },
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'DELETE',
      entityType: 'Equipment',
      entityId: id,
      previousData: { isActive: existing.isActive, isAvailable: existing.isAvailable },
      newData: { isActive: false, isAvailable: false },
      description: `Equipamento ${existing.name} desativado (soft delete) por ${req.user!.email}`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: equipment });
  } catch (error) {
    console.error('[EQUIPMENT] Erro ao excluir equipamento:', error);
    res.status(500).json({ success: false, error: 'Erro ao excluir equipamento' });
  }
});

export default router;
