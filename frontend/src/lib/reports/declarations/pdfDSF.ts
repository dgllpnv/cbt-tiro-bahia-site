// DSF — Declaracao de Desfiliacao a Entidade de Tiro Desportivo
import {
  newDeclaration, declTitle, declParagraph, declCenterDate, declTwoSignatures,
  declHeaderLogo, declClubHeaderLines,
  formatLongDate, formatCpf,
} from './_shared/declarationBase';
import type { DeclarationDataPacket } from '@/services/reportsService';

export async function buildDSFPdf(packet: DeclarationDataPacket) {
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

  declTitle(ctx, 'DECLARAÇÃO DE DESFILIAÇÃO A ENTIDADE DE TIRO DESPORTIVO');

  declParagraph(
    ctx,
    `O ${club.name}, inscrito no CNPJ/MF sob o nº ${club.cnpj ?? '—'} e Certificado de Registro nº CR ${club.crPj ?? '—'}, ` +
      `com sede em ${club.addressLine ?? '—'}${club.city ? ', ' + club.city : ''}${club.state ? '/' + club.state : ''}, ` +
      `INFORMA, que o FILIADO ${member.fullName}, CR nº ${member.cr ?? '—'}, CPF nº: ${formatCpf(member.cpf)} e ` +
      `Identidade nº ${member.rg ?? '—'}, foi desligado do nosso quadro de Associados.`,
    { fontSize: 11 },
  );

  declParagraph(ctx, 'Esta declaração tem validade de 90 dias.', { fontSize: 11, indent: false });

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
