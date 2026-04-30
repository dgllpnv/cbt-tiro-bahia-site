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

export default router;
