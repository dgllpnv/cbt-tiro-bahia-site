// DGA2 — Declaracao de Endereco de Guarda do Acervo (segundo endereco)
//
// Modelo deixa explicito que e um SEGUNDO endereco; quando o associado
// nao tem segundo endereco cadastrado, o PDF mostra os campos vazios
// para preenchimento manual (igual ao modelo recebido).
import {
  newDeclaration, declTitle, declParagraph, declCenterDate, declSignature,
  formatLongDate, memberIdentificationLine,
} from './_shared/declarationBase';
import type { DeclarationDataPacket } from '@/services/reportsService';

export function buildDGA2Pdf(packet: DeclarationDataPacket) {
  const { member, club } = packet;
  const ctx = newDeclaration();

  declTitle(ctx, 'DECLARAÇÃO DE ENDEREÇO DE GUARDA DO ACERVO');

  // Identificacao com segundo endereco em branco (preenchimento manual)
  const baseIdent = memberIdentificationLine({
    ...member,
    address: '',
    neighborhood: '',
    zipCode: '',
    city: '',
    state: '',
  });
  declParagraph(ctx, baseIdent.replace('residente à , ,', 'com segundo endereço à ___________________________________ - CEP: __________, ___________/___,'), { fontSize: 11 });

  declParagraph(
    ctx,
    `DECLARO junto ao SFPC do Exército Brasileiro e Polícia Federal, que este local de guarda do meu acervo de SEGUNDO ENDEREÇO de ${club.responsibleRole ?? 'ATIRADOR DESPORTIVO'}, também atende as condições de segurança previstas no Anexo A da Portaria Nº 166 - COLOG/C EX, de 22 de dezembro de 2023 e art. 13 da Lei nº 10.826, de 2003.`,
    { fontSize: 11 },
  );

  declParagraph(ctx, 'DECLARO ainda que este endereço é o mesmo da guarda do acervo.', {
    fontSize: 11,
  });

  declCenterDate(ctx, '__________', '__', formatLongDate());
  declSignature(ctx, member.fullName, member.cpf);

  return ctx.pdf;
}
