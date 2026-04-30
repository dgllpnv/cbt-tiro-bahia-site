// Catalogo espelho do frontend (sem icones).
// Mantenha sincronizado com frontend/src/lib/firearmsCatalog.ts.

export type FirearmCategory = 'PISTOL' | 'REVOLVER' | 'RIFLE' | 'SHOTGUN';

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
  // Revolveres
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

export function getFirearmsInCategory(category: FirearmCategory): string[] {
  return POPULAR_FIREARMS.filter((f) => f.category === category).map((f) => f.name);
}
