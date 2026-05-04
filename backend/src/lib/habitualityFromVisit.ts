import type { Prisma } from '@prisma/client';

type PrismaTx = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Cria HabitualityRecord automaticamente a partir dos calibres usados na visita.
 *
 * Disparada quando o admin registra a face do membro no checkout (CHECK_OUT)
 * com visitId associado. Cada calibre unico do VisitDetail vira 1 record.
 *
 * Idempotente: se ja existe HabitualityRecord para (visitId, memberId, caliber),
 * nao duplica. Permite admin registrar face mais de uma vez na mesma visita
 * sem efeitos colaterais.
 */
export async function createHabitualityFromVisit(
  tx: PrismaTx,
  params: { visitId: string; memberId: string; verifiedById: string },
): Promise<{ created: number; calibers: string[] }> {
  const { visitId, memberId, verifiedById } = params;

  const visit = await tx.visit.findUnique({
    where: { id: visitId },
    select: { id: true, visitDate: true, clubId: true },
  });

  if (!visit) {
    return { created: 0, calibers: [] };
  }

  const details = await tx.visitDetail.findMany({
    where: { visitId },
    select: { caliber: true },
  });

  // Calibres unicos
  const uniqueCalibers = Array.from(new Set(details.map((d) => d.caliber).filter(Boolean)));

  if (uniqueCalibers.length === 0) {
    return { created: 0, calibers: [] };
  }

  // Calibres ja registrados como habituality nessa visita
  const existing = await tx.habitualityRecord.findMany({
    where: { visitId, memberId, caliber: { in: uniqueCalibers } },
    select: { caliber: true },
  });
  const existingSet = new Set(existing.map((e) => e.caliber));
  const toCreate = uniqueCalibers.filter((c) => !existingSet.has(c));

  if (toCreate.length === 0) {
    return { created: 0, calibers: [] };
  }

  await tx.habitualityRecord.createMany({
    data: toCreate.map((caliber) => ({
      clubId: visit.clubId,
      memberId,
      caliber,
      activityDate: visit.visitDate,
      activityType: 'TRAINING',
      visitId,
      description: 'Validado por reconhecimento facial',
      verifiedById,
    })),
  });

  return { created: toCreate.length, calibers: toCreate };
}
