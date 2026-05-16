import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

// =====================================================
// Rotas autenticadas de gestao da galeria publica do site
// (/admin/galeria). Endpoint publico (sem auth) vive em public.routes.ts.
// =====================================================

const router = Router();

router.use(authMiddleware);

// Limite hard de imagens ativas (publicadas ou nao) para evitar bloat da tabela
// e payload excessivo no GET publico.
const MAX_GALLERY_IMAGES = 100;

const imageUrlSchema = z
  .string()
  .min(1, 'imageUrl obrigatorio')
  .refine(
    (v) => v.startsWith('data:image/') || /^https?:\/\//.test(v) || v.startsWith('/'),
    { message: 'imageUrl deve ser http(s), data URI ou caminho relativo' },
  );

// =====================================================
// GET /api/gallery — lista todas (admin/cashier)
// =====================================================
router.get('/', requireRole('ADMIN', 'CASHIER'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const images = await prisma.galleryImage.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: images, total: images.length, max: MAX_GALLERY_IMAGES });
  } catch (error) {
    console.error('Erro ao listar galeria:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar galeria' });
  }
});

// =====================================================
// POST /api/gallery — cria imagem
// =====================================================
const createSchema = z.object({
  imageUrl: imageUrlSchema,
  caption: z.string().max(200).optional(),
  displayOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
});

router.post('/', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const count = await prisma.galleryImage.count();
    if (count >= MAX_GALLERY_IMAGES) {
      res.status(400).json({
        success: false,
        error: `Limite de ${MAX_GALLERY_IMAGES} imagens atingido. Remova alguma antes de adicionar nova.`,
      });
      return;
    }

    const data = createSchema.parse(req.body);

    // displayOrder default: ultimo + 1 (vai pro fim)
    let displayOrder = data.displayOrder;
    if (displayOrder === undefined) {
      const last = await prisma.galleryImage.findFirst({
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });
      displayOrder = (last?.displayOrder ?? 0) + 1;
    }

    const image = await prisma.galleryImage.create({
      data: {
        imageUrl: data.imageUrl,
        caption: data.caption,
        displayOrder,
        isPublished: data.isPublished ?? true,
        createdBy: { connect: { id: req.user!.id } },
      },
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'CREATE',
      entityType: 'GalleryImage',
      entityId: image.id,
      newData: { caption: image.caption, isPublished: image.isPublished },
      description: `Imagem adicionada a galeria${image.caption ? `: "${image.caption}"` : ''}`,
      ipAddress: req.ip as string | undefined,
    });

    res.status(201).json({ success: true, data: image });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao criar imagem:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar imagem' });
  }
});

// =====================================================
// PUT /api/gallery/:id — atualiza
// =====================================================
const updateSchema = z.object({
  imageUrl: imageUrlSchema.optional(),
  caption: z.string().max(200).optional().nullable(),
  displayOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
});

router.put('/:id', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.galleryImage.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Imagem nao encontrada' });
      return;
    }

    const data = updateSchema.parse(req.body);

    const image = await prisma.galleryImage.update({
      where: { id: req.params.id },
      data,
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'UPDATE',
      entityType: 'GalleryImage',
      entityId: image.id,
      previousData: { caption: existing.caption, isPublished: existing.isPublished },
      newData: { caption: image.caption, isPublished: image.isPublished },
      description: `Imagem da galeria atualizada`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: image });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao atualizar imagem:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar imagem' });
  }
});

// =====================================================
// DELETE /api/gallery/:id — remove
// =====================================================
router.delete('/:id', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.galleryImage.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Imagem nao encontrada' });
      return;
    }

    await prisma.galleryImage.delete({ where: { id: req.params.id } });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'DELETE',
      entityType: 'GalleryImage',
      entityId: existing.id,
      previousData: { caption: existing.caption },
      description: `Imagem removida da galeria${existing.caption ? `: "${existing.caption}"` : ''}`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, message: 'Imagem removida' });
  } catch (error) {
    console.error('Erro ao remover imagem:', error);
    res.status(500).json({ success: false, error: 'Erro ao remover imagem' });
  }
});

export default router;
