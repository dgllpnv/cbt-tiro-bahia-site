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

// =====================================================
// EXPRESS APP SETUP
// =====================================================

const app = express();
const PORT = Number(process.env.PORT) || 3002;

// =====================================================
// CORS CONFIGURATION
// =====================================================

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : ['http://localhost:8080', 'http://localhost:5173'];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// =====================================================
// HEALTH CHECK
// =====================================================

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

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  CBT Backend - Clube Baiano de Tiro`);
  console.log(`  Servidor rodando na porta ${PORT}`);
  console.log(`  Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  CORS: ${allowedOrigins.join(', ')}`);
  console.log(`========================================\n`);
});

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

const gracefulShutdown = async (signal: string) => {
  console.log(`\n[SERVER] ${signal} recebido. Encerrando graciosamente...`);
  await prisma.$disconnect();
  console.log('[SERVER] Conexao com banco de dados encerrada');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
