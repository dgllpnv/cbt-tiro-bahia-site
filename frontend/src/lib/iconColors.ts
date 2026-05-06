// Paleta de cores para mini-ícones de produtos.
// Inclui as cores usadas para calibres de munição + extras úteis.
// Cores em #RRGGBB para serem aceitas pelo backend (regex validation).

export interface IconColorSwatch {
  hex: string;
  label: string;
  /** Origem (informativa, opcional para tooltips) */
  source?: string;
}

export const ICON_COLOR_PALETTE: IconColorSwatch[] = [
  // Linha 1 — Quentes (calibres pistola comum)
  { hex: '#dc2626', label: 'Vermelho',     source: '9mm Luger' },
  { hex: '#ea580c', label: 'Laranja',      source: '.380 ACP' },
  { hex: '#d97706', label: 'Âmbar',        source: '.40 S&W' },
  { hex: '#ca8a04', label: 'Mostarda',     source: '.45 ACP' },
  // Linha 2 — Verdes / ciano
  { hex: '#16a34a', label: 'Verde',        source: '.357 Magnum' },
  { hex: '#22c55e', label: 'Verde claro' },
  { hex: '#0891b2', label: 'Ciano',        source: '.38 SPL' },
  { hex: '#0ea5e9', label: 'Azul céu' },
  // Linha 3 — Azuis / violetas
  { hex: '#3b82f6', label: 'Azul',         source: '.22 LR' },
  { hex: '#2563eb', label: 'Azul escuro',  source: 'Alvos' },
  { hex: '#7c3aed', label: 'Violeta',      source: '.223 Rem' },
  { hex: '#a855f7', label: 'Roxo',         source: '.308 Win' },
  // Linha 4 — Rosas e neutros
  { hex: '#be123c', label: 'Carmim',       source: '12 GA' },
  { hex: '#ec4899', label: 'Rosa' },
  { hex: '#FF8C00', label: 'Laranja CBT',  source: 'Cor do clube' },
  { hex: '#6b7280', label: 'Cinza',        source: 'Padrão' },
];

export const COLORS_PER_ROW = 4;

export function isKnownColor(hex: string | null | undefined): boolean {
  if (!hex) return false;
  return ICON_COLOR_PALETTE.some((c) => c.hex.toLowerCase() === hex.toLowerCase());
}

export function getColorLabel(hex: string | null | undefined): string {
  if (!hex) return '';
  const swatch = ICON_COLOR_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return swatch?.label ?? hex;
}
