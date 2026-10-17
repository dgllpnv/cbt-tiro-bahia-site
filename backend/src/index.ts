import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma.js';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import newsRoutes from './routes/news.routes.js';
import visitsRoutes from './routes/visits.routes.js';
import visitDetailsRoutes from './routes/visitDetails.routes.js';
import productsRoutes from './routes/products.routes.js';
import equipmentRoutes from './routes/equipment.routes.js';
import transactionsRoutes from './routes/transactions.routes.js';
import loansRoutes from './routes/loans.routes.js';
import annuitiesRoutes from './routes/annuities.routes.js';
import stockRoutes from './routes/stock.routes.js';
import financialRoutes from './routes/financial.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import auditLogsRoutes from './routes/auditLogs.routes.js';
import eventsRoutes from './routes/events.routes.js';
import habitualityRoutes from './routes/habituality.routes.js';
import documentsRoutes from './routes/documents.routes.js';
import lanesRoutes from './routes/lanes.routes.js';
import userStatsRoutes from './routes/userStats.routes.js';
import clubSettingsRoutes from './routes/clubSettings.routes.js';
import visitorsRoutes from './routes/visitors.routes.js';
import faceProfilesRoutes from './routes/faceProfiles.routes.js';
import memberFirearmsRoutes from './routes/memberFirearms.routes.js';
import exportRoutes from './routes/export.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import galleryRoutes from './routes/gallery.routes.js';
import publicRoutes from './routes/public.routes.js';
import { bootstrapMissingMembers } from './services/bootstrapMissingMembers.js';

// =====================================================
// EXPRESS APP SETUP
// =====================================================

const app = express();
const PORT = Number(process.env.PORT) || 3002;

// =====================================================
// CORS CONFIGURATION
// =====================================================
// Aceita:
//   1. Origens explicitas em ALLOWED_ORIGINS (CSV)
//   2. Qualquer subdominio *.easypanel.host (URLs temporarias do
//      EasyPanel mudam com hash; whitelist explicita seria fragil)
//   3. Localhost padrao em DEV (8080, 5173, 3000)
// Origin null/undefined (curl, server-to-server) sempre passa.
// =====================================================

const explicitOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'];

const EASYPANEL_PATTERN = /^https:\/\/[a-z0-9-]+\.[a-z0-9]+\.easypanel\.host$/i;

function isOriginAllowed(origin: string): boolean {
  if (explicitOrigins.includes(origin)) return true;
  if (EASYPANEL_PATTERN.test(origin)) return true;
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Origin null/undefined = curl ou server-to-server. Permite.
      if (!origin) return callback(null, true);
      if (isOriginAllowed(origin)) return callback(null, true);
      // Origem nao autorizada — Express CORS rejeita silenciosamente
      // (nao retorna ACL-Allow-Origin), browser bloqueia.
      console.warn(`[CORS] Origem nao autorizada: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Permite o frontend ler o nome do arquivo no download (export do banco)
    exposedHeaders: ['Content-Disposition'],
  }),
);

// =====================================================
// BODY PARSERS
// =====================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =====================================================
// REQUEST LOGGING (development only)
// =====================================================

if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    // Health check costuma ser pollado a cada poucos segundos por scripts/extensions —
    // suprimir do log evita ruido sem perder visibilidade nas rotas de negocio.
    if (req.path !== '/health') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
  });
}

// =====================================================
// HEALTH CHECK
// =====================================================

// Liveness: so diz se o processo esta de pe, SEM tocar no banco. Usado
// pelo HEALTHCHECK do Dockerfile — se o banco oscilar, o Docker nao deve
// matar o backend em cascata (reiniciar a API nao conserta o banco).
app.get('/live', (_req, res) => {
  res.json({ success: true, data: { status: 'alive', timestamp: new Date().toISOString() } });
});

// Readiness: confere o banco. Usado por monitoramento externo (UptimeRobot etc.).
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
      },
    });
  } catch (error) {
    console.error('[HEALTH] Database connection failed:', error);
    res.status(503).json({
      success: false,
      error: 'Database connection failed',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// =====================================================
// ROUTES
// =====================================================

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/visits', visitsRoutes);
app.use('/api/visit-details', visitDetailsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/annuities', annuitiesRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/habituality', habitualityRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/lanes', lanesRoutes);
app.use('/api/users', userStatsRoutes);
app.use('/api/club-settings', clubSettingsRoutes);
app.use('/api/visitors', visitorsRoutes);
app.use('/api/face-profiles', faceProfilesRoutes);
app.use('/api/member-firearms', memberFirearmsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/public', publicRoutes);

// =====================================================
// 404 HANDLER
// =====================================================

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota nao encontrada',
  });
});

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message);

  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor',
  });
});

// =====================================================
// START SERVER
// =====================================================

const server = app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  CBT Backend - Clube Baiano de Tiro`);
  console.log(`  Servidor rodando na porta ${PORT}`);
  console.log(`  Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  CORS: ${explicitOrigins.join(', ')} + *.easypanel.host`);
  console.log(`========================================\n`);

  // Bootstrap async — restaura os 13 socios "perdidos" pela migracao
  // inicial caso a mat 0001 (Edivanildo) nao exista. No-op silencioso
  // depois que ja rodou. Nao bloqueia request handling.
  void bootstrapMissingMembers();
});

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

// Sai com codigo != 0 DE PROPOSITO (128 + numero do sinal). O EasyPanel
// cria o servico com restart policy "on-failure": se sairmos com 0, o
// Docker entende "terminou com sucesso" e NAO sobe o backend de novo
// depois de um reboot/desligamento da VPS (foi o que derrubou o frontend
// no incidente de 17/10/2026). Em deploy normal nada muda.
const gracefulShutdown = async (signal: string, exitCode: number) => {
  console.log(`\n[SERVER] ${signal} recebido. Encerrando graciosamente...`);
  server.close();
  await prisma.$disconnect();
  console.log('[SERVER] Conexao com banco de dados encerrada');
  process.exit(exitCode);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM', 143));
process.on('SIGINT', () => gracefulShutdown('SIGINT', 130));

// Rede de seguranca: promessa rejeitada sem tratamento so e registrada
// (sem isso o Node 22 derruba o processo inteiro). Excecao nao capturada
// deixa o processo em estado incerto — registra e sai com erro para o
// Docker recriar o container limpo.
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Promise rejeitada sem tratamento:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Excecao nao capturada — reiniciando:', error);
  process.exit(1);
});
