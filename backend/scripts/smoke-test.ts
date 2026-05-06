import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

(async () => {
  console.log('═══ SMOKE TEST PÓS-MIGRAÇÃO ═══\n');

  // 1. Distribuição active/inactive
  const totalAssociates = await p.user.count({ where: { role: 'ASSOCIATE' } });
  const active = await p.user.count({ where: { role: 'ASSOCIATE', isActive: true } });
  const inactive = await p.user.count({ where: { role: 'ASSOCIATE', isActive: false } });
  console.log(`Associates: ${totalAssociates} total — ${active} ativos / ${inactive} inativos`);

  // 2. Distribuição com/sem CR
  const withCr = await p.user.count({
    where: { role: 'ASSOCIATE', isActive: true, cr: { not: null } },
  });
  const withoutCr = active - withCr;
  console.log(`  ativos com CR: ${withCr} | sem CR: ${withoutCr}`);

  // 3. Sample membro real importado
  const sample = await p.user.findFirst({
    where: { fullName: 'CARLOS AUGUSTO BALDUINO' },
    select: { id: true, email: true, cpf: true, fullName: true, memberNumber: true, cr: true, crLevel: true, dateOfBirth: true, naturality: true, profession: true, maritalStatus: true, fatherName: true, motherName: true, address: true, neighborhood: true, city: true, isActive: true, status: true, annuityValidUntil: true, passwordHash: true },
  });
  console.log('\nSample member (CARLOS AUGUSTO BALDUINO):');
  console.log({ ...sample, passwordHash: sample?.passwordHash ? '<hashed>' : null });

  // 4. Test password hash = first 6 digits of CPF
  if (sample?.cpf && sample?.passwordHash) {
    const expected = sample.cpf.slice(0, 6);
    const ok = await bcrypt.compare(expected, sample.passwordHash);
    console.log(`Password test: bcrypt(cpf[0..6]='${expected}') vs hash → ${ok ? '✓ OK' : '✗ FAIL'}`);
  }

  // 5. Sample habitualidade
  const habit = await p.habitualityRecord.findFirst({
    where: { memberId: sample?.id },
    include: { visit: { include: { details: true } } },
    orderBy: { activityDate: 'asc' },
  });
  console.log('\nSample habitualidade do membro:');
  console.log(habit);

  // 6. Equipment overview
  const eqByType = await p.equipment.groupBy({ by: ['equipmentType'], _count: true });
  console.log('\nEquipment by type:', eqByType);

  // 7. Habitualidades por ano
  const habitByYear = await p.$queryRaw<{ ano: number; total: bigint }[]>`
    SELECT EXTRACT(YEAR FROM "activityDate")::int AS ano, COUNT(*)::bigint AS total
    FROM "HabitualityRecord"
    GROUP BY ano
    ORDER BY ano
  `;
  console.log('\nHabitualidades por ano:', habitByYear.map((r) => ({ ano: r.ano, total: Number(r.total) })));

  // 8. Anuidades importadas
  const annuities = await p.annuityPayment.findMany({
    select: { referenceYear: true, amount: true, paymentDate: true, paymentMethod: true, member: { select: { memberNumber: true, fullName: true } } },
  });
  console.log('\nAnuidades:', annuities);

  await p.$disconnect();
})();
