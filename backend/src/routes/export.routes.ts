import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';
import { encryptBuffer } from '../lib/backupCrypto.js';
import { buildSelfDecryptingHtml } from '../lib/selfDecryptHtml.js';

// Exportacao completa do banco — somente ADMIN. O arquivo SEMPRE sai cifrado
// (AES) com a passphrase informada pelo admin.
const router = Router();
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

const exportSchema = z.object({
  format: z.enum(['json', 'csv']),
  passphrase: z.string().min(8, 'A senha deve ter no minimo 8 caracteres'),
});

// Ordem de dump. Cada entrada: [nome da tabela, accessor do Prisma].
// Cobre as 25 tabelas do schema.
async function dumpAllTables(): Promise<Record<string, any[]>> {
  const p = prisma as any;
  const tables: [string, string][] = [
    ['User', 'user'],
    ['MemberFirearm', 'memberFirearm'],
    ['UserAttachment', 'userAttachment'],
    ['News', 'news'],
    ['GalleryImage', 'galleryImage'],
    ['Visit', 'visit'],
    ['VisitDetail', 'visitDetail'],
    ['Product', 'product'],
    ['Equipment', 'equipment'],
    ['EquipmentLoan', 'equipmentLoan'],
    ['Transaction', 'transaction'],
    ['TransactionItem', 'transactionItem'],
    ['AnnuityPayment', 'annuityPayment'],
    ['StockItem', 'stockItem'],
    ['StockMovement', 'stockMovement'],
    ['Expense', 'expense'],
    ['AuditLog', 'auditLog'],
    ['ClubSettings', 'clubSettings'],
    ['Event', 'event'],
    ['EventParticipation', 'eventParticipation'],
    ['HabitualityRecord', 'habitualityRecord'],
    ['MemberDocument', 'memberDocument'],
    ['Lane', 'lane'],
    ['SiteStat', 'siteStat'],
    ['FaceProfile', 'faceProfile'],
  ];

  const out: Record<string, any[]> = {};
  for (const [name, accessor] of tables) {
    out[name] = await p[accessor].findMany();
  }
  return out;
}

// ── Serializacao CSV (formato multitabela legivel) ──────────────────────────

function csvCell(v: any): string {
  if (v === null || v === undefined) return '';
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === 'object') s = JSON.stringify(v);
  else s = String(v);
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function tableToCsv(name: string, rows: any[]): string {
  let out = `=== ${name} ===\n`;
  if (!rows.length) return out + '\n';
  const keys = Object.keys(rows[0]);
  out += keys.map(csvCell).join(',') + '\n';
  for (const r of rows) out += keys.map((k) => csvCell(r[k])).join(',') + '\n';
  return out + '\n';
}

// =====================================================
// POST /api/export/database — backup completo cifrado
// =====================================================

router.post('/database', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = exportSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: validation.error.errors[0].message });
      return;
    }
    const { format, passphrase } = validation.data;

    const dump = await dumpAllTables();
    const totalRecords = Object.values(dump).reduce((s, rows) => s + rows.length, 0);

    let plaintext: string;
    if (format === 'json') {
      plaintext = JSON.stringify(
        { generatedAt: new Date().toISOString(), version: 1, tables: dump },
        null,
        2,
      );
    } else {
      plaintext = Object.entries(dump)
        .map(([name, rows]) => tableToCsv(name, rows))
        .join('');
    }

    const encrypted = encryptBuffer(plaintext, passphrase);

    const stamp = new Date().toISOString().slice(0, 10);
    // Nome do arquivo descriptografado (gerado ao abrir o .html) e o nome do
    // proprio download (HTML autodescriptografavel — duplo-clique abre, pede a
    // senha e baixa o arquivo em claro, sem precisar de projeto/Node).
    const innerName = `cbt-backup-${stamp}.${format}`;
    const html = buildSelfDecryptingHtml(encrypted, innerName);
    const filename = `${innerName}.html`;

    // Auditoria — registra o export SEM a passphrase nem os dados.
    await createAuditLog({
      performedById: req.user!.id,
      action: 'REPORT_GENERATED',
      entityType: 'DatabaseExport',
      description: `Exportacao do banco (${format}, ${totalRecords} registros) por ${req.user!.email}`,
      ipAddress: req.ip as string | undefined,
    });

    console.log(`[EXPORT] Backup ${format} gerado (${totalRecords} registros) por ${req.user!.email}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
  } catch (error) {
    console.error('[EXPORT] Erro ao exportar banco:', error);
    res.status(500).json({ success: false, error: 'Erro ao exportar banco de dados' });
  }
});

export default router;
