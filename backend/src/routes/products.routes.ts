import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// All routes require authentication + ADMIN role
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createProductSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  sku: z.string().optional(),
  category: z.enum(
    ['AMMUNITION', 'TARGET', 'ACCESSORY', 'SAFETY_EQUIPMENT', 'RENTAL_ITEM', 'COURSE', 'OTHER'],
    { errorMap: () => ({ message: 'Categoria invalida' }) },
  ),
  caliber: z.string().optional(),
  caliberCategory: z.enum(['RIMFIRE', 'CENTERFIRE', 'SHOTGUN', 'RIFLE']).optional(),
  unitPrice: z.number().min(0, 'Preco unitario deve ser no minimo 0'),
  costPrice: z.number().min(0).optional(),
  unit: z.string().optional(),
  isForSale: z.boolean().optional(),
  isForLoan: z.boolean().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  iconKey: z.string().max(60).nullable().optional(),
  iconColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use #RRGGBB)').nullable().optional(),
  metadata: z.any().optional(),
  // Initial stock fields
  initialStock: z.number().int().min(0).optional(),
  minimumStock: z.number().int().min(0).optional(),
  maximumStock: z.number().int().min(0).optional(),
  location: z.string().optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  description: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  category: z.enum(
    ['AMMUNITION', 'TARGET', 'ACCESSORY', 'SAFETY_EQUIPMENT', 'RENTAL_ITEM', 'COURSE', 'OTHER'],
  ).optional(),
  caliber: z.string().nullable().optional(),
  caliberCategory: z.enum(['RIMFIRE', 'CENTERFIRE', 'SHOTGUN', 'RIFLE']).nullable().optional(),
  unitPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).nullable().optional(),
  unit: z.string().optional(),
  isForSale: z.boolean().optional(),
  isForLoan: z.boolean().optional(),
  imageUrl: z.string().url().nullable().optional().or(z.literal('')),
  iconKey: z.string().max(60).nullable().optional(),
  iconColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use #RRGGBB)').nullable().optional(),
  metadata: z.any().optional(),
});

// =====================================================
// GET / — List products
// =====================================================

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const { category, search, isActive } = req.query;

    const where: any = {};

    if (category && typeof category === 'string') {
      where.category = category;
    }

    if (isActive !== undefined && typeof isActive === 'string') {
      where.isActive = isActive === 'true';
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { sku: { contains: searchTerm, mode: 'insensitive' } },
        { caliber: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          stockItems: {
            select: {
              id: true,
              currentStock: true,
              minimumStock: true,
              maximumStock: true,
              location: true,
              lastRestocked: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('[PRODUCTS] Erro ao listar produtos:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar produtos' });
  }
});

// =====================================================
// GET /:id — Get product by ID
// =====================================================

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        stockItems: {
          select: {
            id: true,
            currentStock: true,
            minimumStock: true,
            maximumStock: true,
            location: true,
            lastRestocked: true,
          },
        },
      },
    });

    if (!product) {
      res.status(404).json({ success: false, error: 'Produto nao encontrado' });
      return;
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('[PRODUCTS] Erro ao buscar produto:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar produto' });
  }
});

// =====================================================
// POST / — Create product (auto-create StockItem)
// =====================================================

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = createProductSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
        details: validation.error.errors,
      });
      return;
    }

    const { initialStock, minimumStock, maximumStock, location, ...productData } = validation.data;

    // Check SKU uniqueness if provided
    if (productData.sku) {
      const existingSku = await prisma.product.findUnique({
        where: { sku: productData.sku },
        select: { id: true },
      });

      if (existingSku) {
        res.status(409).json({ success: false, error: 'SKU ja esta em uso' });
        return;
      }
    }

    // Create product and stock item in a transaction
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...productData,
          imageUrl: productData.imageUrl === '' ? null : productData.imageUrl || null,
        } as any,
      });

      // Auto-create StockItem
      await tx.stockItem.create({
        data: {
          productId: created.id,
          currentStock: initialStock || 0,
          minimumStock: minimumStock || 0,
          maximumStock: maximumStock || null,
          location: location || null,
        },
      });

      return tx.product.findUnique({
        where: { id: created.id },
        include: {
          stockItems: {
            select: {
              id: true,
              currentStock: true,
              minimumStock: true,
              maximumStock: true,
              location: true,
              lastRestocked: true,
            },
          },
        },
      });
    });

    console.log(`[PRODUCTS] Produto criado: ${productData.name} por ${req.user!.email}`);

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('[PRODUCTS] Erro ao criar produto:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar produto' });
  }
});

// =====================================================
// PUT /:id — Update product
// =====================================================

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Produto nao encontrado' });
      return;
    }

    const validation = updateProductSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
        details: validation.error.errors,
      });
      return;
    }

    const data = validation.data;

    // Check SKU uniqueness if changed
    if (data.sku && data.sku !== existing.sku) {
      const existingSku = await prisma.product.findFirst({
        where: { sku: data.sku, id: { not: id } },
        select: { id: true },
      });

      if (existingSku) {
        res.status(409).json({ success: false, error: 'SKU ja esta em uso' });
        return;
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        imageUrl: data.imageUrl === '' ? null : data.imageUrl,
      },
      include: {
        stockItems: {
          select: {
            id: true,
            currentStock: true,
            minimumStock: true,
            maximumStock: true,
            location: true,
            lastRestocked: true,
          },
        },
      },
    });

    console.log(`[PRODUCTS] Produto ${id} atualizado por ${req.user!.email}`);

    res.json({ success: true, data: product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('[PRODUCTS] Erro ao atualizar produto:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar produto' });
  }
});

// =====================================================
// PATCH /:id/status — Toggle isActive
// =====================================================

router.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Produto nao encontrado' });
      return;
    }

    const product = await prisma.product.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: {
        stockItems: {
          select: {
            id: true,
            currentStock: true,
            minimumStock: true,
            maximumStock: true,
            location: true,
            lastRestocked: true,
          },
        },
      },
    });

    console.log(`[PRODUCTS] Produto ${existing.name} ${product.isActive ? 'ativado' : 'desativado'} por ${req.user!.email}`);

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('[PRODUCTS] Erro ao alterar status do produto:', error);
    res.status(500).json({ success: false, error: 'Erro ao alterar status do produto' });
  }
});

// =====================================================
// DELETE /:id — Soft delete (isActive=false)
// =====================================================

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Produto nao encontrado' });
      return;
    }

    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: {
        stockItems: {
          select: {
            id: true,
            currentStock: true,
            minimumStock: true,
            maximumStock: true,
            location: true,
            lastRestocked: true,
          },
        },
      },
    });

    console.log(`[PRODUCTS] Produto ${existing.name} desativado (soft delete) por ${req.user!.email}`);

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('[PRODUCTS] Erro ao excluir produto:', error);
    res.status(500).json({ success: false, error: 'Erro ao excluir produto' });
  }
});

export default router;
