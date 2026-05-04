import {
  startReport,
  finalizeReport,
  addAutoTable,
  addCalloutBox,
  addSectionTitle,
  fmtDate,
  fmtDateTime,
  fmtCpf,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { AmmoMovementsReport } from '@/services/reportsService';

export async function buildAmmoOutPdf(
  payload: AmmoMovementsReport,
  club: ReportClubInfo,
) {
  const ctx = await startReport(
    {
      title: 'SAÍDA DE MUNIÇÕES',
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
      `Nenhuma saída de munições entre ${fmtDate(payload.from)} e ${fmtDate(payload.to)}.`,
    );
  } else {
    const byCaliber = new Map<string, number>();
    let totalQty = 0;
    for (const m of payload.movements) {
      const cal = m.stockItem.product.caliber ?? '—';
      byCaliber.set(cal, (byCaliber.get(cal) ?? 0) + m.quantity);
      totalQty += m.quantity;
    }

    addCalloutBox(ctx, `Total: ${totalQty} unidade(s) em ${payload.total} movimento(s) de saída.`);

    addSectionTitle(ctx, 'Resumo por calibre');
    addAutoTable(
      ctx,
      [['Calibre', 'Quantidade saída']],
      Array.from(byCaliber.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cal, q]) => [cal, String(q)]),
      { columnStyles: { 1: { halign: 'right', cellWidth: 35 } } },
    );

    addSectionTitle(ctx, 'Detalhamento das saídas');
    addAutoTable(
      ctx,
      [['Data/Hora', 'Atirador / CPF', 'Nº', 'Produto', 'Calibre', 'Qtd.', 'Estoque pós']],
      payload.movements.map((m) => [
        fmtDateTime(m.createdAt),
        m.member ? `${m.member.fullName}\n${fmtCpf(m.member.cpf)}` : '—',
        m.member?.memberNumber ?? '—',
        m.stockItem.product.name,
        m.stockItem.product.caliber ?? '—',
        String(m.quantity),
        String(m.newStock),
      ]),
      {
        styles: { fontSize: 8 },
        columnStyles: {
          5: { halign: 'right', cellWidth: 15 },
          6: { halign: 'right', cellWidth: 22 },
        },
      },
    );
  }

  return finalizeReport(ctx);
}
