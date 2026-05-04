import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// =====================================================
// HELPER: Visitor select fields (sem passwordHash)
// =====================================================

const visitorSelectFields = {
  id: true,
  email: true,
  cpf: true,
  fullName: true,
  role: true,
  status: true,
  dateOfBirth: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  zipCode: true,
  photoUrl: true,
  memberNumber: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createVisitorSchema = z.object({
  fullName: z.string().min(2, 'Nome completo deve ter no minimo 2 caracteres'),
  cpf: z.string().min(11, 'CPF deve ter 11 digitos').max(14, 'CPF invalido'),
  phone: z.string().min(1, 'Telefone e obrigatorio'),
  email: z.string().email('Email invalido').optional().nullable(),
  dateOfBirth: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

const updateVisitorSchema = z.object({
  fullName: z.string().min(2).optional(),
  cpf: z.string().min(11).max(14).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  dateOfBirth: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
});

const convertVisitorSchema = z.object({
  // Campos obrigatorios para virar ASSOCIATE
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Senha deve ter no minimo 6 caracteres'),
  memberNumber: z.string().min(1, 'Numero de associado e obrigatorio'),
  // Anuidade obrigatoria na conversao
  annuityAmount: z.number().min(0.01, 'Valor da anuidade deve ser positivo'),
  annuityPaymentMethod: z.string().optional().nullable(),
  annuityReferenceYear: z.number().int().min(2000).max(2100),
  annuityNotes: z.string().optional().nullable(),
  // Campos opcionais que o admin pode preencher na conversao
  cr: z.string().optional().nullable(),
  crLevel: z.number().int().min(1).max(3).optional().nullable(),
  membershipTier: z.string().optional().nullable(),
});

const deleteConfirmSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Confirmacao e obrigatoria (confirm: true)' }),
  }),
});

// =====================================================
// GET / — Lista visitantes
// =====================================================

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const { search, status } = req.query;

    const where: any = { role: 'VISITOR' };

    if (status && (status === 'ACTIVE' || status === 'INACTIVE' || status === 'SUSPENDED')) {
      where.status = status;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { cpf: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [visitors, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: visitorSelectFields,
        skip,
        take: limit,
        orderBy: { fullName: 'asc' },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: visitors,
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
    console.error('[VISITORS] Erro ao listar:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// =====================================================
// GET /:id
// =====================================================

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const visitor = await prisma.user.findFirst({
      where: { id, role: 'VISITOR' },
      select: visitorSelectFields,
    });

    if (!visitor) {
      res.status(404).json({ success: false, error: 'Visitante nao encontrado' });
      return;
    }

    res.json({ success: true, data: visitor });
  } catch (error) {
    console.error('[VISITORS] Erro ao buscar:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// =====================================================
// POST / — Cadastra novo visitante
// =====================================================

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = createVisitorSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: validation.error.errors[0].message });
      return;
    }

    const data = validation.data;

    // Unicidade: CPF nunca pode duplicar; email duplica se preenchido
    const conflicts: any[] = [{ cpf: data.cpf }];
    if (data.email) conflicts.push({ email: data.email });

    const existing = await prisma.user.findFirst({
      where: { OR: conflicts },
      select: { id: true, cpf: true, email: true, role: true, fullName: true },
    });

    if (existing) {
      const field = existing.cpf === data.cpf ? 'CPF' : 'Email';
      const tag =
        existing.role === 'ASSOCIATE'
          ? 'associado'
          : existing.role === 'ADMIN'
            ? 'administrador'
            : 'visitante';
      res.status(409).json({
        success: false,
        error: `${field} ja esta em uso por um ${tag}`,
      });
      return;
    }

    const visitor = await prisma.user.create({
      data: {
        role: 'VISITOR',
        status: 'ACTIVE',
        isActive: true,
        fullName: data.fullName.trim(),
        cpf: data.cpf,
        phone: data.phone,
        email: data.email || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zipCode || null,
        photoUrl: data.photoUrl || null,
      },
      select: visitorSelectFields,
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'CREATE',
      entityType: 'Visitor',
      entityId: visitor.id,
      userId: visitor.id,
      newData: { fullName: visitor.fullName, cpf: visitor.cpf, phone: visitor.phone },
      description: `Visitante ${visitor.fullName} cadastrado por ${req.user!.email}`,
      ipAddress: req.ip as string | undefined,
    });

    res.status(201).json({ success: true, data: visitor });
  } catch (error) {
    console.error('[VISITORS] Erro ao criar:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// =====================================================
// PUT /:id
// =====================================================

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const validation = updateVisitorSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: validation.error.errors[0].message });
      return;
    }

    const data = validation.data;

    const existing = await prisma.user.findFirst({
      where: { id, role: 'VISITOR' },
      select: visitorSelectFields,
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Visitante nao encontrado' });
      return;
    }

    // Unicidade para CPF/email se mudaram
    const checks: any[] = [];
    if (data.cpf && data.cpf !== existing.cpf) checks.push({ cpf: data.cpf });
    if (data.email && data.email !== existing.email) checks.push({ email: data.email });

    if (checks.length > 0) {
      const conflicting = await prisma.user.findFirst({
        where: { AND: [{ id: { not: id } }, { OR: checks }] },
        select: { cpf: true, email: true },
      });

      if (conflicting) {
        const field = data.cpf && conflicting.cpf === data.cpf ? 'CPF' : 'Email';
        res.status(409).json({ success: false, error: `${field} ja esta em uso` });
        return;
      }
    }

    const updateData: any = { ...data };
    if (data.dateOfBirth !== undefined) {
      updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: visitorSelectFields,
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'UPDATE',
      entityType: 'Visitor',
      entityId: id,
      userId: id,
      previousData: existing,
      newData: updated,
      description: `Visitante ${existing.fullName} atualizado por ${req.user!.email}`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[VISITORS] Erro ao atualizar:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// =====================================================
// DELETE /:id — Soft delete
// =====================================================

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const confirmValidation = deleteConfirmSchema.safeParse(req.body);
    if (!confirmValidation.success) {
      res.status(400).json({ success: false, error: confirmValidation.error.errors[0].message });
      return;
    }

    const existing = await prisma.user.findFirst({
      where: { id, role: 'VISITOR' },
      select: { id: true, fullName: true, status: true, isActive: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Visitante nao encontrado' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: false, status: 'INACTIVE' },
      select: visitorSelectFields,
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'DELETE',
      entityType: 'Visitor',
      entityId: id,
      userId: id,
      previousData: { status: existing.status, isActive: existing.isActive },
      newData: { status: 'INACTIVE', isActive: false },
      description: `Visitante ${existing.fullName} desativado por ${req.user!.email}`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[VISITORS] Erro ao excluir:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// =====================================================
// POST /:id/convert — Converte visitante em ASSOCIATE com anuidade
//
// Cria 4 efeitos de forma atomica:
//   1. User update -> role=ASSOCIATE, email, passwordHash, memberNumber, etc.
//   2. AnnuityPayment para o ano de referencia
//   3. User.annuityValidUntil atualizado
//   4. Transaction(ANNUITY_PAYMENT, COMPLETED) espelhada (igual /api/annuities POST)
// =====================================================

router.post('/:id/convert', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const validation = convertVisitorSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: validation.error.errors[0].message });
      return;
    }

    const data = validation.data;

    const visitor = await prisma.user.findFirst({
      where: { id, role: 'VISITOR' },
    });

    if (!visitor) {
      res.status(404).json({ success: false, error: 'Visitante nao encontrado' });
      return;
    }

    if (!visitor.isActive) {
      res.status(400).json({
        success: false,
        error: 'Visitante esta inativo. Reative-o antes de converter.',
      });
      return;
    }

    // Unicidade de email + memberNumber (CPF ja e unico no proprio User)
    const conflicting = await prisma.user.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          { OR: [{ email: data.email }, { memberNumber: data.memberNumber }] },
        ],
      },
      select: { email: true, memberNumber: true },
    });

    if (conflicting) {
      const field =
        conflicting.memberNumber === data.memberNumber ? 'Numero de associado' : 'Email';
      res.status(409).json({ success: false, error: `${field} ja esta em uso` });
      return;
    }

    // Calcula validFrom/validUntil (mesma regra de annuities.routes)
    const now = new Date();
    let validFrom: Date;
    if (visitor.annuityValidUntil && visitor.annuityValidUntil > now) {
      validFrom = new Date(visitor.annuityValidUntil);
      validFrom.setDate(validFrom.getDate() + 1);
    } else {
      validFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    const validUntil = new Date(validFrom);
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    const passwordHash = await bcrypt.hash(data.password, 10);
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

    const result = await prisma.$transaction(async (tx) => {
      // 1) Promove visitante para ASSOCIATE
      const promoted = await tx.user.update({
        where: { id },
        data: {
          role: 'ASSOCIATE',
          email: data.email,
          passwordHash,
          memberNumber: data.memberNumber,
          cr: data.cr ?? null,
          crLevel: data.crLevel ?? null,
          membershipTier: data.membershipTier ?? 'STANDARD',
          memberSince: visitor.memberSince ?? new Date(),
          annuityValidUntil: validUntil,
        },
        select: {
          id: true,
          email: true,
          cpf: true,
          fullName: true,
          role: true,
          memberNumber: true,
          annuityValidUntil: true,
        },
      });

      // 2) Cria AnnuityPayment
      const payment = await tx.annuityPayment.create({
        data: {
          memberId: id,
          amount: data.annuityAmount,
          paymentMethod: data.annuityPaymentMethod || null,
          referenceYear: data.annuityReferenceYear,
          validFrom,
          validUntil,
          notes: data.annuityNotes || null,
          registeredById: req.user!.id,
        },
      });

      // 3) Cria Transaction COMPLETED espelhada (mesma logica de annuities.routes)
      const txDescription = `Anuidade ${data.annuityReferenceYear} (conversao de visitante)`;
      const txNotes =
        data.annuityNotes || `Vigencia ${fmtDate(validFrom)} a ${fmtDate(validUntil)}`;
      const transaction = await tx.transaction.create({
        data: {
          memberId: id,
          registeredById: req.user!.id,
          type: 'ANNUITY_PAYMENT',
          status: 'COMPLETED',
          totalAmount: data.annuityAmount,
          paymentMethod: data.annuityPaymentMethod || null,
          notes: txNotes,
          transactionDate: new Date(),
          items: {
            create: [
              {
                description: txDescription,
                quantity: 1,
                unitPrice: data.annuityAmount,
                subtotal: data.annuityAmount,
              },
            ],
          },
        },
      });

      return { user: promoted, payment, transaction };
    });

    // Audit logs (3): conversao + recebimento + lancamento
    await createAuditLog({
      performedById: req.user!.id,
      action: 'STATUS_CHANGE',
      entityType: 'User',
      entityId: id,
      userId: id,
      previousData: { role: 'VISITOR' },
      newData: {
        role: 'ASSOCIATE',
        memberNumber: data.memberNumber,
        email: data.email,
      },
      description: `Visitante ${visitor.fullName} convertido em ASSOCIATE por ${req.user!.email}`,
      ipAddress: req.ip as string | undefined,
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'PAYMENT_RECEIVED',
      entityType: 'Annuity',
      entityId: result.payment.id,
      userId: id,
      newData: {
        amount: data.annuityAmount,
        referenceYear: data.annuityReferenceYear,
        validFrom,
        validUntil,
        paymentMethod: data.annuityPaymentMethod ?? null,
        transactionId: result.transaction.id,
      },
      description: `Anuidade ${data.annuityReferenceYear} paga (R$ ${data.annuityAmount.toFixed(2)}) na conversao do visitante`,
      ipAddress: req.ip as string | undefined,
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'CREATE',
      entityType: 'Transaction',
      entityId: result.transaction.id,
      userId: id,
      newData: {
        type: 'ANNUITY_PAYMENT',
        totalAmount: data.annuityAmount,
        paymentMethod: data.annuityPaymentMethod ?? null,
        annuityPaymentId: result.payment.id,
      },
      description: `Lancamento de anuidade ${data.annuityReferenceYear} (R$ ${data.annuityAmount.toFixed(2)})`,
      ipAddress: req.ip as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        annuityPayment: result.payment,
        transaction: result.transaction,
      },
    });
  } catch (error) {
    console.error('[VISITORS] Erro ao converter:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

export default router;
