import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

(async () => {
  const counts: Record<string, number> = {};
  counts['User'] = await p.user.count();
  counts['ClubSettings'] = await p.clubSettings.count();
  counts['Lane'] = await p.lane.count();
  counts['Equipment'] = await p.equipment.count();
  counts['Product'] = await p.product.count();
  counts['StockItem'] = await p.stockItem.count();
  counts['StockMovement'] = await p.stockMovement.count();
  counts['Visit'] = await p.visit.count();
  counts['VisitDetail'] = await p.visitDetail.count();
  counts['HabitualityRecord'] = await p.habitualityRecord.count();
  counts['AnnuityPayment'] = await p.annuityPayment.count();
  counts['Transaction'] = await p.transaction.count();
  counts['Event'] = await p.event.count();
  counts['News'] = await p.news.count();
  counts['AuditLog'] = await p.auditLog.count();
  counts['EquipmentLoan'] = await p.equipmentLoan.count();
  counts['Expense'] = await p.expense.count();
  counts['EventParticipation'] = await p.eventParticipation.count();
  counts['MemberDocument'] = await p.memberDocument.count();
  counts['FaceProfile'] = await p.faceProfile.count();
  counts['UserAttachment'] = await p.userAttachment.count();
  console.log(JSON.stringify(counts, null, 2));
  const users = await p.user.findMany({ select: { email: true, fullName: true, role: true } });
  console.log('USERS:', JSON.stringify(users, null, 2));
  await p.$disconnect();
})();
