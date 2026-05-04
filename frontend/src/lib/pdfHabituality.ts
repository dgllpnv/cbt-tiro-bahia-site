// =====================================================
// Gerador de PDF — Declaracao de Habitualidade (Anexo E)
// Portaria nº 166-COLOG/C Ex de 22/12/2023, alterada pela
// Portaria nº 260-COLOG/C Ex de 09/06/2025, com lastro no
// Decreto nº 11.615/2023.
//
// Estilo: documento oficial sobrio (NAO tactical/militar).
// Texto vetorial pesquisavel + tabela com quebra automatica
// de pagina via jspdf-autotable.
// =====================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { HabitualityDeclarationPacket } from '@/services/documentsService';

// Cores
const ORANGE = '#FF8C00';
const HEADER_DARK = '#222222';
const TEXT_DARK = '#1a1a1a';
const TEXT_MUTED = '#555555';

// Layout (mm)
const MARGIN_X = 18;
const MARGIN_TOP = 15;
const MARGIN_BOTTOM = 18; // espaco reservado pro footer

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function formatDateBr(iso: string | Date | null): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateLong(d: Date): string {
  return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatCpfBr(cpf: string | null): string {
  if (!cpf) return '—';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/** Carrega a logo CBT como dataURL (base64) para incorporar no PDF. */
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

export async function generateHabitualityPdf(
  packet: HabitualityDeclarationPacket,
): Promise<jsPDF> {
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
      // ignora se a imagem nao puder ser embutida
    }
  }
  const headerLeftX = MARGIN_X + (logoData ? 26 : 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(HEADER_DARK);
  pdf.text(packet.club.name, headerLeftX, cursorY + 5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(TEXT_MUTED);
  const cnpjLine = `CNPJ: ${packet.club.cnpj ?? '—'}     CR PJ: ${packet.club.crPj ?? '—'}`;
  pdf.text(cnpjLine, headerLeftX, cursorY + 11);

  const addrLine = [
    packet.club.addressLine,
    [packet.club.city, packet.club.state].filter(Boolean).join('/'),
    packet.club.zipCode ? `CEP ${packet.club.zipCode}` : null,
  ]
    .filter(Boolean)
    .join(' — ');
  if (addrLine) pdf.text(addrLine, headerLeftX, cursorY + 16);

  const contactLine = [
    packet.club.phone ? `Tel: ${packet.club.phone}` : null,
    packet.club.email ? `E-mail: ${packet.club.email}` : null,
  ]
    .filter(Boolean)
    .join('     ');
  if (contactLine) pdf.text(contactLine, headerLeftX, cursorY + 21);

  cursorY += 26;

  // Linha laranja
  pdf.setDrawColor(ORANGE);
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN_X, cursorY, pageW - MARGIN_X, cursorY);
  cursorY += 8;

  // ── Título ────────────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(TEXT_DARK);
  pdf.text('DECLARAÇÃO DE HABITUALIDADE', pageW / 2, cursorY, { align: 'center' });
  cursorY += 5.5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(TEXT_MUTED);
  pdf.text(
    'Anexo E da Portaria nº 166-COLOG/C Ex de 22/12/2023 (alterada pela Portaria nº 260-COLOG/2025)',
    pageW / 2,
    cursorY,
    { align: 'center' },
  );
  cursorY += 8;

  // ── Identificação do atirador ─────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(TEXT_DARK);
  pdf.text('Identificação do atirador', MARGIN_X, cursorY);
  cursorY += 1.5;
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN_X, cursorY, pageW - MARGIN_X, cursorY);
  cursorY += 4;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(TEXT_DARK);

  const colW = (pageW - MARGIN_X * 2) / 2;
  const memberRows: Array<[string, string]> = [
    ['Nome completo', packet.member.fullName],
    ['CPF', formatCpfBr(packet.member.cpf)],
    ['Data de nascimento', formatDateBr(packet.member.dateOfBirth)],
    ['Nº de matrícula', packet.member.memberNumber],
    ['CR (Certificado de Registro)', packet.member.cr ?? '—'],
    ['Nível CR', packet.member.crLevel ? `Nível ${packet.member.crLevel}` : '—'],
    ['Validade do CR', formatDateBr(packet.member.crExpiry)],
    ['Filiado desde', formatDateBr(packet.member.memberSince)],
  ];
  const enderecoLinha = [
    packet.member.addressLine,
    [packet.member.city, packet.member.state].filter(Boolean).join('/'),
    packet.member.zipCode ? `CEP ${packet.member.zipCode}` : null,
  ]
    .filter(Boolean)
    .join(' — ') || '—';
  memberRows.push(['Endereço', enderecoLinha]);

  for (let i = 0; i < memberRows.length; i += 2) {
    const left = memberRows[i];
    const right = memberRows[i + 1];
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(TEXT_MUTED);
    pdf.text(`${left[0]}:`, MARGIN_X, cursorY);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(TEXT_DARK);
    pdf.text(left[1], MARGIN_X + 38, cursorY, { maxWidth: colW - 40 });

    if (right) {
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(TEXT_MUTED);
      pdf.text(`${right[0]}:`, MARGIN_X + colW, cursorY);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(TEXT_DARK);
      pdf.text(right[1], MARGIN_X + colW + 38, cursorY, { maxWidth: colW - 40 });
    }
    cursorY += 5;
  }

  cursorY += 3;

  // ── Período de referência ─────────────────────────────────────────────
  pdf.setFillColor(255, 247, 235);
  pdf.setDrawColor(ORANGE);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(MARGIN_X, cursorY, pageW - MARGIN_X * 2, 9, 1.5, 1.5, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(HEADER_DARK);
  pdf.text(
    `Período de referência: ${formatDateBr(packet.period.startDate)} a ${formatDateBr(packet.period.endDate)}`,
    MARGIN_X + 4,
    cursorY + 6,
  );
  cursorY += 14;

  // ── Tabela detalhada de atividades (autotable) ────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(TEXT_DARK);
  pdf.text('Atividades registradas', MARGIN_X, cursorY);
  cursorY += 4;

  const tableBody = packet.activities.map((a, idx) => [
    String(idx + 1),
    formatDateBr(a.date),
    a.activityType === 'COMPETITION' ? 'Competição' : 'Treinamento',
    a.modality,
    a.caliber,
    a.firearmName ?? '—',
    a.shotsFired != null ? String(a.shotsFired) : '—',
  ]);

  if (tableBody.length === 0) {
    tableBody.push(['—', '—', '—', 'Nenhuma atividade registrada no período', '—', '—', '—']);
  }

  autoTable(pdf, {
    startY: cursorY,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
    head: [['#', 'Data', 'Tipo', 'Modalidade', 'Calibre', 'Arma', 'Munição']],
    body: tableBody,
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
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 22 },
      3: { cellWidth: 38 },
      4: { cellWidth: 22 },
      5: { cellWidth: 38 },
      6: { cellWidth: 17, halign: 'right' },
    },
  });

  cursorY = (pdf as any).lastAutoTable.finalY + 6;

  // Helper que garante espaco vertical, criando nova pagina se preciso.
  const ensureSpace = (needed: number) => {
    if (cursorY + needed > pageH - MARGIN_BOTTOM) {
      pdf.addPage();
      cursorY = MARGIN_TOP;
    }
  };

  // ── Totais ─────────────────────────────────────────────────────────────
  ensureSpace(40);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(TEXT_DARK);
  pdf.text('Totais por calibre', MARGIN_X, cursorY);
  cursorY += 4;

  if (packet.totalsByCaliber.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(TEXT_MUTED);
    pdf.text('Sem registros agrupados.', MARGIN_X, cursorY + 4);
    cursorY += 8;
  } else {
    autoTable(pdf, {
      startY: cursorY,
      margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
      head: [['Calibre', 'Eventos', 'Mínimo', 'Status']],
      body: packet.totalsByCaliber.map((t) => [
        t.caliber,
        String(t.count),
        String(t.required),
        t.compliant ? 'Atende' : 'Pendente',
      ]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8 },
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' },
      },
    });
    cursorY = (pdf as any).lastAutoTable.finalY + 4;
  }

  ensureSpace(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(TEXT_DARK);
  pdf.text(
    `Total no período: ${packet.totals.total} atividade(s) — ` +
      `${packet.totals.trainings} treino(s), ${packet.totals.competitions} competição(ões).`,
    MARGIN_X,
    cursorY,
  );
  cursorY += 5;
  pdf.setTextColor(TEXT_MUTED);
  pdf.setFontSize(8.5);
  const tg = packet.crLevelTargets;
  pdf.text(
    `Mínimos exigidos para Nível ${tg.level}: ${tg.requiredTrainings} treino(s)` +
      (tg.requiredCompetitions > 0 ? ` + ${tg.requiredCompetitions} competição(ões).` : '.'),
    MARGIN_X,
    cursorY,
  );
  cursorY += 9;

  // ── Texto declaratório ────────────────────────────────────────────────
  ensureSpace(50);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(TEXT_DARK);
  pdf.text('Declaração', MARGIN_X, cursorY);
  cursorY += 5;

  const decText =
    `O ${packet.club.name}, inscrito no CNPJ sob o nº ${packet.club.cnpj ?? '—'} e portador do ` +
    `Certificado de Registro nº ${packet.club.crPj ?? '—'} expedido pelo Comando do Exército, com sede ` +
    `em ${packet.club.addressLine ?? '—'}${packet.club.city ? ', ' + packet.club.city : ''}` +
    `${packet.club.state ? '/' + packet.club.state : ''}, DECLARA, para os fins do art. 96 da Portaria ` +
    `nº 166-COLOG/C Ex de 22/12/2023, alterada pela Portaria nº 260-COLOG/C Ex de 09/06/2025, e em ` +
    `cumprimento ao disposto no Decreto nº 11.615/2023, que o(a) Sr.(a) ${packet.member.fullName}, ` +
    `CPF nº ${formatCpfBr(packet.member.cpf)}, titular do CR nº ${packet.member.cr ?? '—'} ` +
    `(válido até ${formatDateBr(packet.member.crExpiry)}), classificado(a) no Nível ` +
    `${packet.member.crLevel ?? '—'} de atirador desportivo, realizou no período de ` +
    `${formatDateBr(packet.period.startDate)} a ${formatDateBr(packet.period.endDate)} as atividades de ` +
    `treinamento e/ou competição relacionadas no quadro acima. As informações têm respaldo nos ` +
    `registros oficiais desta entidade, nos termos do Anexo E da Portaria nº 166-COLOG/C Ex/2023.`;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(TEXT_DARK);
  const decLines = pdf.splitTextToSize(decText, pageW - MARGIN_X * 2);
  ensureSpace(decLines.length * 5 + 4);
  pdf.text(decLines, MARGIN_X, cursorY, { align: 'justify', maxWidth: pageW - MARGIN_X * 2 });
  cursorY += decLines.length * 5 + 6;

  // ── Local + data ──────────────────────────────────────────────────────
  ensureSpace(30);
  const localDate =
    `${packet.club.city ?? '—'}${packet.club.state ? '/' + packet.club.state : ''}, ` +
    formatDateLong(new Date());
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(localDate, MARGIN_X, cursorY);
  cursorY += 16;

  // ── Assinatura ────────────────────────────────────────────────────────
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
  pdf.text(packet.club.responsibleName ?? '—', pageW / 2, cursorY, { align: 'center' });
  cursorY += 4;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(TEXT_MUTED);
  if (packet.club.responsibleRole) {
    pdf.text(packet.club.responsibleRole, pageW / 2, cursorY, { align: 'center' });
    cursorY += 4;
  }
  if (packet.club.responsibleCpf) {
    pdf.text(`CPF: ${formatCpfBr(packet.club.responsibleCpf)}`, pageW / 2, cursorY, { align: 'center' });
    cursorY += 4;
  }
  pdf.setFontSize(8.5);
  pdf.text('Carimbo do clube', pageW / 2, cursorY + 1, { align: 'center' });

  // ── Footer fixo em todas as páginas ───────────────────────────────────
  const totalPages = pdf.getNumberOfPages();
  const generatedAtStr = (() => {
    const d = new Date();
    return `${formatDateBr(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  })();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `${packet.club.email ?? ''} · Documento gerado em ${generatedAtStr}`,
      MARGIN_X,
      pageH - 8,
    );
    pdf.text(`Página ${p} de ${totalPages}`, pageW - MARGIN_X, pageH - 8, { align: 'right' });
  }

  return pdf;
}
