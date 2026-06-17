// =====================================================
// pdfReceipt.ts
// Recibo de pagamento (anuidade e vendas). Identidade visual do CBT,
// reaproveitando reportBase (logo, cor laranja, header/footer, assinatura).
//
// Dois exportadores de conveniencia:
//  - exportAnnuityReceiptPdf: recibo de anuidade
//  - exportSaleReceiptPdf:     recibo de qualquer venda/transacao
// =====================================================

import {
  startReport,
  finalizeReport,
  addAutoTable,
  addSectionTitle,
  addKeyValueGrid,
  addParagraph,
  addSignatureBlock,
  ensureSpace,
  fmtDate,
  fmtDateTime,
  fmtCurrency,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { ClubSettings } from '@/services/clubSettingsService';
import type { Transaction } from '@/services/transactionsService';
import type { AnnuityPayment } from '@/services/annuitiesService';
import { transactionTypeLabels } from '@/lib/constants';

// ── Mapeia ClubSettings -> ReportClubInfo (mesmo padrao do pdfDailyClosing) ──
function toClubInfo(club: ClubSettings | null): ReportClubInfo {
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

export interface ReceiptLine {
  description: string;
  quantity?: number;
  unitPrice?: number;
  total: number;
}

export interface ReceiptInput {
  club: ClubSettings | null;
  title: string;                 // Ex: 'RECIBO DE ANUIDADE'
  receiptNumber: string;
  issuedAt: string | Date;
  kindLabel: string;             // Ex: 'Anuidade', 'Venda de munições'
  member: { fullName: string; memberNumber?: string | number | null };
  lines: ReceiptLine[];
  total: number;
  paymentMethod?: string | null;
  periodLabel?: string | null;   // vigencia (anuidade)
  notes?: string | null;
  generatedByName?: string | null;
}

export async function buildReceiptPdf(input: ReceiptInput) {
  const club = toClubInfo(input.club);

  const ctx = await startReport(
    {
      title: input.title,
      subtitle: `Recibo Nº ${input.receiptNumber}`,
      reportNumber: input.receiptNumber,
      category: 'FINANCEIRO',
    },
    club,
  );

  // ── Dados do recibo ───────────────────────────────────────────────────
  addSectionTitle(ctx, 'Dados do recibo');
  addKeyValueGrid(ctx, [
    ['Recibo Nº', input.receiptNumber],
    ['Emitido em', fmtDateTime(input.issuedAt)],
    ['Referente a', input.kindLabel],
    ['Forma de pagamento', input.paymentMethod ?? '—'],
    ['Associado', input.member.fullName],
    ['Matrícula', input.member.memberNumber != null ? String(input.member.memberNumber) : '—'],
    ...(input.periodLabel ? ([['Vigência', input.periodLabel]] as Array<[string, string]>) : []),
    ...(input.generatedByName ? ([['Operador', input.generatedByName]] as Array<[string, string]>) : []),
  ]);

  // ── Itens ─────────────────────────────────────────────────────────────
  ctx.cursorY += 2;
  addSectionTitle(ctx, 'Discriminação');
  addAutoTable(
    ctx,
    [['Descrição', 'Qtd', 'Valor unit.', 'Total']],
    input.lines.map((l) => [
      l.description,
      l.quantity != null ? String(l.quantity) : '—',
      l.unitPrice != null ? fmtCurrency(l.unitPrice) : '—',
      fmtCurrency(l.total),
    ]),
    {
      columnStyles: {
        0: { cellWidth: 92 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 32, halign: 'right' },
        3: { cellWidth: 32, halign: 'right' },
      },
    },
  );

  ensureSpace(ctx, 8);
  addParagraph(ctx, `TOTAL: ${fmtCurrency(input.total)}`, {
    fontSize: 11,
    bold: true,
    align: 'right',
  });

  // ── Texto declaratorio ────────────────────────────────────────────────
  ctx.cursorY += 2;
  addParagraph(
    ctx,
    `Recebemos de ${input.member.fullName} a importância de ${fmtCurrency(input.total)} ` +
      `referente a ${input.kindLabel.toLowerCase()}, conforme discriminado acima. ` +
      `Para clareza e comprovação, firmamos o presente recibo.`,
    { fontSize: 9.5 },
  );

  if (input.notes) {
    addParagraph(ctx, `Observações: ${input.notes}`, { fontSize: 8.5 });
  }

  // ── Assinatura ────────────────────────────────────────────────────────
  ctx.cursorY += 6;
  addSignatureBlock(ctx, {
    closingNote: 'Este recibo comprova o pagamento registrado no sistema de gestão do clube.',
  });

  return finalizeReport(ctx);
}

// ── Conveniencia: recibo de anuidade ────────────────────────────────────────
export async function exportAnnuityReceiptPdf(
  payment: AnnuityPayment,
  club: ClubSettings | null,
  generatedByName?: string | null,
): Promise<void> {
  const period = `${fmtDate(payment.validFrom)} a ${fmtDate(payment.validUntil)}`;
  const pdf = await buildReceiptPdf({
    club,
    title: 'RECIBO DE ANUIDADE',
    receiptNumber: `REC-A-${payment.id.slice(0, 8).toUpperCase()}`,
    issuedAt: payment.paymentDate,
    kindLabel: 'Anuidade',
    member: { fullName: payment.member.fullName, memberNumber: payment.member.memberNumber },
    lines: [{ description: `Anuidade — vigência ${period}`, total: Number(payment.amount) }],
    total: Number(payment.amount),
    paymentMethod: payment.paymentMethod,
    periodLabel: period,
    generatedByName,
  });
  pdf.save(`recibo-anuidade-${payment.id.slice(0, 8)}.pdf`);
}

// ── Conveniencia: recibo de venda/transacao ─────────────────────────────────
export async function exportSaleReceiptPdf(
  tx: Transaction,
  club: ClubSettings | null,
  generatedByName?: string | null,
): Promise<void> {
  const pdf = await buildReceiptPdf({
    club,
    title: 'RECIBO DE PAGAMENTO',
    receiptNumber: `REC-V-${tx.id.slice(0, 8).toUpperCase()}`,
    issuedAt: tx.transactionDate,
    kindLabel: transactionTypeLabels[tx.type] ?? 'Venda',
    member: tx.member,
    lines: tx.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
      total: Number(it.subtotal),
    })),
    total: Number(tx.totalAmount),
    paymentMethod: tx.paymentMethod,
    notes: tx.notes,
    generatedByName: generatedByName ?? tx.registeredBy?.fullName ?? null,
  });
  pdf.save(`recibo-venda-${tx.id.slice(0, 8)}.pdf`);
}
