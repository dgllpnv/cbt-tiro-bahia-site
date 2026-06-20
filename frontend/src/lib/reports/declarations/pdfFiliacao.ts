// FILIACAO — Declaracao de Filiacao a Entidade de Tiro (Anexo B)
import {
  newDeclaration, declTitle, declParagraph, declCenterDate, declTwoSignatures, declTable,
  declHeaderLogo, declClubHeaderLines,
  formatLongDate, formatShortDate, formatCnpj, formatCep,
} from './_shared/declarationBase';
import type { DeclarationDataPacket } from '@/services/reportsService';

export async function buildFiliacaoPdf(packet: DeclarationDataPacket) {
  const { member, club } = packet;
  const ctx = newDeclaration();

  await declHeaderLogo(ctx, { width: 16 });
  declClubHeaderLines(ctx, {
    cnpj: club.cnpj,
    addressLine: club.addressLine,
    city: club.city,
    state: club.state,
    zipCode: club.zipCode,
    crPj: club.crPj,
    phone: club.phone,
    email: club.email,
  });

  declTitle(ctx, 'DECLARAÇÃO DE FILIAÇÃO A ENTIDADE DE TIRO', 'ANEXO B');
  declParagraph(ctx, '(Inciso XVII do art. 2º do Decreto nº 11.615/2023)', {
    fontSize: 10,
    align: 'center',
    indent: false,
  });

  // Bloco 1 — Dados da Entidade
  declParagraph(ctx, 'DADOS DA ENTIDADE DE TIRO DECLARANTE', {
    fontSize: 10,
    bold: true,
    align: 'center',
    indent: false,
  });
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
      ['Dados de Filiação', `Numero: ${member.memberNumber ?? '—'}`, 'Data:', formatShortDate(member.memberSince)],
    ],
    {
      styles: { fontSize: 9, cellPadding: 1.4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 42 },
        2: { fontStyle: 'bold', cellWidth: 28 },
      },
    },
  );

  // Bloco 2 — Dados do Requerente
  ctx.cursorY += 2;
  declParagraph(ctx, 'DADOS DO REQUERENTE', {
    fontSize: 10,
    bold: true,
    align: 'center',
    indent: false,
  });
  const enderecoMembro = [
    member.address,
    member.neighborhood,
    member.zipCode ? `CEP ${formatCep(member.zipCode)}` : null,
    [member.city, member.state].filter(Boolean).join('/'),
  ]
    .filter(Boolean)
    .join(', ');
  declTable(
    ctx,
    [],
    [
      ['Nome:', member.fullName, 'CPF:', member.cpf.replace(/\D/g, '')],
      ['Certificado de Registro', member.cr ?? '—', 'Data:', formatShortDate(member.crExpiry)],
      ['Endereço:', { content: enderecoMembro || '—', colSpan: 3 }],
    ],
    {
      styles: { fontSize: 9, cellPadding: 1.4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 42 },
        2: { fontStyle: 'bold', cellWidth: 28 },
      },
    },
  );

  // Texto principal
  ctx.cursorY += 3;
  declParagraph(
    ctx,
    `O ${club.name}, DECLARA, para fim de comprovação de filiação nos termos do contido no inciso XVII do ` +
      `Art. 2º do Decreto nº 11.615, de 21 de julho de 2023, e sob as penas da lei, que o(a) cidadão(ã), ` +
      `${member.fullName}, acima identificado, pertence aos quadros desta Entidade, com matricula ` +
      `${member.memberNumber ?? '—'} em ${formatShortDate(member.memberSince)} e conforme os dados de filiação ` +
      `acima descritos.`,
    { fontSize: 11 },
  );

  declParagraph(ctx, 'Esta declaração tem validade de 90 dias.', {
    fontSize: 11,
    indent: false,
  });

  declCenterDate(ctx, club.city ?? '—', club.state ?? '—', formatLongDate());

  declTwoSignatures(
    ctx,
    { name: member.fullName, cpf: member.cpf, role: 'REQUERENTE' },
    {
      name: club.responsibleName ?? '—',
      cpf: club.responsibleCpf ?? '',
      role: club.responsibleRole ?? 'PRESIDENTE',
    },
  );

  return ctx.pdf;
}
