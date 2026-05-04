// =====================================================
// pdfFinancialReport.ts
// Refator de lib/pdfFinancialReport.ts usando reportBase compartilhado.
// Header em todas paginas, footer com citacao opcional, assinatura padronizada.
// =====================================================

import {
  startReport,
  finalizeReport,
  addAutoTable,
  addCalloutBox,
  addSectionTitle,
  addSignatureBlock,
  fmtDate,
  fmtCurrency,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { FinancialDashboard } from '@/services/financialService';
import type { ClubSettings } from '@/services/clubSettingsService';
import type { ExpiringAnnuity } from '@/services/annuitiesService';
import { transactionTypeLabels, expenseCategoryLabels } from '@/lib/constants';

export interface FinancialReportInput {
  dashboard: FinancialDashboard;
  club: ClubSettings | null;
  overdueAnnuities: ExpiringAnnuity[];
}

const fmtDelta = (d: number | null, unit: 'pct' | 'pp' = 'pct') => {
  if (d === null) return '—';
  const sign = d >= 0 ? '+' : '';
  const fixed = Math.abs(d) >= 10 ? d.toFixed(0) : d.toFixed(1);
  return `${sign}${fixed}${unit === 'pp' ? ' p.p.' : '%'}`;
};

function clubToReportInfo(club: ClubSettings | null): ReportClubInfo {
  return {
    name: club?.clubName ?? 'Clube Baiano de Tiro',
    cnpj: club?.cnpj ?? null,
    crPj: club?.crPj ?? null,
    addressLine: club?.addressLine ?? null,
    city: club?.city ?? null,
    state: club?.state ?? null,
    zipCode: club?.zipCode ?? null,
    phone: club?.phone ?? null,
    email: club?.email ?? null,
    responsibleName: club?.responsibleName ?? null,
    responsibleCpf: club?.responsibleCpf ?? null,
    responsibleRole: club?.responsibleRole ?? null,
  };
}

export async function buildFinancialReportPdf(input: FinancialReportInput) {
  const { dashboard, club, overdueAnnuities } = input;

  const ctx = await startReport(
    {
      title: 'FECHAMENTO FINANCEIRO',
      subtitle: `Período: ${fmtDate(dashboard.period.startDate)} a ${fmtDate(dashboard.period.endDate)} (${dashboard.period.days} dia${dashboard.period.days === 1 ? '' : 's'})`,
      category: 'FINANCEIRO',
    },
    clubToReportInfo(club),
  );

  // KPIs
  const k = dashboard.kpis;
  addCalloutBox(
    ctx,
    `Resultado: ${fmtCurrency(k.result.value)} — Margem ${k.margin.value.toFixed(1)}% — Transações: ${k.txCount.value}`,
  );

  addSectionTitle(ctx, 'Resumo do período');
  addAutoTable(
    ctx,
    [['Indicador', 'Valor', 'Período anterior', 'Variação']],
    [
      ['Receita', fmtCurrency(k.revenue.value), fmtCurrency(k.revenue.prevValue ?? 0), fmtDelta(k.revenue.deltaPct)],
      ['Despesas', fmtCurrency(k.expenses.value), fmtCurrency(k.expenses.prevValue ?? 0), fmtDelta(k.expenses.deltaPct)],
      ['Resultado', fmtCurrency(k.result.value), fmtCurrency(k.result.prevValue ?? 0), fmtDelta(k.result.deltaPct)],
      [
        'Margem',
        `${k.margin.value.toFixed(1)}%`,
        `${(k.margin.prevValue ?? 0).toFixed(1)}%`,
        fmtDelta(k.margin.deltaPct, 'pp'),
      ],
      ['Ticket médio', fmtCurrency(k.avgTicket.value), fmtCurrency(k.avgTicket.prevValue ?? 0), fmtDelta(k.avgTicket.deltaPct)],
      ['Nº de transações', String(k.txCount.value), String(k.txCount.prevValue ?? 0), fmtDelta(k.txCount.deltaPct)],
    ],
    {
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'right', cellWidth: 40 },
        2: { halign: 'right', cellWidth: 40 },
        3: { halign: 'right' },
      },
    },
  );

  addSectionTitle(ctx, 'Receita por categoria');
  addAutoTable(
    ctx,
    [['Categoria', 'Qtd', 'Total', '% do total']],
    dashboard.revenueByType.length === 0
      ? [['—', '—', '—', '—']]
      : dashboard.revenueByType.map((r) => [
          transactionTypeLabels[r.key] ?? r.key,
          String(r.count),
          fmtCurrency(r.total),
          `${(r.share * 100).toFixed(1)}%`,
        ]),
    {
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 40 },
        3: { halign: 'right' },
      },
    },
  );

  addSectionTitle(ctx, 'Despesas por categoria');
  addAutoTable(
    ctx,
    [['Categoria', 'Qtd', 'Total', '% do total']],
    dashboard.expensesByCategory.length === 0
      ? [['—', '—', '—', '—']]
      : dashboard.expensesByCategory.map((r) => [
          expenseCategoryLabels[r.key] ?? r.key,
          String(r.count),
          fmtCurrency(r.total),
          `${(r.share * 100).toFixed(1)}%`,
        ]),
    {
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 40 },
        3: { halign: 'right' },
      },
    },
  );

  addSectionTitle(ctx, `Anuidades pendentes (${overdueAnnuities.length})`);
  addAutoTable(
    ctx,
    [['Associado', 'Nº', 'Vencimento', 'Status']],
    overdueAnnuities.length === 0
      ? [['—', '—', '—', 'Tudo em dia']]
      : overdueAnnuities.map((a) => {
          const days = a.daysRemaining ?? 0;
          const status =
            days < 0
              ? `Vencida há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`
              : days === 0
                ? 'Vence hoje'
                : `Vence em ${days} dia${days === 1 ? '' : 's'}`;
          return [
            a.fullName,
            a.memberNumber ?? '—',
            fmtDate(a.annuityValidUntil),
            status,
          ];
        }),
    {
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 28, halign: 'center' },
      },
    },
  );

  addSectionTitle(ctx, 'Top 5 produtos por receita');
  addAutoTable(
    ctx,
    [['Produto', 'Qtd', 'Receita', 'Margem']],
    dashboard.topProducts.length === 0
      ? [['—', '—', '—', '—']]
      : dashboard.topProducts.map((p) => [
          p.name,
          String(p.qty),
          fmtCurrency(p.revenue),
          p.marginPct != null ? `${p.marginPct.toFixed(1)}%` : '—',
        ]),
    {
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 18, halign: 'center' },
        2: { halign: 'right', cellWidth: 35 },
        3: { halign: 'right' },
      },
    },
  );

  ctx.cursorY += 6;
  addSignatureBlock(ctx);

  return finalizeReport(ctx);
}
