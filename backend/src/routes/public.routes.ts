import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

// =====================================================
// Rotas PUBLICAS — sem authMiddleware.
// Servem dados consumidos pelo site institucional (/) que nao
// requer login: contador de visitantes, noticias e galeria.
// =====================================================

const router = Router();

const CLUB_ID = 'cbt-bahia';

// =====================================================
// POST /api/public/site-view
// Incrementa o contador de visualizacoes do site e retorna o novo total.
// O incremento e atomico no nivel do Postgres ({ increment: 1 }), entao
// e seguro frente a chamadas concorrentes.
// =====================================================
router.post('/site-view', async (_req: Request, res: Response): Promise<void> => {
  try {
    const stat = await prisma.siteStat.upsert({
      where: { clubId: CLUB_ID },
      create: { clubId: CLUB_ID, totalViews: 1 },
      update: { totalViews: { increment: 1 } },
    });
    res.json({ success: true, data: { totalViews: stat.totalViews } });
  } catch (error) {
    console.error('[PUBLIC] Erro ao incrementar site-view:', error);
    res.status(500).json({ success: false, error: 'Erro ao registrar visita' });
  }
});

// =====================================================
// GET /api/public/site-stats
// Retorna o contador atual sem incrementar.
// =====================================================
router.get('/site-stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const stat = await prisma.siteStat.findUnique({
      where: { clubId: CLUB_ID },
    });
    res.json({ success: true, data: { totalViews: stat?.totalViews ?? 0 } });
  } catch (error) {
    console.error('[PUBLIC] Erro ao buscar site-stats:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar estatisticas' });
  }
});

// =====================================================
// GET /api/public/news
// Lista noticias publicadas (sem auth). Pinned primeiro, depois por data.
// Limite default de 6, max 20 — suficiente para a home/landing.
// Retorna apenas campos seguros (sem dados do autor alem do primeiro nome).
// =====================================================
router.get('/news', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 6));
    const news = await prisma.news.findMany({
      where: { isPublished: true },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        summary: true,
        content: true,
        imageUrl: true,
        isPinned: true,
        publishedAt: true,
        author: { select: { fullName: true } },
      },
    });
    res.json({ success: true, data: news });
  } catch (error) {
    console.error('[PUBLIC] Erro ao listar noticias:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar noticias' });
  }
});

// =====================================================
// GET /api/public/gallery
// Lista imagens publicadas da galeria, ordenadas por displayOrder.
// =====================================================
router.get('/gallery', async (_req: Request, res: Response): Promise<void> => {
  try {
    const images = await prisma.galleryImage.findMany({
      where: { isPublished: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        imageUrl: true,
        caption: true,
        displayOrder: true,
      },
    });
    res.json({ success: true, data: images });
  } catch (error) {
    console.error('[PUBLIC] Erro ao listar galeria:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar galeria' });
  }
});

export default router;
