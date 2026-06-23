// =====================================================
// pdfPeriodClosing.ts
// PDF de fechamento financeiro por PERIODO arbitrario. Identidade visual
// do CBT. Usa reportBase compartilhado (logo, cor laranja, header/footer +
// paginacao automatica → sem overlap). Modelado em pdfDailyClosing.ts,
// generalizando de "dia" para um intervalo de datas: lista TODAS as
// receitas e despesas do periodo, com detalhes.
// =====================================================

import {
  startReport,
  finalizeReport,
  addAutoTable,
  addSectionTitle,
  addKeyValueGrid,
  addParagraph,
  ensureSpace,
  fmtDate,
  fmtDateTime,
  fmtCurrency,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { ClubSettings } from '@/services/clubSettingsService';
import type { PeriodClosing } from '@/services/cashierService';
import { transactionTypeLabels, expenseCategoryLabels } from '@/lib/constants';

export interface PeriodClosingPdfInput {
  closing: PeriodClosing;
  club: ClubSettings | null;
  generatedByName?: string | null;
}

export async function buildPeriodClosingPdf(input: PeriodClosingPdfInput) {
  const { closing, club, generatedByName } = input;

  const clubInfo: ReportClubInfo = {
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

  const startLabel = fmtDate(closing.startDate);
  const endLabel = fmtDate(closing.endDate);

  const ctx = await startReport(
    {
      title: 'FECHAMENTO POR PERÍODO',
      subtitle: `Período: ${startLabel} a ${endLabel}`,
      category: 'FINANCEIRO',
    },
    clubInfo,
  );

  // ── Resumo ────────────────────────────────────────────────────────────
  addSectionTitle(ctx, 'Resumo do período');
  addKeyValueGrid(ctx, [
    ['Período', `${startLabel} a ${endLabel}`],
    ['Hora da emissão', fmtDateTime(new Date())],
    ['Receita do período', fmtCurrency(closing.totals.revenue)],
    ['Despesas do período', fmtCurrency(closing.totals.expenses)],
    ['Saldo do período', fmtCurrency(closing.totals.balance)],
    ['Transações registradas', String(closing.totals.transactionCount)],
    ['Despesas registradas', String(closing.totals.expenseCount)],
    ['Operador', generatedByName ?? '—'],
  ]);

  // Aviso de truncamento — caso o periodo tenha mais registros que o teto
  // de seguranca do backend, o PDF nao lista tudo. Sinaliza para o usuario.
  if (closing.truncated) {
    ensureSpace(ctx, 10);
    addParagraph(
      ctx,
      'Atenção: o período selecionado excedeu o limite de registros por relatório. ' +
        'As listas abaixo podem estar incompletas — gere o relatório em intervalos menores ' +
        'para garantir a listagem completa.',
      { fontSize: 9, bold: true },
    );
  }

  // ── Por forma de pagamento ────────────────────────────────────────────
  if (closing.paymentBreakdown.length > 0) {
    ctx.cursorY += 2;
    addSectionTitle(ctx, 'Receita por forma de pagamento');
    addAutoTable(
      ctx,
      [['Forma de pagamento', 'Transações', 'Total']],
      closing.paymentBreakdown.map((p) => [
        p.method,
        String(p.count),
        fmtCurrency(p.total),
      ]),
      {
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 50, halign: 'right' },
        },
      },
    );
  }

  // ── Por tipo de transação ─────────────────────────────────────────────
  if (closing.typeBreakdown.length > 0) {
    ctx.cursorY += 2;
    addSectionTitle(ctx, 'Receita por tipo de transação');
    addAutoTable(
      ctx,
      [['Tipo', 'Transações', 'Total']],
      closing.typeBreakdown.map((t) => [
        transactionTypeLabels[t.type] ?? t.type,
        String(t.count),
        fmtCurrency(t.total),
      ]),
      {
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 50, halign: 'right' },
        },
      },
    );
  }

  // ── Tabela de transacoes do periodo ───────────────────────────────────
  if (closing.transactions.length > 0) {
    ctx.cursorY += 2;
    addSectionTitle(ctx, `Transações do período (${closing.transactions.length})`);
    addAutoTable(
      ctx,
      [['Data', 'Tipo', 'Associado', 'Pagamento', 'Valor']],
      closing.transactions.map((t) => [
        fmtDate(t.transactionDate),
        transactionTypeLabels[t.type] ?? t.type,
        t.member?.fullName ?? '—',
        t.paymentMethod ?? '—',
        fmtCurrency(t.totalAmount),
      ]),
      {
        columnStyles: {
          0: { cellWidth: 24, halign: 'center' },
          1: { cellWidth: 38 },
          2: { cellWidth: 57 },
          3: { cellWidth: 30 },
          4: { cellWidth: 25, halign: 'right' },
        },
      },
    );
    ensureSpace(ctx, 8);
    addParagraph(
      ctx,
      `Total bruto de receita: ${fmtCurrency(closing.totals.revenue)}`,
      { fontSize: 10, bold: true, align: 'right' },
    );
  } else {
    addParagraph(ctx, 'Nenhuma transação registrada no período.', {
      fontSize: 9.5,
      align: 'center',
    });
  }

  // ── Despesas do periodo ───────────────────────────────────────────────
  if (closing.expenses.length > 0) {
    ctx.cursorY += 2;
    addSectionTitle(ctx, `Despesas do período (${closing.expenses.length})`);
    addAutoTable(
      ctx,
      [['Data', 'Categoria', 'Descrição', 'Fornecedor', 'Valor']],
      closing.expenses.map((e) => [
        fmtDate(e.expenseDate),
        expenseCategoryLabels[e.category] ?? e.category,
        e.description,
        e.vendor ?? '—',
        fmtCurrency(e.amount),
      ]),
      {
        columnStyles: {
          0: { cellWidth: 24, halign: 'center' },
          1: { cellWidth: 38 },
          2: { cellWidth: 57 },
          3: { cellWidth: 30 },
          4: { cellWidth: 25, halign: 'right' },
        },
      },
    );
    ensureSpace(ctx, 8);
    addParagraph(
      ctx,
      `Total de despesas: ${fmtCurrency(closing.totals.expenses)}`,
      { fontSize: 10, bold: true, align: 'right' },
    );
  } else {
    addParagraph(ctx, 'Nenhuma despesa registrada no período.', {
      fontSize: 9.5,
      align: 'center',
    });
  }

  // ── Conclusao ─────────────────────────────────────────────────────────
  ctx.cursorY += 4;
  addSectionTitle(ctx, 'Conferência');
  addParagraph(
    ctx,
    `Saldo apurado no período de ${startLabel} a ${endLabel}: ` +
      `${fmtCurrency(closing.totals.balance)} ` +
      `(${closing.totals.transactionCount} transação(ões), ${closing.totals.expenseCount} despesa(s)).`,
    { fontSize: 10 },
  );

  return finalizeReport(ctx);
}

export async function exportPeriodClosingPdf(input: PeriodClosingPdfInput): Promise<void> {
  const pdf = await buildPeriodClosingPdf(input);
  const startPart = new Date(input.closing.startDate).toISOString().slice(0, 10);
  const endPart = new Date(input.closing.endDate).toISOString().slice(0, 10);
  pdf.save(`fechamento-periodo-${startPart}-a-${endPart}.pdf`);
}
