import {
  startReport,
  finalizeReport,
  addAutoTable,
  addCalloutBox,
  addSectionTitle,
  fmtDate,
  fmtCpf,
  type ReportClubInfo,
} from './_shared/reportBase';
import type { ShootersAmmoReport } from '@/services/reportsService';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  ASSOCIATE: 'Associado',
  VISITOR: 'Visitante',
};

export async function buildShootersAmmoPdf(
  payload: ShootersAmmoReport,
  club: ReportClubInfo,
) {
  const ctx = await startReport(
    {
      title: 'ATIRADORES E MUNIÇÕES UTILIZADAS',
      subtitle: `Período: ${fmtDate(payload.from)} a ${fmtDate(payload.to)} — ${payload.totalShooters} atirador(es)`,
      category: 'ACERVO_MUNICOES',
      isOfficial: true,
      legalRefs: ['Decreto 11.615/2023', 'Portaria 166-COLOG/2023'],
    },
    club,
  );

  if (payload.totalShooters === 0) {
    addCalloutBox(
      ctx,
      `Nenhum atirador registrado entre ${fmtDate(payload.from)} e ${fmtDate(payload.to)}.`,
    );
  } else {
    addCalloutBox(
      ctx,
      `${payload.totalShooters} atirador(es) — Total de ${payload.totalShots} disparo(s) registrado(s).`,
    );

    addSectionTitle(ctx, 'Ranking por consumo de munição');
    addAutoTable(
      ctx,
      [['#', 'Atirador / CPF', 'Tipo', 'CR', 'Visitas', 'Total tiros', 'Calibres']],
      payload.shooters.map((s, idx) => [
        String(idx + 1),
        `${s.member.fullName}\n${fmtCpf(s.member.cpf)}`,
        ROLE_LABEL[s.member.role] ?? s.member.role,
        s.member.cr ?? '—',
        String(s.visits),
        String(s.totalShots),
        s.calibers.map((c) => `${c.caliber} (${c.shots})`).join(', '),
      ]),
      {
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          4: { halign: 'center', cellWidth: 16 },
          5: { halign: 'right', cellWidth: 18 },
        },
      },
    );
  }

  return finalizeReport(ctx);
}
