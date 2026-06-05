// =====================================================
// reactivate-paid-members.ts
//
// Corrige o efeito colateral da migracao do ADM CLUBE: sócios cuja
// `data_renovacao` no sistema antigo era >6 meses (ou vazia) foram marcados
// isActive=false / status=INACTIVE, mesmo estando com a ANUIDADE EM DIA hoje.
// Como isActive=false bloqueia o login ("Conta desativada"), esses sócios nao
// conseguem entrar mesmo com anuidade valida.
//
// Este script reativa (isActive=true, status=ACTIVE) os ASSOCIADOS com anuidade
// NAO vencida (annuityValidUntil >= hoje). Quem esta vencido NAO e tocado — o
// proprio login ja bloqueia esses com a mensagem de renovacao de anuidade.
//
// Idempotente: rodar de novo nao muda nada (so afeta quem ainda esta inativo).
//
// Uso:
//   npx tsx scripts/reactivate-paid-members.ts            (dry-run, padrao)
//   npx tsx scripts/reactivate-paid-members.ts --apply    (persiste)
// =====================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.slice(2).includes('--apply');

async function main() {
  console.log(`\n=== Reativar associados com anuidade em dia (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Associados com anuidade valida (>= hoje) que estao inativos por algum criterio.
  const where = {
    role: 'ASSOCIATE' as const,
    annuityValidUntil: { gte: startOfToday },
    OR: [{ isActive: false }, { status: { not: 'ACTIVE' as const } }],
  };

  const candidates = await prisma.user.findMany({
    where,
    select: { id: true, memberNumber: true, fullName: true, annuityValidUntil: true },
    orderBy: { memberNumber: 'asc' },
  });

  console.log(`Associados a reativar (anuidade em dia, hoje inativos): ${candidates.length}`);
  for (const c of candidates.slice(0, 10)) {
    console.log(`  - ${c.memberNumber ?? '----'}  ${c.fullName}  (anuidade ate ${c.annuityValidUntil?.toISOString().slice(0, 10)})`);
  }
  if (candidates.length > 10) console.log(`  ... e mais ${candidates.length - 10}`);

  // Contexto: quantos associados continuam inativos por anuidade vencida/nula.
  const stillBlocked = await prisma.user.count({
    where: {
      role: 'ASSOCIATE',
      OR: [{ isActive: false }, { status: { not: 'ACTIVE' } }],
      NOT: { annuityValidUntil: { gte: startOfToday } },
    },
  });
  console.log(`\nPermanecerao inativos (anuidade vencida/nula — bloqueio por anuidade): ${stillBlocked}`);

  if (APPLY && candidates.length > 0) {
    const result = await prisma.user.updateMany({
      where,
      data: { isActive: true, status: 'ACTIVE' },
    });
    console.log(`\n[APPLY] Reativados: ${result.count}`);
  } else if (!APPLY) {
    console.log(`\n[DRY-RUN] Nada gravado. Rode com --apply para persistir.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Erro:', e);
  await prisma.$disconnect();
  process.exit(1);
});
