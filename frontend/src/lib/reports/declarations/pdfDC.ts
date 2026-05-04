// DC — Declaracao de Compromisso de Participacao em Treinamentos e Competicoes (Anexo C)
import {
  newDeclaration, declTitle, declParagraph, declCenterDate, declSignature, declTable,
  formatLongDate, formatShortDate, formatCpf, formatCnpj, formatCep,
} from './_shared/declarationBase';
import type { DeclarationDataPacket } from '@/services/reportsService';

export function buildDCPdf(packet: DeclarationDataPacket) {
  const { member, club } = packet;
  const ctx = newDeclaration();

  declTitle(ctx, 'ANEXO C', 'DECLARAÇÃO DE COMPROMISSO DE PARTICIPAÇÃO\nEM TREINAMENTOS E COMPETIÇÕES');

  declParagraph(ctx, '(art. 35 do Decreto nº 11.615/2023)', {
    fontSize: 10,
    align: 'center',
    indent: false,
  });
  declParagraph(ctx, 'Dados da Entidade de Tiro de Vinculação', {
    fontSize: 10,
    align: 'center',
    indent: false,
  });

  // Tabela com dados do clube
  declTable(
    ctx,
    [],
    [
      ['Nome:', club.name, 'CNPJ:', formatCnpj(club.cnpj)],
      ['Certificado de Registro', club.crPj ?? '—', 'Data:', formatShortDate(club.crPjIssueDate)],
      [
        'Endereço',
        {
          content: [
            club.addressLine,
            club.zipCode ? `CEP: ${formatCep(club.zipCode)}` : null,
            [club.city, club.state].filter(Boolean).join('/'),
          ]
            .filter(Boolean)
            .join(' - '),
          colSpan: 3,
        },
      ],
      ['Dados de Filiação:', `Numero: ${member.memberNumber ?? '—'}`, 'Data:', formatShortDate(member.memberSince)],
    ],
    {
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 42 },
        2: { fontStyle: 'bold', cellWidth: 28 },
      },
    },
  );

  // Texto principal
  ctx.cursorY += 3;
  const enderecoMembro = [
    member.address,
    member.neighborhood ? `bairro ${member.neighborhood}` : null,
    member.zipCode ? `CEP ${formatCep(member.zipCode)}` : null,
    [member.city, member.state].filter(Boolean).join('/'),
  ]
    .filter(Boolean)
    .join(', ');

  const text =
    `Eu, ${member.fullName}, residente a ${enderecoMembro || '—'}, ` +
    `CPF ${formatCpf(member.cpf)}, identidade ${member.rg ?? '—'}, ` +
    `filiado a Entidade de Tiro acima nomeada, ME COMPROMETO a comprovar, no mínimo, por arma representativa ` +
    `de cada um dos tipos de arma de que tratam o art. 11, caput, incisos I, II e III, e o art. 12, caput, ` +
    `incisos III, IV e V, do Decreto nº 11.615/2023, em cumprimento ao previsto no art. 35 do Decreto nº ` +
    `11.615/2023, como requisitos de assiduidade em prática de tiro desportivo junto ao Exército Brasileiro ` +
    `e Polícia Federal.`;
  declParagraph(ctx, text, { fontSize: 11 });

  declCenterDate(ctx, member.city ?? '—', member.state ?? '—', formatLongDate());
  declSignature(ctx, member.fullName, member.cpf);

  return ctx.pdf;
}
