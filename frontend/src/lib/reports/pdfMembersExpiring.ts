import {
  startReport,
  finalizeReport,
  addAutoTable,
  addCalloutBox,
  addParagraph,
  fmtDate,
  fmtCpf,
  fmtPhone,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { MembersExpiringReport } from '@/services/reportsService';

export async function buildMembersExpiringPdf(
  payload: MembersExpiringReport,
  club: ReportClubInfo,
) {
  const ctx = await startReport(
    {
      title: 'ASSOCIADOS COM ANUIDADE A VENCER',
      subtitle: `Próximos ${payload.days} dia(s) — ${payload.total} associado(s)`,
      category: 'MEMBERS',
      legalRefs: ['IN DG/PF 311/2025, art. 20'],
    },
    club,
  );

  if (payload.total === 0) {
    addCalloutBox(ctx, `Nenhum associado vencendo em ${payload.days} dia(s).`);
  } else {
    addCalloutBox(
      ctx,
      `Atenção: ${payload.total} associado(s) com anuidade vencendo nos próximos ${payload.days} dia(s).`,
    );

    addAutoTable(
      ctx,
      [['Nome', 'Nº', 'CR', 'CPF', 'Telefone', 'Vence em', 'Dias rest.']],
      payload.members.map((m) => [
        m.fullName,
        m.memberNumber ?? '—',
        m.cr ?? '—',
        fmtCpf(m.cpf),
        fmtPhone(m.phone),
        fmtDate(m.annuityValidUntil),
        m.daysRemaining != null ? String(m.daysRemaining) : '—',
      ]),
      {
        columnStyles: { 6: { halign: 'center', cellWidth: 18 } },
      },
    );

    addParagraph(
      ctx,
      'Membros com anuidade vencida não podem computar habitualidade conforme IN DG/PF 311/2025, art. 20.',
      { fontSize: 8.5 },
    );
  }

  return finalizeReport(ctx);
}
