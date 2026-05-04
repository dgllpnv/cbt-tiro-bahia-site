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
import type { AnnualPlanReport } from '@/services/reportsService';

const EVENT_TYPE_LABEL: Record<string, string> = {
  COMPETITION: 'Competição',
  TRAINING: 'Treinamento',
  COURSE: 'Curso',
  MEETING: 'Reunião',
  SOCIAL: 'Social',
  OTHER: 'Outro',
};

export async function buildAnnualPlanPdf(
  payload: AnnualPlanReport,
  club: ReportClubInfo,
) {
  const ctx = await startReport(
    {
      title: 'PLANO ANUAL DE ATIVIDADES',
      subtitle: `Ano de ${payload.year} — ${payload.totalEvents} evento(s)`,
      category: 'COMPLIANCE',
      legalRefs: ['IN DG/PF 311/2025, art. 84'],
    },
    club,
  );

  addCalloutBox(
    ctx,
    `Plano de atividades para o ano de ${payload.year} — ${payload.totalEvents} evento(s) registrado(s).`,
  );

  addParagraph(
    ctx,
    `O presente documento consolida o plano anual de atividades do ${club.name} para o exercício de ${payload.year}, conforme exigido pela IN DG/PF 311/2025 (art. 84) para entidades de tiro desportivo.`,
    { fontSize: 9.5 },
  );

  // Modalidades
  addSectionTitle(ctx, 'Modalidades praticadas (calibres registrados no ano)');
  if (payload.modalities.length === 0) {
    addParagraph(ctx, 'Sem registros de prática no ano informado.', { fontSize: 9 });
  } else {
    addAutoTable(
      ctx,
      [['Calibre', 'Ocorrências']],
      payload.modalities
        .sort((a, b) => b.occurrences - a.occurrences)
        .map((m) => [m.caliber, String(m.occurrences)]),
      { columnStyles: { 1: { halign: 'right', cellWidth: 35 } } },
    );
  }

  // Calendario
  addSectionTitle(ctx, 'Calendário de eventos');
  if (payload.events.length === 0) {
    addParagraph(ctx, 'Nenhum evento agendado para o ano.', { fontSize: 9 });
  } else {
    addAutoTable(
      ctx,
      [['Data', 'Tipo', 'Título', 'Local', 'Inscritos']],
      payload.events.map((e) => [
        fmtDate(e.eventDate),
        EVENT_TYPE_LABEL[e.eventType] ?? e.eventType,
        e.title,
        e.location ?? '—',
        String(e._count.participations),
      ]),
      {
        columnStyles: {
          0: { cellWidth: 22 },
          4: { halign: 'center', cellWidth: 22 },
        },
      },
    );
  }

  ctx.cursorY += 4;
  addParagraph(
    ctx,
    'O plano poderá ser ajustado durante o exercício, com registro das alterações em ata, mantida a integridade do calendário oficial junto à fiscalização.',
    { fontSize: 8.5 },
  );

  return finalizeReport(ctx);
}
