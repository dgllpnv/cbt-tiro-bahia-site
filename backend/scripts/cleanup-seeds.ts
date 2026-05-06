// =====================================================
// cleanup-seeds.ts
// Remove APENAS os dados criados pelos scripts de seed
// (seed.ts, seed-demo.ts, seed-news-events.ts, seed-financial.ts),
// preservando os dados reais migrados do ADM CLUBE.
//
// Identificadores precisos:
//   • Visit demo:        notes contém "[demo]"
//   • Tx/Exp/Anuid demo: notes contém "[demo-fin]"
//   • User demo:         email termina em "@demo.cbt.com.br"
//   • Equipment seed:    serialNumber começa com "CBT-"
//   • Products:          TODOS (migração não cria)
//   • News/Events:       TODOS (migração não cria)
//
// Side-effect adicional do seed-financial.ts: ele sobrescreveu
// User.annuityValidUntil em ~55% dos sócios ativos. Esta etapa
// re-lê o CSV original e restaura o valor de data_renovacao para
// todos os usuários migrados.
//
// Uso:
//   npx tsx scripts/cleanup-seeds.ts             (dry-run, default)
//   npx tsx scripts/cleanup-seeds.ts --apply
//   npx tsx scripts/cleanup-seeds.ts --apply --yes      (sem confirmação)
//   npx tsx scripts/cleanup-seeds.ts --apply --skip-restore  (sem restaurar annuity)
// =====================================================

import { PrismaClient } from '@prisma/client';
import {
  readCsvUtf8,
  splitTables,
  parseTable,
  parseDate,
  normalizeCpf,
  confirmDestructive,
} from './migration-utils.js';

const prisma = new PrismaClient();

interface Args {
  apply: boolean;
  yes: boolean;
  skipRestore: boolean;
  csvPath: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    apply: false,
    yes: false,
    skipRestore: false,
    csvPath: './data/backup_adm_clube.csv',
  };
  for (const arg of argv) {
    if (arg === '--apply') a.apply = true;
    else if (arg === '--yes' || arg === '-y') a.yes = true;
    else if (arg === '--skip-restore') a.skipRestore = true;
    else if (arg.startsWith('--input=')) a.csvPath = arg.slice('--input='.length);
  }
  return a;
}

interface Counts {
  visitsDemo: number;
  visitDetailsDemo: number;
  habitDemo: number;
  txDemo: number;
  expDemo: number;
  annuityDemo: number;
  usersDemo: number;
  equipmentSeed: number;
  products: number;
  stockItems: number;
  stockMovements: number;
  news: number;
  events: number;
  eventParticipations: number;
  loansDemo: number;
}

async function countSeedData(): Promise<Counts> {
  const usersDemoIds = (
    await prisma.user.findMany({
      where: { email: { endsWith: '@demo.cbt.com.br' } },
      select: { id: true },
    })
  ).map((u) => u.id);

  return {
    visitsDemo: await prisma.visit.count({
      where: {
        OR: [{ notes: { contains: '[demo]' } }, { memberId: { in: usersDemoIds } }],
      },
    }),
    visitDetailsDemo: await prisma.visitDetail.count({
      where: {
        OR: [
          { visit: { notes: { contains: '[demo]' } } },
          { memberId: { in: usersDemoIds } },
        ],
      },
    }),
    habitDemo: await prisma.habitualityRecord.count({
      where: {
        OR: [
          { visit: { notes: { contains: '[demo]' } } },
          { memberId: { in: usersDemoIds } },
        ],
      },
    }),
    txDemo: await prisma.transaction.count({ where: { notes: { contains: '[demo-fin]' } } }),
    expDemo: await prisma.expense.count({ where: { notes: { contains: '[demo-fin]' } } }),
    annuityDemo: await prisma.annuityPayment.count({
      where: { notes: { contains: '[demo-fin]' } },
    }),
    usersDemo: usersDemoIds.length,
    equipmentSeed: await prisma.equipment.count({
      where: { serialNumber: { startsWith: 'CBT-' } },
    }),
    products: await prisma.product.count(),
    stockItems: await prisma.stockItem.count(),
    stockMovements: await prisma.stockMovement.count(),
    news: await prisma.news.count(),
    events: await prisma.event.count(),
    eventParticipations: await prisma.eventParticipation.count(),
    loansDemo: await prisma.equipmentLoan.count({
      where: { memberId: { in: usersDemoIds } },
    }),
  };
}

async function applyCleanup(): Promise<void> {
  // Pega IDs dos users demo antes (para usar nos cascades manuais)
  const usersDemo = await prisma.user.findMany({
    where: { email: { endsWith: '@demo.cbt.com.br' } },
    select: { id: true },
  });
  const usersDemoIds = usersDemo.map((u) => u.id);

  // Single transaction para garantir atomicidade
  await prisma.$transaction(async (tx) => {
    // 1. EventParticipation — apaga todas (events vão sumir; usuarios demo tambem)
    await tx.eventParticipation.deleteMany({});

    // 2. HabitualityRecord ligadas a visits demo OU users demo
    await tx.habitualityRecord.deleteMany({
      where: {
        OR: [
          { visit: { notes: { contains: '[demo]' } } },
          { memberId: { in: usersDemoIds } },
        ],
      },
    });

    // 3. VisitDetail das visits demo OU de users demo
    await tx.visitDetail.deleteMany({
      where: {
        OR: [
          { visit: { notes: { contains: '[demo]' } } },
          { memberId: { in: usersDemoIds } },
        ],
      },
    });

    // 4. Visits demo
    await tx.visit.deleteMany({
      where: {
        OR: [{ notes: { contains: '[demo]' } }, { memberId: { in: usersDemoIds } }],
      },
    });

    // 5. AnnuityPayment marcadas com [demo-fin]
    await tx.annuityPayment.deleteMany({ where: { notes: { contains: '[demo-fin]' } } });

    // 6. AnnuityPayment de users demo (caso algum nao tenha tag)
    if (usersDemoIds.length > 0) {
      await tx.annuityPayment.deleteMany({ where: { memberId: { in: usersDemoIds } } });
    }

    // 7. TransactionItem cascade ao deletar Transaction (já tem onDelete: Cascade no schema)
    await tx.transaction.deleteMany({ where: { notes: { contains: '[demo-fin]' } } });
    if (usersDemoIds.length > 0) {
      await tx.transaction.deleteMany({ where: { memberId: { in: usersDemoIds } } });
    }

    // 8. Expense
    await tx.expense.deleteMany({ where: { notes: { contains: '[demo-fin]' } } });

    // 9. EquipmentLoan dos users demo
    if (usersDemoIds.length > 0) {
      await tx.equipmentLoan.deleteMany({ where: { memberId: { in: usersDemoIds } } });
    }

    // 10. AuditLog ligadas aos users demo
    if (usersDemoIds.length > 0) {
      await tx.auditLog.deleteMany({
        where: {
          OR: [
            { userId: { in: usersDemoIds } },
            { performedById: { in: usersDemoIds } },
          ],
        },
      });
    }

    // 11. MemberDocument
    if (usersDemoIds.length > 0) {
      await tx.memberDocument.deleteMany({
        where: {
          OR: [
            { memberId: { in: usersDemoIds } },
            { generatedById: { in: usersDemoIds } },
          ],
        },
      });
    }

    // 12. Lane.currentMemberId → null se aponta para user demo
    if (usersDemoIds.length > 0) {
      await tx.lane.updateMany({
        where: { currentMemberId: { in: usersDemoIds } },
        data: { currentMemberId: null },
      });
    }

    // 13. Users demo (UserAttachment + FaceProfile cascade automatico)
    await tx.user.deleteMany({ where: { email: { endsWith: '@demo.cbt.com.br' } } });

    // 14. StockMovement → StockItem → Product (apaga catálogo do seed inteiro)
    await tx.stockMovement.deleteMany({});
    await tx.stockItem.deleteMany({});
    await tx.product.deleteMany({});

    // 15. Equipment do seed (serial CBT-*)
    await tx.equipment.deleteMany({ where: { serialNumber: { startsWith: 'CBT-' } } });

    // 16. News e Events (todos)
    await tx.news.deleteMany({});
    await tx.event.deleteMany({});
  }, { timeout: 60000 });

  console.log('  ✓ Cleanup transacional concluido.');
}

async function restoreAnnuityFromCsv(csvPath: string): Promise<{ updated: number; missed: number }> {
  console.log('\n▶ Restaurando User.annuityValidUntil a partir do CSV...');
  const content = readCsvUtf8(csvPath);
  const tables = splitTables(content);
  const rows = parseTable(tables.tab_membros ?? '');

  let updated = 0;
  let missed = 0;

  for (const row of rows) {
    const cpf = normalizeCpf(row.cpf);
    if (!cpf) continue;
    if (cpf === '00000000000' || cpf === '11111111111') continue; // seed users

    const annuityValidUntil = parseDate(row.data_renovacao);

    try {
      const result = await prisma.user.updateMany({
        where: { cpf },
        // Setar para o valor original do CSV (pode ser null se nao tinha renovacao)
        data: { annuityValidUntil },
      });
      if (result.count > 0) {
        updated += 1;
      } else {
        missed += 1;
      }
    } catch (e) {
      missed += 1;
    }
  }

  return { updated, missed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Cleanup de dados de SEED (preservando dados migrados)');
  console.log(`  Modo: ${args.apply ? 'APPLY (apaga de verdade)' : 'DRY-RUN (somente conta)'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('▶ Contando dados de seed que SERIAM apagados...');
  const counts = await countSeedData();
  for (const [k, v] of Object.entries(counts)) {
    if (v > 0) console.log(`  ${k}: ${v}`);
  }

  if (!args.apply) {
    console.log('\n(dry-run) Nada foi alterado. Use --apply para executar de verdade.');
    await prisma.$disconnect();
    return;
  }

  if (!args.yes) {
    const ok = await confirmDestructive('LIMPAR SEEDS');
    if (!ok) {
      console.log('✗ Cancelado pelo usuário.');
      process.exit(1);
    }
  }

  console.log('\n▶ Aplicando cleanup...');
  await applyCleanup();

  if (!args.skipRestore) {
    try {
      const { updated, missed } = await restoreAnnuityFromCsv(args.csvPath);
      console.log(`  ✓ annuityValidUntil restaurado: ${updated} OK, ${missed} CPFs não encontrados`);
    } catch (e: any) {
      console.error(`  ⚠ Falha ao restaurar annuityValidUntil: ${e.message}`);
      console.error('    (cleanup foi aplicado, mas as datas de anuidade ficaram como o seed deixou)');
    }
  }

  console.log('\n▶ Estado final:');
  const after = await countSeedData();
  for (const [k, v] of Object.entries(after)) {
    if (v > 0) console.log(`  ${k}: ${v}`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ✓ Cleanup completo. Dados migrados preservados.');
  console.log('═══════════════════════════════════════════════════════');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('✗ Erro fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
