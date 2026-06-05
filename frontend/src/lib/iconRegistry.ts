// Curadoria de mini-ícones para a realidade de um clube de tiro brasileiro.
// Base: Game Icons (CC BY 3.0) via react-icons/gi — apenas itens do dia-a-dia
// real do clube (CACs, IPSC, defesa, manutenção, vendas), sem ícones militares
// pesados (canhão, lança-mísseis), fantasiosos (munição prateada, caveiras,
// pistola decorada, barra de ouro), policiais específicos (algemas, soco-inglês)
// ou de outras modalidades (arco e flecha).
// Pesquisa: catálogos CBC/Magtech, Decreto 11.615/2023, IPSC Brasil, CBTE.

import {
  // ── ARMAS ──
  GiPistolGun, GiRevolver, GiRifle, GiShotgun, GiGlock,
  GiGunStock, GiGunshot, GiCrossedPistols, GiMachineGunMagazine,

  // ── MUNIÇÃO ──
  GiBullets, GiBulletImpacts, GiShotgunRounds, GiAmmoBox, GiBulletBill,

  // ── ALVO / MIRA ──
  GiCrosshair, GiCrosshairArrow, GiBullseye,
  GiTargetShot, GiTargetPrize, GiTargetPoster, GiTargetLaser, GiTargetDummy,

  // ── SEGURANÇA ──
  GiShield, GiShieldImpact,
  GiHelmet, GiHelmetHeadShot, GiBoots,
  GiEyeShield, GiHeadphones, GiEarbuds,
  GiFireExtinguisher, GiFirstAidKit, GiMedicalPack, GiPlateClaw,

  // ── FERRAMENTAS ──
  GiToolbox, GiGearHammer, GiGears, GiHandSaw,
  GiBelt, GiBeltArmor, GiSpray, GiMagnifyingGlass, GiHandTruck,

  // ── CURSOS ──
  GiGraduateCap, GiBookCover,

  // ── PRÊMIOS ──
  GiTrophy, GiTrophyCup,
  GiLaurelCrown, GiLaurels, GiLaurelsTrophy,
  GiMedal, GiMedallist, GiStarMedal,
  GiRibbon, GiRibbonMedal,

  // ── VENDAS ──
  GiCash, GiCoins, GiCoinsPile,
} from 'react-icons/gi';
import type { IconType } from 'react-icons/lib';

// ─────────────────────────────────────────────────────────────────────

export type IconKey = string;

export interface IconEntry {
  key: IconKey;
  Icon: IconType;
  label: string;
  group: IconGroup;
}

export type IconGroup =
  | 'firearm'
  | 'ammo'
  | 'target'
  | 'safety'
  | 'tool'
  | 'course'
  | 'award'
  | 'money';

export const ICON_GROUPS: { key: IconGroup; label: string }[] = [
  { key: 'firearm', label: 'Armas' },
  { key: 'ammo', label: 'Munição' },
  { key: 'target', label: 'Alvos' },
  { key: 'safety', label: 'Segurança' },
  { key: 'tool', label: 'Ferramentas' },
  { key: 'course', label: 'Cursos' },
  { key: 'award', label: 'Prêmios' },
  { key: 'money', label: 'Vendas' },
];

export const ICON_REGISTRY: IconEntry[] = [
  // ── ARMAS (9) ───────────────────────────────────
  { key: 'GiPistolGun',           Icon: GiPistolGun,           label: 'Pistola',                group: 'firearm' },
  { key: 'GiGlock',               Icon: GiGlock,               label: 'Glock',                  group: 'firearm' },
  { key: 'GiRevolver',            Icon: GiRevolver,            label: 'Revólver',               group: 'firearm' },
  { key: 'GiRifle',               Icon: GiRifle,               label: 'Rifle / Carabina',       group: 'firearm' },
  { key: 'GiShotgun',             Icon: GiShotgun,             label: 'Espingarda',             group: 'firearm' },
  { key: 'GiGunStock',            Icon: GiGunStock,            label: 'Coronha',                group: 'firearm' },
  { key: 'GiMachineGunMagazine',  Icon: GiMachineGunMagazine,  label: 'Carregador',             group: 'firearm' },
  { key: 'GiGunshot',             Icon: GiGunshot,             label: 'Disparo',                group: 'firearm' },
  { key: 'GiCrossedPistols',      Icon: GiCrossedPistols,      label: 'Pistolas cruzadas',      group: 'firearm' },

  // ── MUNIÇÃO (5) ─────────────────────────────────
  { key: 'GiBullets',             Icon: GiBullets,             label: 'Munição',                group: 'ammo' },
  { key: 'GiAmmoBox',             Icon: GiAmmoBox,             label: 'Caixa de munição',       group: 'ammo' },
  { key: 'GiBulletImpacts',       Icon: GiBulletImpacts,       label: 'Impactos',               group: 'ammo' },
  { key: 'GiShotgunRounds',       Icon: GiShotgunRounds,       label: 'Cartuchos calibre 12',   group: 'ammo' },
  { key: 'GiBulletBill',          Icon: GiBulletBill,          label: 'Projétil',               group: 'ammo' },

  // ── ALVO / MIRA (8) ─────────────────────────────
  { key: 'GiBullseye',            Icon: GiBullseye,            label: 'Alvo (bullseye)',        group: 'target' },
  { key: 'GiCrosshair',           Icon: GiCrosshair,           label: 'Mira',                   group: 'target' },
  { key: 'GiCrosshairArrow',      Icon: GiCrosshairArrow,      label: 'Mira pontual',           group: 'target' },
  { key: 'GiTargetShot',          Icon: GiTargetShot,          label: 'Alvo atingido',          group: 'target' },
  { key: 'GiTargetPrize',         Icon: GiTargetPrize,         label: 'Alvo de competição',     group: 'target' },
  { key: 'GiTargetPoster',        Icon: GiTargetPoster,        label: 'Alvo de papel',          group: 'target' },
  { key: 'GiTargetLaser',         Icon: GiTargetLaser,         label: 'Alvo laser',             group: 'target' },
  { key: 'GiTargetDummy',         Icon: GiTargetDummy,         label: 'Alvo silhueta',          group: 'target' },

  // ── SEGURANÇA (12) ──────────────────────────────
  { key: 'GiShield',              Icon: GiShield,              label: 'Escudo',                 group: 'safety' },
  { key: 'GiShieldImpact',        Icon: GiShieldImpact,        label: 'Escudo balístico',       group: 'safety' },
  { key: 'GiHelmet',              Icon: GiHelmet,              label: 'Capacete',               group: 'safety' },
  { key: 'GiHelmetHeadShot',      Icon: GiHelmetHeadShot,      label: 'Capacete tático',        group: 'safety' },
  { key: 'GiBoots',               Icon: GiBoots,               label: 'Botas táticas',          group: 'safety' },
  { key: 'GiEyeShield',           Icon: GiEyeShield,           label: 'Proteção ocular',        group: 'safety' },
  { key: 'GiHeadphones',          Icon: GiHeadphones,          label: 'Abafador',               group: 'safety' },
  { key: 'GiEarbuds',             Icon: GiEarbuds,             label: 'Plug auricular',         group: 'safety' },
  { key: 'GiFireExtinguisher',    Icon: GiFireExtinguisher,    label: 'Extintor',               group: 'safety' },
  { key: 'GiFirstAidKit',         Icon: GiFirstAidKit,         label: 'Primeiros socorros',     group: 'safety' },
  { key: 'GiMedicalPack',         Icon: GiMedicalPack,         label: 'Kit médico',             group: 'safety' },
  { key: 'GiPlateClaw',           Icon: GiPlateClaw,           label: 'Placa balística',        group: 'safety' },

  // ── FERRAMENTAS (9) ─────────────────────────────
  { key: 'GiToolbox',             Icon: GiToolbox,             label: 'Caixa de ferramentas',   group: 'tool' },
  { key: 'GiGearHammer',          Icon: GiGearHammer,          label: 'Manutenção',             group: 'tool' },
  { key: 'GiGears',               Icon: GiGears,               label: 'Engrenagens',            group: 'tool' },
  { key: 'GiHandSaw',             Icon: GiHandSaw,             label: 'Serrote',                group: 'tool' },
  { key: 'GiBelt',                Icon: GiBelt,                label: 'Cinto',                  group: 'tool' },
  { key: 'GiBeltArmor',           Icon: GiBeltArmor,           label: 'Cinto tático',           group: 'tool' },
  { key: 'GiSpray',               Icon: GiSpray,               label: 'Spray (limpeza)',        group: 'tool' },
  { key: 'GiMagnifyingGlass',     Icon: GiMagnifyingGlass,     label: 'Lupa / inspeção',        group: 'tool' },
  { key: 'GiHandTruck',           Icon: GiHandTruck,           label: 'Carrinho',               group: 'tool' },

  // ── CURSOS (2) ──────────────────────────────────
  { key: 'GiGraduateCap',         Icon: GiGraduateCap,         label: 'Formatura',              group: 'course' },
  { key: 'GiBookCover',           Icon: GiBookCover,           label: 'Manual / apostila',      group: 'course' },

  // ── PRÊMIOS (10) ────────────────────────────────
  { key: 'GiTrophy',              Icon: GiTrophy,              label: 'Troféu',                 group: 'award' },
  { key: 'GiTrophyCup',           Icon: GiTrophyCup,           label: 'Taça',                   group: 'award' },
  { key: 'GiLaurelCrown',         Icon: GiLaurelCrown,         label: 'Coroa de louros',        group: 'award' },
  { key: 'GiLaurels',             Icon: GiLaurels,             label: 'Louros',                 group: 'award' },
  { key: 'GiLaurelsTrophy',       Icon: GiLaurelsTrophy,       label: 'Louros + troféu',        group: 'award' },
  { key: 'GiMedal',               Icon: GiMedal,               label: 'Medalha',                group: 'award' },
  { key: 'GiMedallist',           Icon: GiMedallist,           label: 'Medalhista',             group: 'award' },
  { key: 'GiStarMedal',           Icon: GiStarMedal,           label: 'Medalha estrela',        group: 'award' },
  { key: 'GiRibbon',              Icon: GiRibbon,              label: 'Fita',                   group: 'award' },
  { key: 'GiRibbonMedal',         Icon: GiRibbonMedal,         label: 'Fita medalha',           group: 'award' },

  // ── VENDAS (3) ──────────────────────────────────
  { key: 'GiCash',                Icon: GiCash,                label: 'Dinheiro',               group: 'money' },
  { key: 'GiCoins',               Icon: GiCoins,               label: 'Moedas',                 group: 'money' },
  { key: 'GiCoinsPile',           Icon: GiCoinsPile,           label: 'Pilha de moedas',        group: 'money' },
];

// ── Lookup helpers ─────────────────────────────────────────────────────────

const REGISTRY_MAP: Record<string, IconEntry> = ICON_REGISTRY.reduce(
  (acc, entry) => {
    acc[entry.key] = entry;
    return acc;
  },
  {} as Record<string, IconEntry>,
);

export function getIconEntry(key: string | null | undefined): IconEntry | null {
  if (!key) return null;
  return REGISTRY_MAP[key] ?? null;
}

export function searchIcons(query: string): IconEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return ICON_REGISTRY;
  return ICON_REGISTRY.filter(
    (e) => e.label.toLowerCase().includes(q) || e.key.toLowerCase().includes(q),
  );
}
