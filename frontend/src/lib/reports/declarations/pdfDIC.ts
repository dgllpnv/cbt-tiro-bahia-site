// DIC — Declaracao de Inexistencia de Inqueritos Policiais ou Processos Criminais
import {
  newDeclaration, declTitle, declParagraph, declCenterDate, declSignature,
  formatLongDate, formatShortDate, formatCpf, formatCep,
} from './_shared/declarationBase';
import type { DeclarationDataPacket } from '@/services/reportsService';

export function buildDICPdf(packet: DeclarationDataPacket) {
  const { member } = packet;
  const ctx = newDeclaration();

  declTitle(ctx, 'DECLARAÇÃO DE INEXISTÊNCIA DE INQUÉRITOS POLICIAIS OU PROCESSOS CRIMINAIS');

  const enderecoCompleto = [
    member.address ? `Rua ${member.address}` : null,
    member.neighborhood ? `Bairro ${member.neighborhood}` : null,
    [member.city, member.state].filter(Boolean).join('/'),
    member.zipCode ? `CEP ${formatCep(member.zipCode)}` : null,
  ]
    .filter(Boolean)
    .join(' – ');

  const text =
    `Eu, ${member.fullName}, ${member.nationality ?? 'BRASILEIRO(A)'}, ${member.profession ?? '—'}, ` +
    `natural de ${member.naturality ?? '—'}, nascido em ${formatShortDate(member.dateOfBirth)}, ` +
    `filho de ${member.fatherName ?? '—'} e ${member.motherName ?? '—'}, ` +
    `residente e domiciliado a ${enderecoCompleto || '—'}, ` +
    `portador da cédula de identidade nº ${member.rg ?? '—'}, expedida pela ${member.rgIssuer ?? '—'} e ` +
    `inscrito no Cadastro de Pessoa Física sob nº ${formatCpf(member.cpf)}, DECLARO, sob as penas da lei, ` +
    `que não respondo a inquéritos policiais nem a processos criminais tanto no estado de domicilio quanto nos demais ` +
    `entes federativos, e estou ciente de que, em caso de falsidade ideológica, ficarei sujeito às sanções prescritas ` +
    `no Código Penal e às demais cominações legais aplicáveis tanto no estado de domicilio quanto nos outros entes ` +
    `federativos.`;

  declParagraph(ctx, text, { fontSize: 11 });

  ctx.cursorY += 3;
  declParagraph(
    ctx,
    `"Art. 299 - Omitir, em documento público ou particular, declaração que nele deveria constar, ou nele ` +
      `inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, ` +
      `criar obrigação ou alterar a verdade sobre o fato juridicamente relevante.`,
    { fontSize: 10, indent: false },
  );
  declParagraph(
    ctx,
    `Pena - reclusão de 1 (um) a 5 (cinco) anos e multa, se o documento é público e reclusão de 1 (um) a 3 (três) ` +
      `anos, se o documento é particular."`,
    { fontSize: 10, indent: false },
  );

  declCenterDate(ctx, member.city ?? '—', member.state ?? '—', formatLongDate());
  declSignature(ctx, member.fullName, member.cpf);

  return ctx.pdf;
}
