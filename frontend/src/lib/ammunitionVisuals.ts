import { GiBullets, type IconType } from 'react-icons/gi';

export const CALIBER_COLORS: Record<string, string> = {
  '9mm': '#dc2626',
  '.380 ACP': '#ea580c',
  '.40 S&W': '#d97706',
  '.45 ACP': '#ca8a04',
  '.357 Mag': '#16a34a',
  '.38 SPL': '#0891b2',
  '.22 LR': '#3b82f6',
  '.223 Rem': '#7c3aed',
  '.308 Win': '#a855f7',
  '12 GA': '#be123c',
};

export function getCaliberColor(caliber: string | null | undefined): string {
  if (!caliber) return '#6b7280';
  return CALIBER_COLORS[caliber] ?? '#6b7280';
}

export const AmmunitionIcon: IconType = GiBullets;
