import {
  startReport,
  finalizeReport,
  addAutoTable,
  addCalloutBox,
  addSignatureBlock,
  fmtDate,
  fmtCpf,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { HabitualityBookReport } from '@/services/reportsService';
import { ammunitionTypeShortLabels } from '@/lib/constants';

const ACTIVITY_LABEL: Record<string, string> = {
  TRAINING: 'Treinamento',
  COMPETITION: 'Competição',
};

export async function buildHabitualityBookPdf(
  payload: HabitualityBookReport,
  club: ReportClubInfo,
) {
  const ctx = await startReport(
    {
      title: 'LIVRO DE HABITUALIDADE',
      subtitle: `Período: ${fmtDate(payload.from)} a ${fmtDate(payload.to)} — ${payload.total} registro(s)`,
      category: 'HABITUALIDADE',
      isOfficial: true,
      legalRefs: [
        'Decreto 11.615/2023, art. 11',
        'Portaria 166-COLOG/2023, Anexo E',
        'Portaria 260-COLOG/2025',
      ],
    },
    club,
  );

  if (payload.total === 0) {
    addCalloutBox(ctx, 'Nenhum registro de habitualidade no período informado.');
  } else {
    addCalloutBox(
      ctx,
      `Total: ${payload.total} registro(s) entre ${fmtDate(payload.from)} e ${fmtDate(payload.to)}.`,
    );

    addAutoTable(
      ctx,
      [
        ['#', 'Data', 'Atirador / CPF', 'CR / Nível', 'Calibre', 'Arma', 'Tiros', 'Mun.', 'Tipo', 'Verif. por'],
      ],
      payload.records.map((r, idx) => {
        // Casa o detail pelo calibre (mesma logica do documents.routes).
        // Fallback no [0] preserva comportamento antigo se nao houver match.
        const detail =
          r.visit?.details?.find((d) => d.caliber === r.caliber) ?? r.visit?.details?.[0];
        const cr = [r.member.cr, r.member.crLevel ? `N${r.member.crLevel}` : null]
          .filter(Boolean)
          .join(' · ') || '—';
        return [
          String(idx + 1),
          fmtDate(r.activityDate),
          `${r.member.fullName}\n${fmtCpf(r.member.cpf)}`,
          cr,
          r.caliber,
          detail?.firearmName ?? '—',
          detail?.shotsFired != null ? String(detail.shotsFired) : '—',
          detail?.ammunitionType ? ammunitionTypeShortLabels[detail.ammunitionType] : '—',
          ACTIVITY_LABEL[r.activityType] ?? r.activityType,
          r.verifiedBy?.fullName ?? '—',
        ];
      }),
      {
        styles: { fontSize: 7.5, cellPadding: 1.4 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 18 },
          3: { cellWidth: 22 },
          4: { cellWidth: 18 },
          6: { cellWidth: 12, halign: 'center' },
          7: { cellWidth: 12, halign: 'center' },
          8: { cellWidth: 22 },
        },
      },
    );

    ctx.cursorY += 6;
    addSignatureBlock(ctx, {
      closingNote: `O presente livro consigna ${payload.total} atividade(s) de habitualidade conforme o Anexo E da Portaria 166-COLOG/2023.`,
    });
  }

  return finalizeReport(ctx);
}
