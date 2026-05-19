import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../lib/prisma.js';

// =====================================================
// Bootstrap one-shot: garante que os 13 socios "perdidos" pela migracao
// inicial (Edivanildo + outros com CPF colidido/malformado) sejam
// restaurados automaticamente no startup do backend.
//
// Dispara `migrate-patch-missing.ts` SOMENTE quando o sentinel (associado
// de matricula 0001) nao existe — no-op silencioso depois disso. O proprio
// script de patch ja e idempotente, mas a checagem aqui evita o overhead
// de spawnar processos a cada boot.
//
// Funciona em prod (EasyPanel) sem precisar abrir terminal do container.
// Requisitos:
//   - MIGRATION_PASSPHRASE env var (mesma usada no setup local)
//   - backend/data/backup_adm_clube.csv.enc (ja versionado no git)
//
// Fail-safe: qualquer falha apenas loga; NUNCA derruba o servidor.
// =====================================================

const SENTINEL_MEMBER_NUMBER = '0001'; // EDIVANILDO ANGELO DE MATOS
const CSV_ENC = 'data/backup_adm_clube.csv.enc';
const CSV_CLEAR = 'data/backup_adm_clube.csv';

export async function bootstrapMissingMembers(): Promise<void> {
  try {
    const sentinel = await prisma.user.findFirst({
      where: { memberNumber: SENTINEL_MEMBER_NUMBER },
      select: { id: true },
    });
    if (sentinel) return;

    console.log(`[BOOTSTRAP] Mat ${SENTINEL_MEMBER_NUMBER} ausente — disparando patch de socios perdidos...`);

    if (!process.env.MIGRATION_PASSPHRASE) {
      console.warn('[BOOTSTRAP] MIGRATION_PASSPHRASE nao configurada — skipando patch.');
      console.warn('[BOOTSTRAP] Configure no EasyPanel (backend > Environment) para auto-restauracao.');
      return;
    }

    const cwd = process.cwd();
    const csvEncPath = resolve(cwd, CSV_ENC);
    const csvClearPath = resolve(cwd, CSV_CLEAR);

    if (!existsSync(csvEncPath)) {
      console.warn(`[BOOTSTRAP] CSV criptografado ausente em ${csvEncPath} — skipando.`);
      return;
    }

    if (!existsSync(csvClearPath)) {
      console.log('[BOOTSTRAP] Descriptografando CSV...');
      await runScript(['scripts/csv-crypto.ts', 'decrypt', CSV_ENC, CSV_CLEAR]);
    }

    console.log('[BOOTSTRAP] Rodando migrate-patch-missing.ts...');
    await runScript(['scripts/migrate-patch-missing.ts']);
    console.log('[BOOTSTRAP] Patch concluido — socios perdidos restaurados.');
  } catch (error) {
    console.error('[BOOTSTRAP] Falha (servidor continua rodando):', (error as Error).message);
  }
}

function runScript(args: string[]): Promise<void> {
  return new Promise((resolveFn, rejectFn) => {
    const child = spawn('npx', ['tsx', ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    child.stdout.on('data', (d) => process.stdout.write(`[BOOTSTRAP] ${d}`));
    child.stderr.on('data', (d) => process.stderr.write(`[BOOTSTRAP] ${d}`));

    child.on('error', rejectFn);
    child.on('exit', (code) => {
      if (code === 0) resolveFn();
      else rejectFn(new Error(`Script saiu com codigo ${code}`));
    });
  });
}
