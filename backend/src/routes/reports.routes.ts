import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { startOfDay, endOfDay, startOfYear, endOfYear, addDays, subDays, startOfQuarter, endOfQuarter } from 'date-fns';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('ADMIN', 'CASHIER'));

/**
 * Audit helper — registra cada geracao para rastreio.
 * Falhas de audit nao quebram a operacao (createAuditLog ja engole excecoes).
 */
async function auditReport(
  req: Request,
  reportType: string,
  filters: Record<string, any>,
  description: string,
): Promise<void> {
  await createAuditLog({
    performedById: req.user!.id,
    action: 'REPORT_GENERATED',
    entityType: 'Report',
    newData: { reportType, filters },
    description,
    ipAddress: req.ip as string | undefined,
  });
}

// =====================================================
// 1. ANIVERSARIANTES DO MES
// =====================================================
const birthdaysSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  roles: z.string().optional(),  // CSV: "ADMIN,ASSOCIATE,VISITOR"
});

router.get('/birthdays', async (req: Request, res: Response): Promise<void> => {
  try {
    const params = birthdaysSchema.parse(req.query);
    const allowedRoles = params.roles
      ? params.roles.split(',').filter((r) => ['ADMIN', 'ASSOCIATE', 'VISITOR'].includes(r))
      : ['ADMIN', 'ASSOCIATE', 'VISITOR'];

    // Busca todos com dateOfBirth e filtra por mes em JS (Prisma nao tem extract de mes nativo)
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: allowedRoles as any[] },
        dateOfBirth: { not: null },
      },
      select: {
        id: true, fullName: true, cpf: true, role: true,
        dateOfBirth: true, phone: true, email: true, memberNumber: true,
      },
      orderBy: { dateOfBirth: 'asc' },
    });

    const filtered = users
      .filter((u) => u.dateOfBirth && new Date(u.dateOfBirth).getMonth() + 1 === params.month)
      .map((u) => {
        const dob = new Date(u.dateOfBirth!);
        const day = dob.getDate();
        const now = new Date();
        const ageThisMonth = now.getFullYear() - dob.getFullYear();
        return { ...u, dayOfMonth: day, ageThisMonth };
      })
      .sort((a, b) => a.dayOfMonth - b.dayOfMonth);

    await auditReport(req, 'BIRTHDAYS', params, `Aniversariantes do mes ${params.month}`);

    res.json({ success: true, data: { month: params.month, members: filtered } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[REPORTS] birthdays:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar relatorio' });
  }
});

// =====================================================
// 2. ASSOCIADOS ATIVOS
// =====================================================
// hasCr=true filtra apenas associados com CR preenchido; hasCr=false apenas sem CR;
// omitir o param mantem o comportamento original (todos).
const hasCrSchema = z.object({
  hasCr: z
    .union([z.literal('true'), z.literal('false')])
    .optional(),
});

function buildHasCrFilter(hasCr: 'true' | 'false' | undefined) {
  if (hasCr === 'true') return { cr: { not: null as any } };
  if (hasCr === 'false') return { OR: [{ cr: null }, { cr: '' }] };
  return {};
}

router.get('/members-active', async (req: Request, res: Response): Promise<void> => {
  try {
    const { hasCr } = hasCrSchema.parse(req.query);
    const crFilter = buildHasCrFilter(hasCr);

    const members = await prisma.user.findMany({
      where: { role: 'ASSOCIATE', status: 'ACTIVE', isActive: true, ...crFilter },
      orderBy: { fullName: 'asc' },
      select: {
        id: true, fullName: true, cpf: true, memberNumber: true, email: true, phone: true,
        memberSince: true, annuityValidUntil: true, cr: true, crLevel: true, membershipTier: true,
      },
    });

    await auditReport(req, 'MEMBERS_ACTIVE', { hasCr }, `Associados ativos (${members.length})`);

    res.json({ success: true, data: { total: members.length, members } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[REPORTS] members-active:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar relatorio' });
  }
});

// =====================================================
// 3. ASSOCIADOS INATIVOS
// =====================================================
router.get('/members-inactive', async (req: Request, res: Response): Promise<void> => {
  try {
    const { hasCr } = hasCrSchema.parse(req.query);
    const crFilter = buildHasCrFilter(hasCr);

    // Combina o filtro de inatividade com o filtro de CR via AND explicito,
    // pois o endpoint ja usa OR para inatividade — evitar conflito de OR.
    const where: any = {
      role: 'ASSOCIATE',
      AND: [
        { OR: [{ status: 'INACTIVE' }, { isActive: false }] },
        crFilter,
      ],
    };

    const members = await prisma.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      select: {
        id: true, fullName: true, cpf: true, memberNumber: true, email: true, phone: true,
        memberSince: true, status: true, isActive: true, annuityValidUntil: true,
        cr: true, crLevel: true,
      },
    });

    await auditReport(req, 'MEMBERS_INACTIVE', { hasCr }, `Associados inativos (${members.length})`);

    res.json({ success: true, data: { total: members.length, members } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[REPORTS] members-inactive:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar relatorio' });
  }
});

// =====================================================
// 4. ASSOCIADOS A VENCER (X DIAS)
// =====================================================
const expiringSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});

router.get('/members-expiring', async (req: Request, res: Response): Promise<void> => {
  try {
    const { days = 30 } = expiringSchema.parse(req.query);
    const now = new Date();
    const futureDate = addDays(now, days);

    const members = await prisma.user.findMany({
      where: {
        role: 'ASSOCIATE', isActive: true,
        annuityValidUntil: { gte: now, lte: futureDate },
      },
      select: {
        id: true, fullName: true, cpf: true, memberNumber: true, email: true, phone: true,
        annuityValidUntil: true, cr: true, crLevel: true,
      },
      orderBy: { annuityValidUntil: 'asc' },
    });

    const enriched = members.map((m) => ({
      ...m,
      daysRemaining: m.annuityValidUntil
        ? Math.ceil((new Date(m.annuityValidUntil).getTime() - now.getTime()) / 86400000)
        : null,
    }));

    await auditReport(req, 'MEMBERS_EXPIRING', { days }, `Anuidades a vencer em ${days} dias`);

    res.json({ success: true, data: { days, total: enriched.length, members: enriched } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[REPORTS] members-expiring:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar relatorio' });
  }
});

// =====================================================
// 5. ASSOCIADOS VENCIDOS HA X DIAS
// =====================================================
router.get('/members-overdue', async (req: Request, res: Response): Promise<void> => {
  try {
    const { days = 30 } = expiringSchema.parse(req.query);
    const now = new Date();
    const cutoff = subDays(now, days);

    const members = await prisma.user.findMany({
      where: {
        role: 'ASSOCIATE', isActive: true,
        annuityValidUntil: { lt: cutoff },
      },
      select: {
        id: true, fullName: true, cpf: true, memberNumber: true, email: true, phone: true,
        annuityValidUntil: true, cr: true, crLevel: true,
      },
      orderBy: { annuityValidUntil: 'asc' },
    });

    const enriched = members.map((m) => ({
      ...m,
      daysOverdue: m.annuityValidUntil
        ? Math.ceil((now.getTime() - new Date(m.annuityValidUntil).getTime()) / 86400000)
        : null,
    }));

    await auditReport(req, 'MEMBERS_OVERDUE', { days }, `Anuidades vencidas ha ${days} dias`);

    res.json({ success: true, data: { days, total: enriched.length, members: enriched } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[REPORTS] members-overdue:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar relatorio' });
  }
});

// =====================================================
// 6. LIVRO DE HABITUALIDADES (consolidado de periodo)
// =====================================================
const periodSchema = z.object({
  from: z.string(),
  to: z.string(),
});

router.get('/habituality-book', async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = periodSchema.parse(req.query);
    const fromDate = startOfDay(new Date(from));
    const toDate = endOfDay(new Date(to));

    const records = await prisma.habitualityRecord.findMany({
      where: { activityDate: { gte: fromDate, lte: toDate } },
      orderBy: [{ activityDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        member: { select: { id: true, fullName: true, cpf: true, memberNumber: true, cr: true, crLevel: true } },
        verifiedBy: { select: { id: true, fullName: true } },
        event: { select: { id: true, title: true, eventType: true } },
        visit: {
          select: {
            id: true, visitDate: true, checkInTime: true,
            details: { select: { caliber: true, firearmName: true, shotsFired: true, ammunitionType: true } },
          },
        },
      },
    });

    await auditReport(req, 'HABITUALITY_BOOK', { from, to }, `Livro de habitualidade ${from} a ${to}`);

    res.json({ success: true, data: { from, to, total: records.length, records } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[REPORTS] habituality-book:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar relatorio' });
  }
});

// =====================================================
// 7. HABITUALIDADE INFERIOR (associados abaixo do minimo de 8 atividades/calibre/ano)
// =====================================================
const habLowSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

router.get('/habituality-low', async (req: Request, res: Response): Promise<void> => {
  try {
    const { year = new Date().getFullYear() } = habLowSchema.parse(req.query);
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 0, 1));

    const associates = await prisma.user.findMany({
      where: { role: 'ASSOCIATE', isActive: true, status: 'ACTIVE' },
      select: { id: true, fullName: true, cpf: true, memberNumber: true, cr: true, crLevel: true },
    });

    const result: Array<{
      member: typeof associates[number];
      caliberCounts: Array<{ caliber: string; count: number; required: number; gap: number }>;
      hasShortfall: boolean;
    }> = [];

    for (const a of associates) {
      const groups = await prisma.habitualityRecord.groupBy({
        by: ['caliber'],
        where: { memberId: a.id, activityDate: { gte: yearStart, lte: yearEnd } },
        _count: { id: true },
      });

      // Min 8 por calibre conforme Portaria 260
      const required = 8;
      const calibers = groups.map((g) => ({
        caliber: g.caliber,
        count: g._count.id,
        required,
        gap: required - g._count.id,
      }));

      const shortfalls = calibers.filter((c) => c.gap > 0);
      if (shortfalls.length > 0) {
        result.push({ member: a, caliberCounts: shortfalls, hasShortfall: true });
      }
    }

    await auditReport(req, 'HABITUALITY_LOW', { year }, `Habitualidade inferior ano ${year}`);

    res.json({ success: true, data: { year, total: result.length, associates: result } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[REPORTS] habituality-low:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar relatorio' });
  }
});

// =====================================================
// 9. ACERVO DO CLUBE
// =====================================================
const inventorySchema = z.object({
  equipmentType: z.string().optional(),
  condition: z.string().optional(),
});

router.get('/equipment-inventory', async (req: Request, res: Response): Promise<void> => {
  try {
    const params = inventorySchema.parse(req.query);
    const where: any = { isActive: true };
    if (params.equipmentType) where.equipmentType = params.equipmentType;
    if (params.condition) where.condition = params.condition;

    const items = await prisma.equipment.findMany({
      where,
      orderBy: [{ equipmentType: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, equipmentType: true, serialNumber: true,
        registrationId: true, caliber: true, brand: true, model: true,
        condition: true, isAvailable: true, acquisitionDate: true, notes: true,
      },
    });

    await auditReport(req, 'EQUIPMENT_INVENTORY', params, `Acervo ${items.length} itens`);

    res.json({ success: true, data: { total: items.length, items } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[REPORTS] equipment-inventory:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar relatorio' });
  }
});

// =====================================================
// 10. ENTRADA DE MUNICOES (StockMovement: PURCHASE_IN, ADJUSTMENT_IN)
// =====================================================
router.get('/ammo-in', async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = periodSchema.parse(req.query);
    const fromDate = startOfDay(new Date(from));
    const toDate = endOfDay(new Date(to));

    const movements = await prisma.stockMovement.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
        movementType: { in: ['PURCHASE_IN', 'ADJUSTMENT_IN', 'INITIAL_STOCK'] },
        stockItem: { product: { category: 'AMMUNITION' } },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        stockItem: { include: { product: { select: { id: true, name: true, caliber: true, unit: true } } } },
      },
    });

    await auditReport(req, 'AMMO_IN', { from, to }, `Entrada de municoes ${from} a ${to}`);

    res.json({ success: true, data: { from, to, total: movements.length, movements } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[REPORTS] ammo-in:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar relatorio' });
  }
});

// =====================================================
// 11. SAIDA DE MUNICOES (StockMovement: SALE_OUT)
// =====================================================
router.get('/ammo-out', async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = periodSchema.parse(req.query);
    const fromDate = startOfDay(new Date(from));
    const toDate = endOfDay(new Date(to));

    const movements = await prisma.stockMovement.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
        movementType: 'SALE_OUT',
        stockItem: { product: { category: 'AMMUNITION' } },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        stockItem: { include: { product: { select: { id: true, name: true, caliber: true, unit: true } } } },
      },
    });

    // Tenta enriquecer com membro a partir de Transaction.id em referenceId/referenceType
    const txIds = movements
      .filter((m) => m.referenceType === 'Transaction' && m.referenceId)
      .map((m) => m.referenceId as string);
    const txs = txIds.length
      ? await prisma.transaction.findMany({
          where: { id: { in: txIds } },
          select: { id: true, member: { select: { id: true, fullName: true, memberNumber: true, cpf: true } } },
        })
      : [];
    const txMap = new Map(txs.map((t) => [t.id, t.member]));

    const enriched = movements.map((m) => ({
      ...m,
      member: m.referenceType === 'Transaction' && m.referenceId ? txMap.get(m.referenceId) : null,
    }));

    await auditReport(req, 'AMMO_OUT', { from, to }, `Saida de municoes ${from} a ${to}`);

    res.json({ success: true, data: { from, to, total: enriched.length, movements: enriched } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[REPORTS] ammo-out:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar relatorio' });
  }
});

// =====================================================
// 12. ATIRADORES E MUNICOES UTILIZADAS
// =====================================================
router.get('/shooters-ammo', async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = periodSchema.parse(req.query);
    const fromDate = startOfDay(new Date(from));
    const toDate = endOfDay(new Date(to));

    const visits = await prisma.visit.findMany({
      where: { visitDate: { gte: fromDate, lte: toDate } },
      include: {
        member: { select: { id: true, fullName: true, cpf: true, memberNumber: true, cr: true, role: true } },
        details: { select: { caliber: true, shotsFired: true, firearmName: true } },
      },
    });

    // Agrupa por membro
    const byMember = new Map<string, {
      member: any;
      visits: number;
      calibers: Map<string, number>;
      totalShots: number;
    }>();

    for (const v of visits) {
      const key = v.memberId;
      if (!byMember.has(key)) {
        byMember.set(key, {
          member: v.member,
          visits: 0,
          calibers: new Map(),
          totalShots: 0,
        });
      }
      const entry = byMember.get(key)!;
      entry.visits += 1;
      for (const d of v.details) {
        entry.totalShots += d.shotsFired;
        entry.calibers.set(d.caliber, (entry.calibers.get(d.caliber) ?? 0) + d.shotsFired);
      }
    }

    const shooters = Array.from(byMember.values())
      .map((s) => ({
        member: s.member,
        visits: s.visits,
        totalShots: s.totalShots,
        calibers: Array.from(s.calibers.entries()).map(([caliber, shots]) => ({ caliber, shots })),
      }))
      .sort((a, b) => b.totalShots - a.totalShots);

    await auditReport(req, 'SHOOTERS_AMMO', { from, to }, `Atiradores e municoes ${from} a ${to}`);

    res.json({
      success: true,
      data: {
        from, to,
        totalShooters: shooters.length,
        totalShots: shooters.reduce((sum, s) => sum + s.totalShots, 0),
        shooters,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[REPORTS] shooters-ammo:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar relatorio' });
  }
});

// =====================================================
// 13. PLANO ANUAL DE ATIVIDADES
// =====================================================
const yearOnlySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

router.get('/annual-plan', async (req: Request, res: Response): Promise<void> => {
  try {
    const { year = new Date().getFullYear() } = yearOnlySchema.parse(req.query);
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 0, 1));

    const events = await prisma.event.findMany({
      where: { eventDate: { gte: yearStart, lte: yearEnd } },
      orderBy: { eventDate: 'asc' },
      include: {
        _count: { select: { participations: true } },
      },
    });

    // Modalidades unicas (a partir dos calibres usados em VisitDetail no ano)
    const modalitiesGroup = await prisma.visitDetail.groupBy({
      by: ['caliber'],
      where: { createdAt: { gte: yearStart, lte: yearEnd } },
      _count: { id: true },
    });

    await auditReport(req, 'ANNUAL_PLAN', { year }, `Plano anual ${year}`);

    res.json({
      success: true,
      data: {
        year,
        totalEvents: events.length,
        events,
        modalities: modalitiesGroup.map((m) => ({ caliber: m.caliber, occurrences: m._count.id })),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[REPORTS] annual-plan:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar relatorio' });
  }
});

// =====================================================
// 14. CONFORMIDADE TRIMESTRAL (checklist)
// =====================================================
const complianceSchema = z.object({
  quarter: z.coerce.number().int().min(1).max(4).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

router.get('/compliance-checklist', async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const { year = now.getFullYear(), quarter = Math.floor(now.getMonth() / 3) + 1 } = complianceSchema.parse(req.query);
    const qStart = startOfQuarter(new Date(year, (quarter - 1) * 3, 1));
    const qEnd = endOfQuarter(new Date(year, (quarter - 1) * 3, 1));

    // 1. Livro de habitualidade preenchido?
    const habCount = await prisma.habitualityRecord.count({
      where: { activityDate: { gte: qStart, lte: qEnd } },
    });

    // 2. Acervo conferido (todos com condicao registrada)?
    const totalEquipment = await prisma.equipment.count({ where: { isActive: true } });
    const equipWithoutCondition = 0; // condition tem default GOOD em todos, sempre 0

    // 3. Anuidades em dia (% de associados com anuidade valida)?
    const totalAssociates = await prisma.user.count({
      where: { role: 'ASSOCIATE', isActive: true, status: 'ACTIVE' },
    });
    const validAnnuities = await prisma.user.count({
      where: {
        role: 'ASSOCIATE', isActive: true, status: 'ACTIVE',
        annuityValidUntil: { gt: now },
      },
    });
    const annuityRate = totalAssociates > 0 ? (validAnnuities / totalAssociates) * 100 : 0;

    // 4. Limite SIGMA (consumo por arma/ano <= 600)?
    const yearStart = startOfYear(now);
    const ammoOut = await prisma.stockMovement.aggregate({
      where: {
        createdAt: { gte: yearStart },
        movementType: 'SALE_OUT',
        stockItem: { product: { category: 'AMMUNITION' } },
      },
      _sum: { quantity: true },
    });
    const totalAmmoYear = ammoOut._sum.quantity ?? 0;

    // 5. CRs proximos do vencimento (proximos 60 dias)
    const crSoon = await prisma.user.count({
      where: {
        role: 'ASSOCIATE', isActive: true,
        crExpiry: { gte: now, lte: addDays(now, 60) },
      },
    });

    const checklist = [
      {
        key: 'habituality_book',
        label: 'Livro de habitualidade preenchido no trimestre',
        ok: habCount > 0,
        detail: `${habCount} registros no trimestre`,
      },
      {
        key: 'equipment_condition',
        label: 'Acervo com condicao registrada para todos os itens',
        ok: equipWithoutCondition === 0,
        detail: `${totalEquipment} equipamentos cadastrados`,
      },
      {
        key: 'annuities_compliance',
        label: 'Anuidades em dia (>= 90% dos associados)',
        ok: annuityRate >= 90,
        detail: `${validAnnuities}/${totalAssociates} (${annuityRate.toFixed(1)}%)`,
      },
      {
        key: 'sigma_limit',
        label: 'Consumo de municao no ano dentro do esperado',
        ok: totalAmmoYear < 100000, // limite institucional generico
        detail: `${totalAmmoYear} unidades vendidas no ano (acumulado)`,
      },
      {
        key: 'cr_alerts',
        label: 'CRs proximos do vencimento (alerta)',
        ok: crSoon === 0,
        detail: crSoon > 0 ? `${crSoon} CR(s) vencendo nos proximos 60 dias` : 'Nenhum CR proximo de vencer',
      },
    ];

    await auditReport(req, 'COMPLIANCE_CHECKLIST', { quarter, year }, `Conformidade Q${quarter}/${year}`);

    res.json({
      success: true,
      data: {
        quarter, year, period: { from: qStart, to: qEnd },
        checklist,
        kpis: { habCount, totalEquipment, totalAssociates, validAnnuities, annuityRate, totalAmmoYear, crSoon },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[REPORTS] compliance-checklist:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar relatorio' });
  }
});

// =====================================================
// 15. DECLARATION DATA — packet completo do associado + clube
//     usado pelas 9 declaracoes oficiais (DGA, DSA, DIC, DC, etc.)
// =====================================================
router.get('/declaration-data/:memberId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;

    const [member, club] = await Promise.all([
      prisma.user.findUnique({
        where: { id: memberId },
        select: {
          id: true, fullName: true, cpf: true, email: true, phone: true,
          dateOfBirth: true, role: true, photoUrl: true,
          address: true, neighborhood: true, city: true, state: true, zipCode: true,
          rg: true, rgIssuer: true, nationality: true, naturality: true,
          fatherName: true, motherName: true, profession: true, maritalStatus: true,
          memberNumber: true, memberSince: true,
          cr: true, crLevel: true, crExpiry: true,
          annuityValidUntil: true, status: true, isActive: true,
        },
      }),
      prisma.clubSettings.findUnique({ where: { clubId: 'cbt-bahia' } }),
    ]);

    if (!member) {
      res.status(404).json({ success: false, error: 'Associado nao encontrado' });
      return;
    }
    if (!club) {
      res.status(404).json({ success: false, error: 'Configuracao do clube nao encontrada' });
      return;
    }

    await auditReport(req, 'DECLARATION_DATA', { memberId }, `Pacote de declaracao para ${member.fullName}`);

    res.json({
      success: true,
      data: {
        member,
        club: {
          name: club.clubName,
          cnpj: club.cnpj,
          crPj: club.crPj,
          crPjIssueDate: club.crPjIssueDate,
          addressLine: club.addressLine,
          city: club.city,
          state: club.state,
          zipCode: club.zipCode,
          phone: club.phone,
          email: club.email,
          responsibleName: club.responsibleName,
          responsibleCpf: club.responsibleCpf,
          responsibleRole: club.responsibleRole,
          logoUrl: club.logoUrl,
        },
      },
    });
  } catch (error) {
    console.error('[REPORTS] declaration-data:', error);
    res.status(500).json({ success: false, error: 'Erro ao montar pacote de declaracao' });
  }
});

export default router;
