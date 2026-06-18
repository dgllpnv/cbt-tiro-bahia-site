// =====================================================
// pdfReceipt.ts
// Recibo de pagamento (anuidade e vendas). Identidade visual do CBT,
// reaproveitando reportBase (logo, cor laranja, header/footer, assinatura).
//
// Dois exportadores de conveniencia:
//  - exportAnnuityReceiptPdf: recibo de anuidade
//  - exportSaleReceiptPdf:     recibo de qualquer venda/transacao
// =====================================================

import jsPDF from 'jspdf';
import {
  startReport,
  finalizeReport,
  addAutoTable,
  addSectionTitle,
  addKeyValueGrid,
  addParagraph,
  addSignatureBlock,
  ensureSpace,
  loadLogoDataUrl,
  fmtDate,
  fmtDateLong,
  fmtDateTime,
  fmtCpf,
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

// Formato de saida do recibo:
//  - 'a4':      folha A4 com cabecalho/rodape institucional (reportBase)
//  - 'thermal': bobina termica 80mm (padrao Bematech/Elgin/Epson),
//               altura continua calculada pelo conteudo.
export type ReceiptFormat = 'a4' | 'thermal';

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

// =====================================================
// RECIBO TERMICO 80mm (bobina) — padrao Bematech/Elgin/Epson
//
// Impressoras termicas de cupom usam bobina de 80mm de largura com ~72mm
// de area imprimivel e ALTURA CONTINUA (corte por guilhotina/serrilha). Por
// isso o PDF e gerado numa pagina estreita cuja altura e medida a partir do
// proprio conteudo (duas passadas: 1 mede, 2 desenha), evitando sobra de
// papel em branco. Layout de coluna unica, fontes compactas, sem tabelas.
// =====================================================

const TW = 80;             // largura da bobina (mm) — padrao mais usado (80mm)
const TMX = 4;             // margem lateral (mm) — area util 72mm
const TCW = TW - TMX * 2;  // largura util do conteudo
const TLABEL = 19;         // recuo (mm) onde os valores dos campos se alinham

// Percorre o recibo calculando a altura (commit=false) ou desenhando
// (commit=true). A matematica de avanco de Y NAO depende de commit, para que
// as duas passadas produzam exatamente a mesma altura.
function layoutThermalReceipt(
  pdf: jsPDF,
  input: ReceiptInput,
  club: ReportClubInfo,
  logo: string | null,
  commit: boolean,
): number {
  const cx = TW / 2;
  const rightX = TW - TMX;
  const state = { y: 5 };

  const lh = (size: number) => size * 0.46; // altura de linha aproximada (mm)

  const setFont = (size: number, style: 'normal' | 'bold' | 'italic' = 'normal') => {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
  };

  // Texto centralizado (com quebra automatica)
  const center = (
    text: string,
    size: number,
    style: 'normal' | 'bold' | 'italic' = 'normal',
    color: [number, number, number] = [20, 20, 20],
  ) => {
    if (!text) return;
    setFont(size, style);
    pdf.setTextColor(color[0], color[1], color[2]);
    for (const line of pdf.splitTextToSize(text, TCW) as string[]) {
      if (commit) pdf.text(line, cx, state.y, { align: 'center' });
      state.y += lh(size);
    }
  };

  // Campo "Rotulo:  valor" — valor quebra alinhado ao recuo TLABEL
  const field = (label: string, value: string, size = 8) => {
    setFont(size, 'normal');
    const valueLines = pdf.splitTextToSize(value || '—', TCW - (TLABEL - TMX)) as string[];
    if (commit) {
      pdf.setTextColor(90, 90, 90);
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, TMX, state.y);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(20, 20, 20);
      pdf.text(valueLines, TMX + TLABEL, state.y);
    }
    state.y += lh(size) * valueLines.length;
  };

  // Linha rotulo/valor nas extremidades (usada no TOTAL)
  const leftRight = (label: string, value: string, size: number, bold = false) => {
    setFont(size, bold ? 'bold' : 'normal');
    if (commit) {
      pdf.setTextColor(20, 20, 20);
      pdf.text(label, TMX, state.y);
      pdf.text(value, rightX, state.y, { align: 'right' });
    }
    state.y += lh(size);
  };

  // Paragrafo justificado a esquerda
  const paragraph = (text: string, size: number) => {
    if (!text) return;
    setFont(size, 'normal');
    pdf.setTextColor(40, 40, 40);
    for (const line of pdf.splitTextToSize(text, TCW) as string[]) {
      if (commit) pdf.text(line, TMX, state.y);
      state.y += lh(size);
    }
  };

  // Divisoria tracejada
  const divider = (gap = 1.6) => {
    state.y += gap;
    if (commit) {
      pdf.setDrawColor(150, 150, 150);
      pdf.setLineWidth(0.15);
      if (typeof (pdf as any).setLineDashPattern === 'function') {
        (pdf as any).setLineDashPattern([0.6, 0.6], 0);
      }
      pdf.line(TMX, state.y, rightX, state.y);
      if (typeof (pdf as any).setLineDashPattern === 'function') {
        (pdf as any).setLineDashPattern([], 0);
      }
    }
    state.y += gap + 0.4;
  };

  // ── Cabecalho do clube ──────────────────────────────────────────────────
  if (logo) {
    try {
      if (commit) pdf.addImage(logo, 'PNG', cx - 8, state.y, 16, 16);
      state.y += 18;
    } catch {
      /* logo opcional */
    }
  }
  center(club.name, 10, 'bold');
  const ids = [club.cnpj ? `CNPJ ${club.cnpj}` : null, club.crPj ? `CR PJ ${club.crPj}` : null]
    .filter(Boolean)
    .join('  ·  ');
  center(ids, 7);
  const addr = [club.addressLine, [club.city, club.state].filter(Boolean).join('/')].filter(Boolean).join(' — ');
  center(addr, 7);
  const contact = [club.phone, club.email].filter(Boolean).join('  ·  ');
  center(contact, 7);

  divider();

  // ── Titulo + numero do recibo ───────────────────────────────────────────
  center(input.title, 9.5, 'bold');
  center(`Recibo Nº ${input.receiptNumber}`, 7.5, 'normal', [90, 90, 90]);

  divider();

  // ── Dados do recibo ─────────────────────────────────────────────────────
  field('Emitido em', fmtDateTime(input.issuedAt));
  field('Referente a', input.kindLabel);
  field('Associado', input.member.fullName);
  if (input.member.memberNumber != null) field('Matrícula', String(input.member.memberNumber));
  field('Pagamento', input.paymentMethod ?? '—');
  if (input.periodLabel) field('Vigência', input.periodLabel);
  if (input.generatedByName) field('Operador', input.generatedByName);

  divider();

  // ── Itens ───────────────────────────────────────────────────────────────
  center('DISCRIMINAÇÃO', 7.5, 'bold', [90, 90, 90]);
  state.y += 0.6;
  for (const line of input.lines) {
    paragraph(line.description, 8);
    const qtyUnit =
      line.quantity != null && line.unitPrice != null
        ? `${line.quantity} x ${fmtCurrency(line.unitPrice)}`
        : '';
    leftRight(qtyUnit, fmtCurrency(line.total), 8);
    state.y += 0.6;
  }

  divider();

  // ── Total ───────────────────────────────────────────────────────────────
  leftRight('TOTAL', fmtCurrency(input.total), 11, true);

  divider();

  // ── Texto declaratorio ──────────────────────────────────────────────────
  paragraph(
    `Recebemos de ${input.member.fullName} a importância de ${fmtCurrency(input.total)} ` +
      `referente a ${input.kindLabel.toLowerCase()}, conforme discriminado acima.`,
    7.5,
  );
  if (input.notes) {
    state.y += 0.8;
    paragraph(`Obs.: ${input.notes}`, 7);
  }

  // ── Assinatura ──────────────────────────────────────────────────────────
  state.y += 6;
  center(
    `${club.city ?? '—'}/${club.state ?? '—'}, ${fmtDateLong(new Date())}.`,
    7.5,
  );
  state.y += 9;
  if (commit) {
    pdf.setDrawColor(120, 120, 120);
    pdf.setLineWidth(0.2);
    pdf.line(cx - 28, state.y, cx + 28, state.y);
  }
  state.y += 3.4;
  center(club.responsibleName ?? '—', 8, 'bold');
  const cargo = [club.responsibleRole, club.responsibleCpf ? `CPF ${fmtCpf(club.responsibleCpf)}` : null]
    .filter(Boolean)
    .join(' — ');
  center(cargo, 7, 'normal', [90, 90, 90]);
  center('[Carimbo do clube]', 7, 'italic', [120, 120, 120]);

  state.y += 3;
  center('Comprova o pagamento registrado no sistema de gestão do clube.', 6.5, 'normal', [120, 120, 120]);

  return state.y;
}

export async function buildThermalReceiptPdf(input: ReceiptInput): Promise<jsPDF> {
  const club = toClubInfo(input.club);
  const logo = await loadLogoDataUrl();

  // Passada 1 (scratch): mede a altura total do conteudo.
  const scratch = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [TW, 800] });
  const contentH = layoutThermalReceipt(scratch, input, club, logo, false);
  const pageH = Math.max(110, Math.ceil(contentH + 6));

  // Passada 2: desenha na pagina com a altura exata.
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [TW, pageH] });
  layoutThermalReceipt(pdf, input, club, logo, true);
  return pdf;
}

// ── Conveniencia: recibo de anuidade ────────────────────────────────────────
export async function exportAnnuityReceiptPdf(
  payment: AnnuityPayment,
  club: ClubSettings | null,
  generatedByName?: string | null,
  format: ReceiptFormat = 'a4',
): Promise<void> {
  const period = `${fmtDate(payment.validFrom)} a ${fmtDate(payment.validUntil)}`;
  const input: ReceiptInput = {
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
  };
  const pdf = format === 'thermal' ? await buildThermalReceiptPdf(input) : await buildReceiptPdf(input);
  const suffix = format === 'thermal' ? '-80mm' : '';
  pdf.save(`recibo-anuidade-${payment.id.slice(0, 8)}${suffix}.pdf`);
}

// ── Conveniencia: recibo de venda/transacao ─────────────────────────────────
export async function exportSaleReceiptPdf(
  tx: Transaction,
  club: ClubSettings | null,
  generatedByName?: string | null,
  format: ReceiptFormat = 'a4',
): Promise<void> {
  const input: ReceiptInput = {
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
  };
  const pdf = format === 'thermal' ? await buildThermalReceiptPdf(input) : await buildReceiptPdf(input);
  const suffix = format === 'thermal' ? '-80mm' : '';
  pdf.save(`recibo-venda-${tx.id.slice(0, 8)}${suffix}.pdf`);
}
