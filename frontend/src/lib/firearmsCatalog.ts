import {
  GiPistolGun,
  GiRevolver,
  GiRifle,
  GiShotgun,
} from 'react-icons/gi';
import type { IconType } from 'react-icons/lib';

export type FirearmCategory = 'PISTOL' | 'REVOLVER' | 'RIFLE' | 'SHOTGUN';

export interface FirearmCategoryVisual {
  label: string;
  icon: IconType;
  color: string;
  bg: string;
  border: string;
  text: string;
}

export const FIREARM_CATEGORIES: Record<FirearmCategory, FirearmCategoryVisual> = {
  PISTOL: {
    label: 'Pistola',
    icon: GiPistolGun,
    color: '#f59e0b',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
  },
  REVOLVER: {
    label: 'Revólver',
    icon: GiRevolver,
    color: '#94a3b8',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/40',
    text: 'text-slate-300',
  },
  RIFLE: {
    label: 'Carabina/Rifle',
    icon: GiRifle,
    color: '#22c55e',
    bg: 'bg-green-500/10',
    border: 'border-green-500/40',
    text: 'text-green-300',
  },
  SHOTGUN: {
    label: 'Espingarda',
    icon: GiShotgun,
    color: '#ef4444',
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    text: 'text-red-300',
  },
};

export interface FirearmEntry {
  name: string;
  category: FirearmCategory;
  defaultCaliber: string;
}

export const POPULAR_FIREARMS: FirearmEntry[] = [
  // Pistolas
  { name: 'Taurus G2c', category: 'PISTOL', defaultCaliber: '9mm' },
  { name: 'Taurus G3c', category: 'PISTOL', defaultCaliber: '9mm' },
  { name: 'Taurus TH9', category: 'PISTOL', defaultCaliber: '9mm' },
  { name: 'Taurus PT 92', category: 'PISTOL', defaultCaliber: '9mm' },
  { name: 'Taurus PT 100', category: 'PISTOL', defaultCaliber: '.40 S&W' },
  { name: 'IMBEL MD1', category: 'PISTOL', defaultCaliber: '.40 S&W' },
  { name: 'Glock 17', category: 'PISTOL', defaultCaliber: '9mm' },
  { name: 'Glock 19', category: 'PISTOL', defaultCaliber: '9mm' },
  { name: 'CZ Shadow 2', category: 'PISTOL', defaultCaliber: '9mm' },
  { name: 'Sig Sauer P320', category: 'PISTOL', defaultCaliber: '9mm' },
  { name: 'Taurus 1911', category: 'PISTOL', defaultCaliber: '.45 ACP' },
  // Revólveres
  { name: 'Taurus RT 85', category: 'REVOLVER', defaultCaliber: '.38 SPL' },
  { name: 'Taurus 856', category: 'REVOLVER', defaultCaliber: '.38 SPL' },
  { name: 'Taurus RT 82', category: 'REVOLVER', defaultCaliber: '.38 SPL' },
  { name: 'Taurus RT 605', category: 'REVOLVER', defaultCaliber: '.357 Mag' },
  { name: 'Taurus Tracker 627', category: 'REVOLVER', defaultCaliber: '.357 Mag' },
  { name: 'Taurus RT 838', category: 'REVOLVER', defaultCaliber: '.38 SPL' },
  { name: 'S&W 686', category: 'REVOLVER', defaultCaliber: '.357 Mag' },
  // Carabinas/Rifles
  { name: 'CBC 7022', category: 'RIFLE', defaultCaliber: '.22 LR' },
  { name: 'CBC 8122', category: 'RIFLE', defaultCaliber: '.22 LR' },
  { name: 'CBC 8022 Bolt', category: 'RIFLE', defaultCaliber: '.22 LR' },
  { name: 'Ruger 10/22', category: 'RIFLE', defaultCaliber: '.22 LR' },
  { name: 'IMBEL IA2', category: 'RIFLE', defaultCaliber: '.223 Rem' },
  { name: 'CZ 457', category: 'RIFLE', defaultCaliber: '.22 LR' },
  { name: 'Taurus CT9', category: 'RIFLE', defaultCaliber: '9mm' },
  { name: 'Remington 700', category: 'RIFLE', defaultCaliber: '.308 Win' },
  // Espingardas
  { name: 'CBC Pump 586', category: 'SHOTGUN', defaultCaliber: '12 GA' },
  { name: 'Boito Pump A-680', category: 'SHOTGUN', defaultCaliber: '12 GA' },
  { name: 'Mossberg 500', category: 'SHOTGUN', defaultCaliber: '12 GA' },
  { name: 'Beretta 686', category: 'SHOTGUN', defaultCaliber: '12 GA' },
];

export function getFirearmCategory(firearmName: string | null | undefined): FirearmCategory | null {
  if (!firearmName) return null;
  return POPULAR_FIREARMS.find((f) => f.name === firearmName)?.category ?? null;
}

export function getFirearmCategoryVisual(
  category: FirearmCategory | null | undefined,
): FirearmCategoryVisual | null {
  return category ? FIREARM_CATEGORIES[category] : null;
}

export function getFirearmEntry(name: string | null | undefined): FirearmEntry | null {
  if (!name) return null;
  return POPULAR_FIREARMS.find((f) => f.name === name) ?? null;
}

export function getFirearmsInCategory(category: FirearmCategory): FirearmEntry[] {
  return POPULAR_FIREARMS.filter((f) => f.category === category);
}
