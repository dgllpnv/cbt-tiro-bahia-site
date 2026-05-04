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
import type { MembersListReport } from '@/services/reportsService';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  SUSPENDED: 'Suspenso',
};

interface BuildOptions {
  crVariant?: 'with' | 'without';
}

export async function buildMembersInactivePdf(
  payload: MembersListReport,
  club: ReportClubInfo,
  opts: BuildOptions = {},
) {
  const variantSuffix =
    opts.crVariant === 'with' ? ' COM CR' : opts.crVariant === 'without' ? ' SEM CR' : '';

  const ctx = await startReport(
    {
      title: `ASSOCIADOS INATIVOS${variantSuffix}`,
      subtitle: `${payload.total} associado(s)`,
      category: 'MEMBERS',
    },
    club,
  );

  if (payload.total === 0) {
    addCalloutBox(ctx, `Nenhum associado inativo${variantSuffix.toLowerCase()}.`);
  } else {
    addCalloutBox(ctx, `Total: ${payload.total} associado(s) inativo(s)${variantSuffix.toLowerCase()}.`);

    const showCr = opts.crVariant !== 'without';
    const head = showCr
      ? [['Nome', 'Nº', 'CPF', 'Telefone', 'Filiado desde', 'CR', 'Nível', 'Status', 'Anuidade até']]
      : [['Nome', 'Nº', 'CPF', 'Telefone', 'Filiado desde', 'Status', 'Anuidade até']];

    addAutoTable(
      ctx,
      head,
      payload.members.map((m) => {
        const base = [
          m.fullName,
          m.memberNumber ?? '—',
          fmtCpf(m.cpf),
          fmtPhone(m.phone),
          fmtDate(m.memberSince),
        ];
        if (showCr) {
          base.push(m.cr ?? '—', m.crLevel ? `N${m.crLevel}` : '—');
        }
        base.push(
          m.isActive === false ? 'Desativado' : (STATUS_LABEL[m.status ?? ''] ?? m.status ?? '—'),
          fmtDate(m.annuityValidUntil),
        );
        return base;
      }),
    );
  }

  return finalizeReport(ctx);
}
