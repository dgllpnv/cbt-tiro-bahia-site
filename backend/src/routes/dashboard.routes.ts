import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import {
  startOfDay, endOfDay,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  addDays, differenceInDays,
} from 'date-fns';

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
router.get('/admin', requireRole('ADMIN'), async (_req: Request, res: Response): Promise<void> => {
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

      // Revenue this month
      prisma.transaction.aggregate({
        where: {
          transactionDate: { gte: monthStart, lte: monthEnd },
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

export default router;
