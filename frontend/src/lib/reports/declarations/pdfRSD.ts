// RSD — Declaracao de Comprovacao de Residencia
import {
  newDeclaration, declTitle, declParagraph, declCenterDate, declSignature,
  formatLongDate, formatCpf, formatCep, MARITAL_STATUS_LABEL,
} from './_shared/declarationBase';
import type { DeclarationDataPacket } from '@/services/reportsService';

export function buildRSDPdf(packet: DeclarationDataPacket) {
  const { member } = packet;
  const ctx = newDeclaration();

  declTitle(ctx, 'DECLARAÇÃO DE COMPROVAÇÃO RESIDENCIA');

  const enderecoCompleto = [
    member.address,
    member.neighborhood ? `bairro ${member.neighborhood}` : null,
    member.zipCode ? `CEP: ${formatCep(member.zipCode)}` : null,
    [member.city, member.state].filter(Boolean).join('/'),
  ]
    .filter(Boolean)
    .join(', ');

  const maritalLabel = member.maritalStatus
    ? MARITAL_STATUS_LABEL[member.maritalStatus] ?? member.maritalStatus
    : '—';

  // Paragrafo de identificacao + objeto da declaracao
  const intro =
    `Eu, ${member.fullName}, portador do RG nº ${member.rg ?? '—'}/${member.rgIssuer ?? '—'} e ` +
    `do CPF nº ${formatCpf(member.cpf)}, ${maritalLabel}, residente à ${enderecoCompleto || '—'}, ` +
    `visando a CONCESSÃO/REVALIDAÇÃO de certificado de registro ou AQUISIÇÃO DE PCE através do Exército ` +
    `Brasileiro, DECLARO sob as penas de lei, (art. 2º da lei 7.115/83), que tive residência e domicílio, ` +
    `nos últimos cinco anos, no(s) endereço(s) abaixo mencionado(s):`;
  declParagraph(ctx, intro, { fontSize: 11 });

  // Endereco enumerado
  declParagraph(
    ctx,
    `1 - ${enderecoCompleto || '—'} - CONFORME COMPROVANTES ANEXOS.`,
    { fontSize: 11, indent: false },
  );

  // Texto legal (art. 299 do CP)
  declParagraph(
    ctx,
    `Por ser verdade firmo a presente declaração para que se produza os efeitos legais, ciente de que a ` +
      `falsidade de seu conteúdo pode implicar na imputação de sanções civis, administrativas bem como na ` +
      `sanção penal prevista no art. 299 do Código Penal. Conforme transcrição abaixo:`,
    { fontSize: 11 },
  );

  ctx.cursorY += 1;
  declParagraph(ctx, '" art. 299', { fontSize: 10, indent: false });
  declParagraph(
    ctx,
    `Omitir, em documento público ou particular, declaração que nele deveria constar, ou nele inserir ou ` +
      `fazer inserir declaração falsa ou diversa do que devia ser escrita, com fim de prejudicar direito, ` +
      `criar obrigação ou alterar a verdade sobre o fato juridicamente relevante.`,
    { fontSize: 10, indent: false },
  );
  declParagraph(
    ctx,
    `Pena : reclusão de 1(um) ano a 5(cinco) anos e multa, se o documento é público, e reclusão de 1(um) ` +
      `ano a 3(três) anos, se o documento é particular."`,
    { fontSize: 10, indent: false },
  );

  declCenterDate(ctx, member.city ?? '—', member.state ?? '—', formatLongDate());
  declSignature(ctx, member.fullName, member.cpf);

  return ctx.pdf;
}
