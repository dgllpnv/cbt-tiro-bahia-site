import {
  startReport,
  finalizeReport,
  addAutoTable,
  addCalloutBox,
  addParagraph,
  fmtCpf,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { HabitualityLowReport } from '@/services/reportsService';

export async function buildHabitualityLowPdf(
  payload: HabitualityLowReport,
  club: ReportClubInfo,
) {
  const ctx = await startReport(
    {
      title: 'HABITUALIDADE INFERIOR AO MÍNIMO',
      subtitle: `Ano de referência ${payload.year} — ${payload.total} associado(s) com pendência`,
      category: 'HABITUALIDADE',
      legalRefs: ['Portaria 260-COLOG/2025'],
    },
    club,
  );

  if (payload.total === 0) {
    addCalloutBox(
      ctx,
      `Todos os associados ativos atingiram o mínimo de habitualidade em ${payload.year}.`,
    );
  } else {
    addCalloutBox(
      ctx,
      `${payload.total} associado(s) abaixo do mínimo de 8 atividades por calibre em ${payload.year}.`,
    );

    const rows: string[][] = [];
    for (const a of payload.associates) {
      for (const c of a.caliberCounts) {
        rows.push([
          a.member.fullName,
          a.member.memberNumber ?? '—',
          a.member.cr ?? '—',
          a.member.crLevel ? `N${a.member.crLevel}` : '—',
          fmtCpf(a.member.cpf),
          c.caliber,
          String(c.count),
          String(c.required),
          String(c.gap),
        ]);
      }
    }

    addAutoTable(
      ctx,
      [['Nome', 'Nº', 'CR', 'Nível', 'CPF', 'Calibre', 'Atividades', 'Mínimo', 'Faltam']],
      rows,
      {
        columnStyles: {
          6: { halign: 'center', cellWidth: 22 },
          7: { halign: 'center', cellWidth: 18 },
          8: { halign: 'center', cellWidth: 16 },
        },
      },
    );

    addParagraph(
      ctx,
      'A Portaria 260-COLOG/2025 estabelece o mínimo de 8 (oito) atividades por calibre por ano para fins de comprovação de habitualidade. Recomenda-se notificar os associados listados.',
      { fontSize: 8.5 },
    );
  }

  return finalizeReport(ctx);
}
