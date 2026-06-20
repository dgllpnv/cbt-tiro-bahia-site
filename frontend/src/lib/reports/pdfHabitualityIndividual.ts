// =====================================================
// pdfHabitualityIndividual.ts
// Refator de pdfHabituality.ts usando reportBase compartilhado.
// Header em TODAS as paginas (melhoria), QR de validacao opcional,
// citacao Portarias 166/2023 + 260/2025 + Decreto 11.615/2023.
// =====================================================

import {
  startReport,
  finalizeReport,
  addAutoTable,
  addCalloutBox,
  addParagraph,
  addSectionTitle,
  addKeyValueGrid,
  addSignatureBlock,
  ensureSpace,
  fmtDate,
  fmtCpf,
  TEXT_DARK,
  TEXT_MUTED,
  MARGIN_X,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { HabitualityDeclarationPacket } from '@/services/documentsService';
import { ammunitionTypeLabels } from '@/lib/constants';

export async function buildHabitualityIndividualPdf(
  packet: HabitualityDeclarationPacket,
) {
  const club: ReportClubInfo = {
    name: packet.club.name,
    cnpj: packet.club.cnpj,
    crPj: packet.club.crPj,
    addressLine: packet.club.addressLine,
    city: packet.club.city,
    state: packet.club.state,
    zipCode: packet.club.zipCode,
    phone: packet.club.phone,
    email: packet.club.email,
    responsibleName: packet.club.responsibleName,
    responsibleCpf: packet.club.responsibleCpf,
    responsibleRole: packet.club.responsibleRole,
  };

  const ctx = await startReport(
    {
      title: 'DECLARAÇÃO DE HABITUALIDADE',
      subtitle: `Período: ${fmtDate(packet.period.startDate)} a ${fmtDate(packet.period.endDate)}`,
      category: 'HABITUALIDADE',
      isOfficial: true,
      legalRefs: [
        'Decreto 11.615/2023, art. 11',
        'Portaria 166-COLOG/C Ex/2023, Anexo E',
        'Portaria 260-COLOG/C Ex/2025',
      ],
    },
    club,
  );

  // Identificacao do atirador
  addSectionTitle(ctx, 'Identificação do atirador');
  const enderecoLinha = [
    packet.member.addressLine,
    [packet.member.city, packet.member.state].filter(Boolean).join('/'),
    packet.member.zipCode ? `CEP ${packet.member.zipCode}` : null,
  ]
    .filter(Boolean)
    .join(' — ') || '—';

  addKeyValueGrid(ctx, [
    ['Nome completo', packet.member.fullName],
    ['CPF', fmtCpf(packet.member.cpf)],
    ['Data de nascimento', fmtDate(packet.member.dateOfBirth)],
    ['Nº de matrícula', packet.member.memberNumber],
    ['CR (Certificado de Registro)', packet.member.cr ?? '—'],
    ['Nível CR', packet.member.crLevel ? `Nível ${packet.member.crLevel}` : '—'],
    ['Validade do CR', fmtDate(packet.member.crExpiry)],
    ['Filiado desde', fmtDate(packet.member.memberSince)],
    ['Endereço', enderecoLinha],
  ]);

  ctx.cursorY += 2;
  addCalloutBox(
    ctx,
    `Período de referência: ${fmtDate(packet.period.startDate)} a ${fmtDate(packet.period.endDate)}`,
  );

  // Atividades
  addSectionTitle(ctx, 'Atividades registradas');

  const tableBody = packet.activities.length
    ? packet.activities.map((a, idx) => [
        String(idx + 1),
        fmtDate(a.date),
        a.activityType === 'COMPETITION' ? 'Competição' : 'Treinamento',
        a.modality,
        a.caliber,
        a.firearmName ?? '—',
        a.shotsFired != null ? String(a.shotsFired) : '—',
        a.ammunitionType ? ammunitionTypeLabels[a.ammunitionType] : '—',
      ])
    : [['—', '—', '—', 'Nenhuma atividade registrada no período', '—', '—', '—', '—']];

  // Coluna "Tipo mun." adicionada apos "Municao" (Portaria 260-COLOG/2025
  // distingue municao recarregada vs original para fins de habitualidade).
  addAutoTable(
    ctx,
    [['#', 'Data', 'Tipo', 'Modalidade', 'Calibre', 'Arma', 'Munição', 'Tipo mun.']],
    tableBody,
    {
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 32 },
        4: { cellWidth: 18 },
        5: { cellWidth: 32 },
        6: { cellWidth: 15, halign: 'right' },
        7: { cellWidth: 22, halign: 'center' },
      },
    },
  );

  // Totais por calibre
  addSectionTitle(ctx, 'Totais por calibre');
  if (packet.totalsByCaliber.length === 0) {
    addParagraph(ctx, 'Sem registros agrupados.', { fontSize: 9 });
  } else {
    addAutoTable(
      ctx,
      [['Calibre', 'Eventos', 'Mínimo', 'Status']],
      packet.totalsByCaliber.map((t) => [
        t.caliber,
        String(t.count),
        String(t.required),
        t.compliant ? 'Atende' : 'Pendente',
      ]),
      {
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 30, halign: 'center' },
        },
      },
    );
  }

  ensureSpace(ctx, 12);
  addParagraph(
    ctx,
    `Total no período: ${packet.totals.total} atividade(s) — ${packet.totals.trainings} treino(s), ${packet.totals.competitions} competição(ões).`,
    { fontSize: 9.5 },
  );
  const tg = packet.crLevelTargets;
  addParagraph(
    ctx,
    `Mínimos exigidos para Nível ${tg.level}: ${tg.requiredTrainings} treino(s)` +
      (tg.requiredCompetitions > 0 ? ` + ${tg.requiredCompetitions} competição(ões).` : '.'),
    { fontSize: 8.5 },
  );

  // Texto declaratorio
  ctx.cursorY += 4;
  addSectionTitle(ctx, 'Declaração');
  const decText =
    `O ${packet.club.name}, inscrito no CNPJ sob o nº ${packet.club.cnpj ?? '—'} e portador do ` +
    `Certificado de Registro nº ${packet.club.crPj ?? '—'} expedido pelo Comando do Exército, com sede ` +
    `em ${packet.club.addressLine ?? '—'}${packet.club.city ? ', ' + packet.club.city : ''}` +
    `${packet.club.state ? '/' + packet.club.state : ''}, DECLARA, para os fins do art. 96 da Portaria ` +
    `nº 166-COLOG/C Ex de 22/12/2023, alterada pela Portaria nº 260-COLOG/C Ex de 09/06/2025, e em ` +
    `cumprimento ao disposto no Decreto nº 11.615/2023, que o(a) Sr.(a) ${packet.member.fullName}, ` +
    `CPF nº ${fmtCpf(packet.member.cpf)}, titular do CR nº ${packet.member.cr ?? '—'} ` +
    `(válido até ${fmtDate(packet.member.crExpiry)}), classificado(a) no Nível ` +
    `${packet.member.crLevel ?? '—'} de atirador desportivo, realizou no período de ` +
    `${fmtDate(packet.period.startDate)} a ${fmtDate(packet.period.endDate)} as atividades de ` +
    `treinamento e/ou competição relacionadas no quadro acima. As informações têm respaldo nos ` +
    `registros oficiais desta entidade, nos termos do Anexo E da Portaria nº 166-COLOG/C Ex/2023.`;
  addParagraph(ctx, decText, { fontSize: 10 });

  // Assinatura
  ctx.cursorY += 4;
  addSignatureBlock(ctx);

  return finalizeReport(ctx);
}

// =====================================================
// buildHabitualityIndividualMultiPdf
// Versao multi-ano: um unico PDF com UMA SECAO POR ANO. Preserva o
// "8 por calibre por ANO" (cada ano mantem seus proprios totais/Atende)
// e lida corretamente com anos nao contiguos (ex.: 2026 + 2025 + 2023).
// Recebe um pacote por ano (mesmo associado/clube); ordena do mais
// recente para o mais antigo.
// =====================================================

// Renderiza, dentro de uma secao "Ano XXXX" ja aberta, a tabela de
// atividades + totais por calibre + linha de totais do ano.
function addYearActivities(ctx: Awaited<ReturnType<typeof startReport>>, packet: HabitualityDeclarationPacket): void {
  const tableBody = packet.activities.length
    ? packet.activities.map((a, idx) => [
        String(idx + 1),
        fmtDate(a.date),
        a.activityType === 'COMPETITION' ? 'Competição' : 'Treinamento',
        a.modality,
        a.caliber,
        a.firearmName ?? '—',
        a.shotsFired != null ? String(a.shotsFired) : '—',
        a.ammunitionType ? ammunitionTypeLabels[a.ammunitionType] : '—',
      ])
    : [['—', '—', '—', 'Nenhuma atividade registrada no ano', '—', '—', '—', '—']];

  addAutoTable(
    ctx,
    [['#', 'Data', 'Tipo', 'Modalidade', 'Calibre', 'Arma', 'Munição', 'Tipo mun.']],
    tableBody,
    {
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 32 },
        4: { cellWidth: 18 },
        5: { cellWidth: 32 },
        6: { cellWidth: 15, halign: 'right' },
        7: { cellWidth: 22, halign: 'center' },
      },
    },
  );

  if (packet.totalsByCaliber.length > 0) {
    addAutoTable(
      ctx,
      [['Calibre', 'Eventos', 'Mínimo', 'Status']],
      packet.totalsByCaliber.map((t) => [
        t.caliber,
        String(t.count),
        String(t.required),
        t.compliant ? 'Atende' : 'Pendente',
      ]),
      {
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 30, halign: 'center' },
        },
      },
    );
  }

  addParagraph(
    ctx,
    `Total em ${packet.period.year}: ${packet.totals.total} atividade(s) — ${packet.totals.trainings} treino(s), ${packet.totals.competitions} competição(ões).`,
    { fontSize: 9 },
  );
}

export async function buildHabitualityIndividualMultiPdf(
  packets: HabitualityDeclarationPacket[],
) {
  // Do mais recente para o mais antigo.
  const sorted = [...packets].sort((a, b) => b.period.year - a.period.year);
  const first = sorted[0];
  const yearsLabel = sorted.map((p) => p.period.year).join(', ');

  const club: ReportClubInfo = {
    name: first.club.name,
    cnpj: first.club.cnpj,
    crPj: first.club.crPj,
    addressLine: first.club.addressLine,
    city: first.club.city,
    state: first.club.state,
    zipCode: first.club.zipCode,
    phone: first.club.phone,
    email: first.club.email,
    responsibleName: first.club.responsibleName,
    responsibleCpf: first.club.responsibleCpf,
    responsibleRole: first.club.responsibleRole,
  };

  const ctx = await startReport(
    {
      title: 'DECLARAÇÃO DE HABITUALIDADE',
      subtitle: `Anos: ${yearsLabel}`,
      category: 'HABITUALIDADE',
      isOfficial: true,
      legalRefs: [
        'Decreto 11.615/2023, art. 11',
        'Portaria 166-COLOG/C Ex/2023, Anexo E',
        'Portaria 260-COLOG/C Ex/2025',
      ],
    },
    club,
  );

  // Identificacao do atirador (mesmo associado em todos os anos)
  addSectionTitle(ctx, 'Identificação do atirador');
  const enderecoLinha = [
    first.member.addressLine,
    [first.member.city, first.member.state].filter(Boolean).join('/'),
    first.member.zipCode ? `CEP ${first.member.zipCode}` : null,
  ]
    .filter(Boolean)
    .join(' — ') || '—';

  addKeyValueGrid(ctx, [
    ['Nome completo', first.member.fullName],
    ['CPF', fmtCpf(first.member.cpf)],
    ['Data de nascimento', fmtDate(first.member.dateOfBirth)],
    ['Nº de matrícula', first.member.memberNumber],
    ['CR (Certificado de Registro)', first.member.cr ?? '—'],
    ['Nível CR', first.member.crLevel ? `Nível ${first.member.crLevel}` : '—'],
    ['Validade do CR', fmtDate(first.member.crExpiry)],
    ['Filiado desde', fmtDate(first.member.memberSince)],
    ['Endereço', enderecoLinha],
  ]);

  ctx.cursorY += 2;
  addCalloutBox(ctx, `Anos incluídos nesta declaração: ${yearsLabel}`);

  // Uma secao por ano
  for (const p of sorted) {
    addSectionTitle(ctx, `Ano ${p.period.year}`);
    addYearActivities(ctx, p);
    ctx.cursorY += 2;
  }

  // Texto declaratorio (cita os anos, nao um periodo continuo)
  const tg = first.crLevelTargets;
  addParagraph(
    ctx,
    `Mínimos exigidos para Nível ${tg.level}: ${tg.requiredTrainings} treino(s)` +
      (tg.requiredCompetitions > 0 ? ` + ${tg.requiredCompetitions} competição(ões) por ano.` : ' por ano.'),
    { fontSize: 8.5 },
  );

  ctx.cursorY += 4;
  addSectionTitle(ctx, 'Declaração');
  const decText =
    `O ${first.club.name}, inscrito no CNPJ sob o nº ${first.club.cnpj ?? '—'} e portador do ` +
    `Certificado de Registro nº ${first.club.crPj ?? '—'} expedido pelo Comando do Exército, com sede ` +
    `em ${first.club.addressLine ?? '—'}${first.club.city ? ', ' + first.club.city : ''}` +
    `${first.club.state ? '/' + first.club.state : ''}, DECLARA, para os fins do art. 96 da Portaria ` +
    `nº 166-COLOG/C Ex de 22/12/2023, alterada pela Portaria nº 260-COLOG/C Ex de 09/06/2025, e em ` +
    `cumprimento ao disposto no Decreto nº 11.615/2023, que o(a) Sr.(a) ${first.member.fullName}, ` +
    `CPF nº ${fmtCpf(first.member.cpf)}, titular do CR nº ${first.member.cr ?? '—'} ` +
    `(válido até ${fmtDate(first.member.crExpiry)}), classificado(a) no Nível ` +
    `${first.member.crLevel ?? '—'} de atirador desportivo, realizou nos anos de ${yearsLabel} as atividades de ` +
    `treinamento e/ou competição relacionadas nos quadros acima, ano a ano. As informações têm respaldo nos ` +
    `registros oficiais desta entidade, nos termos do Anexo E da Portaria nº 166-COLOG/C Ex/2023.`;
  addParagraph(ctx, decText, { fontSize: 10 });

  ctx.cursorY += 4;
  addSignatureBlock(ctx);

  return finalizeReport(ctx);
}
