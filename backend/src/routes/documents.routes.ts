import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { startOfYearUtc, endOfYearUtc } from '../lib/dateOnly.js';
import { createAuditLog } from '../services/auditService.js';
import { decryptSecret } from '../lib/secretCrypto.js';
import { signPdfWithCertificate } from '../lib/pdfSigning.js';

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

// GET /api/documents/declaration/filiation/:memberId
// Pacote { member, club } (mesmo shape de /api/reports/declaration-data) para o
// associado — ou admin — gerar a Declaracao de Filiacao no cliente
// (buildFiliacaoPdf). Permissao: ADMIN ou self. O reports/declaration-data e
// admin-only, por isso o associado precisa deste endpoint self-acessivel.
router.get('/declaration/filiation/:memberId', async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = req.params.memberId;
    if (req.user?.role !== 'ADMIN' && req.user?.id !== memberId) {
      res.status(403).json({ success: false, error: 'Permissao negada' });
      return;
    }

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
      res.status(500).json({ success: false, error: 'Configuracoes do clube nao encontradas' });
      return;
    }

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
    console.error('Erro ao montar pacote de filiacao:', error);
    res.status(500).json({ success: false, error: 'Erro ao montar pacote de filiacao' });
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
    // Limites em UTC — activityDate e `@db.Date`. Em horario local o inicio
    // caia em 01/01 03:00Z e a declaracao perdia os treinos do dia 01/01.
    const startDate = startOfYearUtc(year);
    const endDate = endOfYearUtc(year);

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
              details: { select: { caliber: true, firearmName: true, shotsFired: true, ammunitionType: true } },
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
      ammunitionType: string | null;
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
        ammunitionType: detail?.ammunitionType ?? null,
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

// =====================================================
// POST /api/documents/sign — assina digitalmente um PDF ja gerado no
// cliente, usando o certificado A1 configurado em ClubDigitalSignature
// (assinatura PKCS#7/ICP-Brasil real, via @signpdf + node-forge — sem
// nenhum custo/servico pago). Qualquer usuario autenticado pode chamar
// (associados assinam suas proprias declaracoes em /portal/documentos),
// mas TODA chamada gera AuditLog com hash sha256 do PDF original, para
// rastreabilidade — o texto do documento em si nunca e guardado.
//
// A chave privada e a senha do certificado NUNCA saem do backend: o
// cliente so envia o PDF pronto e recebe de volta o PDF assinado.
// =====================================================
const signPdfSchema = z.object({
  // base64 puro do PDF gerado no navegador (sem prefixo data:...;base64,).
  pdfData: z.string().min(1, 'PDF vazio'),
  documentLabel: z.string().max(200).optional(),
});

router.post('/sign', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = signPdfSchema.parse(req.body);

    const cert = await prisma.clubDigitalSignature.findUnique({ where: { clubId: 'cbt-bahia' } });
    if (!cert) {
      res.status(404).json({ success: false, error: 'Nenhuma assinatura digital configurada' });
      return;
    }
    if (cert.validUntil && cert.validUntil.getTime() < Date.now()) {
      res.status(400).json({
        success: false,
        error: `Certificado de assinatura vencido em ${cert.validUntil.toISOString().slice(0, 10)} — anexe um novo em Dados do Clube.`,
      });
      return;
    }

    const pdfBytes = Buffer.from(data.pdfData, 'base64');
    const p12Buffer = Buffer.from(cert.fileData, 'base64');
    const password = decryptSecret(cert.passwordEncrypted);

    const signed = await signPdfWithCertificate(pdfBytes, p12Buffer, password, {
      signerName: cert.holderName || cert.uploadedByEmail,
      reason: 'Documento assinado digitalmente pelo clube',
    });

    // Auditoria: nunca guarda o PDF em si — so um hash pra rastreabilidade
    // em caso de disputa sobre o conteudo assinado.
    const hash = crypto.createHash('sha256').update(pdfBytes).digest('hex');
    await createAuditLog({
      performedById: req.user!.id,
      action: 'CREATE',
      entityType: 'DigitalSignatureUse',
      description: `PDF assinado digitalmente${data.documentLabel ? ` (${data.documentLabel})` : ''}`,
      newData: { documentLabel: data.documentLabel ?? null, sha256: hash, sizeBytes: pdfBytes.length },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { signedPdfData: signed.toString('base64') } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[DOCUMENTS] Erro ao assinar PDF:', error);
    res.status(500).json({ success: false, error: 'Erro ao assinar documento' });
  }
});

export default router;
