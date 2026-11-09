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
import { firearmCellTextMany } from './_shared/firearmLabel';

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
      payload.records.flatMap((r, idx) => {
        // Linhas do mesmo calibre (todas); fallback no [0] preserva comportamento antigo.
        const all = r.visit?.details ?? [];
        const same = all.filter((d) => d.caliber === r.caliber);
        const lines = same.length > 0 ? same : all.slice(0, 1);
        const cr = [r.member.cr, r.member.crLevel ? `N${r.member.crLevel}` : null]
          .filter(Boolean)
          .join(' · ') || '—';
        // Uma linha de tabela por linha de arma (mesmo calibre), mantendo
        // Tiros/Mun. alinhados com a arma mesmo quando o nome quebra de linha.
        const rowsOf = lines.length ? lines : [null];
        return rowsOf.map((d, i) => [
          i === 0 ? String(idx + 1) : '',
          fmtDate(r.activityDate),
          `${r.member.fullName}
${fmtCpf(r.member.cpf)}`,
          cr,
          r.caliber,
          d ? firearmCellTextMany([d]) : '—',
          d?.shotsFired != null ? String(d.shotsFired) : '—',
          d?.ammunitionType ? ammunitionTypeShortLabels[d.ammunitionType] : '—',
          ACTIVITY_LABEL[r.activityType] ?? r.activityType,
          r.verifiedBy?.fullName ?? '—',
        ]);
      }),
      {
        rowPageBreak: 'avoid',
        styles: { fontSize: 7.5, cellPadding: 1.4 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 17 },
          2: { cellWidth: 27 },
          3: { cellWidth: 18 },
          4: { cellWidth: 14 },
          5: { cellWidth: 26 },
          6: { cellWidth: 11, halign: 'center' },
          7: { cellWidth: 11, halign: 'center' },
          8: { cellWidth: 20 },
          9: { cellWidth: 22 },
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
