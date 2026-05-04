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

export async function buildMembersOverduePdf(
  payload: MembersExpiringReport,
  club: ReportClubInfo,
) {
  const ctx = await startReport(
    {
      title: 'ASSOCIADOS COM ANUIDADE VENCIDA',
      subtitle: `Vencidos há ${payload.days} dia(s) ou mais — ${payload.total} associado(s)`,
      category: 'MEMBERS',
      legalRefs: ['IN DG/PF 311/2025, art. 20'],
    },
    club,
  );

  if (payload.total === 0) {
    addCalloutBox(ctx, `Nenhum associado com anuidade vencida há ${payload.days}+ dia(s).`);
  } else {
    addCalloutBox(
      ctx,
      `IMPORTANTE: ${payload.total} associado(s) com anuidade vencida há ${payload.days}+ dia(s).`,
    );

    addAutoTable(
      ctx,
      [['Nome', 'Nº', 'CR', 'CPF', 'Telefone', 'Venceu em', 'Dias atraso']],
      payload.members.map((m) => [
        m.fullName,
        m.memberNumber ?? '—',
        m.cr ?? '—',
        fmtCpf(m.cpf),
        fmtPhone(m.phone),
        fmtDate(m.annuityValidUntil),
        m.daysOverdue != null ? String(m.daysOverdue) : '—',
      ]),
      {
        columnStyles: { 6: { halign: 'center', cellWidth: 22 } },
      },
    );

    addParagraph(
      ctx,
      'Filiação ativa é requisito para o registro de habitualidade no acervo CAC. Recomenda-se contatar os associados listados para regularização.',
      { fontSize: 8.5 },
    );
  }

  return finalizeReport(ctx);
}
