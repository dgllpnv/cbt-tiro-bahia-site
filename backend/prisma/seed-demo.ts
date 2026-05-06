// =====================================================
// CBT — DEMO SEED (idempotente)
// Popula o banco com dados realistas para apresentação:
//   • ~30 produtos de munição/acessórios brasileiros
//   • 20 sócios demo com tempo de casa variado
//   • visitas dos últimos 90 dias com frequência por perfil
//   • detalhes de tiros (calibre + arma do firearmsCatalog)
//
// Pesquisa baseada em: catálogos CBC/Magtech, Decreto 11.615/2023,
// CBTE, blogs Magnum/Tiro Defesa Brasil.
//
// Idempotente:
//   • produtos por SKU (upsert)
//   • sócios por email (upsert) — emails terminam em @demo.cbt.com.br
//   • visitas: pula sócios que já têm visitas demo (campo `notes` marcado "[demo]")
//
// Run: npx tsx prisma/seed-demo.ts
// =====================================================

import { PrismaClient, ProductCategory, StockMovementType, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { POPULAR_FIREARMS, getFirearmCategory, type FirearmCategory } from '../src/lib/firearmsCatalog.js';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const CLUB_ID = 'cbt-bahia';
const DEMO_TAG = '[demo]';

// =====================================================
// PRODUTOS — MUNIÇÃO E ACESSÓRIOS REAIS BR
// =====================================================

interface ProductSeed {
  name: string;
  sku: string;
  category: ProductCategory;
  caliber?: string;
  unitPrice: number;
  costPrice: number;
  unit: string;
  initialStock: number;
  minimumStock: number;
  location: string;
}

const PRODUCTS: ProductSeed[] = [
  // ── MUNIÇÃO 9mm Luger ─────────────────────────────────
  { name: 'CBC 9mm Luger ETOG+P1 124gr FMJ (50un)',  sku: 'AMMO-9MM-CBC-FMJ-50',     category: ProductCategory.AMMUNITION, caliber: '9mm',      unitPrice: 320, costPrice: 235, unit: 'cx', initialStock: 240, minimumStock: 60, location: 'Depósito Munição - A1' },
  { name: 'Magtech 9A 9mm FMJ 115gr (50un)',          sku: 'AMMO-9MM-MAG-FMJ-50',     category: ProductCategory.AMMUNITION, caliber: '9mm',      unitPrice: 305, costPrice: 220, unit: 'cx', initialStock: 180, minimumStock: 50, location: 'Depósito Munição - A1' },
  { name: 'CBC 9mm EXPO +P 124gr JHP Defesa (20un)',  sku: 'AMMO-9MM-CBC-JHP-20',     category: ProductCategory.AMMUNITION, caliber: '9mm',      unitPrice: 210, costPrice: 150, unit: 'cx', initialStock: 80,  minimumStock: 20, location: 'Depósito Munição - A1' },

  // ── MUNIÇÃO .380 ACP ─────────────────────────────────
  { name: 'CBC .380 Auto FMJ 95gr (50un)',            sku: 'AMMO-380-CBC-FMJ-50',     category: ProductCategory.AMMUNITION, caliber: '.380 ACP', unitPrice: 265, costPrice: 195, unit: 'cx', initialStock: 140, minimumStock: 40, location: 'Depósito Munição - A2' },
  { name: 'Magtech 380A FMJ 95gr (50un)',             sku: 'AMMO-380-MAG-FMJ-50',     category: ProductCategory.AMMUNITION, caliber: '.380 ACP', unitPrice: 275, costPrice: 200, unit: 'cx', initialStock: 110, minimumStock: 30, location: 'Depósito Munição - A2' },

  // ── MUNIÇÃO .40 S&W ──────────────────────────────────
  { name: 'CBC .40 S&W ETOG 180gr FMJ (50un)',        sku: 'AMMO-40-CBC-FMJ-50',      category: ProductCategory.AMMUNITION, caliber: '.40 S&W',  unitPrice: 370, costPrice: 270, unit: 'cx', initialStock: 90,  minimumStock: 30, location: 'Depósito Munição - A3' },
  { name: 'Magtech 40B FMJ 180gr (50un)',             sku: 'AMMO-40-MAG-FMJ-50',      category: ProductCategory.AMMUNITION, caliber: '.40 S&W',  unitPrice: 360, costPrice: 260, unit: 'cx', initialStock: 75,  minimumStock: 25, location: 'Depósito Munição - A3' },

  // ── MUNIÇÃO .45 ACP ──────────────────────────────────
  { name: 'CBC .45 Auto FMJ 230gr (50un)',            sku: 'AMMO-45-CBC-FMJ-50',      category: ProductCategory.AMMUNITION, caliber: '.45 ACP',  unitPrice: 435, costPrice: 320, unit: 'cx', initialStock: 60,  minimumStock: 20, location: 'Depósito Munição - A4' },
  { name: 'Magtech 45A FMJ 230gr (50un)',             sku: 'AMMO-45-MAG-FMJ-50',      category: ProductCategory.AMMUNITION, caliber: '.45 ACP',  unitPrice: 445, costPrice: 325, unit: 'cx', initialStock: 50,  minimumStock: 15, location: 'Depósito Munição - A4' },

  // ── MUNIÇÃO .357 Magnum ──────────────────────────────
  { name: 'CBC .357 Mag SJSP 158gr (50un)',           sku: 'AMMO-357-CBC-SJSP-50',    category: ProductCategory.AMMUNITION, caliber: '.357 Mag', unitPrice: 405, costPrice: 295, unit: 'cx', initialStock: 70,  minimumStock: 20, location: 'Depósito Munição - A5' },
  { name: 'Magtech 357A FMJ 158gr (50un)',            sku: 'AMMO-357-MAG-FMJ-50',     category: ProductCategory.AMMUNITION, caliber: '.357 Mag', unitPrice: 415, costPrice: 300, unit: 'cx', initialStock: 55,  minimumStock: 15, location: 'Depósito Munição - A5' },

  // ── MUNIÇÃO .38 SPL ──────────────────────────────────
  { name: 'CBC .38 SPL Chumbo Coberto 158gr (50un)',  sku: 'AMMO-38SPL-CBC-CHOG-50',  category: ProductCategory.AMMUNITION, caliber: '.38 SPL',  unitPrice: 220, costPrice: 160, unit: 'cx', initialStock: 220, minimumStock: 60, location: 'Depósito Munição - B1' },
  { name: 'CBC .38 SPL +P Gold Hex 125gr JHP (20un)', sku: 'AMMO-38SPL-CBC-GH-20',    category: ProductCategory.AMMUNITION, caliber: '.38 SPL',  unitPrice: 155, costPrice: 110, unit: 'cx', initialStock: 60,  minimumStock: 20, location: 'Depósito Munição - B1' },
  { name: 'Magtech 38A LRN 158gr (50un)',             sku: 'AMMO-38SPL-MAG-LRN-50',   category: ProductCategory.AMMUNITION, caliber: '.38 SPL',  unitPrice: 230, costPrice: 165, unit: 'cx', initialStock: 180, minimumStock: 50, location: 'Depósito Munição - B1' },

  // ── MUNIÇÃO .22 LR ───────────────────────────────────
  { name: 'CBC .22 LR Standard Velocity 40gr CPRN (50un)', sku: 'AMMO-22LR-CBC-SV-50',  category: ProductCategory.AMMUNITION, caliber: '.22 LR',   unitPrice: 90,  costPrice: 60,  unit: 'cx', initialStock: 320, minimumStock: 80, location: 'Depósito Munição - B2' },
  { name: 'CBC .22 LR High Velocity 40gr CPRN (50un)',     sku: 'AMMO-22LR-CBC-HV-50',  category: ProductCategory.AMMUNITION, caliber: '.22 LR',   unitPrice: 105, costPrice: 70,  unit: 'cx', initialStock: 280, minimumStock: 80, location: 'Depósito Munição - B2' },
  { name: 'Magtech 22A High Velocity 40gr LRN (50un)',     sku: 'AMMO-22LR-MAG-HV-50',  category: ProductCategory.AMMUNITION, caliber: '.22 LR',   unitPrice: 115, costPrice: 80,  unit: 'cx', initialStock: 200, minimumStock: 60, location: 'Depósito Munição - B2' },

  // ── MUNIÇÃO .223 Rem ─────────────────────────────────
  { name: 'CBC .223 Rem FMJ 55gr (50un)',             sku: 'AMMO-223-CBC-FMJ-50',     category: ProductCategory.AMMUNITION, caliber: '.223 Rem', unitPrice: 340, costPrice: 245, unit: 'cx', initialStock: 75,  minimumStock: 20, location: 'Depósito Munição - C1' },
  { name: 'Magtech 223A FMJ 55gr (50un)',             sku: 'AMMO-223-MAG-FMJ-50',     category: ProductCategory.AMMUNITION, caliber: '.223 Rem', unitPrice: 350, costPrice: 250, unit: 'cx', initialStock: 60,  minimumStock: 20, location: 'Depósito Munição - C1' },

  // ── MUNIÇÃO .308 Win ─────────────────────────────────
  { name: 'CBC .308 Win FMJ 147gr (20un)',            sku: 'AMMO-308-CBC-FMJ-20',     category: ProductCategory.AMMUNITION, caliber: '.308 Win', unitPrice: 270, costPrice: 195, unit: 'cx', initialStock: 50,  minimumStock: 15, location: 'Depósito Munição - C2' },
  { name: 'Magtech 762A FMJ 147gr (20un)',            sku: 'AMMO-308-MAG-FMJ-20',     category: ProductCategory.AMMUNITION, caliber: '.308 Win', unitPrice: 280, costPrice: 200, unit: 'cx', initialStock: 40,  minimumStock: 12, location: 'Depósito Munição - C2' },

  // ── MUNIÇÃO 12 GA ────────────────────────────────────
  { name: 'CBC 12 Chumbo nº 7½ 32g (25un)',           sku: 'AMMO-12GA-CBC-7H-25',     category: ProductCategory.AMMUNITION, caliber: '12 GA',    unitPrice: 120, costPrice: 85,  unit: 'cx', initialStock: 90,  minimumStock: 25, location: 'Depósito Munição - D1' },
  { name: 'CBC 12 Magnum Slug 28g (5un)',             sku: 'AMMO-12GA-CBC-SLUG-5',    category: ProductCategory.AMMUNITION, caliber: '12 GA',    unitPrice: 48,  costPrice: 32,  unit: 'cx', initialStock: 40,  minimumStock: 10, location: 'Depósito Munição - D1' },
  { name: 'Magtech 12 Buckshot 00 9 bagos (25un)',    sku: 'AMMO-12GA-MAG-BK-25',     category: ProductCategory.AMMUNITION, caliber: '12 GA',    unitPrice: 220, costPrice: 160, unit: 'cx', initialStock: 30,  minimumStock: 10, location: 'Depósito Munição - D1' },

  // ── ALVOS ────────────────────────────────────────────
  { name: 'Alvo Papel Precisão 50m (cartela 100un)',  sku: 'TGT-PAPEL-PREC-100',      category: ProductCategory.TARGET,                       unitPrice: 65,  costPrice: 35,  unit: 'cx', initialStock: 40,  minimumStock: 10, location: 'Almoxarifado - B1' },
  { name: 'Alvo IPSC Classic Papelão (un)',           sku: 'TGT-IPSC-CLASSIC',        category: ProductCategory.TARGET,                       unitPrice: 12,  costPrice: 6,   unit: 'un', initialStock: 250, minimumStock: 50, location: 'Almoxarifado - B1' },
  { name: 'Alvo Silhueta Defesa (un)',                sku: 'TGT-SILHUETA-DEF',        category: ProductCategory.TARGET,                       unitPrice: 8,   costPrice: 4,   unit: 'un', initialStock: 320, minimumStock: 80, location: 'Almoxarifado - B1' },
  { name: 'Alvo Metálico Popper (par)',               sku: 'TGT-METAL-POPPER',        category: ProductCategory.TARGET,                       unitPrice: 650, costPrice: 420, unit: 'par', initialStock: 8,  minimumStock: 2,  location: 'Almoxarifado - B2' },
  { name: 'Alvo Metálico Plate Rack (kit 6)',         sku: 'TGT-METAL-PLATE-6',       category: ProductCategory.TARGET,                       unitPrice: 1200,costPrice: 800, unit: 'kit', initialStock: 3,  minimumStock: 1,  location: 'Almoxarifado - B2' },

  // ── EQUIPAMENTOS DE SEGURANÇA ────────────────────────
  { name: 'Abafador Passivo Howard Leight L3',        sku: 'SAFE-EAR-HL-L3',          category: ProductCategory.SAFETY_EQUIPMENT,             unitPrice: 165, costPrice: 105, unit: 'un', initialStock: 25, minimumStock: 8,  location: 'Loja - C1' },
  { name: 'Abafador Eletrônico Howard Impact Sport',  sku: 'SAFE-EAR-HL-IMPACT',      category: ProductCategory.SAFETY_EQUIPMENT,             unitPrice: 720, costPrice: 480, unit: 'un', initialStock: 12, minimumStock: 4,  location: 'Loja - C1' },
  { name: 'Plug Auricular 3M (par)',                  sku: 'SAFE-EAR-3M-PLUG',        category: ProductCategory.SAFETY_EQUIPMENT,             unitPrice: 18,  costPrice: 9,   unit: 'par', initialStock: 150, minimumStock: 40, location: 'Loja - C1' },
  { name: 'Óculos Balístico Pyramex Venture',         sku: 'SAFE-EYE-PYR-VENT',       category: ProductCategory.SAFETY_EQUIPMENT,             unitPrice: 145, costPrice: 95,  unit: 'un', initialStock: 35, minimumStock: 10, location: 'Loja - C1' },

  // ── ACESSÓRIOS / MAGAZINES / COLDRES ─────────────────
  { name: 'Magazine Glock 17 (17 tiros)',             sku: 'ACC-MAG-GLOCK17-17',      category: ProductCategory.ACCESSORY, caliber: '9mm',    unitPrice: 365, costPrice: 250, unit: 'un', initialStock: 18, minimumStock: 5,  location: 'Loja - D1' },
  { name: 'Magazine Taurus G2c (12 tiros)',           sku: 'ACC-MAG-G2C-12',          category: ProductCategory.ACCESSORY, caliber: '9mm',    unitPrice: 235, costPrice: 160, unit: 'un', initialStock: 22, minimumStock: 6,  location: 'Loja - D1' },
  { name: 'Coldre Kydex IWB Bravo Concealment',       sku: 'ACC-HOL-BC-IWB',          category: ProductCategory.ACCESSORY,                    unitPrice: 380, costPrice: 250, unit: 'un', initialStock: 15, minimumStock: 5,  location: 'Loja - D2' },
  { name: 'Speed Loader Revólver .38/.357',           sku: 'ACC-SPLOAD-38',           category: ProductCategory.ACCESSORY, caliber: '.38 SPL',unitPrice: 95,  costPrice: 60,  unit: 'un', initialStock: 28, minimumStock: 8,  location: 'Loja - D2' },
  { name: 'Kit Limpeza CBC Multicalibre',             sku: 'ACC-CLEAN-CBC-KIT',       category: ProductCategory.ACCESSORY,                    unitPrice: 110, costPrice: 70,  unit: 'kit',initialStock: 30, minimumStock: 8,  location: 'Loja - D2' },
  { name: 'Óleo Ballistol 200ml',                     sku: 'ACC-CLEAN-BAL-200',       category: ProductCategory.ACCESSORY,                    unitPrice: 65,  costPrice: 38,  unit: 'un', initialStock: 45, minimumStock: 12, location: 'Loja - D2' },

  // ── CURSOS ───────────────────────────────────────────
  { name: 'Curso de Habitualidade CAC',               sku: 'COURSE-HAB-CAC',          category: ProductCategory.COURSE,                       unitPrice: 350, costPrice: 100, unit: 'un', initialStock: 20, minimumStock: 0,  location: 'Recepção' },
  { name: 'Curso Tiro Defensivo Nível 1',             sku: 'COURSE-TD-N1',            category: ProductCategory.COURSE,                       unitPrice: 750, costPrice: 250, unit: 'un', initialStock: 12, minimumStock: 0,  location: 'Recepção' },
  { name: 'Curso IPSC Black Badge (16h)',             sku: 'COURSE-IPSC-BB',          category: ProductCategory.COURSE,                       unitPrice: 1100,costPrice: 380, unit: 'un', initialStock: 8,  minimumStock: 0,  location: 'Recepção' },
];

// =====================================================
// SÓCIOS DEMO
// =====================================================

interface MemberSeed {
  fullName: string;
  cpf: string;
  memberNumber: string;
  cr?: string;
  crLevel?: number;
  membershipTier: 'STANDARD' | 'PREMIUM' | 'HONORARY';
  monthsAgo: number; // memberSince offset
  profile: 'competitive' | 'regular' | 'casual' | 'inactive';
  preferredFirearms: string[]; // names from POPULAR_FIREARMS
}

const DEMO_MEMBERS: MemberSeed[] = [
  // Competitivos (5) — IPSC, alta frequência, multiplas armas
  { fullName: 'Rafael Mendonça',     cpf: '21345678901', memberNumber: 'CBT0101', cr: 'CR-BA-21001', crLevel: 3, membershipTier: 'PREMIUM',  monthsAgo: 56, profile: 'competitive', preferredFirearms: ['Glock 17', 'CZ Shadow 2', 'Taurus 1911', 'CBC 7022'] },
  { fullName: 'Camila Vasconcelos',  cpf: '32156789012', memberNumber: 'CBT0102', cr: 'CR-BA-21002', crLevel: 3, membershipTier: 'PREMIUM',  monthsAgo: 41, profile: 'competitive', preferredFirearms: ['Glock 19', 'CZ Shadow 2', 'Ruger 10/22'] },
  { fullName: 'Felipe Andrade',      cpf: '43267890123', memberNumber: 'CBT0103', cr: 'CR-BA-21003', crLevel: 2, membershipTier: 'PREMIUM',  monthsAgo: 38, profile: 'competitive', preferredFirearms: ['Sig Sauer P320', 'Taurus TH9', 'Glock 17'] },
  { fullName: 'Letícia Cavalcanti',  cpf: '54378901234', memberNumber: 'CBT0104', cr: 'CR-BA-21004', crLevel: 3, membershipTier: 'PREMIUM',  monthsAgo: 28, profile: 'competitive', preferredFirearms: ['Taurus G3c', 'CZ Shadow 2', 'CBC 8122'] },
  { fullName: 'Bruno Carvalho',      cpf: '65489012345', memberNumber: 'CBT0105', cr: 'CR-BA-21005', crLevel: 2, membershipTier: 'PREMIUM',  monthsAgo: 24, profile: 'competitive', preferredFirearms: ['Glock 17', 'IMBEL IA2', 'Taurus 856'] },

  // Regulares (8) — frequência média, 1-2 armas
  { fullName: 'Juliana Pereira',     cpf: '76590123456', memberNumber: 'CBT0106', cr: 'CR-BA-21006', crLevel: 2, membershipTier: 'STANDARD', monthsAgo: 22, profile: 'regular', preferredFirearms: ['Taurus G2c', 'Taurus 856'] },
  { fullName: 'Diego Nascimento',    cpf: '87601234567', memberNumber: 'CBT0107', cr: 'CR-BA-21007', crLevel: 1, membershipTier: 'STANDARD', monthsAgo: 19, profile: 'regular', preferredFirearms: ['Taurus PT 92', 'Taurus RT 605'] },
  { fullName: 'Patrícia Souza',      cpf: '98712345678', memberNumber: 'CBT0108', cr: 'CR-BA-21008', crLevel: 1, membershipTier: 'STANDARD', monthsAgo: 17, profile: 'regular', preferredFirearms: ['Taurus G3c', 'Taurus RT 85'] },
  { fullName: 'Ricardo Albuquerque', cpf: '10923456789', memberNumber: 'CBT0109', cr: 'CR-BA-21009', crLevel: 2, membershipTier: 'STANDARD', monthsAgo: 16, profile: 'regular', preferredFirearms: ['IMBEL MD1', 'Taurus 1911'] },
  { fullName: 'Marcela Ribeiro',     cpf: '12034567890', memberNumber: 'CBT0110', cr: 'CR-BA-21010', crLevel: 1, membershipTier: 'STANDARD', monthsAgo: 14, profile: 'regular', preferredFirearms: ['Taurus G2c', 'CBC 7022'] },
  { fullName: 'Henrique Lima',       cpf: '23145678012', memberNumber: 'CBT0111', cr: 'CR-BA-21011', crLevel: 2, membershipTier: 'STANDARD', monthsAgo: 12, profile: 'regular', preferredFirearms: ['Glock 19', 'Taurus 856'] },
  { fullName: 'Gabriela Moura',      cpf: '34256789013', memberNumber: 'CBT0112', cr: 'CR-BA-21012', crLevel: 1, membershipTier: 'STANDARD', monthsAgo: 10, profile: 'regular', preferredFirearms: ['Taurus G3c'] },
  { fullName: 'Lucas Oliveira',      cpf: '45367890124', memberNumber: 'CBT0113', cr: 'CR-BA-21013', crLevel: 2, membershipTier: 'STANDARD', monthsAgo: 9,  profile: 'regular', preferredFirearms: ['Taurus PT 100', 'Taurus Tracker 627'] },

  // Casuais (5) — pouca frequência, treino básico
  { fullName: 'Amanda Castro',       cpf: '56478901235', memberNumber: 'CBT0114', cr: 'CR-BA-21014', crLevel: 1, membershipTier: 'STANDARD', monthsAgo: 7,  profile: 'casual', preferredFirearms: ['Taurus G2c'] },
  { fullName: 'Eduardo Barreto',     cpf: '67589012346', memberNumber: 'CBT0115', cr: 'CR-BA-21015', crLevel: 1, membershipTier: 'STANDARD', monthsAgo: 6,  profile: 'casual', preferredFirearms: ['Taurus 856'] },
  { fullName: 'Vanessa Tavares',     cpf: '78690123457', memberNumber: 'CBT0116', cr: 'CR-BA-21016', crLevel: 1, membershipTier: 'STANDARD', monthsAgo: 5,  profile: 'casual', preferredFirearms: ['Taurus G3c'] },
  { fullName: 'Roberto Macedo',      cpf: '89701234568', memberNumber: 'CBT0117', cr: 'CR-BA-21017', crLevel: 1, membershipTier: 'STANDARD', monthsAgo: 3,  profile: 'casual', preferredFirearms: ['Taurus PT 92'] },
  { fullName: 'Larissa Freitas',     cpf: '90812345679', memberNumber: 'CBT0118', cr: 'CR-BA-21018', crLevel: 1, membershipTier: 'STANDARD', monthsAgo: 2,  profile: 'casual', preferredFirearms: ['Taurus 856'] },

  // Honorários / inativos (2)
  { fullName: 'José Ferreira (Honorário)',  cpf: '01923456780', memberNumber: 'CBT0119', cr: 'CR-BA-21019', crLevel: 3, membershipTier: 'HONORARY', monthsAgo: 84, profile: 'casual',   preferredFirearms: ['S&W 686', 'Beretta 686', 'IMBEL IA2'] },
  { fullName: 'Antônio Cunha',              cpf: '13045678901', memberNumber: 'CBT0120', cr: 'CR-BA-21020', crLevel: 1, membershipTier: 'STANDARD', monthsAgo: 60, profile: 'inactive', preferredFirearms: ['Taurus PT 92'] },
];

// =====================================================
// HELPERS
// =====================================================

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function visitsCountForProfile(profile: MemberSeed['profile']): number {
  switch (profile) {
    case 'competitive': return randInt(28, 42);
    case 'regular':     return randInt(10, 18);
    case 'casual':      return randInt(2, 6);
    case 'inactive':    return 0;
  }
}

function shotsForFirearmCategory(cat: FirearmCategory | null): number {
  switch (cat) {
    case 'PISTOL':   return randInt(50, 200);
    case 'REVOLVER': return randInt(30, 120);
    case 'RIFLE':    return randInt(20, 80);
    case 'SHOTGUN':  return randInt(15, 50);
    default:         return randInt(40, 100);
  }
}

// Returns a random datetime within the last N days
function randomDateWithinDays(days: number): Date {
  const now = new Date();
  const start = now.getTime() - days * 24 * 60 * 60 * 1000;
  const ts = start + Math.random() * (now.getTime() - start);
  const d = new Date(ts);
  // Set check-in time between 8h and 17h
  d.setHours(randInt(8, 17), randInt(0, 59), 0, 0);
  return d;
}

function dateOnly(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('--- CBT Demo Seed: começando ---\n');

  const passwordHash = await bcrypt.hash('demo123', SALT_ROUNDS);

  // Make sure admin exists for `registeredById`
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@cbt.com.br' },
    select: { id: true },
  });
  if (!admin) {
    console.error('[ERRO] Admin não encontrado. Rode o seed principal primeiro: npx prisma db seed');
    process.exit(1);
  }

  // ──────────────── PRODUCTS ────────────────
  console.log('▶ Cadastrando produtos...');
  let prodCount = 0;
  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        // refresh price/stock metadata if exists
        unitPrice: p.unitPrice,
        costPrice: p.costPrice,
        name: p.name,
      },
      create: {
        clubId: CLUB_ID,
        name: p.name,
        sku: p.sku,
        category: p.category,
        caliber: p.caliber ?? null,
        unitPrice: p.unitPrice,
        costPrice: p.costPrice,
        unit: p.unit,
        isForSale: true,
        isActive: true,
      },
    });

    const stockItem = await prisma.stockItem.upsert({
      where: { clubId_productId: { clubId: CLUB_ID, productId: product.id } },
      update: {},
      create: {
        clubId: CLUB_ID,
        productId: product.id,
        currentStock: p.initialStock,
        minimumStock: p.minimumStock,
        location: p.location,
        lastRestocked: new Date(),
      },
    });

    const movementExists = await prisma.stockMovement.findFirst({
      where: { stockItemId: stockItem.id, movementType: StockMovementType.INITIAL_STOCK },
    });
    if (!movementExists) {
      await prisma.stockMovement.create({
        data: {
          stockItemId: stockItem.id,
          movementType: StockMovementType.INITIAL_STOCK,
          quantity: p.initialStock,
          previousStock: 0,
          newStock: p.initialStock,
          notes: 'Estoque inicial via seed-demo',
        },
      });
    }

    prodCount++;
  }
  console.log(`  ✓ ${prodCount} produtos cadastrados/atualizados\n`);

  // ──────────────── MEMBERS ────────────────
  console.log('▶ Cadastrando sócios demo...');
  const memberIds: { id: string; member: MemberSeed }[] = [];

  for (const m of DEMO_MEMBERS) {
    const email = `${m.memberNumber.toLowerCase()}@demo.cbt.com.br`;
    const memberSince = new Date();
    memberSince.setMonth(memberSince.getMonth() - m.monthsAgo);

    // Annuity valid until 1 year from memberSince anniversary closest to now
    const annuityValidUntil = new Date(memberSince);
    while (annuityValidUntil < new Date()) {
      annuityValidUntil.setFullYear(annuityValidUntil.getFullYear() + 1);
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        cpf: m.cpf,
        passwordHash,
        role: Role.ASSOCIATE,
        status: m.profile === 'inactive' ? UserStatus.INACTIVE : UserStatus.ACTIVE,
        isActive: m.profile !== 'inactive',
        fullName: m.fullName,
        memberNumber: m.memberNumber,
        cr: m.cr ?? null,
        crLevel: m.crLevel ?? null,
        membershipTier: m.membershipTier,
        memberSince,
        annuityValidUntil,
        clubId: CLUB_ID,
      },
    });
    memberIds.push({ id: user.id, member: m });
  }
  console.log(`  ✓ ${memberIds.length} sócios demo cadastrados\n`);

  // ──────────────── VISITS + DETAILS ────────────────
  console.log('▶ Gerando visitas + tiros (últimos 90 dias)...');
  let visitsCreated = 0;
  let detailsCreated = 0;

  for (const { id: memberId, member } of memberIds) {
    // Skip if this member already has demo visits (idempotent)
    const existingDemo = await prisma.visit.count({
      where: { memberId, notes: { contains: DEMO_TAG } },
    });
    if (existingDemo > 0) {
      continue;
    }

    const visitsCount = visitsCountForProfile(member.profile);
    if (visitsCount === 0) continue;

    for (let i = 0; i < visitsCount; i++) {
      const checkInTime = randomDateWithinDays(90);
      // Most visits have a checkout (~95%); some are still ongoing OR cut short
      const hasCheckout = Math.random() > 0.05;
      const durationMin = randInt(45, 180);
      const checkOutTime = hasCheckout
        ? new Date(checkInTime.getTime() + durationMin * 60_000)
        : null;

      const visit = await prisma.visit.create({
        data: {
          memberId,
          registeredById: admin.id,
          visitDate: dateOnly(checkInTime),
          checkInTime,
          checkOutTime,
          purpose: pickRandom(['Treino', 'Habitualidade', 'IPSC Practice', 'Defesa Pessoal', 'Curso', null]),
          notes: DEMO_TAG,
        },
      });
      visitsCreated++;

      // 1-3 detalhes por visita (mais para competitivos)
      const detailsPerVisit =
        member.profile === 'competitive' ? randInt(2, 4)
        : member.profile === 'regular' ? randInt(1, 3)
        : randInt(1, 2);

      for (let d = 0; d < detailsPerVisit; d++) {
        const firearmName = pickRandom(member.preferredFirearms);
        const firearm = POPULAR_FIREARMS.find((f) => f.name === firearmName);
        if (!firearm) continue;
        const cat = getFirearmCategory(firearmName);
        const shots = shotsForFirearmCategory(cat);

        // Some details have caliber different from default (variation)
        const useDefault = Math.random() > 0.15;
        const caliber = useDefault
          ? firearm.defaultCaliber
          : pickRandom([firearm.defaultCaliber, '9mm', '.38 SPL', '.22 LR']);

        await prisma.visitDetail.create({
          data: {
            visitId: visit.id,
            memberId,
            caliber,
            firearmName,
            shotsFired: shots,
            notes: Math.random() > 0.7 ? pickRandom(['Treino preciso', 'Saque rápido', 'Stage IPSC', 'Defesa']) : null,
          },
        });
        detailsCreated++;
      }
    }
  }
  console.log(`  ✓ ${visitsCreated} visitas | ${detailsCreated} detalhes criados\n`);

  // ──────────────── PRESENTES AGORA (alguns) ────────────────
  console.log('▶ Marcando 3 sócios como presentes agora (sem checkout)...');
  const activeNow = memberIds.filter((m) => m.member.profile !== 'inactive').slice(0, 3);
  for (const { id: memberId, member } of activeNow) {
    // Check if already present
    const open = await prisma.visit.findFirst({
      where: { memberId, checkOutTime: null, visitDate: dateOnly(new Date()) },
    });
    if (open) continue;

    const checkInTime = new Date(Date.now() - randInt(20, 110) * 60_000);
    const visit = await prisma.visit.create({
      data: {
        memberId,
        registeredById: admin.id,
        visitDate: dateOnly(new Date()),
        checkInTime,
        checkOutTime: null,
        purpose: pickRandom(['Treino', 'Habitualidade']),
        notes: DEMO_TAG,
      },
    });

    // 1-2 tiros já registrados
    const detailsCount = randInt(1, 2);
    for (let d = 0; d < detailsCount; d++) {
      const firearmName = pickRandom(member.preferredFirearms);
      const firearm = POPULAR_FIREARMS.find((f) => f.name === firearmName);
      if (!firearm) continue;
      const cat = getFirearmCategory(firearmName);
      await prisma.visitDetail.create({
        data: {
          visitId: visit.id,
          memberId,
          caliber: firearm.defaultCaliber,
          firearmName,
          shotsFired: shotsForFirearmCategory(cat),
        },
      });
    }
  }
  console.log(`  ✓ Presentes agora marcados\n`);

  // ──────────────── SUMMARY ────────────────
  console.log('--- CBT Demo Seed: concluído ---');
  console.log(`  Produtos:        ${PRODUCTS.length}`);
  console.log(`  Sócios demo:     ${DEMO_MEMBERS.length}`);
  console.log(`  Visitas criadas: ${visitsCreated}`);
  console.log(`  Detalhes tiro:   ${detailsCreated}`);
  console.log('-------------------------------------\n');
  console.log('Login admin: admin@cbt.com.br / admin123');
  console.log('Sócios demo: <memberNumber>@demo.cbt.com.br / demo123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('\n[ERRO] Falha ao executar seed-demo:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
