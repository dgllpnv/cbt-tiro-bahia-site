// =====================================================
// reset-passwords-to-cpf
// =====================================================
// Reseta a senha de TODOS os associados (role = ASSOCIATE) para o proprio
// CPF (somente digitos) e marca mustChangePassword=true para forcar o fluxo
// de primeiro acesso no proximo login.
//
// IMPORTANTE: NAO toca em ADMIN nem CASHIER — credenciais administrativas
// continuam funcionando exatamente como antes (admin@cbt.com.br / admin123,
// caixa@cbt.com.br / caixa123).
//
// Uso: npx tsx prisma/reset-passwords-to-cpf.ts
// =====================================================

import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const associates = await prisma.user.findMany({
    where: { role: 'ASSOCIATE' },
    select: { id: true, cpf: true, fullName: true, memberNumber: true },
  });

  if (associates.length === 0) {
    console.log('[RESET] Nenhum associado encontrado.');
    return;
  }

  console.log(`[RESET] Encontrados ${associates.length} associados. Iniciando reset...`);

  let updated = 0;
  let skipped = 0;
  const errors: Array<{ id: string; reason: string }> = [];

  for (const u of associates) {
    const cpfDigits = (u.cpf ?? '').replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      skipped++;
      errors.push({ id: u.id, reason: `CPF invalido (${cpfDigits.length} digitos)` });
      continue;
    }

    const newHash = await bcrypt.hash(cpfDigits, 12);

    // Atualiza passwordHash via API typed e mustChangePassword via raw SQL
    // (Prisma client ainda nao foi regenerado pos schema change).
    await prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: newHash },
    });
    await prisma.$executeRaw`
      UPDATE "User" SET "mustChangePassword" = true WHERE id = ${u.id}
    `;

    updated++;
    console.log(`  ✓ ${u.memberNumber ?? '—'} ${u.fullName}`);
  }

  console.log('\n[RESET] Concluido.');
  console.log(`  Atualizados:    ${updated}`);
  console.log(`  Ignorados:      ${skipped}`);
  if (errors.length > 0) {
    console.log('\n[RESET] Erros:');
    for (const e of errors) console.log(`  - ${e.id}: ${e.reason}`);
  }
  console.log('\nADMIN e CASHIER nao foram tocados — continuam logando normalmente.');
}

main()
  .catch((e) => {
    console.error('[RESET] Falha fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
