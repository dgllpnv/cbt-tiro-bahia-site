import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';
import { cosineSimilarity, DEFAULT_THRESHOLD, DEFAULT_GAP } from '../lib/faceMatch.js';
import { createHabitualityFromVisit } from '../lib/habitualityFromVisit.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const verifySchema = z.object({
  descriptor: z.array(z.number()).min(64).max(2048),
  threshold: z.number().min(0).max(1).optional(),
});

const createSchema = z.object({
  memberId: z.string().uuid(),
  descriptor: z.array(z.number()).min(64).max(2048),
  thumbnail: z.string().optional().nullable(),
  source: z.enum(['CHECK_IN', 'CHECK_OUT', 'MANUAL']),
  visitId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const verifyCheckoutSchema = z.object({
  descriptor: z.array(z.number()).min(64).max(2048),
  memberId: z.string().uuid(),
  visitId: z.string().uuid(),
  threshold: z.number().min(0).max(1).optional(),
});

// =====================================================
// POST /api/face-profiles/verify — Identifica membro por descriptor
// =====================================================

router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = verifySchema.parse(req.body);
    const threshold = data.threshold ?? DEFAULT_THRESHOLD;

    const profiles = await prisma.faceProfile.findMany({
      where: { isActive: true },
      select: {
        id: true,
        descriptor: true,
        member: {
          select: {
            id: true,
            fullName: true,
            memberNumber: true,
            cpf: true,
            role: true,
            photoUrl: true,
            isActive: true,
            status: true,
          },
        },
      },
    });

    // Computa similaridade contra cada perfil
    const candidates = profiles
      .filter((p) => p.member.isActive)
      .map((p) => {
        const stored = (p.descriptor as unknown) as number[];
        const similarity = stored.length === data.descriptor.length
          ? cosineSimilarity(data.descriptor, stored)
          : -1;
        return { profileId: p.id, member: p.member, similarity };
      })
      .filter((c) => c.similarity >= 0)
      .sort((a, b) => b.similarity - a.similarity);

    // Top 3 sempre retornados como suggestions (pode ajudar admin)
    const suggestions = candidates.slice(0, 3).map((c) => ({
      member: c.member,
      similarity: c.similarity,
      profileId: c.profileId,
    }));

    const top = candidates[0];
    const second = candidates[1];

    let matched = false;
    let matchedMember = null;
    let matchedSimilarity: number | null = null;
    let matchedProfileId: string | null = null;

    if (top && top.similarity >= threshold) {
      const gap = second ? top.similarity - second.similarity : 1;
      if (gap >= DEFAULT_GAP) {
        matched = true;
        matchedMember = top.member;
        matchedSimilarity = top.similarity;
        matchedProfileId = top.profileId;
      }
    }

    // Audit (sempre — mesmo sem match)
    await createAuditLog({
      performedById: req.user!.id,
      action: 'FACE_VERIFIED',
      entityType: 'FaceProfile',
      entityId: matchedProfileId ?? undefined,
      userId: matchedMember?.id,
      newData: {
        matched,
        similarity: matchedSimilarity,
        threshold,
        candidatesCount: candidates.length,
      },
      description: matched
        ? `Face verificada — ${matchedMember!.fullName} (sim ${(matchedSimilarity! * 100).toFixed(1)}%)`
        : `Face verificada — sem match (top: ${top ? (top.similarity * 100).toFixed(1) + '%' : 'nenhum'})`,
      ipAddress: req.ip as string | undefined,
    });

    if (matched) {
      res.json({
        success: true,
        data: {
          matched: true,
          member: matchedMember,
          similarity: matchedSimilarity,
          profileId: matchedProfileId,
          suggestions,
        },
      });
    } else {
      res.json({
        success: true,
        data: { matched: false, suggestions },
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('[FACE] Erro ao verificar:', error);
    res.status(500).json({ success: false, error: 'Erro ao verificar face' });
  }
});

// =====================================================
// POST /api/face-profiles/verify-checkout — Valida facial no checkout
//
// Compara o descriptor recebido APENAS com os perfis ativos do memberId
// fornecido. Se houver match (similaridade >= threshold), cria
// HabitualityRecord automaticamente para cada calibre da visita.
//
// NAO cria novo FaceProfile — para registrar nova captura, usar POST /.
// =====================================================

router.post('/verify-checkout', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = verifyCheckoutSchema.parse(req.body);
    const threshold = data.threshold ?? DEFAULT_THRESHOLD;

    const visit = await prisma.visit.findUnique({
      where: { id: data.visitId },
      select: { id: true, memberId: true, visitDate: true },
    });

    if (!visit) {
      res.status(404).json({ success: false, error: 'Visita nao encontrada' });
      return;
    }

    if (visit.memberId !== data.memberId) {
      res.status(400).json({ success: false, error: 'Visita pertence a outro membro' });
      return;
    }

    const profiles = await prisma.faceProfile.findMany({
      where: { memberId: data.memberId, isActive: true },
      select: { id: true, descriptor: true },
    });

    if (profiles.length === 0) {
      // Sem perfil cadastrado — admin precisa registrar antes
      await createAuditLog({
        performedById: req.user!.id,
        action: 'FACE_VERIFIED',
        entityType: 'FaceProfile',
        userId: data.memberId,
        newData: { matched: false, reason: 'NO_PROFILE_REGISTERED' },
        description: `Verificacao de checkout falhou — membro sem facial cadastrado`,
        ipAddress: req.ip as string | undefined,
      });

      res.json({
        success: true,
        data: {
          matched: false,
          reason: 'NO_PROFILE_REGISTERED',
          similarity: null,
        },
      });
      return;
    }

    // Calcula similaridade contra cada perfil do membro (1-to-N do mesmo)
    const scored = profiles
      .map((p) => {
        const stored = (p.descriptor as unknown) as number[];
        const similarity = stored.length === data.descriptor.length
          ? cosineSimilarity(data.descriptor, stored)
          : -1;
        return { profileId: p.id, similarity };
      })
      .filter((s) => s.similarity >= 0)
      .sort((a, b) => b.similarity - a.similarity);

    const best = scored[0];
    const matched = !!best && best.similarity >= threshold;

    if (!matched) {
      await createAuditLog({
        performedById: req.user!.id,
        action: 'FACE_VERIFIED',
        entityType: 'FaceProfile',
        userId: data.memberId,
        newData: {
          matched: false,
          reason: 'LOW_SIMILARITY',
          bestSimilarity: best?.similarity ?? null,
          threshold,
        },
        description: `Verificacao de checkout falhou — similaridade ${best ? (best.similarity * 100).toFixed(1) + '%' : 'n/d'} (< threshold)`,
        ipAddress: req.ip as string | undefined,
      });

      res.json({
        success: true,
        data: {
          matched: false,
          reason: 'LOW_SIMILARITY',
          similarity: best?.similarity ?? null,
        },
      });
      return;
    }

    // Match: cria habitualidade automatica (idempotente)
    const habituality = await prisma.$transaction(async (tx) => {
      return createHabitualityFromVisit(tx, {
        visitId: data.visitId,
        memberId: data.memberId,
        verifiedById: req.user!.id,
      });
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'FACE_VERIFIED',
      entityType: 'FaceProfile',
      entityId: best.profileId,
      userId: data.memberId,
      newData: {
        matched: true,
        similarity: best.similarity,
        threshold,
        visitId: data.visitId,
        habitualityCreated: habituality.created,
        calibers: habituality.calibers,
      },
      description: `Verificacao de checkout OK (sim ${(best.similarity * 100).toFixed(1)}%)${
        habituality.created > 0 ? ` — ${habituality.created} habitualidade(s) criada(s)` : ''
      }`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({
      success: true,
      data: {
        matched: true,
        similarity: best.similarity,
        profileId: best.profileId,
        habituality,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('[FACE] Erro ao verificar checkout:', error);
    res.status(500).json({ success: false, error: 'Erro ao verificar facial no checkout' });
  }
});

// =====================================================
// POST /api/face-profiles — Registra novo descriptor
// =====================================================

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createSchema.parse(req.body);

    const member = await prisma.user.findUnique({
      where: { id: data.memberId },
      select: { id: true, fullName: true, isActive: true, role: true },
    });
    if (!member || !member.isActive) {
      res.status(404).json({ success: false, error: 'Membro nao encontrado ou inativo' });
      return;
    }

    if (data.visitId) {
      const visit = await prisma.visit.findUnique({
        where: { id: data.visitId },
        select: { id: true, memberId: true },
      });
      if (!visit) {
        res.status(404).json({ success: false, error: 'Visita nao encontrada' });
        return;
      }
      if (visit.memberId !== data.memberId) {
        res.status(400).json({
          success: false,
          error: 'Visita pertence a outro membro',
        });
        return;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.faceProfile.create({
        data: {
          memberId: data.memberId,
          descriptor: data.descriptor as any,
          thumbnail: data.thumbnail || null,
          source: data.source,
          visitId: data.visitId || null,
          capturedById: req.user!.id,
          notes: data.notes || null,
        },
        select: {
          id: true,
          source: true,
          createdAt: true,
          thumbnail: true,
        },
      });

      // Habitualidade automatica somente em CHECK_OUT com visitId
      let habituality: { created: number; calibers: string[] } | null = null;
      if (data.source === 'CHECK_OUT' && data.visitId) {
        habituality = await createHabitualityFromVisit(tx, {
          visitId: data.visitId,
          memberId: data.memberId,
          verifiedById: req.user!.id,
        });
      }

      return { profile, habituality };
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'FACE_REGISTERED',
      entityType: 'FaceProfile',
      entityId: result.profile.id,
      userId: data.memberId,
      newData: {
        source: data.source,
        visitId: data.visitId ?? null,
        habitualityCreated: result.habituality?.created ?? 0,
        calibers: result.habituality?.calibers ?? [],
      },
      description: `Face registrada para ${member.fullName} (${data.source})${
        result.habituality && result.habituality.created > 0
          ? ` — ${result.habituality.created} habitualidade(s) criada(s)`
          : ''
      }`,
      ipAddress: req.ip as string | undefined,
    });

    res.status(201).json({
      success: true,
      data: {
        profile: result.profile,
        habituality: result.habituality,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('[FACE] Erro ao registrar:', error);
    res.status(500).json({ success: false, error: 'Erro ao registrar face' });
  }
});

// =====================================================
// GET /api/face-profiles/member/:memberId — Lista perfis ativos
// =====================================================

router.get('/member/:memberId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;

    const profiles = await prisma.faceProfile.findMany({
      where: { memberId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        source: true,
        thumbnail: true,
        notes: true,
        visitId: true,
        createdAt: true,
        capturedBy: { select: { id: true, fullName: true } },
      },
    });

    res.json({ success: true, data: profiles });
  } catch (error) {
    console.error('[FACE] Erro ao listar perfis:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar perfis faciais' });
  }
});

// =====================================================
// DELETE /api/face-profiles/:id — Soft delete (LGPD)
// =====================================================

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.faceProfile.findUnique({
      where: { id },
      select: {
        id: true,
        memberId: true,
        source: true,
        member: { select: { fullName: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Perfil facial nao encontrado' });
      return;
    }

    await prisma.faceProfile.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'FACE_DELETED',
      entityType: 'FaceProfile',
      entityId: id,
      userId: existing.memberId,
      previousData: { source: existing.source, isActive: true },
      newData: { isActive: false },
      description: `Perfil facial de ${existing.member.fullName} excluido (LGPD)`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: { id, isActive: false } });
  } catch (error) {
    console.error('[FACE] Erro ao excluir perfil:', error);
    res.status(500).json({ success: false, error: 'Erro ao excluir perfil facial' });
  }
});

export default router;
