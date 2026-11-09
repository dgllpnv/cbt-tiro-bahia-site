// Texto da celula "Arma" dos relatorios de habitualidade, com a propriedade
// (Propria/Terceiro). ownership null = comportamento antigo (sem rotulo).
export type FirearmOwnership = 'OWN' | 'THIRD_PARTY';

export interface FirearmLike {
  firearmName?: string | null;
  firearmOwnership?: FirearmOwnership | null;
  firearmSerial?: string | null;
  firearmRegistrationId?: string | null;
}

const OWNERSHIP_LABEL: Record<FirearmOwnership, string> = {
  OWN: 'Própria',
  THIRD_PARTY: 'Terceiro',
};

export function firearmCellText(f: FirearmLike | null | undefined): string {
  const name = f?.firearmName;
  if (!name) return '—';
  const own = f?.firearmOwnership;
  const label = own ? ` (${OWNERSHIP_LABEL[own]})` : '';
  let text = `${name}${label}`;
  if (own === 'OWN') {
    const ids = [
      f?.firearmSerial ? `Série ${f.firearmSerial}` : null,
      f?.firearmRegistrationId ? `Reg. ${f.firearmRegistrationId}` : null,
    ].filter(Boolean);
    if (ids.length) text += `\n${ids.join(' · ')}`;
  }
  return text;
}

// Varias linhas (mesmo calibre) -> uma celula, uma entrada por linha.
export function firearmCellTextMany(list: FirearmLike[]): string {
  return list.map(firearmCellText).join('\n');
}
