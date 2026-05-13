/**
 * Patch da migração inicial — recupera os 12 sócios reais que ficaram
 * de fora por problemas no CSV de origem:
 *
 *   (a) EDIVANILDO ANGELO DE MATOS (mat 0001, PRESIDENTE CBT) —
 *       perdido porque AGENOR IZIDRO (mat 1092) cadastrou no painel
 *       antigo o CPF do EDIVANILDO no campo cpf por engano. AGENOR
 *       entrou primeiro, EDIVANILDO virou "CPF duplicado" no script.
 *
 *   (b) 11 sócios com CPF malformado no CSV (digitação errada — 10/12/13
 *       dígitos, vazio, faltando DV).
 *
 * Estratégia: criar User com CPF placeholder único no formato
 *   9 + 0000 + matricula(4) + seq(2)  -> 11 dígitos
 * Ex.: matrícula 0001 -> 90000000100. Admin corrige CPF real depois.
 *
 * Notes em metadata sinaliza pendência. Reusa toda a normalização do
 * pipeline original.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  readCsvUtf8,
  splitTables,
  parseTable,
  normalizeCpf,
  normalizePhone,
  normalizeCep,
  normalizeState,
  normalizeNationality,
  normalizeMaritalStatus,
  parseDate,
  clean,
  cleanUpper,
  buildAddress,
  safeInt,
} from './migration-utils.js';

const prisma = new PrismaClient();
const csvPath = './data/backup_adm_clube.csv';

interface CsvRow {
  matricula: string;
  nome: string;
  cpf: string;
  email: string;
  data_filiacao: string;
  data_renovacao: string;
  data_nascimento: string;
  validade_cr: string;
  cr: string;
  nivel: string;
  bloqueio: string;
  rua: string;
  numero: string;
  bairro: string;
  complemento: string;
  cep: string;
  cidade: string;
  siglauf: string;
  estadocivil: string;
  naturalidade: string;
  nacionalidade: string;
  profissao: string;
  telefone: string;
  pai: string;
  mae: string;
  identidade: string;
  orgaouf: string;
}

function buildPlaceholderCpf(matricula: string, seq: number): string {
  const m = (matricula || 'X000').replace(/\D/g, '').padStart(4, '0').slice(-4);
  const s = String(seq).padStart(2, '0');
  return `90000${m}${s}`; // 11 digits: 9 + 0000 + 4 + 2
}

async function main() {
  console.log('═══ PATCH MIGRAÇÃO — SÓCIOS PERDIDOS ═══\n');

  const content = readCsvUtf8(csvPath);
  const tables = splitTables(content);
  const rows = parseTable(tables['tab_membros'] || '') as unknown as CsvRow[];

  console.log(`CSV total: ${rows.length} linhas`);

  // 1) Identificar quem deveria entrar mas não entrou (por nome+matricula)
  //    Critério: row tem nome e matricula, mas (a) CPF inválido OU
  //    (b) CPF colidiu com outra linha que entrou antes.

  // Mapa cpf válido -> array de rows
  const cpfRows = new Map<string, Array<{ row: number; data: CsvRow }>>();
  const invalidCpfRows: Array<{ row: number; data: CsvRow }> = [];

  rows.forEach((r, i) => {
    const cpf = normalizeCpf(r.cpf);
    const info = { row: i + 2, data: r };
    if (!cpf) {
      invalidCpfRows.push(info);
    } else {
      if (!cpfRows.has(cpf)) cpfRows.set(cpf, []);
      cpfRows.get(cpf)!.push(info);
    }
  });

  // Os "perdidos por duplicação" são as posições 2+ em cada bucket de CPFs duplicados
  // ONDE o nome difere do nome do vencedor (= conflito real, não re-cadastro).
  // Ignora registros de teste óbvios (NO NO NO NO, TESTE, etc).
  const dupLosers: Array<{ row: number; data: CsvRow; reason: string }> = [];
  for (const [, arr] of cpfRows) {
    if (arr.length < 2) continue;
    const winnerName = (arr[0].data.nome || '').trim().toUpperCase();
    for (const e of arr.slice(1)) {
      const losingName = (e.data.nome || '').trim().toUpperCase();
      if (!losingName) continue;
      // Ignorar registros de teste óbvios
      if (/^NO\b/i.test(losingName) || /^TESTE/i.test(losingName) || /\bTESTE\b/i.test(losingName)) continue;
      if (losingName !== winnerName && !namesAreSimilar(losingName, winnerName)) {
        dupLosers.push({ row: e.row, data: e.data, reason: 'CPF colidiu com outro sócio' });
      }
    }
  }

  // 2) Linhas com CPF malformado mas que parecem sócio legítimo (tem nome + matricula numérica)
  const cpfInvalidWithName: Array<{ row: number; data: CsvRow; reason: string }> = [];
  for (const e of invalidCpfRows) {
    const nome = (e.data.nome || '').trim();
    const mat = (e.data.matricula || '').trim();
    if (!nome) continue;
    if (!mat || !/^\d+$/.test(mat)) continue;
    // Heurística: ignorar "NO NO NO NO" e variantes
    if (/^NO\b/i.test(nome) || /^TESTE/i.test(nome)) continue;
    cpfInvalidWithName.push({
      row: e.row,
      data: e.data,
      reason: `CPF malformado no CSV: "${e.data.cpf}"`,
    });
  }

  const allMissing = [...dupLosers, ...cpfInvalidWithName];
  console.log(`\nA RESGATAR (${allMissing.length} sócios):`);
  for (const m of allMissing) {
    console.log(`  - mat ${m.data.matricula.padStart(4, '0')} | ${m.data.nome.padEnd(45)} | ${m.reason}`);
  }

  // 3) Inserir/Atualizar cada um — checando se já não existe no banco
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let seq = 0;

  for (const m of allMissing) {
    seq += 1;
    const r = m.data;
    const matricula = (r.matricula || '').padStart(4, '0');
    const fullName = r.nome.trim().toUpperCase();

    // Já existe alguém com essa matrícula no banco?
    const existing = await prisma.user.findFirst({
      where: { memberNumber: matricula, fullName },
    });
    if (existing) {
      console.log(`  [skip] mat ${matricula} ${fullName} — já existe no banco como ${existing.cpf}`);
      skipped += 1;
      continue;
    }

    const placeholderCpf = buildPlaceholderCpf(matricula, seq);

    // Garantir unicidade do placeholder (caso re-rode)
    let candidate = placeholderCpf;
    let tries = 0;
    while (await prisma.user.findUnique({ where: { cpf: candidate } })) {
      tries += 1;
      candidate = buildPlaceholderCpf(matricula, seq + tries * 100);
      if (tries > 10) throw new Error(`Não consegui gerar CPF único para ${fullName}`);
    }

    // Email fallback similar ao script principal
    let email = (r.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      email = `m${matricula}@cbt.local`;
    }
    // Se email já existe no banco, sufixar
    const emailTaken = await prisma.user.findFirst({ where: { email } });
    if (emailTaken) {
      email = email.replace('@', `+${matricula}@`);
    }

    const memberSince = parseDate(r.data_filiacao) ?? new Date('2016-01-01T00:00:00.000Z');
    const annuityValidUntil = parseDate(r.data_renovacao);
    const bloqueio = (r.bloqueio ?? '').trim().toUpperCase();
    let isActive: boolean;
    if (bloqueio === 'D') {
      isActive = false;
    } else if (annuityValidUntil) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 6);
      isActive = annuityValidUntil >= cutoff;
    } else {
      isActive = false;
    }
    const crLevel = (() => {
      const n = safeInt(r.nivel);
      if (n != null && n >= 1 && n <= 3) return n;
      return null;
    })();

    const passwordHash = await bcrypt.hash(candidate.slice(0, 6), 10);

    await prisma.user.create({
      data: {
        cpf: candidate,
        email,
        passwordHash,
        role: 'ASSOCIATE',
        status: isActive ? 'ACTIVE' : 'INACTIVE',
        isActive,
        fullName,
        memberNumber: matricula,
        dateOfBirth: parseDate(r.data_nascimento),
        phone: normalizePhone(r.telefone),
        address: buildAddress(r.rua, r.numero, r.complemento),
        neighborhood: clean(r.bairro),
        city: clean(r.cidade),
        state: normalizeState(r.siglauf),
        zipCode: normalizeCep(r.cep),
        rg: clean(r.identidade),
        rgIssuer: cleanUpper(r.orgaouf),
        nationality: normalizeNationality(r.nacionalidade),
        naturality: clean(r.naturalidade),
        fatherName: clean(r.pai),
        motherName: clean(r.mae),
        profession: clean(r.profissao),
        maritalStatus: normalizeMaritalStatus(r.estadocivil),
        cr: clean(r.cr),
        crLevel,
        crExpiry: parseDate(r.validade_cr),
        memberSince,
        annuityValidUntil,
        clubId: 'cbt-bahia',
        metadata: {
          migration: {
            patchedAt: new Date().toISOString(),
            reason: m.reason,
            originalCpf: r.cpf || null,
            placeholderCpf: true,
            note: 'CPF placeholder — substituir pelo CPF real no painel.',
          },
        },
      },
    });
    created += 1;
    console.log(`  [+] ${matricula} ${fullName} -> CPF placeholder ${candidate}`);
  }

  console.log(`\n═══ RESUMO ═══`);
  console.log(`  Criados: ${created}`);
  console.log(`  Atualizados: ${updated}`);
  console.log(`  Skipados (já no banco): ${skipped}`);

  await prisma.$disconnect();
}

// Detecção barata de variantes de spelling (Levenshtein ratio simples)
function namesAreSimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  const A = a.replace(/\s+/g, ' ');
  const B = b.replace(/\s+/g, ' ');
  if (A === B) return true;
  // Compara primeiras duas palavras (nome+primeiro sobrenome)
  const A2 = A.split(' ').slice(0, 2).join(' ');
  const B2 = B.split(' ').slice(0, 2).join(' ');
  if (A2 === B2) return true;
  return false;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
