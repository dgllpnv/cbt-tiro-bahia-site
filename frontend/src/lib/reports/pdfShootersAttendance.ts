// =====================================================
// pdfShootersAttendance.ts — Relacao dos Atiradores e dos Atletas que
// Frequentaram Entidades de Tiro Desportivo
//
// Mesmas colunas do modelo de planilha entregue ao Exercito (clube, CR do
// clube, nome, CPF, CR, quantidade de tiros e datas de frequencia), no
// padrao visual dos demais relatorios. Dados: /api/reports/shooters-ammo.
// =====================================================

import {
  startReport,
  finalizeReport,
  addAutoTable,
  addCalloutBox,
  addSectionTitle,
  addSignatureBlock,
  fmtDate,
  fmtCpf,
  TEXT_DARK,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { ShootersAmmoReport } from '@/services/reportsService';

export async function buildShootersAttendancePdf(
  payload: ShootersAmmoReport,
  club: ReportClubInfo,
) {
  const ctx = await startReport(
    {
      title: 'RELAÇÃO DE ATIRADORES E ATLETAS FREQUENTADORES',
      subtitle: `Período: ${fmtDate(payload.from)} a ${fmtDate(payload.to)} — ${payload.totalShooters} atirador(es)`,
      category: 'ACERVO_MUNICOES',
      isOfficial: true,
      legalRefs: ['Decreto 11.615/2023'],
      orientation: 'landscape',
    },
    club,
  );

  addSectionTitle(
    ctx,
    'Relação dos Atiradores e dos Atletas que Frequentaram Entidades de Tiro Desportivo - OM :',
  );

  if (payload.totalShooters === 0) {
    addCalloutBox(
      ctx,
      `Nenhum atirador frequentou o clube entre ${fmtDate(payload.from)} e ${fmtDate(payload.to)}.`,
    );
    return finalizeReport(ctx);
  }

  // Ordem alfabetica, como numa relacao nominal.
  const shooters = [...payload.shooters].sort((a, b) =>
    a.member.fullName.localeCompare(b.member.fullName, 'pt-BR'),
  );

  addAutoTable(
    ctx,
    [[
      'Nome da entidade/clube de tiro',
      'CR entidade/clube de tiro',
      'Nome Completo do atirador/atleta',
      'CPF atirador/atleta',
      'CR atirador/atleta',
      'Quant. Tiros',
      'Datas em que frequentou a entidade',
    ]],
    shooters.map((s) => [
      club.name,
      club.crPj ?? '—',
      s.member.fullName,
      fmtCpf(s.member.cpf),
      s.member.cr ?? '—',
      String(s.totalShots),
      (s.dates ?? []).map((d) => fmtDate(d)).join('; '),
    ]),
    {
      // `styles`/`headStyles` substituem o padrao do addAutoTable por inteiro,
      // entao repetem cores/bordas da identidade dos relatorios.
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 1.8,
        textColor: TEXT_DARK,
        lineColor: [220, 220, 220],
        lineWidth: 0.15,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [40, 40, 40],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 30 },
        2: { cellWidth: 52 },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 26, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' },
        6: { cellWidth: 'auto' },
      },
    },
  );

  addCalloutBox(
    ctx,
    `Total: ${payload.totalShooters} atirador(es) — ${payload.totalShots} tiro(s) registrado(s) no período.`,
  );

  // Bloco de assinatura do responsavel legal: reserva o lugar da rubrica
  // onde o selo ICP-Brasil e carimbado (mesmo padrao do Livro de Habitualidade).
  ctx.cursorY += 6;
  addSignatureBlock(ctx, {
    closingNote: `A presente relação consigna ${payload.totalShooters} atirador(es)/atleta(s) que frequentaram o clube entre ${fmtDate(payload.from)} e ${fmtDate(payload.to)}.`,
  });

  return finalizeReport(ctx);
}
