// =====================================================
// Gerador de PDF — Fechamento Financeiro
// Mesmo padrão visual do pdfHabituality (jsPDF + autotable,
// helvetica, sóbrio, multipágina, footer com numeração).
// =====================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FinancialDashboard } from '@/services/financialService';
import type { ClubSettings } from '@/services/clubSettingsService';
import type { ExpiringAnnuity } from '@/services/annuitiesService';

const ORANGE = '#FF8C00';
const HEADER_DARK = '#222222';
const TEXT_DARK = '#1a1a1a';
const TEXT_MUTED = '#555555';

const MARGIN_X = 18;
const MARGIN_TOP = 15;
const MARGIN_BOTTOM = 18;

// ── Labels (espelham os do front e os enums do back) ────────────────────
const TYPE_LABELS: Record<string, string> = {
  AMMUNITION_SALE: 'Venda de Munição',
  TARGET_SALE: 'Venda de Alvos',
  EQUIPMENT_RENTAL: 'Aluguel de Equipamento',
  MAGAZINE_RENTAL: 'Aluguel de Carregador',
  LANE_RENTAL: 'Aluguel de Baia',
  ANNUITY_PAYMENT: 'Pagamento de Anuidade',
  COURSE_ENROLLMENT: 'Inscrição em Curso',
  GUEST_ENTRY: 'Entrada de Visitante',
  OTHER_SALE: 'Outra Venda',
};
const EXPENSE_LABELS: Record<string, string> = {
  INVENTORY_PURCHASE: 'Compra de Estoque',
  MAINTENANCE: 'Manutenção',
  UTILITIES: 'Utilidades',
  STAFF: 'Pessoal',
  INSURANCE: 'Seguro',
  AMMUNITION_RESTOCK: 'Reposição de Munição',
  EQUIPMENT_PURCHASE: 'Compra de Equipamento',
  OTHER: 'Outro',
};

const fmtCurrency = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDateBr = (iso: string | Date | null): string => {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

async function loadLogoDataUrl(): Promise<string | null> {
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

export interface FinancialReportInput {
  dashboard: FinancialDashboard;
  club: ClubSettings | null;
  overdueAnnuities: ExpiringAnnuity[];
}

export async function generateFinancialReportPdf(input: FinancialReportInput): Promise<jsPDF> {
  const { dashboard, club, overdueAnnuities } = input;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const logoData = await loadLogoDataUrl();
  let cursorY = MARGIN_TOP;

  // ── Cabeçalho ─────────────────────────────────────────────────────────
  if (logoData) {
    try {
      pdf.addImage(logoData, 'PNG', MARGIN_X, cursorY, 22, 22);
    } catch {
      // ignora se nao puder embutir
    }
  }
  const headerLeftX = MARGIN_X + (logoData ? 26 : 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(HEADER_DARK);
  pdf.text(club?.clubName ?? 'Clube Baiano de Tiro', headerLeftX, cursorY + 5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(TEXT_MUTED);
  if (club) {
    pdf.text(
      `CNPJ: ${club.cnpj ?? '—'}     CR PJ: ${club.crPj ?? '—'}`,
      headerLeftX,
      cursorY + 11,
    );
    const addr = [
      club.addressLine,
      [club.city, club.state].filter(Boolean).join('/'),
      club.zipCode ? `CEP ${club.zipCode}` : null,
    ]
      .filter(Boolean)
      .join(' — ');
    if (addr) pdf.text(addr, headerLeftX, cursorY + 16);

    const contact = [
      club.phone ? `Tel: ${club.phone}` : null,
      club.email ? `E-mail: ${club.email}` : null,
    ]
      .filter(Boolean)
      .join('     ');
    if (contact) pdf.text(contact, headerLeftX, cursorY + 21);
  }
  cursorY += 26;

  pdf.setDrawColor(ORANGE);
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN_X, cursorY, pageW - MARGIN_X, cursorY);
  cursorY += 8;

  // ── Título + Período ──────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(TEXT_DARK);
  pdf.text('FECHAMENTO FINANCEIRO', pageW / 2, cursorY, { align: 'center' });
  cursorY += 5.5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(TEXT_MUTED);
  pdf.text(
    `Período: ${fmtDateBr(dashboard.period.startDate)} a ${fmtDateBr(dashboard.period.endDate)} ` +
      `(${dashboard.period.days} dia${dashboard.period.days === 1 ? '' : 's'})`,
    pageW / 2,
    cursorY,
    { align: 'center' },
  );
  cursorY += 8;

  // ── Bloco de KPIs ─────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(TEXT_DARK);
  pdf.text('Resumo do período', MARGIN_X, cursorY);
  cursorY += 4;

  const k = dashboard.kpis;
  const fmtDelta = (d: number | null, unit: 'pct' | 'pp' = 'pct') => {
    if (d === null) return '—';
    const sign = d >= 0 ? '+' : '';
    const fixed = Math.abs(d) >= 10 ? d.toFixed(0) : d.toFixed(1);
    return `${sign}${fixed}${unit === 'pp' ? ' p.p.' : '%'}`;
  };

  autoTable(pdf, {
    startY: cursorY,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
    head: [['Indicador', 'Valor', 'Período anterior', 'Variação']],
    body: [
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
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 1.8,
      textColor: TEXT_DARK,
      lineColor: [220, 220, 220],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { halign: 'right', cellWidth: 40 },
      2: { halign: 'right', cellWidth: 40, textColor: TEXT_MUTED },
      3: { halign: 'right' },
    },
  });
  cursorY = (pdf as any).lastAutoTable.finalY + 6;

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > pageH - MARGIN_BOTTOM) {
      pdf.addPage();
      cursorY = MARGIN_TOP;
    }
  };

  // ── Receita por categoria ─────────────────────────────────────────────
  ensureSpace(40);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(TEXT_DARK);
  pdf.text('Receita por categoria', MARGIN_X, cursorY);
  cursorY += 4;

  const revBody =
    dashboard.revenueByType.length === 0
      ? [['—', '—', '—', '—']]
      : dashboard.revenueByType.map((r) => [
          TYPE_LABELS[r.key] ?? r.key,
          String(r.count),
          fmtCurrency(r.total),
          `${(r.share * 100).toFixed(1)}%`,
        ]);

  autoTable(pdf, {
    startY: cursorY,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
    head: [['Categoria', 'Qtd', 'Total', '% do total']],
    body: revBody,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 40 },
      3: { halign: 'right' },
    },
  });
  cursorY = (pdf as any).lastAutoTable.finalY + 6;

  // ── Despesa por categoria ─────────────────────────────────────────────
  ensureSpace(40);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(TEXT_DARK);
  pdf.text('Despesas por categoria', MARGIN_X, cursorY);
  cursorY += 4;

  const expBody =
    dashboard.expensesByCategory.length === 0
      ? [['—', '—', '—', '—']]
      : dashboard.expensesByCategory.map((r) => [
          EXPENSE_LABELS[r.key] ?? r.key,
          String(r.count),
          fmtCurrency(r.total),
          `${(r.share * 100).toFixed(1)}%`,
        ]);

  autoTable(pdf, {
    startY: cursorY,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
    head: [['Categoria', 'Qtd', 'Total', '% do total']],
    body: expBody,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 40 },
      3: { halign: 'right' },
    },
  });
  cursorY = (pdf as any).lastAutoTable.finalY + 6;

  // ── Anuidades pendentes ───────────────────────────────────────────────
  ensureSpace(40);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(TEXT_DARK);
  pdf.text(
    `Anuidades pendentes (${overdueAnnuities.length})`,
    MARGIN_X,
    cursorY,
  );
  cursorY += 4;

  const anBody =
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
            fmtDateBr(a.annuityValidUntil),
            status,
          ];
        });

  autoTable(pdf, {
    startY: cursorY,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
    head: [['Associado', 'Nº', 'Vencimento', 'Status']],
    body: anBody,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 28, halign: 'center' },
      3: { halign: 'left' },
    },
  });
  cursorY = (pdf as any).lastAutoTable.finalY + 6;

  // ── Top produtos ──────────────────────────────────────────────────────
  ensureSpace(40);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(TEXT_DARK);
  pdf.text('Top 5 produtos por receita', MARGIN_X, cursorY);
  cursorY += 4;

  const topBody =
    dashboard.topProducts.length === 0
      ? [['—', '—', '—', '—']]
      : dashboard.topProducts.map((p) => [
          p.name,
          String(p.qty),
          fmtCurrency(p.revenue),
          p.marginPct != null ? `${p.marginPct.toFixed(1)}%` : '—',
        ]);

  autoTable(pdf, {
    startY: cursorY,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
    head: [['Produto', 'Qtd', 'Receita', 'Margem']],
    body: topBody,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 18, halign: 'center' },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right' },
    },
  });
  cursorY = (pdf as any).lastAutoTable.finalY + 12;

  // ── Bloco de assinatura ───────────────────────────────────────────────
  ensureSpace(28);
  const signX1 = pageW / 2 - 45;
  const signX2 = pageW / 2 + 45;
  pdf.setDrawColor(120, 120, 120);
  pdf.setLineWidth(0.3);
  pdf.line(signX1, cursorY, signX2, cursorY);
  cursorY += 4;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(TEXT_DARK);
  pdf.text(club?.responsibleName ?? '—', pageW / 2, cursorY, { align: 'center' });
  cursorY += 4;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(TEXT_MUTED);
  if (club?.responsibleRole) {
    pdf.text(club.responsibleRole, pageW / 2, cursorY, { align: 'center' });
    cursorY += 4;
  }
  pdf.setFontSize(8.5);
  pdf.text('Carimbo do clube', pageW / 2, cursorY + 1, { align: 'center' });

  // ── Footer fixo ───────────────────────────────────────────────────────
  const totalPages = pdf.getNumberOfPages();
  const generatedAt = (() => {
    const d = new Date();
    return `${fmtDateBr(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  })();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `${club?.email ?? ''} · Documento gerado em ${generatedAt}`,
      MARGIN_X,
      pageH - 8,
    );
    pdf.text(`Página ${p} de ${totalPages}`, pageW - MARGIN_X, pageH - 8, { align: 'right' });
  }

  return pdf;
}
