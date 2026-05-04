import {
  startReport,
  finalizeReport,
  addAutoTable,
  addCalloutBox,
  addSectionTitle,
  fmtDate,
  type ReportClubInfo,
} from './_shared/reportBase';
import { equipmentTypeLabels, equipmentConditionLabels } from '@/lib/constants';
import type { EquipmentInventoryReport } from '@/services/reportsService';

export async function buildEquipmentInventoryPdf(
  payload: EquipmentInventoryReport,
  club: ReportClubInfo,
) {
  const ctx = await startReport(
    {
      title: 'ACERVO DO CLUBE',
      subtitle: `${payload.total} item(ns) cadastrado(s)`,
      category: 'ACERVO_MUNICOES',
      isOfficial: true,
      legalRefs: ['Decreto 11.615/2023, art. 66', 'Portaria 166-COLOG/2023'],
    },
    club,
  );

  if (payload.total === 0) {
    addCalloutBox(ctx, 'Acervo vazio. Nenhum item cadastrado.');
  } else {
    addCalloutBox(ctx, `Total: ${payload.total} item(ns) ativo(s) no acervo.`);

    // Agrupa por tipo
    const grouped = payload.items.reduce<Record<string, typeof payload.items>>((acc, it) => {
      const k = it.equipmentType;
      if (!acc[k]) acc[k] = [];
      acc[k].push(it);
      return acc;
    }, {});

    for (const [type, items] of Object.entries(grouped)) {
      const label = equipmentTypeLabels[type] ?? type;
      addSectionTitle(ctx, `${label} — ${items.length} item(ns)`);

      addAutoTable(
        ctx,
        [['Nome', 'Marca / Modelo', 'Nº Série', 'SIGMA', 'Calibre', 'Condição', 'Disponível', 'Aquisição']],
        items.map((it) => [
          it.name,
          [it.brand, it.model].filter(Boolean).join(' / ') || '—',
          it.serialNumber ?? '—',
          it.registrationId ?? '—',
          it.caliber ?? '—',
          equipmentConditionLabels[it.condition] ?? it.condition,
          it.isAvailable ? 'Sim' : 'Não',
          fmtDate(it.acquisitionDate),
        ]),
        {
          columnStyles: {
            6: { halign: 'center', cellWidth: 20 },
            7: { cellWidth: 22 },
          },
        },
      );
    }
  }

  return finalizeReport(ctx);
}
