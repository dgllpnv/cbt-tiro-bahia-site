// =====================================================
// declarationBase.ts — Helper para PDFs de declaracoes oficiais
//
// Diferente de relatorios (com header/footer institucional do clube),
// declaracoes seguem o padrao sobrio dos modelos: pagina A4 limpa,
// titulo centralizado em caixa alta, paragrafo(s) justificado(s),
// local + data centralizados, linha de assinatura centralizada.
// =====================================================

import jsPDF from 'jspdf';
import autoTable, { type UserOptions } from 'jspdf-autotable';

export const MARGIN_X = 25;
export const MARGIN_Y = 30;
const TEXT_DARK = '#000000';

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function formatLongDate(d: Date | string | null = new Date()): string {
  const dt = d ? (typeof d === 'string' ? new Date(d) : d) : new Date();
  return `${String(dt.getDate()).padStart(2, '0')} de ${MONTHS_PT[dt.getMonth()]} de ${dt.getFullYear()}`;
}

export function formatShortDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function formatCpf(cpf: string | null | undefined): string {
  if (!cpf) return '—';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return '—';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return phone;
}

export function formatCep(cep: string | null | undefined): string {
  if (!cep) return '';
  const d = cep.replace(/\D/g, '');
  if (d.length !== 8) return cep;
  return d.replace(/(\d{5})(\d{3})/, '$1-$2');
}

export interface DeclContext {
  pdf: jsPDF;
  pageWidth: number;
  pageHeight: number;
  cursorY: number;
}

export function newDeclaration(): DeclContext {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.setFont('times', 'normal');
  pdf.setTextColor(TEXT_DARK);
  return {
    pdf,
    pageWidth: pdf.internal.pageSize.getWidth(),
    pageHeight: pdf.internal.pageSize.getHeight(),
    cursorY: MARGIN_Y,
  };
}

export function ensureSpace(ctx: DeclContext, needed: number): void {
  if (ctx.cursorY + needed > ctx.pageHeight - MARGIN_Y) {
    ctx.pdf.addPage();
    ctx.cursorY = MARGIN_Y;
  }
}

export function declTitle(ctx: DeclContext, title: string, subtitle?: string): void {
  const { pdf, pageWidth } = ctx;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(13);
  const lines = pdf.splitTextToSize(title, pageWidth - MARGIN_X * 2);
  for (const line of lines) {
    ensureSpace(ctx, 8);
    pdf.text(line, pageWidth / 2, ctx.cursorY, { align: 'center' });
    ctx.cursorY += 6;
  }
  if (subtitle) {
    pdf.setFont('times', 'normal');
    pdf.setFontSize(11);
    ctx.cursorY += 1;
    pdf.text(subtitle, pageWidth / 2, ctx.cursorY, { align: 'center' });
    ctx.cursorY += 6;
  }
  ctx.cursorY += 6;
}

/**
 * Insere um logo opcional do clube acima do titulo. Se o logo nao
 * carregar, ignora silenciosamente — declaracao continua valida.
 */
export async function declHeaderLogo(ctx: DeclContext): Promise<void> {
  try {
    const res = await fetch('/branding/cbt-logo.png');
    if (!res.ok) return;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const w = 22;
    ctx.pdf.addImage(dataUrl, 'PNG', (ctx.pageWidth - w) / 2, ctx.cursorY, w, w);
    ctx.cursorY += w + 4;
  } catch {
    /* ignora */
  }
}

/** Linhas de identificacao do clube no topo (CNPJ, endereco, CR, contato). */
export function declClubHeaderLines(ctx: DeclContext, club: {
  cnpj?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  crPj?: string | null;
  phone?: string | null;
  email?: string | null;
}): void {
  const { pdf, pageWidth } = ctx;
  pdf.setFont('times', 'normal');
  pdf.setFontSize(10);

  const lines = [
    club.cnpj ? `CNPJ: ${formatCnpj(club.cnpj)}` : null,
    [
      club.addressLine,
      club.zipCode ? `CEP: ${formatCep(club.zipCode)}` : null,
      [club.city, club.state].filter(Boolean).join('/'),
    ]
      .filter(Boolean)
      .join(' - '),
    [club.crPj ? `Nº CR: ${club.crPj}` : null, club.phone ? `Telefone(s): ${formatPhone(club.phone)}` : null]
      .filter(Boolean)
      .join(' - '),
    club.email ? `Email: ${club.email}` : null,
  ].filter(Boolean) as string[];

  for (const line of lines) {
    ensureSpace(ctx, 5);
    pdf.text(line, pageWidth / 2, ctx.cursorY, { align: 'center' });
    ctx.cursorY += 4.5;
  }
  ctx.cursorY += 4;
}

export function declParagraph(
  ctx: DeclContext,
  text: string,
  opts: { fontSize?: number; bold?: boolean; align?: 'left' | 'center' | 'right' | 'justify'; indent?: boolean } = {},
): void {
  const { pdf, pageWidth } = ctx;
  const { fontSize = 11, bold = false, align = 'justify', indent = true } = opts;
  pdf.setFont('times', bold ? 'bold' : 'normal');
  pdf.setFontSize(fontSize);
  const maxWidth = pageWidth - MARGIN_X * 2;
  const prefixed = indent && align === 'justify' ? `        ${text}` : text;
  const lines: string[] = pdf.splitTextToSize(prefixed, maxWidth);
  const lineHeight = fontSize * 0.45 + 1.5;
  for (let i = 0; i < lines.length; i++) {
    ensureSpace(ctx, lineHeight + 1);
    const isLast = i === lines.length - 1;
    if (align === 'center') {
      pdf.text(lines[i], pageWidth / 2, ctx.cursorY, { align: 'center' });
    } else if (align === 'right') {
      pdf.text(lines[i], pageWidth - MARGIN_X, ctx.cursorY, { align: 'right' });
    } else if (align === 'justify' && !isLast) {
      // jsPDF nao tem justify nativo simples; usamos left que ja faz wrap.
      pdf.text(lines[i], MARGIN_X, ctx.cursorY);
    } else {
      pdf.text(lines[i], MARGIN_X, ctx.cursorY);
    }
    ctx.cursorY += lineHeight;
  }
  ctx.cursorY += 2;
}

export function declCenterDate(ctx: DeclContext, city: string, state: string, dateLong: string): void {
  ctx.cursorY += 6;
  ensureSpace(ctx, 10);
  ctx.pdf.setFont('times', 'normal');
  ctx.pdf.setFontSize(11);
  ctx.pdf.text(`${city}/${state}, ${dateLong}.`, ctx.pageWidth / 2, ctx.cursorY, { align: 'center' });
  ctx.cursorY += 16;
}

export function declSignature(
  ctx: DeclContext,
  name: string,
  cpf: string,
  role?: string | null,
): void {
  ensureSpace(ctx, 24);
  const { pdf, pageWidth } = ctx;
  const lineW = 90;
  const lineX1 = (pageWidth - lineW) / 2;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.3);
  pdf.line(lineX1, ctx.cursorY, lineX1 + lineW, ctx.cursorY);
  ctx.cursorY += 5;

  pdf.setFont('times', 'bold');
  pdf.setFontSize(11);
  pdf.text(name, pageWidth / 2, ctx.cursorY, { align: 'center' });
  ctx.cursorY += 5;

  pdf.setFont('times', 'normal');
  pdf.setFontSize(10);
  if (role) {
    pdf.text(role, pageWidth / 2, ctx.cursorY, { align: 'center' });
    ctx.cursorY += 4.5;
  }
  pdf.text(`CPF: ${formatCpf(cpf)}`, pageWidth / 2, ctx.cursorY, { align: 'center' });
  ctx.cursorY += 6;
}

/** Duas assinaturas lado-a-lado (ex: REQUERENTE + PRESIDENTE). */
export function declTwoSignatures(
  ctx: DeclContext,
  left: { name: string; cpf: string; role: string },
  right: { name: string; cpf: string; role: string },
): void {
  ensureSpace(ctx, 30);
  const { pdf, pageWidth } = ctx;
  const colW = (pageWidth - MARGIN_X * 2) / 2;
  const baseY = ctx.cursorY;

  pdf.setFont('times', 'bold');
  pdf.setFontSize(10);
  pdf.text(left.role, MARGIN_X + colW / 2, baseY, { align: 'center' });
  pdf.text(right.role, MARGIN_X + colW + colW / 2, baseY, { align: 'center' });

  pdf.setFont('times', 'bold');
  pdf.setFontSize(11);
  pdf.text(left.name, MARGIN_X + colW / 2, baseY + 6, { align: 'center' });
  pdf.text(right.name, MARGIN_X + colW + colW / 2, baseY + 6, { align: 'center' });

  pdf.setFont('times', 'normal');
  pdf.setFontSize(10);
  pdf.text(`CPF: ${formatCpf(left.cpf)}`, MARGIN_X + colW / 2, baseY + 11, { align: 'center' });
  pdf.text(`CPF: ${formatCpf(right.cpf)}`, MARGIN_X + colW + colW / 2, baseY + 11, { align: 'center' });

  ctx.cursorY = baseY + 18;
}

export function declTable(
  ctx: DeclContext,
  head: string[][],
  body: any[][],
  options: Partial<UserOptions> = {},
): void {
  ensureSpace(ctx, 20);
  autoTable(ctx.pdf, {
    startY: ctx.cursorY,
    margin: { left: MARGIN_X, right: MARGIN_X, top: MARGIN_Y, bottom: MARGIN_Y },
    head,
    body,
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize: 9.5,
      cellPadding: 1.8,
      textColor: TEXT_DARK,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: TEXT_DARK,
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    ...options,
  });
  ctx.cursorY = (ctx.pdf as any).lastAutoTable.finalY + 5;
}

/** Helper: monta a string "Eu, NOME, ... CPF NN..." com fallback dignos. */
export function memberIdentificationLine(member: {
  fullName: string;
  cpf: string;
  rg?: string | null;
  rgIssuer?: string | null;
  nationality?: string | null;
  naturality?: string | null;
  dateOfBirth?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  profession?: string | null;
  maritalStatus?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  zipCode?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
}): string {
  const enderecoCompleto = [
    member.address,
    member.neighborhood ? `bairro ${member.neighborhood}` : null,
    member.zipCode ? `CEP ${formatCep(member.zipCode)}` : null,
    [member.city, member.state].filter(Boolean).join('/'),
  ]
    .filter(Boolean)
    .join(', ');

  return [
    `Eu, ${member.fullName}, portador da carteira de identidade nº ${member.rg ?? '—'}/${member.rgIssuer ?? '—'},`,
    member.nationality ? member.nationality.toUpperCase() : 'BRASILEIRO(A)',
    `, natural de ${member.naturality ?? '—'}, CPF nº ${formatCpf(member.cpf)},`,
    `nascido em ${formatShortDate(member.dateOfBirth)},`,
    member.fatherName || member.motherName
      ? `filho de ${member.fatherName ?? '—'} e ${member.motherName ?? '—'},`
      : '',
    enderecoCompleto ? `residente à ${enderecoCompleto},` : '',
    member.phone ? `Telefone: ${formatPhone(member.phone)},` : '',
    member.email ? `e-mail: ${member.email}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export const MARITAL_STATUS_LABEL: Record<string, string> = {
  SOLTEIRO: 'SOLTEIRO',
  CASADO: 'CASADO',
  DIVORCIADO: 'DIVORCIADO',
  VIUVO: 'VIÚVO',
  UNIAO_ESTAVEL: 'UNIÃO ESTÁVEL',
};
