import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { differenceInMonths, subYears } from 'date-fns';
import { getFirearmCategory } from '../lib/firearmsCatalog.js';

const router = Router();

router.use(authMiddleware);

// =====================================================
// GET /api/users/:id/stats — Aggregated profile stats
// =====================================================

router.get('/:id/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Permission: ADMIN or self
    if (req.user!.role !== 'ADMIN' && req.user!.id !== id) {
      res.status(403).json({ success: false, error: 'Acesso negado.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, memberSince: true, fullName: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'Usuario nao encontrado' });
      return;
    }

    const now = new Date();
    const oneYearAgo = subYears(now, 1);

    const [
      totalVisitsCount,
      visitsLast12,
      shotsAggregate,
      shotsByCaliberRaw,
      shotsByFirearmRaw,
      visitsForDuration,
      ammoTxItems,
      recentVisitsRaw,
    ] = await Promise.all([
      prisma.visit.count({ where: { memberId: id } }),
      prisma.visit.count({ where: { memberId: id, visitDate: { gte: oneYearAgo } } }),
      prisma.visitDetail.aggregate({
        where: { memberId: id },
        _sum: { shotsFired: true },
      }),
      prisma.visitDetail.groupBy({
        by: ['caliber'],
        where: { memberId: id },
        _sum: { shotsFired: true },
        orderBy: { _sum: { shotsFired: 'desc' } },
      }),
      prisma.visitDetail.groupBy({
        by: ['firearmName'],
        where: { memberId: id, firearmName: { not: null } },
        _sum: { shotsFired: true },
        orderBy: { _sum: { shotsFired: 'desc' } },
        take: 8,
      }),
      prisma.visit.findMany({
        where: { memberId: id, checkOutTime: { not: null } },
        select: { checkInTime: true, checkOutTime: true },
        take: 100,
        orderBy: { visitDate: 'desc' },
      }),
      prisma.transactionItem.findMany({
        where: {
          transaction: { memberId: id },
          product: { category: 'AMMUNITION' },
        },
        select: {
          quantity: true,
          subtotal: true,
          product: { select: { name: true, caliber: true } },
        },
      }),
      prisma.visit.findMany({
        where: { memberId: id },
        orderBy: { visitDate: 'desc' },
        take: 5,
        include: {
          details: { select: { shotsFired: true } },
          lane: { select: { name: true } },
        },
      }),
    ]);

    const totalShots = shotsAggregate._sum.shotsFired ?? 0;

    const shotsByCaliber = shotsByCaliberRaw.map((row) => {
      const shots = row._sum.shotsFired ?? 0;
      return {
        caliber: row.caliber,
        shots,
        percentage: totalShots > 0 ? Number(((shots / totalShots) * 100).toFixed(1)) : 0,
      };
    });

    const shotsByFirearmTotal = shotsByFirearmRaw.reduce(
      (acc, row) => acc + (row._sum.shotsFired ?? 0),
      0,
    );
    const shotsByFirearm = shotsByFirearmRaw
      .filter((row) => row.firearmName)
      .map((row) => {
        const shots = row._sum.shotsFired ?? 0;
        return {
          firearmName: row.firearmName as string,
          category: getFirearmCategory(row.firearmName),
          shots,
          percentage:
            shotsByFirearmTotal > 0
              ? Number(((shots / shotsByFirearmTotal) * 100).toFixed(1))
              : 0,
        };
      });

    // Average duration in minutes
    let averageVisitDuration = 0;
    if (visitsForDuration.length > 0) {
      const totalMinutes = visitsForDuration.reduce((acc, v) => {
        if (v.checkOutTime && v.checkInTime) {
          return acc + (v.checkOutTime.getTime() - v.checkInTime.getTime()) / 60000;
        }
        return acc;
      }, 0);
      averageVisitDuration = Math.round(totalMinutes / visitsForDuration.length);
    }

    // Aggregate ammo transactions by product name
    const ammoMap = new Map<string, { productName: string; totalQuantity: number; totalSpent: number; caliber: string | null }>();
    for (const item of ammoTxItems) {
      const key = item.product?.name ?? 'Munição';
      const existing = ammoMap.get(key);
      const qty = Number(item.quantity);
      const spent = Number(item.subtotal);
      if (existing) {
        existing.totalQuantity += qty;
        existing.totalSpent += spent;
      } else {
        ammoMap.set(key, {
          productName: key,
          totalQuantity: qty,
          totalSpent: spent,
          caliber: item.product?.caliber ?? null,
        });
      }
    }
    const ammoSpentByType = Array.from(ammoMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);

    const recentVisits = recentVisitsRaw.map((v) => {
      const duration =
        v.checkOutTime && v.checkInTime
          ? Math.round((v.checkOutTime.getTime() - v.checkInTime.getTime()) / 60000)
          : null;
      const visitShots = v.details.reduce((acc, d) => acc + (d.shotsFired ?? 0), 0);
      return {
        id: v.id,
        visitDate: v.visitDate,
        checkInTime: v.checkInTime,
        checkOutTime: v.checkOutTime,
        durationMinutes: duration,
        shotsFired: visitShots,
        laneName: v.lane?.name ?? null,
      };
    });

    const tenureMonths = user.memberSince ? differenceInMonths(now, user.memberSince) : 0;

    res.json({
      success: true,
      data: {
        memberSince: user.memberSince,
        tenureMonths,
        totalShots,
        totalVisits: totalVisitsCount,
        visitsLast12Months: visitsLast12,
        averageVisitDuration,
        shotsByCaliber,
        shotsByFirearm,
        ammoSpentByType,
        recentVisits,
      },
    });
  } catch (error) {
    console.error('[USER_STATS] Erro:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar estatisticas do usuario' });
  }
});

export default router;
