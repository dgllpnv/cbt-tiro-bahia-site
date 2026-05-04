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

interface BuildOptions {
  /** 'with' adiciona "(com CR)" ao subtitulo e mostra coluna CR; 'without' idem para "sem CR"; undefined: todos. */
  crVariant?: 'with' | 'without';
}

export async function buildMembersActivePdf(
  payload: MembersListReport,
  club: ReportClubInfo,
  opts: BuildOptions = {},
) {
  const variantSuffix =
    opts.crVariant === 'with' ? ' COM CR' : opts.crVariant === 'without' ? ' SEM CR' : '';

  const ctx = await startReport(
    {
      title: `ASSOCIADOS ATIVOS${variantSuffix}`,
      subtitle: `${payload.total} associado(s)`,
      category: 'MEMBERS',
    },
    club,
  );

  if (payload.total === 0) {
    addCalloutBox(ctx, `Nenhum associado ativo${variantSuffix.toLowerCase()}.`);
  } else {
    addCalloutBox(ctx, `Total: ${payload.total} associado(s) ativo(s)${variantSuffix.toLowerCase()}.`);

    const showCr = opts.crVariant !== 'without';
    const head = showCr
      ? [['Nome', 'Nº', 'CPF', 'Telefone', 'Filiado desde', 'CR', 'Nível', 'Anuidade até']]
      : [['Nome', 'Nº', 'CPF', 'Telefone', 'Filiado desde', 'Anuidade até']];

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
        base.push(fmtDate(m.annuityValidUntil));
        return base;
      }),
    );
  }

  return finalizeReport(ctx);
}
