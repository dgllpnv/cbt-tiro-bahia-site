// DMP — Declaracao de Modalidade e Prova
import {
  newDeclaration, declTitle, declParagraph, declCenterDate, declSignature, declTable,
  declHeaderLogo, declClubHeaderLines,
  formatLongDate, formatShortDate,
} from './_shared/declarationBase';
import type { DeclarationDataPacket } from '@/services/reportsService';

const MODALIDADES = [
  {
    prova: 'Competição',
    modalidade: 'Saque Rápido, Silhueta Metálica, IPSC, NRA, Duelo 20 segundos e SHOTGUN',
    armas: [
      'Carabina: .22, 17 HMR, 22LR, 38, 40 SW, 44 MAG, 5,56x45 e 7,62, 308, 223;',
      'Espingarda: 12 Manual, 12 Semi-Automática, Astra 20 GA e Beretta 12 GA;',
      'Pistolas: 22 LR .38 Super, .38TPC, .38 Super Auto, .380, .380 ACP, .40, .40S&W, .45, .45 ACP, 10 mm Auto, 380 ACP (9mm curto), 38SA, 40, 40SW, 9mm, 9 mm Luger e 9mx21m;',
      'Revólveres: 22, 22 MAG, 22LR, .38, .38 SPL, 9MM e .45',
    ].join('\n'),
  },
];

export async function buildDMPPdf(packet: DeclarationDataPacket) {
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

  declTitle(ctx, 'DECLARAÇÃO DE MODALIDADE E PROVA');

  declParagraph(
    ctx,
    `O ${club.name}, inscrito no CNPJ/MF sob o nº ${club.cnpj ?? '—'} e Certificado de Registro nº CR ${club.crPj ?? '—'}, ` +
      `com sede em ${club.addressLine ?? '—'}${club.city ? ', ' + club.city : ''}${club.state ? '/' + club.state : ''}, ` +
      `DECLARA, mediante solicitação de ${member.fullName}, CR ${member.cr ?? '—'}, está regularmente inscrito ` +
      `nesta entidade sob o nº ${member.memberNumber ?? '—'}, datado de ${formatShortDate(member.memberSince)} e para fim de ` +
      `comprovação junto ao Exército Brasileiro e Polícia Federal, que promove, realiza ou sedia competições e ` +
      `provas de tiro desportivo, conforme quadro abaixo:`,
    { fontSize: 11 },
  );

  declTable(
    ctx,
    [['PROVA', 'MODALIDADE', 'ARMAMENTO']],
    MODALIDADES.map((m) => [m.prova, m.modalidade, m.armas]),
    {
      styles: { fontSize: 9.5, cellPadding: 2.2, valign: 'top' },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center', valign: 'middle', fontStyle: 'bold' },
        1: { cellWidth: 50 },
      },
    },
  );

  ctx.cursorY += 2;
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
