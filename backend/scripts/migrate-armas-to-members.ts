// =====================================================
// migrate-armas-to-members.ts
//
// Corrige o erro de migracao em que TODAS as armas pessoais dos associados
// (tab_armas do ADM CLUBE) foram lancadas como Equipment do clube.
//
// O que faz:
//   1. Le tab_armas do CSV de backup.
//   2. Re-importa cada arma para o acervo PESSOAL do dono (MemberFirearm),
//      ligando por matricula -> User.memberNumber.
//   3. Remove de Equipment as armas correspondentes (match por numsigma e/ou
//      numserie), junto com seus EquipmentLoan (registros tambem errados).
//
// Idempotente: nao duplica MemberFirearm ja existente (mesmo dono + numsigma/serie).
//
// Uso:
//   npx tsx scripts/migrate-armas-to-members.ts            (dry-run, padrao)
//   npx tsx scripts/migrate-armas-to-members.ts --apply    (persiste)
//   flags: --input=<path> (default ./data/backup_adm_clube.csv)
// =====================================================

import { PrismaClient } from '@prisma/client';
import { readCsvUtf8, splitTables, parseTable, clean, parseDate } from './migration-utils.js';

const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const inputArg = argv.find((a) => a.startsWith('--input='));
const INPUT = inputArg ? inputArg.split('=')[1] : './data/backup_adm_clube.csv';

type Category = 'PISTOL' | 'REVOLVER' | 'RIFLE' | 'SHOTGUN';

function mapCategory(tipo: string | null): Category {
  const t = (tipo || '').trim().toUpperCase();
  if (t.includes('PISTOLA')) return 'PISTOL';
  if (t.includes('REVOLVER') || t.includes('REVÓLVER')) return 'REVOLVER';
  if (t.includes('ESPINGARDA')) return 'SHOTGUN';
  if (t.includes('CARABINA') || t.includes('FUZIL') || t.includes('RIFLE')) return 'RIFLE';
  return 'PISTOL'; // fallback (poucos casos de tipo vazio — admin ajusta depois)
}

// Mesma normalizacao usada em migrateSocios (numerico -> 4 digitos)
function normalizeMatricula(m: string | null): string | null {
  const c = clean(m);
  if (!c) return null;
  return /^\d+$/.test(c) ? c.padStart(4, '0') : c;
}

async function main() {
  console.log(`\n=== Migracao armas -> acervo pessoal (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  const content = readCsvUtf8(INPUT);
  const tables = splitTables(content);
  const armas = parseTable(tables['tab_armas'] || '');
  console.log(`tab_armas: ${armas.length} registros`);

  // memberNumber -> userId
  const users = await prisma.user.findMany({
    where: { memberNumber: { not: null } },
    select: { id: true, memberNumber: true },
  });
  const byMemberNumber = new Map<string, string>();
  for (const u of users) if (u.memberNumber) byMemberNumber.set(u.memberNumber, u.id);
  console.log(`usuarios com memberNumber: ${byMemberNumber.size}`);

  let created = 0;
  let skippedExisting = 0;
  const orphans: { matricula: string | null; modelo: string | null; numsigma: string | null }[] = [];
  const numsigmaSet = new Set<string>();
  const numserieSet = new Set<string>();

  for (const a of armas) {
    const numsigma = clean(a.numsigma);
    const numserie = clean(a.numserie);

    const matricula = normalizeMatricula(a.matricula);
    const userId = matricula ? byMemberNumber.get(matricula) : undefined;
    if (!userId) {
      // Sem dono identificado: NAO remove de Equipment (evita perda de dado).
      // Admin trata manualmente essas poucas armas orfas.
      orphans.push({ matricula, modelo: clean(a.modelo), numsigma });
      continue;
    }

    // So marca para limpeza de Equipment as armas que serao re-homed.
    if (numsigma) numsigmaSet.add(numsigma);
    if (numserie) numserieSet.add(numserie);

    // Dedupe: mesmo dono + mesma numsigma OU numserie. Sem nenhum dos dois,
    // cai para modelo+calibre+categoria (mantem idempotencia para os poucos
    // registros sem numero de serie/SIGMA).
    const dedupeOr = [
      numsigma ? { registrationId: numsigma } : undefined,
      numserie ? { serialNumber: numserie } : undefined,
    ].filter(Boolean) as any[];

    const existing = await prisma.memberFirearm.findFirst({
      where: dedupeOr.length
        ? { memberId: userId, isActive: true, OR: dedupeOr }
        : {
            memberId: userId,
            isActive: true,
            model: clean(a.modelo),
            caliber: clean(a.calibre),
            category: mapCategory(a.tipo),
          },
      select: { id: true },
    });
    if (existing) {
      skippedExisting++;
      continue;
    }

    if (APPLY) {
      await prisma.memberFirearm.create({
        data: {
          memberId: userId,
          category: mapCategory(a.tipo),
          brand: clean(a.marca),
          model: clean(a.modelo),
          caliber: clean(a.calibre),
          serialNumber: numserie,
          registrationId: numsigma,
          registrationBody: 'EXERCITO', // acervo CAC e registrado no Exercito
          acquisitionDate: parseDate(a.data_cadastro),
          notes: clean(a.clube_ou_instrutor) ? `Origem ADM: ${clean(a.clube_ou_instrutor)}` : null,
        },
      });
    }
    created++;
  }

  console.log(`\n--- Re-import MemberFirearm ---`);
  console.log(`  a criar: ${created}`);
  console.log(`  ja existentes (pulados): ${skippedExisting}`);
  console.log(`  orfaos (sem matricula/dono): ${orphans.length}`);
  if (orphans.length) {
    console.log(`  exemplos orfaos:`, JSON.stringify(orphans.slice(0, 8)));
  }

  // ── Limpeza Equipment ──────────────────────────────────────────────
  const targetEquip = await prisma.equipment.findMany({
    where: {
      OR: [
        { registrationId: { in: [...numsigmaSet] } },
        { serialNumber: { in: [...numserieSet] } },
      ],
    },
    select: { id: true, name: true, registrationId: true, serialNumber: true },
  });
  const equipIds = targetEquip.map((e) => e.id);
  const loanCount = await prisma.equipmentLoan.count({ where: { equipmentId: { in: equipIds } } });

  console.log(`\n--- Limpeza Equipment ---`);
  console.log(`  equipamentos a remover: ${targetEquip.length}`);
  console.log(`  emprestimos vinculados a remover: ${loanCount}`);
  const totalEquip = await prisma.equipment.count();
  console.log(`  total Equipment no banco: ${totalEquip} (sobrarao ${totalEquip - targetEquip.length})`);

  if (APPLY && equipIds.length) {
    await prisma.$transaction(async (tx) => {
      await tx.equipmentLoan.deleteMany({ where: { equipmentId: { in: equipIds } } });
      await tx.equipment.deleteMany({ where: { id: { in: equipIds } } });
    });
    console.log(`  -> removidos ${targetEquip.length} equipamentos e ${loanCount} emprestimos.`);
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Nada foi gravado. Rode com --apply para persistir.\n`);
  } else {
    console.log(`\n[APPLY] Concluido.\n`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Erro:', e);
  await prisma.$disconnect();
  process.exit(1);
});
