import {
  startReport,
  finalizeReport,
  addAutoTable,
  addCalloutBox,
  fmtDate,
  fmtCpf,
  fmtPhone,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { BirthdaysReport } from '@/services/reportsService';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  ASSOCIATE: 'Associado',
  VISITOR: 'Visitante',
};

export async function buildBirthdaysPdf(
  payload: BirthdaysReport,
  club: ReportClubInfo,
) {
  const monthName = MONTHS[payload.month - 1] ?? '';
  const ctx = await startReport(
    {
      title: 'ANIVERSARIANTES DO MÊS',
      subtitle: `${monthName} — ${payload.members.length} pessoa(s)`,
      category: 'MEMBERS',
    },
    club,
  );

  if (payload.members.length === 0) {
    addCalloutBox(ctx, `Nenhum aniversariante em ${monthName}.`);
  } else {
    addCalloutBox(ctx, `Total: ${payload.members.length} aniversariante(s) em ${monthName}.`);

    addAutoTable(
      ctx,
      [['Dia', 'Nome', 'Tipo', 'Idade', 'CPF', 'Telefone']],
      payload.members.map((m) => [
        String(m.dayOfMonth ?? '—').padStart(2, '0'),
        m.fullName,
        ROLE_LABEL[m.role ?? ''] ?? m.role ?? '—',
        m.ageThisMonth != null ? `${m.ageThisMonth} anos` : '—',
        fmtCpf(m.cpf),
        fmtPhone(m.phone),
      ]),
      {
        columnStyles: {
          0: { cellWidth: 14, halign: 'center' },
          3: { cellWidth: 22, halign: 'center' },
        },
      },
    );
  }

  return finalizeReport(ctx);
}
