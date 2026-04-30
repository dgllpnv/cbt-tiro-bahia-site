// =====================================================
// CBT - CLUBE BAIANO DE TIRO - DATABASE SEED
// Populates the database with initial data for development
// Run with: npm run db:seed
// =====================================================

import { PrismaClient, ProductCategory, StockMovementType, LaneStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;
const CLUB_ID = 'cbt-bahia';

async function main() {
  console.log('--- CBT Seed: Iniciando populacao do banco de dados ---\n');

  // ==========================================================
  // 1. ADMIN USER
  // ==========================================================
  const adminPasswordHash = await bcrypt.hash('admin123', SALT_ROUNDS);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@cbt.com.br' },
    update: {},
    create: {
      email: 'admin@cbt.com.br',
      cpf: '00000000000',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      fullName: 'Administrador CBT',
      memberNumber: 'ADM001',
      memberSince: new Date(),
      clubId: CLUB_ID,
    },
  });

  console.log(`[OK] Admin criado: ${adminUser.email} (${adminUser.id})`);

  // ==========================================================
  // 2. ASSOCIATE USER
  // ==========================================================
  const associatePasswordHash = await bcrypt.hash('associado123', SALT_ROUNDS);

  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const associateUser = await prisma.user.upsert({
    where: { email: 'associado@cbt.com.br' },
    update: {},
    create: {
      email: 'associado@cbt.com.br',
      cpf: '11111111111',
      passwordHash: associatePasswordHash,
      role: 'ASSOCIATE',
      status: 'ACTIVE',
      fullName: 'Joao Silva (Associado Teste)',
      memberNumber: 'ASS001',
      cr: 'CR-BA-12345',
      crLevel: 1,
      annuityValidUntil: oneYearFromNow,
      memberSince: new Date(),
      clubId: CLUB_ID,
    },
  });

  console.log(`[OK] Associado criado: ${associateUser.email} (${associateUser.id})`);

  // ==========================================================
  // 3. LANES (Baias 1-6)
  // ==========================================================
  const laneCount = 6;

  for (let i = 1; i <= laneCount; i++) {
    const lane = await prisma.lane.upsert({
      where: {
        clubId_number: { clubId: CLUB_ID, number: i },
      },
      update: {},
      create: {
        clubId: CLUB_ID,
        number: i,
        name: `Baia ${i}`,
        status: LaneStatus.AVAILABLE,
        isActive: true,
      },
    });

    console.log(`[OK] Baia criada: ${lane.name} (${lane.id})`);
  }

  // ==========================================================
  // 4. CLUB SETTINGS
  // ==========================================================
  const operatingHours = {
    monday:    { open: '08:00', close: '18:00', closed: false },
    tuesday:   { open: '08:00', close: '18:00', closed: false },
    wednesday: { open: '08:00', close: '18:00', closed: false },
    thursday:  { open: '08:00', close: '18:00', closed: false },
    friday:    { open: '08:00', close: '18:00', closed: false },
    saturday:  { open: '08:00', close: '14:00', closed: false },
    sunday:    { open: null,    close: null,     closed: true  },
  };

  const clubSettings = await prisma.clubSettings.upsert({
    where: { clubId: CLUB_ID },
    update: {},
    create: {
      clubId: CLUB_ID,
      clubName: 'Clube Baiano de Tiro',
      totalLanes: laneCount,
      annuityAmount: 600.00,
      operatingHours,
    },
  });

  console.log(`[OK] Configuracoes do clube criadas (${clubSettings.id})`);

  // ==========================================================
  // 5. PRODUCTS & STOCK
  // ==========================================================
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

  const products: ProductSeed[] = [
    {
      name: 'Municao 9mm Luger (50un)',
      sku: 'AMMO-9MM-50',
      category: ProductCategory.AMMUNITION,
      caliber: '9mm',
      unitPrice: 90,
      costPrice: 65,
      unit: 'cx',
      initialStock: 200,
      minimumStock: 50,
      location: 'Deposito de Municao - Prateleira A1',
    },
    {
      name: 'Municao .38 SPL (50un)',
      sku: 'AMMO-38SPL-50',
      category: ProductCategory.AMMUNITION,
      caliber: '.38 SPL',
      unitPrice: 85,
      costPrice: 60,
      unit: 'cx',
      initialStock: 150,
      minimumStock: 40,
      location: 'Deposito de Municao - Prateleira A2',
    },
    {
      name: 'Municao .380 ACP (50un)',
      sku: 'AMMO-380ACP-50',
      category: ProductCategory.AMMUNITION,
      caliber: '.380 ACP',
      unitPrice: 95,
      costPrice: 70,
      unit: 'cx',
      initialStock: 180,
      minimumStock: 45,
      location: 'Deposito de Municao - Prateleira A3',
    },
    {
      name: 'Alvo de Papel',
      sku: 'TGT-PAPEL-01',
      category: ProductCategory.TARGET,
      unitPrice: 5,
      costPrice: 2,
      unit: 'un',
      initialStock: 500,
      minimumStock: 100,
      location: 'Almoxarifado - Prateleira B1',
    },
    {
      name: 'Alvo Metalico (aluguel)',
      sku: 'TGT-METAL-01',
      category: ProductCategory.TARGET,
      unitPrice: 15,
      costPrice: 8,
      unit: 'un',
      initialStock: 20,
      minimumStock: 5,
      location: 'Almoxarifado - Prateleira B2',
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
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

    // Upsert the stock item for this product
    const stockItem = await prisma.stockItem.upsert({
      where: {
        clubId_productId: { clubId: CLUB_ID, productId: product.id },
      },
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

    // Check if this stock item already has an INITIAL_STOCK movement to avoid duplicates
    const existingMovement = await prisma.stockMovement.findFirst({
      where: {
        stockItemId: stockItem.id,
        movementType: StockMovementType.INITIAL_STOCK,
      },
    });

    if (!existingMovement) {
      await prisma.stockMovement.create({
        data: {
          stockItemId: stockItem.id,
          movementType: StockMovementType.INITIAL_STOCK,
          quantity: p.initialStock,
          previousStock: 0,
          newStock: p.initialStock,
          notes: 'Estoque inicial via seed',
        },
      });
    }

    console.log(
      `[OK] Produto criado: ${product.name} | Estoque: ${p.initialStock} ${p.unit}`
    );
  }

  // ==========================================================
  // SUMMARY
  // ==========================================================
  console.log('\n--- CBT Seed: Populacao concluida com sucesso! ---');
  console.log(`  Usuarios:       2 (1 admin, 1 associado)`);
  console.log(`  Baias:          ${laneCount}`);
  console.log(`  Produtos:       ${products.length}`);
  console.log(`  Config. clube:  1`);
  console.log('---------------------------------------------------\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('\n[ERRO] Falha ao executar seed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
