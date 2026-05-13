// =====================================================
// CBT - CLUBE BAIANO DE TIRO - DATABASE SEED
// Populates the database with initial data for development
// Run with: npm run db:seed
// =====================================================

import {
  PrismaClient,
  ProductCategory,
  StockMovementType,
  LaneStatus,
  EquipmentType,
  EquipmentCondition,
} from '@prisma/client';
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
    update: {
      cpf: '11144477735', // CPF valido (DVs ok)
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
    create: {
      email: 'admin@cbt.com.br',
      cpf: '11144477735',
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
  // 2. CASHIER USER (Operador de Caixa)
  // ==========================================================
  const cashierPasswordHash = await bcrypt.hash('caixa123', SALT_ROUNDS);

  const cashierUser = await prisma.user.upsert({
    where: { email: 'caixa@cbt.com.br' },
    update: {
      cpf: '12345678909', // CPF valido (DVs ok)
      role: 'CASHIER',
      passwordHash: cashierPasswordHash,
    },
    create: {
      email: 'caixa@cbt.com.br',
      cpf: '12345678909',
      passwordHash: cashierPasswordHash,
      role: 'CASHIER',
      status: 'ACTIVE',
      fullName: 'Operador de Caixa',
      memberNumber: 'CAX001',
      memberSince: new Date(),
      clubId: CLUB_ID,
    },
  });

  console.log(`[OK] Operador de caixa criado: ${cashierUser.email} (${cashierUser.id})`);

  // ==========================================================
  // 3. ASSOCIATE USER
  // ==========================================================
  const associatePasswordHash = await bcrypt.hash('associado123', SALT_ROUNDS);

  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const associateUser = await prisma.user.upsert({
    where: { email: 'associado@cbt.com.br' },
    update: {
      cpf: '52998224725', // CPF valido (DVs ok)
      passwordHash: associatePasswordHash,
    },
    create: {
      email: 'associado@cbt.com.br',
      cpf: '52998224725',
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

  // ClubSettings: campos legais (CNPJ, CR PJ, endereco, responsavel) são populados
  // com placeholders sintaticamente válidos. O administrador deve completar em
  // /admin/cadastros → Dados do Clube antes de emitir Declarações de Habitualidade.
  // Estratégia: NUNCA sobrescreve valores já preenchidos; só preenche os null.
  const placeholders = {
    cnpj: '00.000.000/0001-00',
    crPj: 'CR-PJ-PENDENTE',
    addressLine: '[Definir em /admin/cadastros]',
    city: 'Salvador',
    state: 'BA',
    zipCode: '00000-000',
    phone: '(71) 0000-0000',
    email: 'contato@cbt.com.br',
    responsibleName: '[Definir em /admin/cadastros]',
    responsibleCpf: '000.000.000-00',
    responsibleRole: 'Diretor Técnico',
  };

  const existingSettings = await prisma.clubSettings.findUnique({ where: { clubId: CLUB_ID } });
  const clubSettings = existingSettings
    ? await prisma.clubSettings.update({
        where: { clubId: CLUB_ID },
        data: {
          cnpj: existingSettings.cnpj ?? placeholders.cnpj,
          crPj: existingSettings.crPj ?? placeholders.crPj,
          addressLine: existingSettings.addressLine ?? placeholders.addressLine,
          city: existingSettings.city ?? placeholders.city,
          state: existingSettings.state ?? placeholders.state,
          zipCode: existingSettings.zipCode ?? placeholders.zipCode,
          phone: existingSettings.phone ?? placeholders.phone,
          email: existingSettings.email ?? placeholders.email,
          responsibleName: existingSettings.responsibleName ?? placeholders.responsibleName,
          responsibleCpf: existingSettings.responsibleCpf ?? placeholders.responsibleCpf,
          responsibleRole: existingSettings.responsibleRole ?? placeholders.responsibleRole,
        },
      })
    : await prisma.clubSettings.create({
        data: {
          clubId: CLUB_ID,
          clubName: 'Clube Baiano de Tiro',
          totalLanes: laneCount,
          annuityAmount: 600.0,
          operatingHours,
          ...placeholders,
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
  // 6. EQUIPMENT (armas, EPIs, coldres, carregadores do clube)
  // ==========================================================
  interface EquipmentSeed {
    name: string;
    serialNumber: string;
    equipmentType: EquipmentType;
    caliber?: string;
    brand?: string;
    model?: string;
    condition?: EquipmentCondition;
  }

  const equipments: EquipmentSeed[] = [
    // Pistolas
    { name: 'Glock 17 Gen 5',    serialNumber: 'CBT-GLK17-001',  equipmentType: EquipmentType.FIREARM, caliber: '9mm',     brand: 'Glock',  model: 'G17 Gen 5',    condition: EquipmentCondition.EXCELLENT },
    { name: 'Glock 19 Gen 5',    serialNumber: 'CBT-GLK19-001',  equipmentType: EquipmentType.FIREARM, caliber: '9mm',     brand: 'Glock',  model: 'G19 Gen 5',    condition: EquipmentCondition.GOOD      },
    { name: 'Taurus G2c',        serialNumber: 'CBT-TG2C-001',   equipmentType: EquipmentType.FIREARM, caliber: '9mm',     brand: 'Taurus', model: 'G2c',          condition: EquipmentCondition.GOOD      },
    { name: 'Taurus G3c',        serialNumber: 'CBT-TG3C-001',   equipmentType: EquipmentType.FIREARM, caliber: '9mm',     brand: 'Taurus', model: 'G3c',          condition: EquipmentCondition.EXCELLENT },
    { name: 'Sig Sauer P320',    serialNumber: 'CBT-P320-001',   equipmentType: EquipmentType.FIREARM, caliber: '9mm',     brand: 'Sig Sauer', model: 'P320 Carry', condition: EquipmentCondition.EXCELLENT },
    { name: 'CZ Shadow 2',       serialNumber: 'CBT-CZS2-001',   equipmentType: EquipmentType.FIREARM, caliber: '9mm',     brand: 'CZ',     model: 'Shadow 2',     condition: EquipmentCondition.EXCELLENT },
    // Revolveres
    { name: 'Taurus 856',        serialNumber: 'CBT-T856-001',   equipmentType: EquipmentType.FIREARM, caliber: '.38 SPL', brand: 'Taurus', model: '856',          condition: EquipmentCondition.GOOD      },
    { name: 'Taurus RT 605',     serialNumber: 'CBT-T605-001',   equipmentType: EquipmentType.FIREARM, caliber: '.357 Mag', brand: 'Taurus', model: 'RT 605',      condition: EquipmentCondition.GOOD      },
    { name: 'S&W 686',           serialNumber: 'CBT-SW686-001',  equipmentType: EquipmentType.FIREARM, caliber: '.357 Mag', brand: 'S&W',   model: '686',          condition: EquipmentCondition.EXCELLENT },
    // Carabinas / rifles
    { name: 'CBC 7022',          serialNumber: 'CBT-CBC7022-001', equipmentType: EquipmentType.FIREARM, caliber: '.22 LR',  brand: 'CBC',    model: '7022',         condition: EquipmentCondition.GOOD      },
    { name: 'IMBEL IA2',         serialNumber: 'CBT-IA2-001',    equipmentType: EquipmentType.FIREARM, caliber: '.223 Rem', brand: 'IMBEL', model: 'IA2',          condition: EquipmentCondition.EXCELLENT },
    { name: 'Ruger 10/22',       serialNumber: 'CBT-R1022-001',  equipmentType: EquipmentType.FIREARM, caliber: '.22 LR',  brand: 'Ruger',  model: '10/22',        condition: EquipmentCondition.GOOD      },
    // Espingardas
    { name: 'Mossberg 500',      serialNumber: 'CBT-MOSS500-001', equipmentType: EquipmentType.FIREARM, caliber: '12 GA',  brand: 'Mossberg', model: '500',        condition: EquipmentCondition.GOOD      },
    { name: 'CBC Pump 586',      serialNumber: 'CBT-CBC586-001', equipmentType: EquipmentType.FIREARM, caliber: '12 GA',   brand: 'CBC',    model: 'Pump 586',     condition: EquipmentCondition.GOOD      },
    // EPIs
    { name: 'Protetor Auricular Howard Leight', serialNumber: 'CBT-EAR-001', equipmentType: EquipmentType.EAR_PROTECTION, brand: 'Howard Leight', model: 'Impact Sport', condition: EquipmentCondition.EXCELLENT },
    { name: 'Protetor Auricular Howard Leight', serialNumber: 'CBT-EAR-002', equipmentType: EquipmentType.EAR_PROTECTION, brand: 'Howard Leight', model: 'Impact Sport', condition: EquipmentCondition.GOOD },
    { name: 'Oculos de Tiro 3M', serialNumber: 'CBT-EYE-001',    equipmentType: EquipmentType.EYE_PROTECTION, brand: '3M',  model: 'Virtua AP',    condition: EquipmentCondition.EXCELLENT },
    { name: 'Oculos de Tiro 3M', serialNumber: 'CBT-EYE-002',    equipmentType: EquipmentType.EYE_PROTECTION, brand: '3M',  model: 'Virtua AP',    condition: EquipmentCondition.GOOD      },
    // Coldres
    { name: 'Coldre Kydex 9mm',  serialNumber: 'CBT-HOL-001',    equipmentType: EquipmentType.HOLSTER, brand: 'Bravo Concealment', model: 'Torsion',         condition: EquipmentCondition.GOOD },
    // Carregadores
    { name: 'Carregador Glock 17 (17 tiros)', serialNumber: 'CBT-MAG-G17-001', equipmentType: EquipmentType.MAGAZINE, caliber: '9mm', brand: 'Glock', model: 'OEM 17rds', condition: EquipmentCondition.GOOD },
    { name: 'Carregador Taurus G2c (12 tiros)', serialNumber: 'CBT-MAG-TG2C-001', equipmentType: EquipmentType.MAGAZINE, caliber: '9mm', brand: 'Taurus', model: 'OEM 12rds', condition: EquipmentCondition.GOOD },
  ];

  for (const e of equipments) {
    const eq = await prisma.equipment.upsert({
      where: { serialNumber: e.serialNumber },
      update: {},
      create: {
        clubId: CLUB_ID,
        name: e.name,
        serialNumber: e.serialNumber,
        equipmentType: e.equipmentType,
        caliber: e.caliber ?? null,
        brand: e.brand ?? null,
        model: e.model ?? null,
        condition: e.condition ?? EquipmentCondition.GOOD,
        isAvailable: true,
        isActive: true,
        acquisitionDate: new Date(),
      },
    });
    console.log(`[OK] Equipamento: ${eq.name} (${eq.serialNumber})`);
  }

  // ==========================================================
  // SUMMARY
  // ==========================================================
  console.log('\n--- CBT Seed: Populacao concluida com sucesso! ---');
  console.log(`  Usuarios:       3 (1 admin, 1 caixa, 1 associado)`);
  console.log(`  Baias:          ${laneCount}`);
  console.log(`  Produtos:       ${products.length}`);
  console.log(`  Equipamentos:   ${equipments.length}`);
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
