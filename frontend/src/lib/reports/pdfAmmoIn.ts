import {
  startReport,
  finalizeReport,
  addAutoTable,
  addCalloutBox,
  addSectionTitle,
  fmtDate,
  fmtDateTime,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { AmmoMovementsReport } from '@/services/reportsService';

const MOVEMENT_LABEL: Record<string, string> = {
  PURCHASE_IN: 'Compra',
  ADJUSTMENT_IN: 'Ajuste +',
  INITIAL_STOCK: 'Estoque Inicial',
};

export async function buildAmmoInPdf(
  payload: AmmoMovementsReport,
  club: ReportClubInfo,
) {
  const ctx = await startReport(
    {
      title: 'ENTRADA DE MUNIÇÕES',
      subtitle: `Período: ${fmtDate(payload.from)} a ${fmtDate(payload.to)} — ${payload.total} movimento(s)`,
      category: 'ACERVO_MUNICOES',
      isOfficial: true,
      legalRefs: ['Decreto 11.615/2023', 'Portaria 166-COLOG/2023', 'SIGMA/COLOG'],
    },
    club,
  );

  if (payload.total === 0) {
    addCalloutBox(
      ctx,
      `Nenhum movimento de entrada entre ${fmtDate(payload.from)} e ${fmtDate(payload.to)}.`,
    );
  } else {
    // Resumo por calibre
    const byCaliber = new Map<string, number>();
    let totalQty = 0;
    for (const m of payload.movements) {
      const cal = m.stockItem.product.caliber ?? '—';
      byCaliber.set(cal, (byCaliber.get(cal) ?? 0) + m.quantity);
      totalQty += m.quantity;
    }

    addCalloutBox(ctx, `Total: ${totalQty} unidade(s) em ${payload.total} movimento(s).`);

    addSectionTitle(ctx, 'Resumo por calibre');
    addAutoTable(
      ctx,
      [['Calibre', 'Quantidade entrada']],
      Array.from(byCaliber.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cal, q]) => [cal, String(q)]),
      {
        columnStyles: { 1: { halign: 'right', cellWidth: 35 } },
      },
    );

    addSectionTitle(ctx, 'Detalhamento das entradas');
    addAutoTable(
      ctx,
      [['Data/Hora', 'Tipo', 'Produto', 'Calibre', 'Qtd.', 'Estoque pós', 'Obs.']],
      payload.movements.map((m) => [
        fmtDateTime(m.createdAt),
        MOVEMENT_LABEL[m.movementType] ?? m.movementType,
        m.stockItem.product.name,
        m.stockItem.product.caliber ?? '—',
        String(m.quantity),
        String(m.newStock),
        m.notes ?? '—',
      ]),
      {
        columnStyles: {
          4: { halign: 'right', cellWidth: 15 },
          5: { halign: 'right', cellWidth: 22 },
        },
      },
    );
  }

  return finalizeReport(ctx);
}
