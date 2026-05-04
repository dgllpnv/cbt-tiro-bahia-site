// DGA — Declaracao de Endereco de Guarda do Acervo (primeiro endereco)
import {
  newDeclaration, declTitle, declParagraph, declCenterDate, declSignature,
  formatLongDate, memberIdentificationLine,
} from './_shared/declarationBase';
import type { DeclarationDataPacket } from '@/services/reportsService';

export function buildDGAPdf(packet: DeclarationDataPacket) {
  const { member, club } = packet;
  const ctx = newDeclaration();

  declTitle(ctx, 'DECLARAÇÃO DE ENDEREÇO DE GUARDA DO ACERVO');

  const ident = memberIdentificationLine(member);
  declParagraph(ctx, ident, { fontSize: 11 });

  declParagraph(
    ctx,
    `DECLARO junto ao SFPC do Exército Brasileiro e Polícia Federal, que o local de guarda do meu acervo de ${club.responsibleRole ?? 'ATIRADOR DESPORTIVO'}, atende as condições de segurança previstas no Anexo A da Portaria Nº 166 - COLOG/C EX, de 22 de dezembro de 2023 e art. 13 da Lei nº 10.826, de 2003.`,
    { fontSize: 11 },
  );

  declParagraph(ctx, 'DECLARO ainda que este endereço é o mesmo da guarda do acervo.', {
    fontSize: 11,
  });

  declCenterDate(ctx, member.city ?? '—', member.state ?? '—', formatLongDate());
  declSignature(ctx, member.fullName, member.cpf);

  return ctx.pdf;
}
