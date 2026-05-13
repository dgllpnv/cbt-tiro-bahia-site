// =====================================================
// pdfDailyClosing.ts
// PDF de fechamento do caixa (dia). Identidade visual do CBT.
// Usa reportBase compartilhado (logo, cor laranja, header/footer).
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
import type { DailyClosing } from '@/services/cashierService';
import { transactionTypeLabels, expenseCategoryLabels } from '@/lib/constants';

export interface DailyClosingPdfInput {
  closing: DailyClosing;
  club: ClubSettings | null;
  generatedByName?: string | null;
}

export async function buildDailyClosingPdf(input: DailyClosingPdfInput) {
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

  const dateLabel = fmtDate(closing.date);

  const ctx = await startReport(
    {
      title: 'FECHAMENTO DE CAIXA',
      subtitle: `Data: ${dateLabel}`,
      category: 'FINANCEIRO',
    },
    clubInfo,
  );

  // ── Resumo ────────────────────────────────────────────────────────────
  addSectionTitle(ctx, 'Resumo do dia');
  addKeyValueGrid(ctx, [
    ['Data de referência', dateLabel],
    ['Hora da emissão', fmtDateTime(new Date())],
    ['Receita do dia', fmtCurrency(closing.totals.revenue)],
    ['Despesas do dia', fmtCurrency(closing.totals.expenses)],
    ['Saldo do dia', fmtCurrency(closing.totals.balance)],
    ['Transações registradas', String(closing.totals.transactionCount)],
    ['Despesas registradas', String(closing.totals.expenseCount)],
    ['Operador', generatedByName ?? '—'],
  ]);

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

  // ── Tabela de transacoes ──────────────────────────────────────────────
  if (closing.transactions.length > 0) {
    ctx.cursorY += 2;
    addSectionTitle(ctx, `Transações do dia (${closing.transactions.length})`);
    addAutoTable(
      ctx,
      [['Hora', 'Tipo', 'Associado', 'Pagamento', 'Valor']],
      closing.transactions.map((t) => {
        const time = new Date(t.transactionDate).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return [
          time,
          transactionTypeLabels[t.type] ?? t.type,
          t.member?.fullName ?? '—',
          t.paymentMethod ?? '—',
          fmtCurrency(t.totalAmount),
        ];
      }),
      {
        columnStyles: {
          0: { cellWidth: 18, halign: 'center' },
          1: { cellWidth: 42 },
          2: { cellWidth: 60 },
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
    addParagraph(ctx, 'Nenhuma transação registrada no dia.', {
      fontSize: 9.5,
      align: 'center',
    });
  }

  // ── Despesas ──────────────────────────────────────────────────────────
  if (closing.expenses.length > 0) {
    ctx.cursorY += 2;
    addSectionTitle(ctx, `Despesas do dia (${closing.expenses.length})`);
    addAutoTable(
      ctx,
      [['Hora', 'Categoria', 'Descrição', 'Fornecedor', 'Valor']],
      closing.expenses.map((e) => {
        const time = new Date(e.expenseDate).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return [
          time,
          expenseCategoryLabels[e.category] ?? e.category,
          e.description,
          e.vendor ?? '—',
          fmtCurrency(e.amount),
        ];
      }),
      {
        columnStyles: {
          0: { cellWidth: 18, halign: 'center' },
          1: { cellWidth: 42 },
          2: { cellWidth: 60 },
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
  }

  // ── Conclusao ─────────────────────────────────────────────────────────
  ctx.cursorY += 4;
  addSectionTitle(ctx, 'Conferência');
  addParagraph(
    ctx,
    `Saldo apurado no dia ${dateLabel}: ${fmtCurrency(closing.totals.balance)} ` +
      `(${closing.totals.transactionCount} transação(ões), ${closing.totals.expenseCount} despesa(s)).`,
    { fontSize: 10 },
  );

  return finalizeReport(ctx);
}

export async function exportDailyClosingPdf(input: DailyClosingPdfInput): Promise<void> {
  const pdf = await buildDailyClosingPdf(input);
  const datePart = new Date(input.closing.date).toISOString().slice(0, 10);
  pdf.save(`fechamento-caixa-${datePart}.pdf`);
}
