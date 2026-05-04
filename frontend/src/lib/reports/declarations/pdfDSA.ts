// DSA — Declaracao de Seguranca do Acervo (Anexo A) — primeiro endereco
import {
  newDeclaration, declTitle, declParagraph, declCenterDate, declSignature,
  formatLongDate, formatShortDate, formatCpf, formatCep, MARITAL_STATUS_LABEL,
} from './_shared/declarationBase';
import type { DeclarationDataPacket } from '@/services/reportsService';

export function buildDSAPdf(packet: DeclarationDataPacket) {
  const { member } = packet;
  const ctx = newDeclaration();

  declTitle(ctx, 'ANEXO A', 'DECLARAÇÃO DE SEGURANÇA DO ACERVO (DSA)');

  const enderecoCompleto = [
    member.address,
    member.neighborhood ? `bairro ${member.neighborhood}` : null,
    member.zipCode ? `cep: ${formatCep(member.zipCode)}` : null,
    [member.city, member.state].filter(Boolean).join('/'),
  ]
    .filter(Boolean)
    .join(', ');

  const maritalLabel = member.maritalStatus
    ? MARITAL_STATUS_LABEL[member.maritalStatus] ?? member.maritalStatus
    : '—';

  const text =
    `EU, ${member.fullName}, nacionalidade ${member.nationality ?? 'BRASILEIRA'}, ` +
    `natural de ${member.naturality ?? '—'}, nascido em ${formatShortDate(member.dateOfBirth)}, ` +
    `profissão ${member.profession ?? '—'}, estado civil ${maritalLabel}, ` +
    `residindo em ${enderecoCompleto || '—'} e CPF nº ${formatCpf(member.cpf)}. ` +
    `DECLARO, para fim de ATIRADOR DESPORTIVO, que o local de guarda do meu acervo possui cofre ou lugar seguro, ` +
    `com tranca, para armazenamento das armas de fogo desmuniciadas de que sou proprietário, e de que adotarei as ` +
    `medidas necessárias para impedir que menor de dezoito anos de idade ou pessoa civilmente incapaz se apodere ` +
    `de arma de fogo sob minha posse ou de minha propriedade, observado o disposto no art. 13 da Lei nº 10.826, de 2003.`;

  declParagraph(ctx, text, { fontSize: 11 });

  ctx.cursorY += 4;
  declParagraph(ctx, 'SEGUNDO ENDEREÇO: NÃO CONSTA', {
    fontSize: 10,
    bold: true,
    align: 'left',
    indent: false,
  });

  declCenterDate(ctx, member.city ?? '—', member.state ?? '—', formatLongDate());
  declSignature(ctx, member.fullName, member.cpf);

  return ctx.pdf;
}
