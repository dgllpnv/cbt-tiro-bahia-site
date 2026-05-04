import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// =====================================================
// GET /api/news — List news (all authenticated users)
// =====================================================
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Non-admin users only see published news
    if (req.user?.role !== 'ADMIN') {
      where.isPublished = true;
    }

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip,
        take: limit,
        include: {
          author: {
            select: { id: true, fullName: true, photoUrl: true },
          },
        },
      }),
      prisma.news.count({ where }),
    ]);

    res.json({
      success: true,
      data: news,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao listar noticias:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar noticias' });
  }
});

// =====================================================
// GET /api/news/:id — Get single news
// =====================================================
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const news = await prisma.news.findUnique({
      where: { id: req.params.id },
      include: {
        author: {
          select: { id: true, fullName: true, photoUrl: true },
        },
      },
    });

    if (!news) {
      res.status(404).json({ success: false, error: 'Noticia nao encontrada' });
      return;
    }

    // Non-admin can only see published
    if (!news.isPublished && req.user?.role !== 'ADMIN') {
      res.status(404).json({ success: false, error: 'Noticia nao encontrada' });
      return;
    }

    res.json({ success: true, data: news });
  } catch (error) {
    console.error('Erro ao buscar noticia:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar noticia' });
  }
});

// =====================================================
// POST /api/news — Create news (ADMIN only)
// =====================================================
// imageUrl aceita data URI (upload local em base64) ou URL http(s).
const imageUrlSchema = z
  .string()
  .refine(
    (v) => v === '' || v.startsWith('data:image/') || /^https?:\/\//.test(v),
    { message: 'imageUrl deve ser http(s) ou data URI de imagem' },
  );

const createNewsSchema = z.object({
  title: z.string().min(3, 'Titulo deve ter pelo menos 3 caracteres'),
  content: z.string().min(10, 'Conteudo deve ter pelo menos 10 caracteres'),
  summary: z.string().optional(),
  imageUrl: imageUrlSchema.optional(),
  isPinned: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

router.post('/', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createNewsSchema.parse(req.body);

    const news = await prisma.news.create({
      data: {
        title: data.title,
        content: data.content,
        summary: data.summary,
        imageUrl: data.imageUrl || null,
        isPinned: data.isPinned,
        isPublished: data.isPublished,
        author: { connect: { id: req.user!.id } },
        publishedAt: new Date(),
      },
      include: {
        author: {
          select: { id: true, fullName: true, photoUrl: true },
        },
      },
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'CREATE',
      entityType: 'News',
      entityId: news.id,
      newData: { title: news.title, isPinned: news.isPinned, isPublished: news.isPublished },
      description: `Noticia criada: "${news.title}"`,
      ipAddress: req.ip as string | undefined,
    });

    res.status(201).json({ success: true, data: news });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao criar noticia:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar noticia' });
  }
});

// =====================================================
// PUT /api/news/:id — Update news (ADMIN only)
// =====================================================
const updateNewsSchema = z.object({
  title: z.string().min(3).optional(),
  content: z.string().min(10).optional(),
  summary: z.string().optional().nullable(),
  imageUrl: imageUrlSchema.optional().nullable(),
  isPinned: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

router.put('/:id', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.news.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Noticia nao encontrada' });
      return;
    }

    const data = updateNewsSchema.parse(req.body);

    const news = await prisma.news.update({
      where: { id: req.params.id },
      data: {
        ...data,
        imageUrl: data.imageUrl === '' ? null : data.imageUrl,
      },
      include: {
        author: {
          select: { id: true, fullName: true, photoUrl: true },
        },
      },
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'UPDATE',
      entityType: 'News',
      entityId: news.id,
      previousData: { title: existing.title, isPinned: existing.isPinned, isPublished: existing.isPublished },
      newData: { title: news.title, isPinned: news.isPinned, isPublished: news.isPublished },
      description: `Noticia atualizada: "${news.title}"`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: news });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao atualizar noticia:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar noticia' });
  }
});

// =====================================================
// DELETE /api/news/:id — Delete news (ADMIN only)
// =====================================================
router.delete('/:id', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.news.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Noticia nao encontrada' });
      return;
    }

    await prisma.news.delete({ where: { id: req.params.id } });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'DELETE',
      entityType: 'News',
      entityId: existing.id,
      previousData: { title: existing.title },
      description: `Noticia excluida: "${existing.title}"`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, message: 'Noticia excluida com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir noticia:', error);
    res.status(500).json({ success: false, error: 'Erro ao excluir noticia' });
  }
});

export default router;
