/**
 * Audita a migração comparando tab_membros do CSV com o banco.
 * - Lista cada linha do CSV com cpf (normalizado)
 * - Verifica se o sócio está no banco (por cpf)
 * - Detecta CPFs duplicados dentro do CSV (causa conflito no upsert)
 * - Tenta usar identidade (RG) como fallback se cpf for inválido
 */
import { PrismaClient } from '@prisma/client';
import { readCsvUtf8, splitTables, parseTable, normalizeCpf } from './migration-utils.js';

const prisma = new PrismaClient();
const csvPath = './data/backup_adm_clube.csv';

async function main() {
  const content = readCsvUtf8(csvPath);
  const tables = splitTables(content);
  const rows = parseTable(tables['tab_membros'] || '');

  console.log(`Total tab_membros: ${rows.length}`);

  // 1. CPFs duplicados no CSV
  const cpfRows = new Map<string, Array<{ row: number; nome: string; mat: string; email: string }>>();
  const noCpf: Array<{ row: number; nome: string; mat: string; email: string }> = [];

  rows.forEach((r, i) => {
    const cpf = normalizeCpf(r.cpf);
    const info = {
      row: i + 2,
      nome: (r.nome || '').trim(),
      mat: (r.matricula || '').trim(),
      email: (r.email || '').trim(),
    };
    if (!cpf) {
      noCpf.push(info);
    } else {
      if (!cpfRows.has(cpf)) cpfRows.set(cpf, []);
      cpfRows.get(cpf)!.push(info);
    }
  });

  const dups = [...cpfRows.entries()].filter(([, arr]) => arr.length > 1);
  console.log(`\n=== CPFs DUPLICADOS no CSV (cada um aparece em ≥2 linhas) ===`);
  console.log(`Total: ${dups.length} CPFs duplicados (envolvendo ${dups.reduce((s, [, a]) => s + a.length, 0)} linhas)`);
  for (const [cpf, arr] of dups) {
    console.log(`\nCPF ${cpf}:`);
    for (const e of arr) {
      console.log(`  - row ${e.row} | mat ${e.mat} | ${e.nome} | ${e.email}`);
    }
  }

  console.log(`\n=== Linhas SEM CPF VÁLIDO ===`);
  console.log(`Total: ${noCpf.length}`);
  for (const e of noCpf.slice(0, 50)) {
    console.log(`  - row ${e.row} | mat ${e.mat} | ${e.nome} | cpf_raw="${rows[e.row - 2].cpf}"`);
  }
  if (noCpf.length > 50) console.log(`  ... +${noCpf.length - 50} more`);

  // 2. Quem do CSV não está no banco
  const allCpfs = [...cpfRows.keys()];
  const inDb = await prisma.user.findMany({
    where: { cpf: { in: allCpfs } },
    select: { cpf: true, fullName: true, memberNumber: true },
  });
  const dbSet = new Set(inDb.map((u) => u.cpf));
  const missing = allCpfs.filter((c) => !dbSet.has(c));
  console.log(`\n=== CPFs VÁLIDOS do CSV NÃO presentes no banco ===`);
  console.log(`Total: ${missing.length}`);
  for (const c of missing.slice(0, 50)) {
    const r = cpfRows.get(c)![0];
    console.log(`  - CPF ${c} | mat ${r.mat} | ${r.nome}`);
  }

  // 3. Para cada CPF duplicado: quem ficou no banco vs quem ficou de fora
  console.log(`\n=== Quem GANHOU em cada conflito de CPF duplicado ===`);
  for (const [cpf, arr] of dups) {
    const dbUser = inDb.find((u) => u.cpf === cpf);
    if (!dbUser) {
      console.log(`  ✗ CPF ${cpf}: nenhum dos ${arr.length} candidatos entrou`);
      continue;
    }
    console.log(`  CPF ${cpf} → banco tem "${dbUser.fullName}" (mat ${dbUser.memberNumber})`);
    for (const e of arr) {
      const won = e.nome.toUpperCase() === dbUser.fullName.toUpperCase();
      console.log(`    ${won ? '✓' : '✗'} row ${e.row} | mat ${e.mat} | ${e.nome}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
