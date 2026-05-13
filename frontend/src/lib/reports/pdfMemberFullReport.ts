// =====================================================
// pdfMemberFullReport.ts
// Relatorio PDF com TODOS os dados do associado.
// Usa reportBase compartilhado para manter identidade visual do CBT
// (logo, cor laranja, fontes, header/footer em todas as paginas).
//
// Inclui foto do associado (FaceProfile thumbnail) quando disponivel.
// =====================================================

import {
  startReport,
  finalizeReport,
  addAutoTable,
  addParagraph,
  addSectionTitle,
  addKeyValueGrid,
  ensureSpace,
  fmtDate,
  fmtCpf,
  fmtCurrency,
  fmtPhone,
  ORANGE,
  TEXT_DARK,
  TEXT_MUTED,
  MARGIN_X,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { ClubSettings } from '@/services/clubSettingsService';
import type { MemberStats } from '@/services/memberStatsService';
import { transactionTypeLabels, loanStatusLabels } from '@/lib/constants';

// ── Tipos de entrada ────────────────────────────────────────────────────────

export interface MemberFullData {
  id: string;
  fullName: string;
  email?: string | null;
  cpf: string;
  role: string;
  status: string;
  memberNumber?: string | null;
  memberSince?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  rg?: string | null;
  rgIssuer?: string | null;
  nationality?: string | null;
  naturality?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  profession?: string | null;
  maritalStatus?: string | null;
  cr?: string | null;
  crLevel?: number | null;
  crExpiry?: string | null;
  membershipTier?: string | null;
  annuityValidUntil?: string | null;
}

export interface MemberPdfVisit {
  id: string;
  visitDate: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  lane?: { name?: string | null } | null;
  purpose?: string | null;
  details?: Array<{ caliber?: string; shotsFired?: number; firearmName?: string | null }>;
}

export interface MemberPdfAnnuity {
  id: string;
  validUntil: string;
  status?: string;
  amount?: number | null;
  paidAt?: string | null;
}

export interface MemberPdfTransaction {
  id: string;
  date: string;
  type: string;
  description?: string | null;
  amount: number;
  paymentMethod?: string | null;
}

export interface MemberPdfLoan {
  id: string;
  equipmentName: string;
  loanDate: string;
  expectedReturn?: string | null;
  actualReturn?: string | null;
  status: string;
}

export interface MemberPdfAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize?: number | null;
  uploadedAt: string;
}

export interface MemberFullReportInput {
  member: MemberFullData;
  /** thumbnail base64 do FaceProfile mais recente (ex: "data:image/jpeg;base64,..."). */
  facePhoto?: string | null;
  club: ClubSettings | null;
  stats?: MemberStats | null;
  visits?: MemberPdfVisit[];
  annuities?: MemberPdfAnnuity[];
  transactions?: MemberPdfTransaction[];
  loans?: MemberPdfLoan[];
  attachments?: MemberPdfAttachment[];
}

// ── Mapeamentos de label ────────────────────────────────────────────────────

const MARITAL_LABELS: Record<string, string> = {
  SOLTEIRO: 'Solteiro(a)',
  CASADO: 'Casado(a)',
  DIVORCIADO: 'Divorciado(a)',
  VIUVO: 'Viúvo(a)',
  UNIAO_ESTAVEL: 'União estável',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  SUSPENDED: 'Suspenso',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  ADMIN: 'Administrador',
  associate: 'Associado',
  ASSOCIATE: 'Associado',
  visitor: 'Visitante',
  VISITOR: 'Visitante',
};

// ── Foto do associado (avatar circular no topo) ─────────────────────────────

function drawMemberPhoto(
  ctx: Awaited<ReturnType<typeof startReport>>,
  facePhoto: string | null | undefined,
  member: MemberFullData,
): void {
  const { pdf } = ctx;
  // Caixa de foto a direita da pagina (4cm de largura), ao lado do titulo da seção
  const photoSize = 32;
  const photoX = ctx.pageWidth - MARGIN_X - photoSize;
  const photoY = ctx.cursorY;

  // Moldura laranja
  pdf.setFillColor(248, 248, 248);
  pdf.setDrawColor(ORANGE);
  pdf.setLineWidth(0.6);
  pdf.roundedRect(photoX, photoY, photoSize, photoSize, 2, 2, 'FD');

  if (facePhoto) {
    try {
      // Detecta formato pelo prefixo do data URL
      const isPng = facePhoto.startsWith('data:image/png');
      const format = isPng ? 'PNG' : 'JPEG';
      pdf.addImage(facePhoto, format, photoX + 1, photoY + 1, photoSize - 2, photoSize - 2);
    } catch {
      // Fallback: iniciais centralizadas
      drawPhotoInitials(ctx, photoX, photoY, photoSize, member.fullName);
    }
  } else {
    drawPhotoInitials(ctx, photoX, photoY, photoSize, member.fullName);
  }
}

function drawPhotoInitials(
  ctx: Awaited<ReturnType<typeof startReport>>,
  x: number,
  y: number,
  size: number,
  fullName: string,
): void {
  const { pdf } = ctx;
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?';
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(ORANGE);
  pdf.text(initials, x + size / 2, y + size / 2 + 3, { align: 'center' });
}

// ── Builder principal ──────────────────────────────────────────────────────

export async function buildMemberFullReportPdf(input: MemberFullReportInput) {
  const { member, facePhoto, club, stats, visits, annuities, transactions, loans, attachments } = input;

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

  const ctx = await startReport(
    {
      title: 'FICHA COMPLETA DO ASSOCIADO',
      subtitle: member.memberNumber ? `Matrícula nº ${member.memberNumber}` : undefined,
      category: 'MEMBERS',
    },
    clubInfo,
  );

  // ── Bloco do topo: foto + nome + identificacao basica ─────────────────────
  const topY = ctx.cursorY;
  drawMemberPhoto(ctx, facePhoto, member);

  // Texto a esquerda da foto
  const photoBoxWidth = 32 + 4; // foto + gap
  const textWidth = ctx.pageWidth - MARGIN_X * 2 - photoBoxWidth;

  ctx.pdf.setFont('helvetica', 'bold');
  ctx.pdf.setFontSize(14);
  ctx.pdf.setTextColor(TEXT_DARK);
  const nameLines = ctx.pdf.splitTextToSize(member.fullName, textWidth);
  let textY = topY + 6;
  for (const ln of nameLines.slice(0, 2)) {
    ctx.pdf.text(ln, MARGIN_X, textY);
    textY += 6;
  }

  ctx.pdf.setFont('helvetica', 'normal');
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(TEXT_MUTED);
  const sub = [
    ROLE_LABELS[member.role] ?? member.role,
    STATUS_LABELS[member.status] ?? member.status,
    member.memberNumber ? `Matrícula ${member.memberNumber}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');
  ctx.pdf.text(sub, MARGIN_X, textY);
  textY += 5;

  // Status anuidade abaixo do nome
  if (member.annuityValidUntil) {
    const until = new Date(member.annuityValidUntil);
    const days = Math.ceil((until.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const expired = days < 0;
    const label = expired
      ? `Anuidade vencida em ${fmtDate(member.annuityValidUntil)}`
      : `Anuidade válida até ${fmtDate(member.annuityValidUntil)} (${days} dia${days === 1 ? '' : 's'})`;
    ctx.pdf.setFont('helvetica', 'bold');
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(expired ? '#b91c1c' : '#15803d');
    ctx.pdf.text(label, MARGIN_X, textY);
    textY += 5;
  } else {
    ctx.pdf.setFont('helvetica', 'italic');
    ctx.pdf.setFontSize(8.5);
    ctx.pdf.setTextColor(TEXT_MUTED);
    ctx.pdf.text('Sem anuidade registrada', MARGIN_X, textY);
    textY += 5;
  }

  // Empurra cursor para abaixo do bloco (foto tem 32mm)
  ctx.cursorY = Math.max(textY + 2, topY + 36);

  // ── Identificacao pessoal ─────────────────────────────────────────────────
  addSectionTitle(ctx, 'Identificação');
  addKeyValueGrid(ctx, [
    ['Nome completo', member.fullName],
    ['CPF', fmtCpf(member.cpf)],
    ['RG', member.rg ?? '—'],
    ['Órgão emissor', member.rgIssuer ?? '—'],
    ['Data de nascimento', fmtDate(member.dateOfBirth)],
    ['Estado civil', member.maritalStatus ? MARITAL_LABELS[member.maritalStatus] ?? member.maritalStatus : '—'],
    ['Nacionalidade', member.nationality ?? '—'],
    ['Naturalidade', member.naturality ?? '—'],
    ['Profissão', member.profession ?? '—'],
    ['Filiação (pai)', member.fatherName ?? '—'],
    ['Filiação (mãe)', member.motherName ?? '—'],
  ]);

  // ── Contato ──────────────────────────────────────────────────────────────
  ctx.cursorY += 2;
  addSectionTitle(ctx, 'Contato e endereço');
  const enderecoCompleto = [
    member.address,
    member.neighborhood,
    [member.city, member.state].filter(Boolean).join('/'),
    member.zipCode ? `CEP ${member.zipCode}` : null,
  ]
    .filter(Boolean)
    .join(' — ') || '—';
  addKeyValueGrid(ctx, [
    ['E-mail', member.email ?? '—'],
    ['Telefone', fmtPhone(member.phone)],
    ['Endereço', enderecoCompleto],
  ]);

  // ── Filiacao e CR ────────────────────────────────────────────────────────
  ctx.cursorY += 2;
  addSectionTitle(ctx, 'Filiação ao clube e CR');
  addKeyValueGrid(ctx, [
    ['Nº de matrícula', member.memberNumber ?? '—'],
    ['Sócio desde', fmtDate(member.memberSince)],
    ['Categoria', member.membershipTier ?? 'STANDARD'],
    ['Perfil', ROLE_LABELS[member.role] ?? member.role],
    ['CR', member.cr ?? '—'],
    ['Nível CR', member.crLevel != null ? `Nível ${member.crLevel}` : '—'],
    ['Validade CR', fmtDate(member.crExpiry)],
    ['Status', STATUS_LABELS[member.status] ?? member.status],
    ['Anuidade válida até', fmtDate(member.annuityValidUntil)],
  ]);

  // ── Estatisticas ─────────────────────────────────────────────────────────
  if (stats) {
    ctx.cursorY += 2;
    addSectionTitle(ctx, 'Estatísticas de tiro');
    addKeyValueGrid(ctx, [
      ['Total de disparos', stats.totalShots.toLocaleString('pt-BR')],
      ['Total de visitas', String(stats.totalVisits)],
      ['Visitas (últimos 12m)', String(stats.visitsLast12Months)],
      ['Duração média de visita', stats.averageVisitDuration > 0 ? `${stats.averageVisitDuration} min` : '—'],
      ['Calibres distintos', String(stats.shotsByCaliber.length)],
      ['Armas distintas', String(stats.shotsByFirearm.length)],
    ]);

    // Top 5 calibres
    if (stats.shotsByCaliber.length > 0) {
      ctx.cursorY += 1;
      addAutoTable(
        ctx,
        [['Calibre', 'Disparos', '% do total']],
        stats.shotsByCaliber.slice(0, 5).map((c) => [
          c.caliber,
          c.shots.toLocaleString('pt-BR'),
          `${c.percentage}%`,
        ]),
        {
          columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 40, halign: 'right' },
            2: { cellWidth: 30, halign: 'right' },
          },
        },
      );
    }

    // Top 3 armas favoritas
    if (stats.shotsByFirearm.length > 0) {
      addParagraph(ctx, 'Armas favoritas (top 3):', { fontSize: 9, bold: true });
      addAutoTable(
        ctx,
        [['Arma', 'Categoria', 'Disparos', '%']],
        stats.shotsByFirearm.slice(0, 3).map((f) => [
          f.firearmName,
          f.category ?? '—',
          f.shots.toLocaleString('pt-BR'),
          `${f.percentage}%`,
        ]),
        {
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 45 },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 20, halign: 'right' },
          },
        },
      );
    }
  }

  // ── Visitas ──────────────────────────────────────────────────────────────
  if (visits && visits.length > 0) {
    ctx.cursorY += 2;
    addSectionTitle(ctx, `Histórico de visitas (últimas ${visits.length})`);
    addAutoTable(
      ctx,
      [['Data', 'Entrada', 'Saída', 'Baia', 'Finalidade', 'Disparos']],
      visits.map((v) => {
        const shots = (v.details ?? []).reduce((s, d) => s + (d.shotsFired ?? 0), 0);
        const hhmm = (iso?: string | null) =>
          iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
        return [
          fmtDate(v.visitDate),
          hhmm(v.checkInTime),
          hhmm(v.checkOutTime),
          v.lane?.name ?? '—',
          v.purpose ?? '—',
          String(shots),
        ];
      }),
      {
        columnStyles: {
          0: { cellWidth: 26 },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 22, halign: 'center' },
          3: { cellWidth: 28 },
          4: { cellWidth: 48 },
          5: { cellWidth: 28, halign: 'right' },
        },
      },
    );
  }

  // ── Anuidades ────────────────────────────────────────────────────────────
  if (annuities && annuities.length > 0) {
    ctx.cursorY += 2;
    addSectionTitle(ctx, 'Histórico de anuidades');
    addAutoTable(
      ctx,
      [['Válida até', 'Status', 'Valor', 'Paga em']],
      annuities.map((a) => [
        fmtDate(a.validUntil),
        a.status ?? '—',
        a.amount != null ? fmtCurrency(Number(a.amount)) : '—',
        fmtDate(a.paidAt),
      ]),
      {
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 35 },
          2: { cellWidth: 40, halign: 'right' },
          3: { cellWidth: 45 },
        },
      },
    );
  }

  // ── Transacoes ───────────────────────────────────────────────────────────
  if (transactions && transactions.length > 0) {
    ctx.cursorY += 2;
    addSectionTitle(ctx, `Transações (últimas ${transactions.length})`);
    const totalGasto = transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    addAutoTable(
      ctx,
      [['Data', 'Tipo', 'Descrição', 'Pagamento', 'Valor']],
      transactions.map((t) => [
        fmtDate(t.date),
        transactionTypeLabels[t.type] ?? t.type,
        t.description ?? '—',
        t.paymentMethod ?? '—',
        fmtCurrency(Number(t.amount)),
      ]),
      {
        columnStyles: {
          0: { cellWidth: 26 },
          1: { cellWidth: 38 },
          2: { cellWidth: 60 },
          3: { cellWidth: 28 },
          4: { cellWidth: 22, halign: 'right' },
        },
      },
    );
    ensureSpace(ctx, 8);
    addParagraph(ctx, `Total no período: ${fmtCurrency(totalGasto)}`, { fontSize: 9.5, bold: true, align: 'right' });
  }

  // ── Emprestimos ──────────────────────────────────────────────────────────
  if (loans && loans.length > 0) {
    ctx.cursorY += 2;
    addSectionTitle(ctx, 'Empréstimos de equipamentos');
    addAutoTable(
      ctx,
      [['Equipamento', 'Emprestado em', 'Prev. devolução', 'Devolvido em', 'Status']],
      loans.map((l) => [
        l.equipmentName,
        fmtDate(l.loanDate),
        fmtDate(l.expectedReturn),
        fmtDate(l.actualReturn),
        loanStatusLabels[l.status] ?? l.status,
      ]),
      {
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 32 },
          2: { cellWidth: 32 },
          3: { cellWidth: 32 },
          4: { cellWidth: 25 },
        },
      },
    );
  }

  // ── Anexos ───────────────────────────────────────────────────────────────
  if (attachments && attachments.length > 0) {
    ctx.cursorY += 2;
    addSectionTitle(ctx, 'Anexos cadastrados');
    addAutoTable(
      ctx,
      [['Arquivo', 'Tipo', 'Tamanho', 'Enviado em']],
      attachments.map((a) => [
        a.fileName,
        a.fileType,
        a.fileSize != null ? `${(a.fileSize / 1024).toFixed(1)} KB` : '—',
        fmtDate(a.uploadedAt),
      ]),
      {
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 35 },
          2: { cellWidth: 25, halign: 'right' },
          3: { cellWidth: 30 },
        },
      },
    );
  }

  // ── Rodape do documento ──────────────────────────────────────────────────
  ctx.cursorY += 4;
  addParagraph(
    ctx,
    `Documento gerado automaticamente pelo Portal CBT em ${fmtDate(new Date())}, contendo os dados ` +
      `cadastrais atualizados do(a) associado(a) e seu histórico operacional registrado no sistema. ` +
      `As informações refletem o estado do banco de dados no momento da emissão.`,
    { fontSize: 8.5, align: 'left' },
  );

  return finalizeReport(ctx);
}

/**
 * Conveniencia: dispara download direto do PDF com nome padrao.
 */
export async function exportMemberFullReportPdf(input: MemberFullReportInput): Promise<void> {
  const pdf = await buildMemberFullReportPdf(input);
  const slug = input.member.fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
  const numero = input.member.memberNumber ? `-${input.member.memberNumber}` : '';
  pdf.save(`ficha-associado-${slug}${numero}.pdf`);
}
