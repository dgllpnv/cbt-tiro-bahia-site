import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';
import { encryptSecret } from '../lib/secretCrypto.js';
import { inspectPfx } from '../lib/pfxInspect.js';

const router = Router();
router.use(authMiddleware);

const CLUB_ID = 'cbt-bahia';

// Campos seguros para expor via API — NUNCA inclui fileData/passwordEncrypted.
const digitalSignatureMetaSelect = {
  fileName: true,
  holderName: true,
  issuer: true,
  validFrom: true,
  validUntil: true,
  uploadedByEmail: true,
  uploadedAt: true,
} as const;

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

// =====================================================
// Assinatura Digital do Clube — preparacao de terreno
//
// O certificado (.pfx/.p12) do responsavel legal ainda nao foi enviado
// pelo clube. Estas rotas permitem anexar/consultar/remover o arquivo +
// senha (cifrada em repouso) desde ja, para que a assinatura digital real
// de documentos (PKCS#7/ICP-Brasil) possa ser implementada depois sem
// precisar de nova modelagem nem migracao. fileData/senha NUNCA sao
// retornados por nenhuma destas rotas.
// =====================================================

// GET /api/club-settings/digital-signature — metadados apenas (sem arquivo/senha).
// ADMIN e CASHIER podem ler (mesma exposicao dos demais dados do clube).
router.get('/digital-signature', async (_req: Request, res: Response): Promise<void> => {
  try {
    const cert = await prisma.clubDigitalSignature.findUnique({
      where: { clubId: CLUB_ID },
      select: digitalSignatureMetaSelect,
    });

    res.json({ success: true, data: cert ? { configured: true, ...cert } : { configured: false } });
  } catch (error) {
    console.error('[CLUB_SETTINGS] Erro ao ler assinatura digital:', error);
    res.status(500).json({ success: false, error: 'Erro ao ler assinatura digital' });
  }
});

// POST /api/club-settings/digital-signature — anexa/substitui o certificado (ADMIN only).
//
// Abre o .pfx/.p12 de verdade (node-forge) com a senha informada antes de
// salvar: isso VALIDA a senha (rejeita se estiver errada) e extrai titular
// (CN), emissor e validade do certificado real — nada disso e digitado a
// mao pelo admin.
const digitalSignatureUploadSchema = z.object({
  fileName: z.string().min(1).max(255).regex(/\.(pfx|p12)$/i, 'Arquivo deve ser .pfx ou .p12'),
  // base64 puro (sem prefixo data:...;base64,). Certificados A1 sao arquivos
  // pequenos (poucos KB) — limite generoso de 2MB em base64 evita abuso.
  fileData: z.string().min(1).max(2_000_000, 'Arquivo muito grande'),
  password: z.string().min(1, 'Senha do certificado e obrigatoria'),
});

router.post('/digital-signature', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = digitalSignatureUploadSchema.parse(req.body);

    const p12Buffer = Buffer.from(data.fileData, 'base64');
    let info;
    try {
      info = inspectPfx(p12Buffer, data.password);
    } catch {
      res.status(400).json({
        success: false,
        error: 'Nao foi possivel abrir o certificado — senha incorreta ou arquivo invalido.',
      });
      return;
    }

    const existing = await prisma.clubDigitalSignature.findUnique({ where: { clubId: CLUB_ID } });

    const saved = await prisma.clubDigitalSignature.upsert({
      where: { clubId: CLUB_ID },
      create: {
        clubId: CLUB_ID,
        fileName: data.fileName,
        fileData: data.fileData,
        passwordEncrypted: encryptSecret(data.password),
        holderName: info.holderName,
        issuer: info.issuer,
        validFrom: info.validFrom,
        validUntil: info.validUntil,
        uploadedByEmail: req.user!.email,
      },
      update: {
        fileName: data.fileName,
        fileData: data.fileData,
        passwordEncrypted: encryptSecret(data.password),
        holderName: info.holderName,
        issuer: info.issuer,
        validFrom: info.validFrom,
        validUntil: info.validUntil,
        uploadedByEmail: req.user!.email,
        uploadedAt: new Date(),
      },
      select: digitalSignatureMetaSelect,
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'ClubDigitalSignature',
      description: existing
        ? `Assinatura digital do clube substituida (${data.fileName}, titular: ${info.holderName ?? '—'})`
        : `Assinatura digital do clube anexada (${data.fileName}, titular: ${info.holderName ?? '—'})`,
      // Nunca guarda o arquivo/senha no audit log — so metadados.
      previousData: existing ? { fileName: existing.fileName, holderName: existing.holderName } : undefined,
      newData: { fileName: data.fileName, holderName: info.holderName },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: { configured: true, ...saved } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message, details: error.errors });
      return;
    }
    console.error('[CLUB_SETTINGS] Erro ao anexar assinatura digital:', error);
    res.status(500).json({ success: false, error: 'Erro ao anexar assinatura digital' });
  }
});

// DELETE /api/club-settings/digital-signature — remove o certificado (ADMIN only).
router.delete('/digital-signature', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.clubDigitalSignature.findUnique({ where: { clubId: CLUB_ID } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Nenhuma assinatura digital configurada' });
      return;
    }

    await prisma.clubDigitalSignature.delete({ where: { clubId: CLUB_ID } });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'DELETE',
      entityType: 'ClubDigitalSignature',
      description: `Assinatura digital do clube removida (${existing.fileName})`,
      previousData: { fileName: existing.fileName, holderName: existing.holderName },
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[CLUB_SETTINGS] Erro ao remover assinatura digital:', error);
    res.status(500).json({ success: false, error: 'Erro ao remover assinatura digital' });
  }
});

export default router;
