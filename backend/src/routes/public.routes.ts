import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

// =====================================================
// Rotas PUBLICAS — sem authMiddleware.
// Servem dados consumidos pelo site institucional (/) que nao
// requer login, como contador de visitantes.
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

export default router;
