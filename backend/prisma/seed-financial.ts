// =====================================================
// CBT — DEMO SEED FINANCEIRO (idempotente)
//
// Popula /financeiro e /lancamentos com dados realistas:
//   • ~260 transações de venda distribuídas nos últimos 90 dias
//     (AMMUNITION_SALE, TARGET_SALE, LANE_RENTAL, COURSE_ENROLLMENT,
//     EQUIPMENT_RENTAL, OTHER_SALE) com peso por dia da semana
//   • ~50 despesas variadas nos últimos 90 dias (folha, estoque,
//     aluguel imóvel, energia, manutenção, internet, marketing, etc.)
//   • ~15 pagamentos de anuidade
//
// Pesquisa: Magnum / ANIAC / CACBrasil — clube BR médio fatura
// R$ 40-50k/mês, despesas R$ 30-40k/mês, margem 10-18%.
//
// Idempotente: pula se já encontrar transação/despesa/anuidade com
// tag [demo-fin] no notes.
//
// Run: npx tsx prisma/seed-financial.ts
// =====================================================

import { PrismaClient, TransactionType, ExpenseCategory } from '@prisma/client';
import { addDays, startOfDay, subDays } from 'date-fns';

const prisma = new PrismaClient();
const CLUB_ID = 'cbt-bahia';
const DEMO_TAG = '[demo-fin]';

// =====================================================
// HELPERS
// =====================================================

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2): number {
  const v = min + Math.random() * (max - min);
  return Math.round(v * 10 ** decimals) / 10 ** decimals;
}

// Weights per weekday (0=Sun .. 6=Sat). Saturday dominates.
const WEEKDAY_WEIGHTS: Record<number, number> = {
  0: 6,  // Dom
  1: 2,  // Seg
  2: 3,  // Ter
  3: 3,  // Qua
  4: 5,  // Qui
  5: 5,  // Sex
  6: 10, // Sáb
};

/**
 * Generates N random datetimes across the last `days` days, weighted by weekday.
 */
function weightedDatesAcross(count: number, days: number): Date[] {
  const today = startOfDay(new Date());
  // Build a pool of candidate days with duplicates proportional to weight
  const pool: Date[] = [];
  for (let d = 0; d < days; d++) {
    const day = subDays(today, d);
    const weight = WEEKDAY_WEIGHTS[day.getDay()] ?? 1;
    for (let w = 0; w < weight; w++) pool.push(day);
  }
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    const base = new Date(pickRandom(pool));
    // Random hour 8-20, minute 0-59
    base.setHours(randInt(8, 20), randInt(0, 59), randInt(0, 59), 0);
    out.push(base);
  }
  return out;
}

const PAYMENT_METHODS = ['PIX', 'CARD', 'CARD', 'CARD', 'CASH', 'CASH', 'BANK_TRANSFER'];

// =====================================================
// TRANSACTION TEMPLATES (random bundles per type)
// =====================================================

// Each template returns a list of items (description, unitPrice, quantity)
// given available product IDs indexed by SKU prefix.

interface ProductLite {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  caliber: string | null;
  unitPrice: number;
}

function buildAmmoSale(products: ProductLite[]): {
  items: { productId: string; description: string; quantity: number; unitPrice: number }[];
  type: TransactionType;
} {
  const ammo = products.filter((p) => p.category === 'AMMUNITION');
  if (ammo.length === 0) throw new Error('Nenhum produto de munição cadastrado');

  // 60% single-line, 30% two-line, 10% three-line
  const roll = Math.random();
  const lineCount = roll < 0.6 ? 1 : roll < 0.9 ? 2 : 3;

  const picked = new Set<string>();
  const items: { productId: string; description: string; quantity: number; unitPrice: number }[] = [];
  for (let i = 0; i < lineCount; i++) {
    let p: ProductLite;
    let guard = 0;
    do {
      p = pickRandom(ammo);
      guard++;
    } while (picked.has(p.id) && guard < 10);
    picked.add(p.id);
    // Typical qty: 1-3 caixas (ou 2-6 caixas se calibre menor)
    const smallCaliber = p.caliber === '.22 LR' || p.caliber === '.38 SPL';
    const quantity = smallCaliber ? randInt(2, 5) : randInt(1, 3);
    items.push({
      productId: p.id,
      description: p.name,
      quantity,
      unitPrice: p.unitPrice,
    });
  }
  return { items, type: TransactionType.AMMUNITION_SALE };
}

function buildTargetSale(products: ProductLite[]): {
  items: { productId: string; description: string; quantity: number; unitPrice: number }[];
  type: TransactionType;
} | null {
  const targets = products.filter((p) => p.category === 'TARGET');
  if (targets.length === 0) return null;
  const p = pickRandom(targets);
  return {
    items: [
      {
        productId: p.id,
        description: p.name,
        quantity: randInt(3, 12),
        unitPrice: p.unitPrice,
      },
    ],
    type: TransactionType.TARGET_SALE,
  };
}

function buildLaneRental(): {
  items: { description: string; quantity: number; unitPrice: number }[];
  type: TransactionType;
} {
  const hours = randInt(1, 3);
  return {
    items: [
      {
        description: `Aluguel de baia — ${hours}h`,
        quantity: hours,
        unitPrice: randFloat(40, 60),
      },
    ],
    type: TransactionType.LANE_RENTAL,
  };
}

function buildCourseEnrollment(products: ProductLite[]): {
  items: { productId: string; description: string; quantity: number; unitPrice: number }[];
  type: TransactionType;
} | null {
  const courses = products.filter((p) => p.category === 'COURSE');
  if (courses.length === 0) return null;
  const p = pickRandom(courses);
  return {
    items: [
      {
        productId: p.id,
        description: p.name,
        quantity: 1,
        unitPrice: p.unitPrice,
      },
    ],
    type: TransactionType.COURSE_ENROLLMENT,
  };
}

function buildEquipmentRental(): {
  items: { description: string; quantity: number; unitPrice: number }[];
  type: TransactionType;
} {
  const options = [
    { desc: 'Aluguel de arma — pistola', price: randFloat(50, 90) },
    { desc: 'Aluguel de arma — revólver', price: randFloat(40, 70) },
    { desc: 'Aluguel de arma — carabina .22', price: randFloat(45, 80) },
    { desc: 'Aluguel de carregador extra', price: randFloat(15, 30) },
    { desc: 'Aluguel de abafador eletrônico', price: randFloat(10, 25) },
  ];
  const o = pickRandom(options);
  return {
    items: [{ description: o.desc, quantity: 1, unitPrice: o.price }],
    type: TransactionType.EQUIPMENT_RENTAL,
  };
}

function buildOtherSale(products: ProductLite[]): {
  items: { productId?: string; description: string; quantity: number; unitPrice: number }[];
  type: TransactionType;
} {
  const accessories = products.filter(
    (p) => p.category === 'ACCESSORY' || p.category === 'SAFETY_EQUIPMENT',
  );
  if (accessories.length > 0 && Math.random() > 0.3) {
    const p = pickRandom(accessories);
    return {
      items: [
        {
          productId: p.id,
          description: p.name,
          quantity: 1,
          unitPrice: p.unitPrice,
        },
      ],
      type: TransactionType.OTHER_SALE,
    };
  }
  // Small misc sale
  const misc = [
    { desc: 'Café e lanche', price: randFloat(6, 18) },
    { desc: 'Estacionamento', price: randFloat(5, 12) },
    { desc: 'Adesivo / brinde', price: randFloat(15, 30) },
  ];
  const m = pickRandom(misc);
  return {
    items: [{ description: m.desc, quantity: 1, unitPrice: m.price }],
    type: TransactionType.OTHER_SALE,
  };
}

// =====================================================
// EXPENSE TEMPLATES
// =====================================================

interface ExpenseTemplate {
  category: ExpenseCategory;
  description: string;
  vendor?: string;
  amountMin: number;
  amountMax: number;
}

// Monthly recurring (3 instâncias = 3 meses)
const RECURRING_MONTHLY: ExpenseTemplate[] = [
  { category: 'STAFF',      description: 'Salário gerente operacional',        vendor: 'Folha',              amountMin: 4200, amountMax: 4600 },
  { category: 'STAFF',      description: 'Salário instrutor-chefe',            vendor: 'Folha',              amountMin: 3800, amountMax: 4200 },
  { category: 'STAFF',      description: 'Salário secretária / recepção',      vendor: 'Folha',              amountMin: 2600, amountMax: 2900 },
  { category: 'STAFF',      description: 'Faxina mensal (terceirizada)',       vendor: 'Limpar Ltda',        amountMin: 1400, amountMax: 1700 },
  { category: 'OTHER',      description: 'Aluguel do imóvel + condomínio',    vendor: 'Imob. Bahia',        amountMin: 6000, amountMax: 7500 },
  { category: 'UTILITIES',  description: 'Conta de energia elétrica',          vendor: 'Coelba',             amountMin: 3200, amountMax: 4800 },
  { category: 'UTILITIES',  description: 'Água e esgoto',                      vendor: 'Embasa',             amountMin: 420,  amountMax: 680 },
  { category: 'UTILITIES',  description: 'Internet + telefonia',               vendor: 'Claro Empresas',     amountMin: 340,  amountMax: 420 },
  { category: 'OTHER',      description: 'Marketing digital (Instagram Ads)',  vendor: 'Meta Ads',           amountMin: 500,  amountMax: 900 },
  { category: 'OTHER',      description: 'Material de escritório e SIGMA',     vendor: 'Papelaria Central',  amountMin: 180,  amountMax: 320 },
];

// Weekly-ish restock
const RESTOCK: ExpenseTemplate[] = [
  { category: 'AMMUNITION_RESTOCK', description: 'Compra munição 9mm — CBC',           vendor: 'CBC Distribuidor', amountMin: 4500, amountMax: 7500 },
  { category: 'AMMUNITION_RESTOCK', description: 'Compra munição .38 SPL — CBC',       vendor: 'CBC Distribuidor', amountMin: 2200, amountMax: 4000 },
  { category: 'AMMUNITION_RESTOCK', description: 'Compra munição .22 LR — CBC',        vendor: 'CBC Distribuidor', amountMin: 1400, amountMax: 2800 },
  { category: 'AMMUNITION_RESTOCK', description: 'Compra munição .380 ACP — Magtech',  vendor: 'Magtech BR',       amountMin: 1800, amountMax: 3400 },
  { category: 'INVENTORY_PURCHASE', description: 'Reposição de alvos de papel',        vendor: 'Gráfica Alvo',     amountMin: 350,  amountMax: 650 },
  { category: 'INVENTORY_PURCHASE', description: 'Reposição de alvos IPSC',            vendor: 'Fornecedor IPSC',  amountMin: 420,  amountMax: 780 },
  { category: 'INVENTORY_PURCHASE', description: 'Kit limpeza CBC (lote)',             vendor: 'CBC Distribuidor', amountMin: 580,  amountMax: 980 },
  { category: 'INVENTORY_PURCHASE', description: 'Abafadores novos para aluguel',      vendor: 'Howard Leight BR', amountMin: 900,  amountMax: 1600 },
];

// Eventual / maintenance
const EVENTUAL: ExpenseTemplate[] = [
  { category: 'MAINTENANCE',      description: 'Manutenção do sistema de ventilação', vendor: 'Tec Ventil',     amountMin: 1200, amountMax: 2400 },
  { category: 'MAINTENANCE',      description: 'Reforma de backstop (captura)',       vendor: 'Soluções Balísticas', amountMin: 2800, amountMax: 5200 },
  { category: 'MAINTENANCE',      description: 'Troca de iluminação LED das baias',   vendor: 'Elétrica Pontual', amountMin: 600,  amountMax: 1400 },
  { category: 'MAINTENANCE',      description: 'Serviço de descontaminação de chumbo',vendor: 'Eco Tiro',       amountMin: 2400, amountMax: 4800 },
  { category: 'MAINTENANCE',      description: 'Manutenção preventiva AC industrial', vendor: 'Clima Rápido',   amountMin: 480,  amountMax: 850 },
  { category: 'EQUIPMENT_PURCHASE', description: 'Aquisição de óculos balísticos',    vendor: 'Loja SafeFire',  amountMin: 820,  amountMax: 1450 },
  { category: 'EQUIPMENT_PURCHASE', description: 'Aquisição de 2 alvos metálicos',    vendor: 'Popper Pro',     amountMin: 1600, amountMax: 2400 },
  { category: 'INSURANCE',        description: 'Parcela anual seguro predial',        vendor: 'Porto Seguros',  amountMin: 1100, amountMax: 1650 },
  { category: 'INSURANCE',        description: 'RC Profissional instrutores',         vendor: 'Porto Seguros',  amountMin: 680,  amountMax: 920 },
  { category: 'OTHER',            description: 'Taxa de renovação CR — Exército',     vendor: 'SFPC Bahia',     amountMin: 1800, amountMax: 2600 },
  { category: 'OTHER',            description: 'Taxa AVCB — Bombeiros',               vendor: 'CBM-BA',         amountMin: 340,  amountMax: 680 },
  { category: 'OTHER',            description: 'Premiação competição interna',        vendor: 'Troféus Bahia',  amountMin: 450,  amountMax: 1200 },
  { category: 'OTHER',            description: 'Serviços contábeis',                  vendor: 'Contadora Lopes',amountMin: 800,  amountMax: 1200 },
];

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('--- CBT Demo Seed (Financeiro): iniciando ---\n');

  const admin = await prisma.user.findFirst({
    where: { email: 'admin@cbt.com.br' },
    select: { id: true },
  });
  if (!admin) {
    console.error('[ERRO] Admin nao encontrado. Rode `npx prisma db seed` antes.');
    process.exit(1);
  }

  // Idempotency check
  const existingDemoFin = await prisma.transaction.count({
    where: { notes: { contains: DEMO_TAG } },
  });
  if (existingDemoFin > 0) {
    console.log(`[info] Já existem ${existingDemoFin} transações [demo-fin] — pulando criação.\n`);
    console.log('Para recriar, apague-as antes: DELETE transactions WHERE notes LIKE "%[demo-fin]%"');
    await prisma.$disconnect();
    return;
  }

  // ─── Load dependencies ─────────────────────────────────────────────
  const products = await prisma.product.findMany({
    where: { clubId: CLUB_ID, isActive: true },
    select: { id: true, name: true, sku: true, category: true, caliber: true, unitPrice: true },
  });
  const productsLite: ProductLite[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category as string,
    caliber: p.caliber,
    unitPrice: Number(p.unitPrice),
  }));
  console.log(`[info] ${productsLite.length} produtos carregados`);

  // Demo members (CBT0101..CBT0120) + seed associates
  const members = await prisma.user.findMany({
    where: {
      role: 'ASSOCIATE',
      isActive: true,
      clubId: CLUB_ID,
    },
    select: { id: true, memberNumber: true, fullName: true },
  });
  if (members.length === 0) {
    console.error('[ERRO] Nenhum associado ativo. Rode seed-demo.ts antes.');
    process.exit(1);
  }
  console.log(`[info] ${members.length} sócios ativos carregados\n`);

  // ─── TRANSACTIONS ──────────────────────────────────────────────────
  console.log('▶ Gerando transações de venda (~260 em 90 dias)...');
  const TX_COUNT = 260;
  const dates = weightedDatesAcross(TX_COUNT, 90);

  let txCreated = 0;
  let txRevenue = 0;

  for (let i = 0; i < TX_COUNT; i++) {
    const date = dates[i];
    const member = pickRandom(members);
    const paymentMethod = pickRandom(PAYMENT_METHODS);

    // Escolhe tipo ponderado
    // ammo 45%, target 10%, lane 18%, course 4%, equipment 12%, other 11%
    const r = Math.random();
    let bundle: ReturnType<typeof buildAmmoSale> | ReturnType<typeof buildTargetSale> | null = null;
    if (r < 0.45) bundle = buildAmmoSale(productsLite);
    else if (r < 0.55) bundle = buildTargetSale(productsLite);
    else if (r < 0.73) bundle = buildLaneRental();
    else if (r < 0.77) bundle = buildCourseEnrollment(productsLite);
    else if (r < 0.89) bundle = buildEquipmentRental();
    else bundle = buildOtherSale(productsLite);

    if (!bundle) continue;

    const totalBeforeDisc = bundle.items.reduce(
      (acc, it) => acc + it.quantity * it.unitPrice,
      0,
    );
    // 15% das transações têm desconto 5-15%
    const discount = Math.random() < 0.15 ? Math.round(totalBeforeDisc * randFloat(0.05, 0.15) * 100) / 100 : 0;
    const totalAmount = Math.round((totalBeforeDisc - discount) * 100) / 100;

    await prisma.transaction.create({
      data: {
        clubId: CLUB_ID,
        memberId: member.id,
        registeredById: admin.id,
        type: bundle.type,
        paymentMethod,
        discount,
        totalAmount,
        transactionDate: date,
        notes: DEMO_TAG,
        items: {
          create: bundle.items.map((it) => ({
            productId: (it as any).productId ?? null,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            subtotal: Math.round(it.quantity * it.unitPrice * 100) / 100,
          })),
        },
      },
    });
    txCreated++;
    txRevenue += totalAmount;
  }
  console.log(`  ✓ ${txCreated} transações criadas — Receita total: R$ ${txRevenue.toFixed(2)}\n`);

  // ─── EXPENSES ───────────────────────────────────────────────────────
  console.log('▶ Gerando despesas (~50 nos últimos 90 dias)...');
  let expCreated = 0;
  let expTotal = 0;

  // Monthly recurring — 3 instancias por template (mês -0, -30, -60)
  for (const tpl of RECURRING_MONTHLY) {
    for (const monthsAgo of [0, 1, 2]) {
      const baseDate = subDays(startOfDay(new Date()), monthsAgo * 30 + randInt(1, 8));
      const amount = randFloat(tpl.amountMin, tpl.amountMax);
      await prisma.expense.create({
        data: {
          clubId: CLUB_ID,
          category: tpl.category,
          description: tpl.description,
          amount,
          vendor: tpl.vendor ?? null,
          expenseDate: baseDate,
          registeredById: admin.id,
          notes: DEMO_TAG,
        },
      });
      expCreated++;
      expTotal += amount;
    }
  }

  // Restock — ~6-8 ocorrências no período
  const restockCount = randInt(6, 8);
  for (let i = 0; i < restockCount; i++) {
    const tpl = pickRandom(RESTOCK);
    const date = addDays(subDays(new Date(), 90), Math.floor((i * 90) / restockCount) + randInt(0, 6));
    const amount = randFloat(tpl.amountMin, tpl.amountMax);
    await prisma.expense.create({
      data: {
        clubId: CLUB_ID,
        category: tpl.category,
        description: tpl.description,
        amount,
        vendor: tpl.vendor ?? null,
        expenseDate: date,
        registeredById: admin.id,
        notes: DEMO_TAG,
      },
    });
    expCreated++;
    expTotal += amount;
  }

  // Eventual — 8-12 ocorrências aleatórias
  const eventualCount = randInt(8, 12);
  const evDates = weightedDatesAcross(eventualCount, 90);
  for (let i = 0; i < eventualCount; i++) {
    const tpl = pickRandom(EVENTUAL);
    const amount = randFloat(tpl.amountMin, tpl.amountMax);
    await prisma.expense.create({
      data: {
        clubId: CLUB_ID,
        category: tpl.category,
        description: tpl.description,
        amount,
        vendor: tpl.vendor ?? null,
        expenseDate: evDates[i],
        registeredById: admin.id,
        notes: DEMO_TAG,
      },
    });
    expCreated++;
    expTotal += amount;
  }
  console.log(`  ✓ ${expCreated} despesas criadas — Total: R$ ${expTotal.toFixed(2)}\n`);

  // ─── ANNUITY PAYMENTS ───────────────────────────────────────────────
  console.log('▶ Gerando pagamentos de anuidade...');
  const annuityAmount = 600; // valor padrão anual
  // Pegar ~50-60% dos sócios e registrar anuidade paga nos ultimos 60 dias
  const sampleMembers = members.sort(() => Math.random() - 0.5).slice(0, Math.floor(members.length * 0.55));
  let annCreated = 0;
  for (const m of sampleMembers) {
    const paymentDate = subDays(startOfDay(new Date()), randInt(3, 60));
    const validFrom = paymentDate;
    const validUntil = new Date(validFrom);
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    await prisma.annuityPayment.create({
      data: {
        clubId: CLUB_ID,
        memberId: m.id,
        amount: annuityAmount,
        paymentDate,
        paymentMethod: pickRandom(PAYMENT_METHODS),
        referenceYear: paymentDate.getFullYear(),
        validFrom,
        validUntil,
        registeredById: admin.id,
        notes: DEMO_TAG,
      },
    });

    // Atualizar User.annuityValidUntil se a nova data for maior
    await prisma.user.update({
      where: { id: m.id },
      data: { annuityValidUntil: validUntil },
    });
    annCreated++;
  }
  console.log(`  ✓ ${annCreated} anuidades pagas (R$ ${(annCreated * annuityAmount).toFixed(2)})\n`);

  // ─── SUMMARY ────────────────────────────────────────────────────────
  console.log('--- CBT Demo Seed (Financeiro): concluído ---');
  console.log(`  Transações:  ${txCreated}  (receita R$ ${txRevenue.toFixed(2)})`);
  console.log(`  Despesas:    ${expCreated}  (R$ ${expTotal.toFixed(2)})`);
  console.log(`  Anuidades:   ${annCreated}  (R$ ${(annCreated * annuityAmount).toFixed(2)})`);
  const ticketMedio = txRevenue / Math.max(txCreated, 1);
  console.log(`  Ticket médio: R$ ${ticketMedio.toFixed(2)}`);
  const margin = txRevenue - expTotal + annCreated * annuityAmount;
  console.log(`  Saldo 90d:   R$ ${margin.toFixed(2)}`);
  console.log('------------------------------------------------\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('\n[ERRO] Falha ao executar seed-financial:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
