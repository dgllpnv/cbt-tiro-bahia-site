// =====================================================
// reportBase.ts — Helper compartilhado para TODOS os PDFs
//
// Centraliza:
//  - Carregamento de logo do clube
//  - Header repetido em TODAS as paginas (logo, dados, titulo, periodo)
//  - Footer repetido (numeracao, citacao legal, geracao)
//  - Marca d'agua "DOCUMENTO OFICIAL" (opcional)
//  - QR de validacao (opcional)
//  - Bloco de assinatura padrao
//  - Helpers de data, CPF, moeda, secao, key-value grid, autoTable wrapper
//
// Os 14 PDFs do modulo Relatorios usam estas primitivas; os 2 PDFs antigos
// (pdfHabituality, pdfFinancialReport) sao refatorados para tambem usarem.
// =====================================================

import jsPDF from 'jspdf';
import autoTable, { type UserOptions } from 'jspdf-autotable';

// ── Constantes de marca ─────────────────────────────────────────────────────
export const ORANGE = '#FF8C00';
export const HEADER_DARK = '#222222';
export const TEXT_DARK = '#1a1a1a';
export const TEXT_MUTED = '#555555';

// ── Layout (mm) ─────────────────────────────────────────────────────────────
export const MARGIN_X = 18;
export const MARGIN_TOP = 32;     // espaco reservado para header em TODAS paginas
export const MARGIN_BOTTOM = 22;  // espaco reservado para footer em TODAS paginas

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface ReportClubInfo {
  name: string;
  cnpj: string | null;
  crPj: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
  responsibleName: string | null;
  responsibleCpf: string | null;
  responsibleRole: string | null;
}

export type ReportCategory =
  | 'MEMBERS'
  | 'HABITUALIDADE'
  | 'ACERVO_MUNICOES'
  | 'FINANCEIRO'
  | 'COMPLIANCE'
  | 'DECLARACOES';

export interface ReportMeta {
  title: string;                  // Ex: "LIVRO DE HABITUALIDADE"
  subtitle?: string;              // Ex: "Periodo: 01/01/2024 a 31/12/2024"
  reportNumber?: string;          // Auto-gerado se nao informado
  legalRefs?: string[];           // Ex: ["Decreto 11.615/2023, art. 11", "Portaria 166-COLOG/2023"]
  category: ReportCategory;
  isOfficial?: boolean;           // Default false. Se true, marca d'agua + selo
}

export interface PdfReportContext {
  pdf: jsPDF;
  cursorY: number;
  pageWidth: number;
  pageHeight: number;
  meta: Required<Pick<ReportMeta, 'title' | 'category' | 'reportNumber'>> & ReportMeta;
  club: ReportClubInfo;
  logoData: string | null;
  generatedAt: Date;
}

// ── Helpers de formatacao ───────────────────────────────────────────────────

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function fmtDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  const date = fmtDate(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${date} ${hh}:${mi}`;
}

export function fmtDateLong(d: Date): string {
  return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
}

export function fmtCpf(cpf: string | null | undefined): string {
  if (!cpf) return '—';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function fmtCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return phone;
}

// ── Carregamento de logo ────────────────────────────────────────────────────

export async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/branding/cbt-logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Numero de relatorio ─────────────────────────────────────────────────────

const CATEGORY_PREFIXES: Record<ReportCategory, string> = {
  MEMBERS: 'ASSO',
  HABITUALIDADE: 'HABT',
  ACERVO_MUNICOES: 'ACVM',
  FINANCEIRO: 'FINC',
  COMPLIANCE: 'CMPL',
  DECLARACOES: 'DECL',
};

export function generateReportNumber(category: ReportCategory): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `CBT-${CATEGORY_PREFIXES[category]}-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

// ── Inicializa PDF com contexto ─────────────────────────────────────────────

export async function startReport(
  meta: ReportMeta,
  club: ReportClubInfo,
): Promise<PdfReportContext> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const logoData = await loadLogoDataUrl();
  const reportNumber = meta.reportNumber ?? generateReportNumber(meta.category);

  return {
    pdf,
    cursorY: MARGIN_TOP,
    pageWidth,
    pageHeight,
    meta: { ...meta, reportNumber, title: meta.title, category: meta.category },
    club,
    logoData,
    generatedAt: new Date(),
  };
}

// ── Garante espaco vertical (cria nova pagina se nao couber) ────────────────

export function ensureSpace(ctx: PdfReportContext, needed: number): void {
  if (ctx.cursorY + needed > ctx.pageHeight - MARGIN_BOTTOM) {
    ctx.pdf.addPage();
    ctx.cursorY = MARGIN_TOP;
  }
}

// ── Secao com titulo e divisor ──────────────────────────────────────────────

export function addSectionTitle(ctx: PdfReportContext, title: string): void {
  ensureSpace(ctx, 12);
  const { pdf, pageWidth } = ctx;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(TEXT_DARK);
  pdf.text(title, MARGIN_X, ctx.cursorY);
  ctx.cursorY += 1.5;
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN_X, ctx.cursorY, pageWidth - MARGIN_X, ctx.cursorY);
  ctx.cursorY += 4;
}

// ── Grid 2 colunas de chave/valor ───────────────────────────────────────────

export function addKeyValueGrid(
  ctx: PdfReportContext,
  rows: Array<[string, string]>,
): void {
  const { pdf, pageWidth } = ctx;
  const colW = (pageWidth - MARGIN_X * 2) / 2;
  const valueMaxW = colW - 40;
  // Altura por linha de texto (9pt * fator de linha do jsPDF) e folga entre linhas.
  const TEXT_LH = 3.7;
  const ROW_GAP = 1.3;

  for (let i = 0; i < rows.length; i += 2) {
    const left = rows[i];
    const right = rows[i + 1];

    // Mede quantas linhas cada valor ocupa apos a quebra, para dimensionar a
    // altura da linha. Valores longos (nome completo, profissao) quebravam em
    // 2+ linhas e a proxima linha era desenhada por cima -> sobreposicao.
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const leftLines = pdf.splitTextToSize(String(left[1] ?? '—'), valueMaxW);
    const rightLines = right ? pdf.splitTextToSize(String(right[1] ?? '—'), valueMaxW) : [];
    const rowLines = Math.max(leftLines.length, rightLines.length, 1);
    const rowH = Math.max(5, rowLines * TEXT_LH + ROW_GAP);

    ensureSpace(ctx, rowH);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(TEXT_MUTED);
    pdf.text(`${left[0]}:`, MARGIN_X, ctx.cursorY);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(TEXT_DARK);
    pdf.text(leftLines, MARGIN_X + 38, ctx.cursorY);

    if (right) {
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(TEXT_MUTED);
      pdf.text(`${right[0]}:`, MARGIN_X + colW, ctx.cursorY);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(TEXT_DARK);
      pdf.text(rightLines, MARGIN_X + colW + 38, ctx.cursorY);
    }
    ctx.cursorY += rowH;
  }
}

// ── autoTable wrapper com estilo padrao do clube ────────────────────────────

export function addAutoTable(
  ctx: PdfReportContext,
  head: string[][],
  body: any[][],
  options: Partial<UserOptions> = {},
): void {
  ensureSpace(ctx, 20);
  autoTable(ctx.pdf, {
    startY: ctx.cursorY,
    margin: {
      left: MARGIN_X,
      right: MARGIN_X,
      top: MARGIN_TOP,
      bottom: MARGIN_BOTTOM,
    },
    head,
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 1.8,
      textColor: TEXT_DARK,
      lineColor: [220, 220, 220],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    ...options,
  });
  ctx.cursorY = (ctx.pdf as any).lastAutoTable.finalY + 6;
}

// ── Box destacado ───────────────────────────────────────────────────────────

export function addCalloutBox(ctx: PdfReportContext, text: string): void {
  ensureSpace(ctx, 12);
  const { pdf, pageWidth } = ctx;
  pdf.setFillColor(255, 247, 235);
  pdf.setDrawColor(ORANGE);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(MARGIN_X, ctx.cursorY, pageWidth - MARGIN_X * 2, 9, 1.5, 1.5, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(HEADER_DARK);
  pdf.text(text, MARGIN_X + 4, ctx.cursorY + 6);
  ctx.cursorY += 14;
}

// ── Texto livre justificado ─────────────────────────────────────────────────

export function addParagraph(
  ctx: PdfReportContext,
  text: string,
  opts: { fontSize?: number; bold?: boolean; align?: 'left' | 'center' | 'right' | 'justify' } = {},
): void {
  const { pdf, pageWidth } = ctx;
  const { fontSize = 9.5, bold = false, align = 'justify' } = opts;
  pdf.setFont('helvetica', bold ? 'bold' : 'normal');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(TEXT_DARK);
  const maxWidth = pageWidth - MARGIN_X * 2;
  const lines: string[] = pdf.splitTextToSize(text, maxWidth);
  const lineHeight = fontSize * 0.4;
  for (const line of lines) {
    ensureSpace(ctx, lineHeight + 1);
    pdf.text(line, align === 'center' ? pageWidth / 2 : MARGIN_X, ctx.cursorY, {
      align: align === 'justify' ? 'left' : align,
      maxWidth,
    });
    ctx.cursorY += lineHeight;
  }
  ctx.cursorY += 1;
}

// ── Bloco de assinatura padrao ──────────────────────────────────────────────

export function addSignatureBlock(
  ctx: PdfReportContext,
  opts: { closingNote?: string } = {},
): void {
  ensureSpace(ctx, 35);
  const { pdf, pageWidth, club } = ctx;

  // Local + data
  const localData = `${club.city ?? '—'}/${club.state ?? '—'}, ${fmtDateLong(ctx.generatedAt)}.`;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(TEXT_DARK);
  pdf.text(localData, pageWidth / 2, ctx.cursorY, { align: 'center' });
  ctx.cursorY += 14;

  // Linha de assinatura
  const lineW = 80;
  const lineX1 = (pageWidth - lineW) / 2;
  pdf.setDrawColor(150, 150, 150);
  pdf.setLineWidth(0.3);
  pdf.line(lineX1, ctx.cursorY, lineX1 + lineW, ctx.cursorY);
  ctx.cursorY += 4;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(TEXT_DARK);
  pdf.text(club.responsibleName ?? '—', pageWidth / 2, ctx.cursorY, { align: 'center' });
  ctx.cursorY += 4;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(TEXT_MUTED);
  const cargoLine = [club.responsibleRole, club.responsibleCpf ? `CPF ${fmtCpf(club.responsibleCpf)}` : null]
    .filter(Boolean)
    .join(' — ');
  if (cargoLine) {
    pdf.text(cargoLine, pageWidth / 2, ctx.cursorY, { align: 'center' });
    ctx.cursorY += 4;
  }

  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8.5);
  pdf.setTextColor(TEXT_MUTED);
  pdf.text('[Carimbo do clube]', pageWidth / 2, ctx.cursorY + 2, { align: 'center' });
  ctx.cursorY += 8;

  if (opts.closingNote) {
    ensureSpace(ctx, 8);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(TEXT_MUTED);
    addParagraph(ctx, opts.closingNote, { fontSize: 8.5, align: 'center' });
  }
}

// ── Header repetido em TODAS as paginas ─────────────────────────────────────

function drawHeaderOnPage(ctx: PdfReportContext, _pageIdx: number): void {
  const { pdf, pageWidth, club, meta, logoData } = ctx;

  // Logo
  if (logoData) {
    try {
      pdf.addImage(logoData, 'PNG', MARGIN_X, 8, 16, 16);
    } catch {
      // ignora
    }
  }

  // Nome + CNPJ + CR PJ (esquerda)
  const headerLeftX = MARGIN_X + (logoData ? 20 : 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(HEADER_DARK);
  pdf.text(club.name, headerLeftX, 12);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(TEXT_MUTED);
  const ids = [
    club.cnpj ? `CNPJ ${club.cnpj}` : null,
    club.crPj ? `CR PJ ${club.crPj}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');
  if (ids) pdf.text(ids, headerLeftX, 16.5);

  const addrShort = [club.city, club.state].filter(Boolean).join('/');
  if (addrShort) pdf.text(addrShort, headerLeftX, 20.5);

  // Numero + tipo do relatorio (direita)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(HEADER_DARK);
  pdf.text(meta.reportNumber ?? '—', pageWidth - MARGIN_X, 12, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(TEXT_MUTED);
  pdf.text(meta.title, pageWidth - MARGIN_X, 16.5, { align: 'right' });
  if (meta.subtitle) {
    pdf.text(meta.subtitle, pageWidth - MARGIN_X, 20.5, { align: 'right' });
  }

  // Linha laranja
  pdf.setDrawColor(ORANGE);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN_X, 25, pageWidth - MARGIN_X, 25);
}

// ── Footer repetido em TODAS as paginas ─────────────────────────────────────

function drawFooterOnPage(ctx: PdfReportContext, pageIdx: number, totalPages: number): void {
  const { pdf, pageWidth, pageHeight, meta, generatedAt, club } = ctx;
  const footerY = pageHeight - 10;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(150, 150, 150);

  // Esquerda: email + data de geracao
  const leftLine = [
    club.email ?? '—',
    `Gerado em ${fmtDateTime(generatedAt)}`,
  ].join('  ·  ');
  pdf.text(leftLine, MARGIN_X, footerY);

  // Centro: citacao legal compactada (se houver)
  if (meta.legalRefs && meta.legalRefs.length > 0) {
    const refs = meta.legalRefs.join(' · ');
    const maxWidth = pageWidth - MARGIN_X * 2 - 100;
    pdf.text(`Conforme ${refs}`, pageWidth / 2, footerY, {
      align: 'center',
      maxWidth,
    });
  }

  // Direita: pagina X de Y
  pdf.text(`Pagina ${pageIdx} de ${totalPages}`, pageWidth - MARGIN_X, footerY, {
    align: 'right',
  });

  // Linha cinza acima do footer
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN_X, footerY - 4, pageWidth - MARGIN_X, footerY - 4);
}

// ── Finaliza: aplica header+footer em TODAS paginas ────────────────────────

export function finalizeReport(ctx: PdfReportContext): jsPDF {
  const { pdf } = ctx;
  const totalPages = pdf.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    drawHeaderOnPage(ctx, p);
    drawFooterOnPage(ctx, p, totalPages);
  }

  return pdf;
}

// ── Helper para baixar/visualizar PDF gerado ────────────────────────────────

export function savePdf(pdf: jsPDF, filename: string): void {
  pdf.save(filename);
}

export function pdfToBlob(pdf: jsPDF): Blob {
  return pdf.output('blob');
}

export function pdfToBlobUrl(pdf: jsPDF): string {
  return URL.createObjectURL(pdfToBlob(pdf));
}
