// Cleanup parcial — apaga apenas histórico (Visit/VisitDetail/HabitualityRecord/AnnuityPayment)
// para permitir re-execução das fases 3/4/5 da migração sem duplicar dados.
// NÃO toca em User nem Equipment (que usam upsert por chave natural).

import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

(async () => {
  console.log('Limpando histórico (Visit, VisitDetail, HabitualityRecord, AnnuityPayment, Equipment)...');
  await p.$transaction([
    p.habitualityRecord.deleteMany({}),
    p.visitDetail.deleteMany({}),
    p.visit.deleteMany({}),
    p.annuityPayment.deleteMany({}),
    p.equipmentLoan.deleteMany({}),
    p.equipment.deleteMany({}),
  ]);
  const counts = {
    habit: await p.habitualityRecord.count(),
    visitDetail: await p.visitDetail.count(),
    visit: await p.visit.count(),
    annuity: await p.annuityPayment.count(),
  };
  console.log('Após cleanup:', counts);
  await p.$disconnect();
})();
