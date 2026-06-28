// DIAGNOSTICO (read-only) — verifica, por associado, se a senha atual bate
// com o CPF (somente digitos) e cruza com isActive / anuidade. NAO altera nada.
// Uso: npx tsx scripts/diag-senha-cpf.ts
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const assoc = await prisma.user.findMany({
    where: { role: 'ASSOCIATE' },
    select: {
      id: true, cpf: true, fullName: true, memberNumber: true,
      passwordHash: true, isActive: true, annuityValidUntil: true,
    },
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  let senhaEhCpf = 0, senhaNaoEhCpf = 0, semHash = 0;
  let podeLogar = 0;            // senha=CPF E ativo E anuidade ok
  let senhaCpfMasBloqueado = 0; // senha=CPF mas inativo ou anuidade vencida
  const naoLogamComCpf: Array<{ mn: string|null; nome: string; ativo: boolean; anuidadeOk: boolean }> = [];

  for (const u of assoc) {
    const cpfDigits = (u.cpf ?? '').replace(/\D/g, '');
    const ativo = u.isActive;
    const anuidadeOk = !!u.annuityValidUntil && u.annuityValidUntil >= today;
    if (!u.passwordHash) { semHash++; continue; }
    const bate = await bcrypt.compare(cpfDigits, u.passwordHash);
    if (bate) {
      senhaEhCpf++;
      if (ativo && anuidadeOk) podeLogar++; else senhaCpfMasBloqueado++;
    } else {
      senhaNaoEhCpf++;
      naoLogamComCpf.push({ mn: u.memberNumber, nome: u.fullName, ativo, anuidadeOk });
    }
  }

  console.log('===== DIAGNOSTICO SENHA = CPF =====');
  console.log('Total associados:        ', assoc.length);
  console.log('Senha BATE com CPF:      ', senhaEhCpf);
  console.log('  -> e consegue logar:   ', podeLogar, '(ativo + anuidade ok)');
  console.log('  -> mas bloqueado:      ', senhaCpfMasBloqueado, '(inativo ou anuidade vencida)');
  console.log('Senha NAO bate com CPF:  ', senhaNaoEhCpf, '(provavel: trocou a senha)');
  console.log('Sem passwordHash:        ', semHash);
  console.log('\n--- Amostra dos que NAO logam com CPF (max 15) ---');
  for (const x of naoLogamComCpf.slice(0, 15)) {
    console.log(`  #${x.mn ?? '—'} ${x.nome} | ativo=${x.ativo} anuidadeOk=${x.anuidadeOk}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
