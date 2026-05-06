import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';

const router = Router();
router.use(authMiddleware);

// GET /api/documents/member/:id — Documents for a member
router.get('/member/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = req.params.id;
    if (req.user?.role !== 'ADMIN' && req.user?.id !== memberId) {
      res.status(403).json({ success: false, error: 'Permissao negada' });
      return;
    }

    const documents = await prisma.memberDocument.findMany({
      where: { memberId },
      orderBy: { generatedAt: 'desc' },
      include: {
        generatedBy: { select: { id: true, fullName: true } },
      },
    });

    res.json({ success: true, data: documents });
  } catch (error) {
    console.error('Erro ao listar documentos:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar documentos' });
  }
});

// POST /api/documents/generate/filiation/:memberId — Generate Filiation Declaration
router.post('/generate/filiation/:memberId', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const member = await prisma.user.findUnique({ where: { id: req.params.memberId } });
    if (!member) {
      res.status(404).json({ success: false, error: 'Membro nao encontrado' });
      return;
    }

    const doc = await prisma.memberDocument.create({
      data: {
        memberId: member.id,
        documentType: 'FILIATION',
        title: `Declaracao de Filiacao - ${member.fullName}`,
        description: 'Declara que o associado e filiado ao Clube Baiano de Tiro',
        generatedById: req.user!.id,
        templateData: {
          memberName: member.fullName,
          cpf: member.cpf,
          memberNumber: member.memberNumber,
          memberSince: member.memberSince,
          clubName: 'Clube Baiano de Tiro',
          generatedAt: new Date().toISOString(),
        },
      },
    });

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    console.error('Erro ao gerar declaracao:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar declaracao' });
  }
});

// POST /api/documents/generate/habituality/:memberId — Generate Habituality Declaration
router.post('/generate/habituality/:memberId', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const member = await prisma.user.findUnique({ where: { id: req.params.memberId } });
    if (!member) {
      res.status(404).json({ success: false, error: 'Membro nao encontrado' });
      return;
    }

    const year = parseInt(req.body.year) || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const records = await prisma.habitualityRecord.findMany({
      where: { memberId: member.id, activityDate: { gte: startDate, lte: endDate } },
      orderBy: { activityDate: 'asc' },
    });

    // Group by caliber
    const byCaliber: Record<string, { count: number; dates: string[] }> = {};
    for (const r of records) {
      if (!byCaliber[r.caliber]) byCaliber[r.caliber] = { count: 0, dates: [] };
      byCaliber[r.caliber].count++;
      byCaliber[r.caliber].dates.push(r.activityDate.toISOString().split('T')[0]);
    }

    const doc = await prisma.memberDocument.create({
      data: {
        memberId: member.id,
        documentType: 'HABITUALITY',
        title: `Declaracao de Habitualidade ${year} - ${member.fullName}`,
        description: `Comprova habitualidade do associado no ano de ${year}`,
        generatedById: req.user!.id,
        templateData: {
          memberName: member.fullName,
          cpf: member.cpf,
          cr: member.cr,
          memberNumber: member.memberNumber,
          year,
          caliberSummary: byCaliber,
          totalActivities: records.length,
          clubName: 'Clube Baiano de Tiro',
          generatedAt: new Date().toISOString(),
        },
      },
    });

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    console.error('Erro ao gerar declaracao:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar declaracao' });
  }
});

// POST /api/documents/generate/membership-card/:memberId — Generate Membership Card data
router.post('/generate/membership-card/:memberId', async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = req.params.memberId;
    if (req.user?.role !== 'ADMIN' && req.user?.id !== memberId) {
      res.status(403).json({ success: false, error: 'Permissao negada' });
      return;
    }

    const member = await prisma.user.findUnique({ where: { id: memberId } });
    if (!member) {
      res.status(404).json({ success: false, error: 'Membro nao encontrado' });
      return;
    }

    const cardData = {
      memberName: member.fullName,
      cpf: member.cpf,
      memberNumber: member.memberNumber,
      cr: member.cr,
      crLevel: member.crLevel,
      memberSince: member.memberSince,
      annuityValidUntil: member.annuityValidUntil,
      photoUrl: member.photoUrl,
      clubName: 'Clube Baiano de Tiro',
      generatedAt: new Date().toISOString(),
    };

    const doc = await prisma.memberDocument.create({
      data: {
        memberId: member.id,
        documentType: 'MEMBERSHIP_CARD',
        title: `Carteira de Associado - ${member.fullName}`,
        generatedById: req.user!.id,
        templateData: cardData,
      },
    });

    res.status(201).json({ success: true, data: { ...doc, cardData } });
  } catch (error) {
    console.error('Erro ao gerar carteirinha:', error);
    res.status(500).json({ success: false, error: 'Erro ao gerar carteirinha' });
  }
});

// =====================================================
// GET /api/documents/declaration/habituality/:memberId?year=YYYY
// Retorna pacote completo para renderizar a Declaracao de Habitualidade
// (Anexo E da Portaria 166-COLOG/2023, alterada pela 260-COLOG/2025).
// Permissao: ADMIN ou self.
// =====================================================
router.get('/declaration/habituality/:memberId', async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = req.params.memberId;
    if (req.user?.role !== 'ADMIN' && req.user?.id !== memberId) {
      res.status(403).json({ success: false, error: 'Permissao negada' });
      return;
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    const [member, club, records] = await Promise.all([
      prisma.user.findUnique({
        where: { id: memberId },
        select: {
          id: true,
          fullName: true,
          cpf: true,
          dateOfBirth: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          cr: true,
          crLevel: true,
          crExpiry: true,
          memberNumber: true,
          memberSince: true,
          annuityValidUntil: true,
        },
      }),
      prisma.clubSettings.findUnique({ where: { clubId: 'cbt-bahia' } }),
      prisma.habitualityRecord.findMany({
        where: {
          memberId,
          activityDate: { gte: startDate, lte: endDate },
        },
        orderBy: { activityDate: 'asc' },
        include: {
          event: { select: { id: true, title: true, eventType: true } },
          visit: {
            select: {
              id: true,
              visitDate: true,
              details: { select: { caliber: true, firearmName: true, shotsFired: true } },
            },
          },
        },
      }),
    ]);

    if (!member) {
      res.status(404).json({ success: false, error: 'Associado nao encontrado' });
      return;
    }
    if (!club) {
      res.status(500).json({ success: false, error: 'Configuracoes do clube nao encontradas' });
      return;
    }

    // Enriquecer cada registro com nome de arma + municao quando vinculado a uma visita.
    type ActivityRow = {
      date: Date;
      activityType: string;
      modality: string;
      caliber: string;
      firearmName: string | null;
      shotsFired: number | null;
      eventTitle: string | null;
      source: 'EVENT' | 'VISIT' | 'MANUAL';
      recordId: string;
    };

    const activities: ActivityRow[] = records.map((r) => {
      // Best-effort: dentre os details da visita, casar pelo calibre.
      const detail = r.visit?.details.find((d) => d.caliber === r.caliber);
      const source: ActivityRow['source'] = r.eventId ? 'EVENT' : r.visitId ? 'VISIT' : 'MANUAL';
      return {
        date: r.activityDate,
        activityType: r.activityType, // TRAINING ou COMPETITION
        modality: r.event?.title ?? (r.activityType === 'COMPETITION' ? 'Competicao' : 'Treinamento'),
        caliber: r.caliber,
        firearmName: detail?.firearmName ?? null,
        shotsFired: detail?.shotsFired ?? null,
        eventTitle: r.event?.title ?? null,
        source,
        recordId: r.id,
      };
    });

    // Totais por calibre
    const byCaliberMap = new Map<string, number>();
    for (const a of activities) {
      byCaliberMap.set(a.caliber, (byCaliberMap.get(a.caliber) ?? 0) + 1);
    }
    const REQUIRED_PER_CALIBER = 8;
    const totalsByCaliber = Array.from(byCaliberMap.entries())
      .map(([caliber, count]) => ({
        caliber,
        count,
        required: REQUIRED_PER_CALIBER,
        compliant: count >= REQUIRED_PER_CALIBER,
      }))
      .sort((a, b) => b.count - a.count);

    const trainings = activities.filter((a) => a.activityType === 'TRAINING').length;
    const competitions = activities.filter((a) => a.activityType === 'COMPETITION').length;

    // Metas por nivel (Decreto 11.615/2023; aplicada por arma representativa,
    // aqui usamos como referencia agregada do periodo).
    const level = member.crLevel ?? 1;
    const crLevelTargets =
      level === 3
        ? { level: 3, requiredTrainings: 20, requiredCompetitions: 6 }
        : level === 2
        ? { level: 2, requiredTrainings: 12, requiredCompetitions: 4 }
        : { level: 1, requiredTrainings: 8, requiredCompetitions: 0 };

    res.json({
      success: true,
      data: {
        club: {
          name: club.clubName,
          cnpj: club.cnpj,
          crPj: club.crPj,
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
        member: {
          fullName: member.fullName,
          cpf: member.cpf,
          dateOfBirth: member.dateOfBirth,
          addressLine: member.address,
          city: member.city,
          state: member.state,
          zipCode: member.zipCode,
          cr: member.cr,
          crLevel: member.crLevel,
          crExpiry: member.crExpiry,
          memberNumber: member.memberNumber,
          memberSince: member.memberSince,
          annuityValidUntil: member.annuityValidUntil,
        },
        period: {
          year,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        activities,
        totalsByCaliber,
        totals: {
          trainings,
          competitions,
          total: activities.length,
        },
        crLevelTargets,
      },
    });
  } catch (error) {
    console.error('Erro ao montar pacote da declaracao:', error);
    res.status(500).json({ success: false, error: 'Erro ao montar pacote da declaracao' });
  }
});

export default router;
