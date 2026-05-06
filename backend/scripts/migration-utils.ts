// =====================================================
// migration-utils.ts
// Helpers para a migração ADM CLUBE → Portal CBT.
//
// Convenção: tudo idempotente, com fallbacks seguros (nunca lança em parser).
// =====================================================

import { readFileSync } from 'node:fs';
import iconv from 'iconv-lite';
import { parse } from 'csv-parse/sync';

// ── Leitura/decode do CSV ──────────────────────────────────────────────────

/** Lê arquivo ISO-8859-1 e devolve string UTF-8. */
export function readCsvUtf8(path: string): string {
  const buf = readFileSync(path);
  return iconv.decode(buf, 'latin1');
}

/**
 * Separa o conteúdo concatenado em sub-blocos por marcador "=== tab_X ===".
 * Devolve um Record onde a chave é o nome da tabela (sem espaços/aspas).
 */
export function splitTables(content: string): Record<string, string> {
  const lines = content.split(/\r?\n/);
  const out: Record<string, string> = {};
  let currentName: string | null = null;
  let currentBuffer: string[] = [];

  const flush = () => {
    if (currentName) {
      out[currentName] = currentBuffer.join('\n');
    }
  };

  const re = /^"?===\s*(tab_[a-z_]+)\s*===\s*"?$/i;
  for (const line of lines) {
    const m = line.match(re);
    if (m) {
      flush();
      currentName = m[1].toLowerCase();
      currentBuffer = [];
    } else if (currentName) {
      currentBuffer.push(line);
    }
  }
  flush();
  return out;
}

/** Parse CSV-as-string em array de objetos (header obrigatório na linha 1). */
export function parseTable(csv: string): Record<string, string>[] {
  if (!csv || !csv.trim()) return [];
  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  }) as Record<string, string>[];
}

// ── Normalizadores ─────────────────────────────────────────────────────────

const EMPTY_VALUES = new Set(['', '0000-00-00', '0000-00-00 00:00:00', 'NULL', 'null']);

export function isEmpty(v: string | null | undefined): boolean {
  if (v == null) return true;
  return EMPTY_VALUES.has(v.trim());
}

/** trim + nullify se vazio */
export function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t || EMPTY_VALUES.has(t)) return null;
  return t;
}

/** trim + uppercase + nullify se vazio */
export function cleanUpper(v: string | null | undefined): string | null {
  const c = clean(v);
  return c ? c.toUpperCase() : null;
}

/** Devolve apenas dígitos do CPF; null se length != 11 */
export function normalizeCpf(v: string | null | undefined): string | null {
  if (!v) return null;
  const digits = v.replace(/\D/g, '');
  return digits.length === 11 ? digits : null;
}

/** Apenas dígitos; null se vazio */
export function normalizePhone(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, '');
  return d.length >= 10 ? d : null;
}

/** Format CEP 00000-000; null se inválido */
export function normalizeCep(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, '');
  if (d.length !== 8) return null;
  return d.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}

/** Parse data ISO ou YYYY-MM-DD. '0000-00-00', vazio → null. */
export function parseDate(v: string | null | undefined): Date | null {
  if (isEmpty(v)) return null;
  const s = (v as string).trim();
  // CSV usa YYYY-MM-DD ou YYYY-MM-DD HH:MM:SS
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, year, month, day] = m;
  if (year === '0000' || month === '00' || day === '00') return null;
  // Constrói em UTC para evitar shift de timezone (DB Date guarda só YYYY-MM-DD)
  const d = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse timestamp completo. */
export function parseTimestamp(v: string | null | undefined): Date | null {
  if (isEmpty(v)) return null;
  const s = (v as string).trim().replace(' ', 'T');
  const d = new Date(s.endsWith('Z') ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Estado civil → enum string (ou null) */
export function normalizeMaritalStatus(v: string | null | undefined): string | null {
  const c = clean(v);
  if (!c) return null;
  const u = c.toUpperCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (u.startsWith('SOLTEIRO') || u.startsWith('SOLTEIRA')) return 'SOLTEIRO';
  if (u.startsWith('CASADO') || u.startsWith('CASADA')) return 'CASADO';
  if (u.startsWith('DIVORCIADO') || u.startsWith('DIVORCIADA')) return 'DIVORCIADO';
  if (u.startsWith('VIUVO') || u.startsWith('VIUVA') || u.includes('VIÚV')) return 'VIUVO';
  if (u.includes('UNI') && u.includes('ESTAV')) return 'UNIAO_ESTAVEL';
  return null;
}

/** tipo (CSV) → EquipmentType (Prisma enum) */
export function normalizeEquipmentType(tipo: string | null | undefined):
  | 'FIREARM'
  | 'EAR_PROTECTION'
  | 'EYE_PROTECTION'
  | 'HOLSTER'
  | 'MAGAZINE'
  | 'OTHER' {
  const u = (tipo ?? '').toUpperCase().trim();
  if (
    u.includes('PISTOLA') ||
    u.includes('REVOLVER') ||
    u.includes('REVÓLVER') ||
    u.includes('CARABINA') ||
    u.includes('FUZIL') ||
    u.includes('ESPINGARDA') ||
    u.includes('ARMA')
  ) {
    return 'FIREARM';
  }
  if (u.includes('AURICULAR') || u.includes('OUVIDO') || u.includes('PROT_AUD')) return 'EAR_PROTECTION';
  if (u.includes('OCULAR') || u.includes('OCULOS')) return 'EYE_PROTECTION';
  if (u.includes('COLDRE')) return 'HOLSTER';
  if (u.includes('CARREGADOR') || u.includes('MAGAZINE')) return 'MAGAZINE';
  return 'OTHER';
}

/** evento (CSV) → activityType */
export function normalizeActivityType(
  evento: string | null | undefined,
): 'TRAINING' | 'COMPETITION' {
  const u = (evento ?? '').toUpperCase().trim();
  if (u.includes('COMPET')) return 'COMPETITION';
  return 'TRAINING';
}

/** nacionalidade default BRASILEIRA */
export function normalizeNationality(v: string | null | undefined): string {
  const c = cleanUpper(v);
  return c ?? 'BRASILEIRA';
}

/** Constroi linha de endereço a partir dos 3 campos do CSV */
export function buildAddress(
  rua: string | null | undefined,
  numero: string | null | undefined,
  complemento: string | null | undefined,
): string | null {
  const r = clean(rua);
  const n = clean(numero);
  const c = clean(complemento);
  if (!r && !n && !c) return null;
  const parts: string[] = [];
  if (r) parts.push(r);
  if (n) parts.push(n);
  if (c) parts.push(c);
  return parts.join(', ');
}

/** parseInt seguro */
export function safeInt(v: string | null | undefined): number | null {
  if (isEmpty(v)) return null;
  const n = Number.parseInt((v as string).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/** parseFloat seguro */
export function safeFloat(v: string | null | undefined): number | null {
  if (isEmpty(v)) return null;
  // Aceita vírgula como separador decimal
  const s = (v as string).trim().replace(',', '.');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** UF default BA */
export function normalizeState(v: string | null | undefined): string {
  const c = cleanUpper(v);
  if (!c) return 'BA';
  return c.slice(0, 2);
}

// ── Logging ────────────────────────────────────────────────────────────────

export interface PhaseLog {
  table: string;
  total: number;
  ok: number;
  warn: number;
  skipped: number;
  errors: Array<{ row: number; reason: string; sample?: any }>;
  durationMs: number;
}

export function newPhaseLog(table: string): PhaseLog {
  return { table, total: 0, ok: 0, warn: 0, skipped: 0, errors: [], durationMs: 0 };
}

export function logSkip(p: PhaseLog, row: number, reason: string, sample?: any): void {
  p.skipped += 1;
  if (p.errors.length < 50) {
    p.errors.push({ row, reason, sample });
  }
}

export function logWarn(p: PhaseLog, row: number, reason: string, sample?: any): void {
  p.warn += 1;
  if (p.errors.length < 50) {
    p.errors.push({ row, reason, sample });
  }
}

// ── CLI args ───────────────────────────────────────────────────────────────

export interface MigrationArgs {
  dryRun: boolean;
  apply: boolean;
  cleanupOnly: boolean;
  skipCleanup: boolean;
  input: string;
  report: string;
  yes: boolean;
}

export function parseArgs(argv: string[]): MigrationArgs {
  const a: MigrationArgs = {
    dryRun: false,
    apply: false,
    cleanupOnly: false,
    skipCleanup: false,
    input: './data/backup_adm_clube.csv',
    report: './data/migration-report.json',
    yes: false,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') a.dryRun = true;
    else if (arg === '--apply') a.apply = true;
    else if (arg === '--cleanup-only') a.cleanupOnly = true;
    else if (arg === '--skip-cleanup') a.skipCleanup = true;
    else if (arg === '--yes' || arg === '-y') a.yes = true;
    else if (arg.startsWith('--input=')) a.input = arg.slice('--input='.length);
    else if (arg.startsWith('--report=')) a.report = arg.slice('--report='.length);
  }
  if (!a.apply) a.dryRun = true; // default
  return a;
}

/** Confirmação interativa via stdin. Retorna true se input == expected. */
export async function confirmDestructive(expected: string): Promise<boolean> {
  process.stdout.write(
    `\n⚠️  AÇÃO DESTRUTIVA — apagará dados.\nDigite "${expected}" para confirmar: `,
  );
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    const onData = (chunk: string) => {
      buf += chunk;
      if (buf.includes('\n')) {
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        resolve(buf.trim() === expected);
      }
    };
    process.stdin.on('data', onData);
  });
}
