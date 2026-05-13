import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import {
  startOfDay, endOfDay,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  addDays, differenceInDays, subYears,
} from 'date-fns';
import {
  POPULAR_FIREARMS,
  getFirearmCategory,
  getFirearmsInCategory,
  type FirearmCategory,
} from '../lib/firearmsCatalog.js';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// =====================================================
// GET /api/dashboard/associate — Associate dashboard
// =====================================================
router.get('/associate', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const yearStart = startOfYear(now);
    const yearEnd = endOfYear(now);

    const [recentNews, myVisitsCount, shotsResult, userData] = await Promise.all([
      // Last 5 published news
      prisma.news.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          summary: true,
          publishedAt: true,
          imageUrl: true,
        },
      }),

      // Count of visits this year
      prisma.visit.count({
        where: {
          memberId: userId,
          visitDate: { gte: yearStart, lte: yearEnd },
        },
      }),

      // Total shots fired (sum of all visitDetail.shotsFired)
      prisma.visitDetail.aggregate({
        where: { memberId: userId },
        _sum: { shotsFired: true },
      }),

      // User data for annuity status
      prisma.user.findUnique({
        where: { id: userId },
        select: { annuityValidUntil: true },
      }),
    ]);

    // Annuity status calculation
    let annuityStatus: {
      validUntil: Date | null;
      daysRemaining: number | null;
      isExpired: boolean;
    } = {
      validUntil: null,
      daysRemaining: null,
      isExpired: true,
    };

    if (userData?.annuityValidUntil) {
      const validUntil = userData.annuityValidUntil;
      const daysRemaining = differenceInDays(validUntil, now);
      annuityStatus = {
        validUntil,
        daysRemaining: Math.max(0, daysRemaining),
        isExpired: daysRemaining < 0,
      };
    }

    res.json({
      success: true,
      data: {
        recentNews,
        myVisits: myVisitsCount,
        totalShots: shotsResult._sum.shotsFired || 0,
        annuityStatus,
        habitualitySummary: [],
      },
    });
  } catch (error) {
    console.error('Erro ao buscar dashboard do associado:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar dashboard do associado' });
  }
});

// =====================================================
// GET /api/dashboard/admin — Admin dashboard (ADMIN only)
// =====================================================
router.get('/admin', requireRole('ADMIN', 'CASHIER'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const thirtyDaysFromNow = addDays(now, 30);

    const [
      activeMembers,
      todayVisits,
      monthRevenueResult,
      lowStockCount,
      activeLoans,
      expiringAnnuities,
    ] = await Promise.all([
      // Active associates count
      prisma.user.count({
        where: { status: 'ACTIVE', role: 'ASSOCIATE' },
      }),

      // Visits today
      prisma.visit.count({
        where: {
          visitDate: { gte: todayStart, lte: todayEnd },
        },
      }),

      // Revenue this month (apenas vendas finalizadas)
      prisma.transaction.aggregate({
        where: {
          transactionDate: { gte: monthStart, lte: monthEnd },
          status: 'COMPLETED',
        },
        _sum: { totalAmount: true },
      }),

      // Low stock items — fetch all and filter in app layer (comparing two columns)
      prisma.stockItem.findMany({
        select: { currentStock: true, minimumStock: true },
      }),

      // Active equipment loans
      prisma.equipmentLoan.count({
        where: { status: 'ACTIVE' },
      }),

      // Annuities expiring within 30 days
      prisma.user.count({
        where: {
          annuityValidUntil: {
            gte: now,
            lte: thirtyDaysFromNow,
          },
        },
      }),
    ]);

    // Count low stock items (currentStock <= minimumStock)
    const lowStockItemCount = (lowStockCount as Array<{ currentStock: number; minimumStock: number }>)
      .filter((item) => item.currentStock <= item.minimumStock).length;

    res.json({
      success: true,
      data: {
        activeMembers,
        todayVisits,
        monthRevenue: Number(monthRevenueResult._sum.totalAmount || 0),
        lowStockCount: lowStockItemCount,
        activeLoans,
        expiringAnnuities,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar dashboard administrativo:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar dashboard administrativo' });
  }
});

// =====================================================
// GET /api/dashboard/rankings — Top members by frequency / mastery (ADMIN)
// =====================================================
router.get('/rankings', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const period = (req.query.period as string) || 'month';
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 5));
    const firearmCategory = req.query.firearmCategory as FirearmCategory | undefined;
    const firearmName = req.query.firearmName as string | undefined;

    const now = new Date();
    let periodStart: Date;
    if (period === 'year') periodStart = startOfYear(now);
    else if (period === 'all') periodStart = subYears(now, 50);
    else periodStart = startOfMonth(now);

    // Build firearm filter for mastery aggregation
    const detailWhere: any = { createdAt: { gte: periodStart } };
    if (firearmName) {
      detailWhere.firearmName = firearmName;
    } else if (firearmCategory) {
      const allowedNames = getFirearmsInCategory(firearmCategory);
      if (allowedNames.length > 0) {
        detailWhere.firearmName = { in: allowedNames };
      }
    }

    const [visitGroup, detailGroup] = await Promise.all([
      prisma.visit.groupBy({
        by: ['memberId'],
        where: { visitDate: { gte: periodStart } },
        _count: { _all: true },
        orderBy: { _count: { memberId: 'desc' } },
        take: limit,
      }),
      prisma.visitDetail.groupBy({
        by: ['memberId'],
        where: detailWhere,
        _sum: { shotsFired: true },
        orderBy: { _sum: { shotsFired: 'desc' } },
        take: limit,
      }),
    ]);

    const memberIds = Array.from(
      new Set([...visitGroup.map((v) => v.memberId), ...detailGroup.map((d) => d.memberId)]),
    );

    const members = memberIds.length
      ? await prisma.user.findMany({
          where: { id: { in: memberIds } },
          select: {
            id: true,
            fullName: true,
            memberNumber: true,
            photoUrl: true,
            // Avatar do dashboard puxa do FaceProfile mais recente — mesma fonte
            // usada na listagem de associados e nos cards de presentes.
            faceProfiles: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' as const },
              take: 1,
              select: { thumbnail: true },
            },
          },
        })
      : [];
    const byId = new Map(members.map((m) => [m.id, m]));
    const facePhotoFor = (memberId: string): string | null => {
      const m = byId.get(memberId);
      return m?.faceProfiles?.[0]?.thumbnail ?? null;
    };

    const byFrequency = visitGroup
      .filter((v) => byId.has(v.memberId))
      .map((v) => ({
        memberId: v.memberId,
        fullName: byId.get(v.memberId)!.fullName,
        memberNumber: byId.get(v.memberId)!.memberNumber,
        photoUrl: byId.get(v.memberId)!.photoUrl,
        facePhoto: facePhotoFor(v.memberId),
        visitCount: v._count._all,
      }));

    const byMastery = detailGroup
      .filter((d) => byId.has(d.memberId))
      .map((d) => ({
        memberId: d.memberId,
        fullName: byId.get(d.memberId)!.fullName,
        memberNumber: byId.get(d.memberId)!.memberNumber,
        photoUrl: byId.get(d.memberId)!.photoUrl,
        facePhoto: facePhotoFor(d.memberId),
        totalShots: d._sum.shotsFired || 0,
      }));

    res.json({
      success: true,
      data: {
        byFrequency,
        byMastery,
        period,
        firearmCategory: firearmCategory ?? null,
        firearmName: firearmName ?? null,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar rankings:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar rankings' });
  }
});

// =====================================================
// GET /api/dashboard/top-firearms — most-used firearms (ADMIN)
// =====================================================
router.get('/top-firearms', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const period = (req.query.period as string) || 'month';
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 10));

    const now = new Date();
    let periodStart: Date;
    if (period === 'day') periodStart = startOfDay(now);
    else if (period === 'year') periodStart = startOfYear(now);
    else periodStart = startOfMonth(now);

    const detailGroup = await prisma.visitDetail.groupBy({
      by: ['firearmName'],
      where: {
        createdAt: { gte: periodStart },
        firearmName: { not: null },
      },
      _sum: { shotsFired: true },
      _count: { _all: true },
      orderBy: { _sum: { shotsFired: 'desc' } },
      take: limit,
    });

    const topFirearms = detailGroup
      .filter((g) => g.firearmName)
      .map((g) => ({
        firearmName: g.firearmName as string,
        category: getFirearmCategory(g.firearmName),
        totalShots: g._sum.shotsFired ?? 0,
        uses: g._count._all,
      }));

    res.json({
      success: true,
      data: { topFirearms, period },
    });
  } catch (error) {
    console.error('Erro ao buscar top firearms:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar armas mais usadas' });
  }
});

export default router;
