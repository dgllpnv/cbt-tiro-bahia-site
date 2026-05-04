// DHI — Declaracao de Habitualidade Inicial
import {
  newDeclaration, declTitle, declParagraph, declCenterDate, declSignature,
  declHeaderLogo, declClubHeaderLines,
  formatLongDate, formatShortDate,
} from './_shared/declarationBase';
import type { DeclarationDataPacket } from '@/services/reportsService';

export async function buildDHIPdf(packet: DeclarationDataPacket) {
  const { member, club } = packet;
  const ctx = newDeclaration();

  await declHeaderLogo(ctx);
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

  declTitle(ctx, 'DECLARAÇÃO DE HABITUALIDADE INICIAL');

  declParagraph(
    ctx,
    `O ${club.name}, inscrito no CNPJ/MF sob o nº ${club.cnpj ?? '—'} e Certificado de Registro nº CR ${club.crPj ?? '—'}, ` +
      `com sede em ${club.addressLine ?? '—'}${club.city ? ', ' + club.city : ''}${club.state ? '/' + club.state : ''}, ` +
      `DECLARA, que ${member.fullName}, CPF: ${member.cpf.replace(/\D/g, '')}, RG: ${member.rg ?? '—'}, ` +
      `${member.rgIssuer ?? '—'}, CR: ${member.cr ?? '—'}, está regularmente FILIADO nesta Entidade sob o Nº ` +
      `${member.memberNumber ?? '—'}, datado de ${formatShortDate(member.memberSince)}, e que o mesmo está iniciando a ` +
      `prática de tiro na atividade Atirador Desportivo, portanto, ainda não possui as participações mínimas.`,
    { fontSize: 11 },
  );

  declParagraph(ctx, 'Esta declaração tem validade de 90 dias.', { fontSize: 11, indent: false });

  declCenterDate(ctx, club.city ?? '—', club.state ?? '—', formatLongDate());
  declSignature(
    ctx,
    club.responsibleName ?? '—',
    club.responsibleCpf ?? '',
    club.responsibleRole ?? 'PRESIDENTE',
  );

  return ctx.pdf;
}
