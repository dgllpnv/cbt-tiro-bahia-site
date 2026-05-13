/**
 * Apaga todos os dados migrados (sócios reais + habits + armas + visits +
 * anuidades). Preserva apenas admin@cbt.com.br, caixa@cbt.com.br e
 * associado@cbt.com.br (seed base) + as 21 armas/baias/produtos do seed.
 *
 * Usado para SIMULAR PC NOVO em testes locais.
 *
 * NUNCA rodar em produção.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const KEEP = ['admin@cbt.com.br', 'caixa@cbt.com.br', 'associado@cbt.com.br'];

async function main() {
  const before = await prisma.user.count({ where: { role: 'ASSOCIATE' } });
  console.log('ASSOCIATEs antes:', before);

  // AuditLog tem FK pra User (performedById) — limpar antes pra evitar FK constraint
  const al = await prisma.auditLog.deleteMany({});
  const fp = await prisma.faceProfile.deleteMany({});
  const vd = await prisma.visitDetail.deleteMany({});
  const hr = await prisma.habitualityRecord.deleteMany({});
  const v = await prisma.visit.deleteMany({});
  const ap = await prisma.annuityPayment.deleteMany({});
  const ua = await prisma.userAttachment.deleteMany({});
  const u = await prisma.user.deleteMany({
    where: { role: 'ASSOCIATE', email: { notIn: KEEP } },
  });
  const eq = await prisma.equipment.deleteMany({
    where: { serialNumber: { not: { startsWith: 'CBT-' } } },
  });

  const after = await prisma.user.count({ where: { role: 'ASSOCIATE' } });
  console.log('ASSOCIATEs depois:', after);
  console.log('Deletados:', {
    faceProfile: fp.count,
    visitDetail: vd.count,
    habit: hr.count,
    visit: v.count,
    annuity: ap.count,
    attachments: ua.count,
    users: u.count,
    equipment: eq.count,
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
