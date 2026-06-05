// =====================================================
// migrate-adm-clube.ts
// Migra dados do CSV de backup do sistema ADM CLUBE para
// o schema Prisma do Portal CBT.
//
// Uso:
//   npm run migrate:adm:dry-run       (simulação, padrão)
//   npm run migrate:adm:cleanup       (--apply para apagar de fato)
//   npm run migrate:adm:apply         (executa migração; por padrão ainda inclui cleanup)
//   tsx scripts/migrate-adm-clube.ts --apply --skip-cleanup
//
// Flags suportadas:
//   --dry-run        (default) — não persiste nada
//   --apply          — persiste no banco (requer confirmação interativa para cleanup)
//   --cleanup-only   — só limpa o banco; pula a migração de dados
//   --skip-cleanup   — pula a limpeza; só executa a migração
//   --yes            — pula confirmação interativa (use com cautela)
//   --input=<path>   — caminho do CSV (default: ./data/backup_adm_clube.csv)
//   --report=<path>  — caminho do relatório (default: ./data/migration-report.json)
// =====================================================

import { writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  readCsvUtf8,
  splitTables,
  parseTable,
  parseDate,
  parseTimestamp,
  normalizeCpf,
  normalizePhone,
  normalizeCep,
  normalizeMaritalStatus,
  normalizeEquipmentType,
  normalizeActivityType,
  normalizeNationality,
  normalizeState,
  buildAddress,
  clean,
  cleanUpper,
  safeInt,
  safeFloat,
  newPhaseLog,
  logSkip,
  logWarn,
  parseArgs,
  confirmDestructive,
  type PhaseLog,
  type MigrationArgs,
} from './migration-utils.js';

const prisma = new PrismaClient();

const PRESERVED_EMAILS = ['admin@cbt.com.br', 'caixa@cbt.com.br', 'associado@cbt.com.br'];

// =====================================================
// CLEANUP
// =====================================================

async function dryRunCleanup(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  counts['UserAttachment'] = await prisma.userAttachment.count();
  counts['FaceProfile'] = await prisma.faceProfile.count();
  counts['EventParticipation'] = await prisma.eventParticipation.count();
  counts['HabitualityRecord'] = await prisma.habitualityRecord.count();
  counts['MemberDocument'] = await prisma.memberDocument.count();
  counts['AuditLog'] = await prisma.auditLog.count();
  counts['Expense'] = await prisma.expense.count();
  counts['AnnuityPayment'] = await prisma.annuityPayment.count();
  counts['EquipmentLoan'] = await prisma.equipmentLoan.count();
  counts['TransactionItem'] = await prisma.transactionItem.count();
  counts['Transaction'] = await prisma.transaction.count();
  counts['VisitDetail'] = await prisma.visitDetail.count();
  counts['Visit'] = await prisma.visit.count();
  counts['News'] = await prisma.news.count();
  counts['Event'] = await prisma.event.count();
  counts['StockMovement'] = await prisma.stockMovement.count();
  counts['StockItem'] = await prisma.stockItem.count();
  counts['Product'] = await prisma.product.count();
  counts['Equipment'] = await prisma.equipment.count();
  counts['Lane'] = await prisma.lane.count();
  counts['UserToDelete'] = await prisma.user.count({
    where: { email: { notIn: PRESERVED_EMAILS } },
  });
  return counts;
}

async function applyCleanup(): Promise<void> {
  // Loga contagens antes
  const before = await dryRunCleanup();
  console.log('Estado antes do cleanup:');
  for (const [k, v] of Object.entries(before)) {
    if (v > 0) console.log(`  ${k}: ${v}`);
  }

  // Tudo numa única transaction
  await prisma.$transaction(async (tx) => {
    // 1. Cascades automáticos (UserAttachment, FaceProfile) serão limpos quando User for apagado.
    //    Mas antes precisamos quebrar todas as outras FKs.
    await tx.eventParticipation.deleteMany({});
    await tx.habitualityRecord.deleteMany({});
    await tx.memberDocument.deleteMany({});
    await tx.auditLog.deleteMany({});
    await tx.expense.deleteMany({});
    // Lane.currentMemberId → null antes de deletar Lane
    await tx.lane.updateMany({ data: { currentMemberId: null } });
    await tx.annuityPayment.deleteMany({});
    await tx.equipmentLoan.deleteMany({});
    // TransactionItem cascade ao deletar Transaction
    await tx.transaction.deleteMany({});
    await tx.visitDetail.deleteMany({});
    await tx.visit.deleteMany({});
    await tx.news.deleteMany({});
    await tx.event.deleteMany({});
    // Stock
    await tx.stockMovement.deleteMany({});
    await tx.stockItem.deleteMany({});
    await tx.product.deleteMany({});
    // Equipment
    await tx.equipment.deleteMany({});
    // Lane
    await tx.lane.deleteMany({});
    // FaceProfile e UserAttachment cascade ao deletar User
    await tx.user.deleteMany({
      where: { email: { notIn: PRESERVED_EMAILS } },
    });
  }, { timeout: 60000 });

  console.log('✓ Cleanup concluído.');
}

// =====================================================
// CLUB SETTINGS — garantir que existe
// =====================================================

async function ensureClubSettings(): Promise<void> {
  const existing = await prisma.clubSettings.findUnique({ where: { clubId: 'cbt-bahia' } });
  if (existing) {
    console.log('✓ ClubSettings já existe — preservada.');
    return;
  }
  await prisma.clubSettings.create({
    data: {
      clubId: 'cbt-bahia',
      clubName: 'Clube Baiano de Tiro',
      annuityAmount: new Prisma.Decimal(600),
      totalLanes: 6,
      cnpj: null,
      crPj: null,
      addressLine: null,
      city: null,
      state: 'BA',
      zipCode: null,
      phone: null,
      email: null,
      responsibleName: null,
      responsibleCpf: null,
      responsibleRole: null,
    },
  });
  console.log('✓ ClubSettings criada (placeholders).');
}

// =====================================================
// FASE 1 — MEMBROS
// =====================================================

interface MembersResult {
  log: PhaseLog;
  matriculaToUserId: Map<string, string>;
}

async function migrateMembers(rows: Record<string, string>[], args: MigrationArgs): Promise<MembersResult> {
  const log = newPhaseLog('tab_membros');
  log.total = rows.length;
  const start = Date.now();

  const matriculaToUserId = new Map<string, string>();

  // Coletar emails já tomados (admin/associado preservados) para evitar conflito
  const taken = new Set(PRESERVED_EMAILS);
  const seenCpfs = new Set<string>();
  const seenMatriculas = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIdx = i + 2; // +1 header, +1 base 1

    const cpf = normalizeCpf(row.cpf);
    if (!cpf) {
      logSkip(log, rowIdx, 'CPF inválido/ausente', { matricula: row.matricula, nome: row.nome });
      continue;
    }
    if (PRESERVED_EMAILS.includes((row.email ?? '').trim().toLowerCase())) {
      logSkip(log, rowIdx, 'CPF/email reservado pelo seed', { cpf, email: row.email });
      continue;
    }
    if (cpf === '00000000000' || cpf === '11111111111') {
      logSkip(log, rowIdx, 'CPF placeholder do seed (admin/associado)', { cpf });
      continue;
    }

    if (seenCpfs.has(cpf)) {
      logSkip(log, rowIdx, 'CPF duplicado dentro do CSV', { cpf, nome: row.nome });
      continue;
    }
    seenCpfs.add(cpf);

    const fullName = clean(row.nome);
    if (!fullName) {
      logSkip(log, rowIdx, 'Nome ausente', { cpf });
      continue;
    }

    let matricula = clean(row.matricula);
    if (matricula) {
      // Padronização: padStart 4 dígitos se for numérico
      if (/^\d+$/.test(matricula)) matricula = matricula.padStart(4, '0');
      if (seenMatriculas.has(matricula)) {
        const orig = matricula;
        let suffix = 2;
        while (seenMatriculas.has(`${orig}-${suffix}`)) suffix++;
        matricula = `${orig}-${suffix}`;
        logWarn(log, rowIdx, `Matrícula duplicada — renomeada para ${matricula}`, { original: orig });
      }
      seenMatriculas.add(matricula);
    }

    // Email: trim, lowercase, fallback m{matricula}@cbt.local
    let email = (row.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      email = `m${matricula ?? cpf}@cbt.local`;
    }
    if (taken.has(email)) {
      const suffixed = email.replace('@', `+${matricula ?? cpf.slice(-4)}@`);
      logWarn(log, rowIdx, `Email duplicado — usando ${suffixed}`, { original: email });
      email = suffixed;
    }
    taken.add(email);

    const memberSince = parseDate(row.data_filiacao) ?? new Date('2016-01-01T00:00:00.000Z');
    const annuityValidUntil = parseDate(row.data_renovacao);

    // Heurística active/inactive — o CSV antigo tem o campo `status` mostly vazio,
    // mas há sinais claros via `bloqueio` (D = desativado) e `data_renovacao`:
    //  - bloqueio === 'D' → INACTIVE (marca explícita do sistema antigo)
    //  - data_renovacao existe e >= 6 meses atrás → ACTIVE (anuidade recente)
    //  - caso contrário → INACTIVE
    const bloqueio = (row.bloqueio ?? '').trim().toUpperCase();
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
    const userStatus = isActive ? 'ACTIVE' : 'INACTIVE';
    const dateOfBirth = parseDate(row.data_nascimento);
    const crExpiry = parseDate(row.validade_cr);
    const crLevel = (() => {
      const n = safeInt(row.nivel);
      if (n != null && n >= 1 && n <= 3) return n;
      return null;
    })();

    const passwordHash = await bcrypt.hash(cpf.slice(0, 6), 10);

    const data = {
      cpf,
      email,
      passwordHash,
      role: 'ASSOCIATE' as const,
      status: userStatus as 'ACTIVE' | 'INACTIVE',
      isActive,
      fullName: fullName.toUpperCase(),
      memberNumber: matricula,
      dateOfBirth,
      phone: normalizePhone(row.telefone),
      address: buildAddress(row.rua, row.numero, row.complemento),
      neighborhood: clean(row.bairro),
      city: clean(row.cidade),
      state: normalizeState(row.siglauf),
      zipCode: normalizeCep(row.cep),
      rg: clean(row.identidade),
      rgIssuer: cleanUpper(row.orgaouf),
      nationality: normalizeNationality(row.nacionalidade),
      naturality: clean(row.naturalidade),
      fatherName: clean(row.pai),
      motherName: clean(row.mae),
      profession: clean(row.profissao),
      maritalStatus: normalizeMaritalStatus(row.estadocivil),
      cr: clean(row.cr),
      crLevel,
      crExpiry,
      memberSince,
      annuityValidUntil,
      clubId: 'cbt-bahia',
    };

    if (args.dryRun) {
      log.ok += 1;
      // Em dry-run, simulamos um id fake — útil para Fase 3 também simular
      matriculaToUserId.set(matricula ?? cpf, `dryrun-${cpf}`);
      continue;
    }

    try {
      const user = await prisma.user.upsert({
        where: { cpf },
        create: data,
        update: data,
      });
      matriculaToUserId.set(matricula ?? cpf, user.id);
      log.ok += 1;
    } catch (e: any) {
      logSkip(log, rowIdx, `Erro Prisma: ${e.code ?? e.message}`, { cpf, email });
    }
  }

  log.durationMs = Date.now() - start;
  return { log, matriculaToUserId };
}

// =====================================================
// FASE 2 — ARMAS (acervo do clube)
// =====================================================

async function migrateArmas(rows: Record<string, string>[], args: MigrationArgs): Promise<PhaseLog> {
  const log = newPhaseLog('tab_armas');
  log.total = rows.length;
  const start = Date.now();

  const seenSerials = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIdx = i + 2;

    const tipo = clean(row.tipo);
    if (!tipo) {
      logSkip(log, rowIdx, 'Tipo de equipamento ausente', { id: row.id });
      continue;
    }
    const equipmentType = normalizeEquipmentType(tipo);
    const brand = clean(row.marca);
    const model = clean(row.modelo);
    const name = [tipo, brand, model].filter(Boolean).join(' ').trim() || tipo;

    let serialNumber = clean(row.numserie);
    if (serialNumber && seenSerials.has(serialNumber)) {
      const original = serialNumber;
      let suffix = 2;
      while (seenSerials.has(`${original} (${suffix})`)) suffix++;
      serialNumber = `${original} (${suffix})`;
      logWarn(log, rowIdx, `Serial duplicado renomeado para ${serialNumber}`, { original });
    }
    if (serialNumber) seenSerials.add(serialNumber);

    const isActive = (row.status ?? '').trim().toLowerCase() === 'ativo';

    const data = {
      clubId: 'cbt-bahia',
      name,
      equipmentType,
      serialNumber: serialNumber ?? null,
      registrationId: clean(row.numsigma),
      caliber: clean(row.calibre),
      brand: brand ?? null,
      model: model ?? null,
      condition: 'GOOD' as const,
      isAvailable: isActive,
      isActive,
      description: clean(row.descricao),
      acquisitionDate: parseDate(row.data_cadastro),
    };

    if (args.dryRun) {
      log.ok += 1;
      continue;
    }

    try {
      if (serialNumber) {
        await prisma.equipment.upsert({
          where: { serialNumber },
          create: data,
          update: data,
        });
      } else {
        await prisma.equipment.create({ data });
      }
      log.ok += 1;
    } catch (e: any) {
      logSkip(log, rowIdx, `Erro Prisma: ${e.code ?? e.message}`, { name, serialNumber });
    }
  }

  log.durationMs = Date.now() - start;
  return log;
}

// =====================================================
// FASE 3 — HABITUALIDADES + VISITAS + DETALHES
// =====================================================

interface HabitualidadeRow {
  rowIdx: number;
  memberId: string;
  matricula: string;
  date: Date;
  activityType: 'TRAINING' | 'COMPETITION';
  caliber: string;
  firearmName: string | null;
  shotsFired: number;
  purpose: string | null;
}

async function migrateHabitualidades(
  rows: Record<string, string>[],
  matriculaToUserId: Map<string, string>,
  args: MigrationArgs,
): Promise<{ habit: PhaseLog; visit: PhaseLog; visitDetail: PhaseLog; visitKeys: Set<string> }> {
  const habit = newPhaseLog('tab_habitualidade');
  habit.total = rows.length;
  const visit = newPhaseLog('tab_habitualidade→visit');
  const visitDetail = newPhaseLog('tab_habitualidade→visitDetail');
  const start = Date.now();

  // Normaliza linhas
  const normalized: HabitualidadeRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIdx = i + 2;

    let matricula = clean(row.matricula);
    if (!matricula) {
      logSkip(habit, rowIdx, 'Matrícula ausente', { id: row.id });
      continue;
    }
    if (/^\d+$/.test(matricula)) matricula = matricula.padStart(4, '0');

    const memberId = matriculaToUserId.get(matricula);
    if (!memberId) {
      logSkip(habit, rowIdx, `Membro não encontrado (matrícula ${matricula})`, { id: row.id });
      continue;
    }

    const date = parseDate(row.data);
    if (!date) {
      logSkip(habit, rowIdx, 'Data inválida', { id: row.id, data: row.data });
      continue;
    }

    const caliber = clean(row.calibre) ?? '';
    if (!caliber) {
      logWarn(habit, rowIdx, 'Calibre vazio — usando "—"', { id: row.id });
    }

    const modelo = clean(row.modelo);
    const numsigma = clean(row.numsigma);
    const firearmName =
      modelo || numsigma
        ? `${modelo ?? ''}${numsigma ? ` (SIGMA ${numsigma})` : ''}`.trim()
        : null;

    normalized.push({
      rowIdx,
      memberId,
      matricula,
      date,
      activityType: normalizeActivityType(row.evento),
      caliber: caliber || '—',
      firearmName,
      shotsFired: safeInt(row.qtdemunicoes) ?? 0,
      purpose: clean(row.local),
    });
  }

  // Agrupa por (memberId, dateISO)
  const groups = new Map<string, HabitualidadeRow[]>();
  for (const r of normalized) {
    const key = `${r.memberId}|${r.date.toISOString().slice(0, 10)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const visitKeys = new Set<string>(); // memberId|YYYY-MM-DD criados nesta fase

  if (args.dryRun) {
    habit.ok = normalized.length;
    visit.total = groups.size;
    visit.ok = groups.size;
    visitDetail.total = normalized.length;
    visitDetail.ok = normalized.length;
    for (const key of groups.keys()) visitKeys.add(key);
    habit.durationMs = Date.now() - start;
    visit.durationMs = visitDetail.durationMs = 0;
    return { habit, visit, visitDetail, visitKeys };
  }

  // Inserts em chunks
  let groupCount = 0;
  for (const [key, items] of groups.entries()) {
    groupCount++;
    const first = items[0];
    visit.total += 1;
    visitDetail.total += items.length;

    try {
      await prisma.$transaction(async (tx) => {
        // Cria Visit
        const visitRow = await tx.visit.create({
          data: {
            clubId: 'cbt-bahia',
            memberId: first.memberId,
            visitDate: first.date,
            checkInTime: first.date, // sem hora real no CSV, usa 00:00 do dia
            purpose: first.purpose ?? null,
          },
        });
        visit.ok += 1;
        visitKeys.add(key);

        // Detalhes + habitualidades
        for (const item of items) {
          await tx.visitDetail.create({
            data: {
              visitId: visitRow.id,
              memberId: item.memberId,
              caliber: item.caliber,
              firearmName: item.firearmName,
              shotsFired: item.shotsFired,
            },
          });
          visitDetail.ok += 1;

          await tx.habitualityRecord.create({
            data: {
              clubId: 'cbt-bahia',
              memberId: item.memberId,
              caliber: item.caliber,
              activityDate: item.date,
              activityType: item.activityType,
              visitId: visitRow.id,
            },
          });
          habit.ok += 1;
        }
      }, { timeout: 30000 });
    } catch (e: any) {
      logSkip(habit, first.rowIdx, `Erro grupo: ${e.code ?? e.message}`, { key, count: items.length });
    }

    if (groupCount % 200 === 0) {
      console.log(`  habitualidades: ${groupCount}/${groups.size} grupos processados`);
    }
  }

  habit.durationMs = Date.now() - start;
  visit.durationMs = habit.durationMs;
  visitDetail.durationMs = habit.durationMs;
  return { habit, visit, visitDetail, visitKeys };
}

// =====================================================
// FASE 4 — BIOMETRIA / PRESENÇA (Visit complementar)
// =====================================================

async function migrateBiometria(
  rows: Record<string, string>[],
  matriculaToUserId: Map<string, string>,
  visitKeys: Set<string>,
  args: MigrationArgs,
): Promise<PhaseLog> {
  const log = newPhaseLog('tab_biometria_presenca');
  log.total = rows.length;
  const start = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIdx = i + 2;

    let matricula = clean(row.matricula);
    if (!matricula) {
      logSkip(log, rowIdx, 'Matrícula ausente');
      continue;
    }
    if (/^\d+$/.test(matricula)) matricula = matricula.padStart(4, '0');

    const memberId = matriculaToUserId.get(matricula);
    if (!memberId) {
      logSkip(log, rowIdx, `Membro não encontrado (matrícula ${matricula})`);
      continue;
    }

    const checkInTime = parseTimestamp(row.datahora);
    if (!checkInTime) {
      logSkip(log, rowIdx, 'datahora inválida');
      continue;
    }

    // Visit por dia — pula se já existe (criada na Fase 3)
    const dateOnly = new Date(
      `${checkInTime.toISOString().slice(0, 10)}T00:00:00.000Z`,
    );
    const key = `${memberId}|${dateOnly.toISOString().slice(0, 10)}`;
    if (visitKeys.has(key)) {
      log.skipped += 1;
      continue;
    }

    if (args.dryRun) {
      log.ok += 1;
      visitKeys.add(key);
      continue;
    }

    try {
      await prisma.visit.create({
        data: {
          clubId: 'cbt-bahia',
          memberId,
          visitDate: dateOnly,
          checkInTime,
          purpose: 'Presença biométrica',
        },
      });
      visitKeys.add(key);
      log.ok += 1;
    } catch (e: any) {
      logSkip(log, rowIdx, `Erro Prisma: ${e.code ?? e.message}`);
    }
  }

  log.durationMs = Date.now() - start;
  return log;
}

// =====================================================
// FASE 5 — FINANCEIRO (anuidades pagas)
// =====================================================

async function migrateFinanceiro(
  rows: Record<string, string>[],
  matriculaToUserId: Map<string, string>,
  args: MigrationArgs,
): Promise<PhaseLog> {
  const log = newPhaseLog('tab_financeiro');
  log.total = rows.length;
  const start = Date.now();

  const YEARS = [2021, 2022, 2023, 2024, 2025];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIdx = i + 2;

    let matricula = clean(row.matricula);
    if (!matricula) {
      logSkip(log, rowIdx, 'Matrícula ausente');
      continue;
    }
    if (/^\d+$/.test(matricula)) matricula = matricula.padStart(4, '0');

    const memberId = matriculaToUserId.get(matricula);
    if (!memberId) {
      logSkip(log, rowIdx, `Membro não encontrado (matrícula ${matricula})`);
      continue;
    }

    for (const year of YEARS) {
      const amountKey = `anuidade${year}` as const;
      const dateKey = `data_anuidade_${year}` as const;
      const formaKey = `forma_pgto_anuidade${year}` as const;
      const obsKey = `obs_anuidade_${year}` as const;

      const amount = safeFloat(row[amountKey]);
      const paymentDate = parseDate(row[dateKey]);
      if (!amount || amount <= 0 || !paymentDate) continue; // só registros com pagamento real

      const data = {
        clubId: 'cbt-bahia',
        memberId,
        amount: new Prisma.Decimal(amount),
        paymentDate,
        paymentMethod: clean(row[formaKey]),
        referenceYear: year,
        validFrom: new Date(`${year}-01-01T00:00:00.000Z`),
        validUntil: new Date(`${year}-12-31T00:00:00.000Z`),
        notes: clean(row[obsKey]),
      };

      if (args.dryRun) {
        log.ok += 1;
        continue;
      }

      try {
        await prisma.annuityPayment.create({ data });
        log.ok += 1;
      } catch (e: any) {
        logSkip(log, rowIdx, `Erro ano ${year}: ${e.code ?? e.message}`, { matricula, amount });
      }
    }
  }

  log.durationMs = Date.now() - start;
  return log;
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Migração ADM CLUBE → Portal CBT');
  console.log(`  Modo: ${args.apply ? 'APPLY (escreve no DB)' : 'DRY-RUN (simula)'}`);
  console.log(`  Cleanup: ${args.skipCleanup ? 'pulado' : args.cleanupOnly ? 'apenas cleanup' : 'incluído'}`);
  console.log(`  CSV: ${args.input}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const phases: PhaseLog[] = [];
  const meta: any = {
    startedAt: new Date().toISOString(),
    args: { ...args },
  };

  // ── Cleanup ────────────────────────────────────────────────────────────
  if (!args.skipCleanup) {
    console.log('▶ Fase 0: Cleanup');
    if (args.apply) {
      if (!args.yes) {
        const ok = await confirmDestructive('LIMPAR E MIGRAR');
        if (!ok) {
          console.log('✗ Cancelado pelo usuário.');
          process.exit(1);
        }
      }
      await applyCleanup();
    } else {
      const counts = await dryRunCleanup();
      console.log('  (dry-run) seriam apagados:');
      for (const [k, v] of Object.entries(counts)) {
        if (v > 0) console.log(`    ${k}: ${v}`);
      }
    }
    if (args.cleanupOnly) {
      meta.cleanupCounts = await dryRunCleanup();
      writeFileSync(args.report, JSON.stringify({ meta, phases }, null, 2));
      console.log(`\n✓ Cleanup-only finalizado. Relatório: ${args.report}`);
      await prisma.$disconnect();
      return;
    }
  }

  // ── Garante ClubSettings (não pode ficar sem) ──────────────────────────
  if (args.apply) {
    await ensureClubSettings();
  }

  // ── Lê CSV ─────────────────────────────────────────────────────────────
  console.log('\n▶ Lendo CSV...');
  const content = readCsvUtf8(args.input);
  const tables = splitTables(content);
  console.log(`  Tabelas encontradas: ${Object.keys(tables).join(', ')}`);

  const tabMembros = parseTable(tables.tab_membros ?? '');
  const tabArmas = parseTable(tables.tab_armas ?? '');
  const tabHabit = parseTable(tables.tab_habitualidade ?? '');
  const tabBiom = parseTable(tables.tab_biometria_presenca ?? '');
  const tabFin = parseTable(tables.tab_financeiro ?? '');

  console.log(
    `  Linhas: membros=${tabMembros.length} armas=${tabArmas.length} habit=${tabHabit.length} biom=${tabBiom.length} fin=${tabFin.length}`,
  );

  // ── Fase 1: Membros ────────────────────────────────────────────────────
  console.log('\n▶ Fase 1: Membros');
  const { log: membersLog, matriculaToUserId } = await migrateMembers(tabMembros, args);
  phases.push(membersLog);
  console.log(`  ok=${membersLog.ok} warn=${membersLog.warn} skip=${membersLog.skipped} (${membersLog.durationMs}ms)`);

  // ── Fase 2: Armas ──────────────────────────────────────────────────────
  console.log('\n▶ Fase 2: Armas');
  const armasLog = await migrateArmas(tabArmas, args);
  phases.push(armasLog);
  console.log(`  ok=${armasLog.ok} warn=${armasLog.warn} skip=${armasLog.skipped} (${armasLog.durationMs}ms)`);

  // ── Fase 3: Habitualidades ─────────────────────────────────────────────
  console.log('\n▶ Fase 3: Habitualidades + Visitas + Detalhes');
  const { habit, visit, visitDetail, visitKeys } = await migrateHabitualidades(
    tabHabit,
    matriculaToUserId,
    args,
  );
  phases.push(habit);
  phases.push(visit);
  phases.push(visitDetail);
  console.log(
    `  habit ok=${habit.ok} skip=${habit.skipped} | visit ok=${visit.ok} | detail ok=${visitDetail.ok} (${habit.durationMs}ms)`,
  );

  // ── Fase 4: Biometria ──────────────────────────────────────────────────
  console.log('\n▶ Fase 4: Biometria/Presença (Visits complementares)');
  const biomLog = await migrateBiometria(tabBiom, matriculaToUserId, visitKeys, args);
  phases.push(biomLog);
  console.log(`  ok=${biomLog.ok} skip=${biomLog.skipped} (${biomLog.durationMs}ms)`);

  // ── Fase 5: Financeiro ─────────────────────────────────────────────────
  console.log('\n▶ Fase 5: Financeiro (anuidades)');
  const finLog = await migrateFinanceiro(tabFin, matriculaToUserId, args);
  phases.push(finLog);
  console.log(`  ok=${finLog.ok} skip=${finLog.skipped} (${finLog.durationMs}ms)`);

  // ── Sumário ────────────────────────────────────────────────────────────
  meta.finishedAt = new Date().toISOString();
  meta.totals = {
    okSum: phases.reduce((s, p) => s + p.ok, 0),
    warnSum: phases.reduce((s, p) => s + p.warn, 0),
    skipSum: phases.reduce((s, p) => s + p.skipped, 0),
  };

  const reportPayload = { meta, phases };
  writeFileSync(args.report, JSON.stringify(reportPayload, null, 2));

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  ✓ Migração ${args.apply ? 'APLICADA' : 'simulada (dry-run)'}.`);
  console.log(`  Total OK: ${meta.totals.okSum}`);
  console.log(`  Total WARN: ${meta.totals.warnSum}`);
  console.log(`  Total SKIP: ${meta.totals.skipSum}`);
  console.log(`  Relatório: ${args.report}`);
  console.log('═══════════════════════════════════════════════════════');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('✗ Erro fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
