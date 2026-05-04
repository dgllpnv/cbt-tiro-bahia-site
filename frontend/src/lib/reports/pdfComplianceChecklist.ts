import {
  startReport,
  finalizeReport,
  addAutoTable,
  addCalloutBox,
  addSectionTitle,
  addParagraph,
  fmtDate,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { ComplianceChecklistReport } from '@/services/reportsService';

export async function buildComplianceChecklistPdf(
  payload: ComplianceChecklistReport,
  club: ReportClubInfo,
) {
  const okCount = payload.checklist.filter((c) => c.ok).length;
  const total = payload.checklist.length;

  const ctx = await startReport(
    {
      title: 'CONFORMIDADE TRIMESTRAL',
      subtitle: `${okCount}/${total} OK · ${payload.quarter}º Trim/${payload.year} · ${fmtDate(payload.period.from)} a ${fmtDate(payload.period.to)}`,
      category: 'COMPLIANCE',
      legalRefs: [
        'Decreto 11.615/2023',
        'Portaria 166-COLOG/2023',
        'Portaria 260-COLOG/2025',
        'IN DG/PF 311/2025',
      ],
    },
    club,
  );

  addCalloutBox(
    ctx,
    `Conformidade ${okCount}/${total} itens — Trimestre ${payload.quarter}/${payload.year}.`,
  );

  addParagraph(
    ctx,
    'Avaliação automatizada da conformidade da entidade no trimestre, com base nos registros operacionais e nas exigências regulatórias vigentes.',
    { fontSize: 9.5 },
  );

  addSectionTitle(ctx, 'Checklist de conformidade');
  addAutoTable(
    ctx,
    [['Item', 'Status', 'Detalhe']],
    payload.checklist.map((c) => [
      c.label,
      c.ok ? 'OK' : 'PENDENTE',
      c.detail,
    ]),
    {
      columnStyles: {
        1: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const ok = data.cell.raw === 'OK';
          data.cell.styles.textColor = ok ? [0, 110, 0] : [180, 30, 30];
        }
      },
    },
  );

  // KPIs
  addSectionTitle(ctx, 'Indicadores do período');
  const kp = payload.kpis;
  addAutoTable(
    ctx,
    [['Indicador', 'Valor']],
    [
      ['Registros de habitualidade', String(kp.habCount)],
      ['Equipamentos cadastrados', String(kp.totalEquipment)],
      ['Total de associados ativos', String(kp.totalAssociates)],
      ['Anuidades válidas', `${kp.validAnnuities} (${kp.annuityRate.toFixed(1)}%)`],
      ['Munição vendida no ano (acum.)', String(kp.totalAmmoYear)],
      ['CRs vencendo em 60 dias', String(kp.crSoon)],
    ],
    {
      columnStyles: {
        0: { cellWidth: 90 },
        1: { halign: 'right', cellWidth: 50 },
      },
    },
  );

  ctx.cursorY += 4;
  if (okCount < total) {
    addParagraph(
      ctx,
      `Atenção: ${total - okCount} item(ns) pendente(s). Recomenda-se ação corretiva antes do encerramento do trimestre para manter a regularidade junto à PF e ao Comando do Exército.`,
      { fontSize: 9, bold: true },
    );
  } else {
    addParagraph(
      ctx,
      'Todos os itens analisados estão em conformidade no trimestre.',
      { fontSize: 9 },
    );
  }

  return finalizeReport(ctx);
}
