import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();

// All routes require auth + ADMIN
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// =====================================================
// GET /api/loans — List loans
// =====================================================
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Status: 'OVERDUE' e derivado (sem cron) — ACTIVE com expectedReturn vencido
    const statusParam = req.query.status as string | undefined;
    if (statusParam === 'OVERDUE') {
      where.status = 'ACTIVE';
      where.expectedReturn = { lt: new Date(), not: null };
    } else if (statusParam) {
      where.status = statusParam;
    }

    if (req.query.memberId) {
      where.memberId = req.query.memberId as string;
    }

    if (req.query.equipmentId) {
      where.equipmentId = req.query.equipmentId as string;
    }

    // Filtros novos: tipo de equipamento, periodo, busca textual
    if (req.query.equipmentType) {
      where.equipment = { equipmentType: req.query.equipmentType as string };
    }

    if (req.query.startDate || req.query.endDate) {
      where.loanDate = {};
      if (req.query.startDate) where.loanDate.gte = new Date(req.query.startDate as string);
      if (req.query.endDate) where.loanDate.lte = new Date(req.query.endDate as string);
    }

    const q = (req.query.q as string | undefined)?.trim();
    if (q) {
      where.OR = [
        { equipment: { name: { contains: q, mode: 'insensitive' } } },
        { equipment: { serialNumber: { contains: q, mode: 'insensitive' } } },
        { member: { fullName: { contains: q, mode: 'insensitive' } } },
        { member: { memberNumber: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [loans, total] = await Promise.all([
      prisma.equipmentLoan.findMany({
        where,
        orderBy: { loanDate: 'desc' },
        skip,
        take: limit,
        include: {
          equipment: {
            select: { id: true, name: true, serialNumber: true, equipmentType: true },
          },
          member: {
            select: { id: true, fullName: true, memberNumber: true, role: true },
          },
          issuedBy: {
            select: { id: true, fullName: true },
          },
          returnedBy: {
            select: { id: true, fullName: true },
          },
          transferredFrom: {
            select: { id: true, member: { select: { id: true, fullName: true } } },
          },
        },
      }),
      prisma.equipmentLoan.count({ where }),
    ]);

    res.json({
      success: true,
      data: loans,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao listar emprestimos:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar emprestimos' });
  }
});

// =====================================================
// GET /api/loans/active — Currently active loans only
// =====================================================
router.get('/active', async (req: Request, res: Response): Promise<void> => {
  try {
    const loans = await prisma.equipmentLoan.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { loanDate: 'desc' },
      include: {
        equipment: {
          select: { id: true, name: true, serialNumber: true, equipmentType: true },
        },
        member: {
          select: { id: true, fullName: true, memberNumber: true, role: true },
        },
        issuedBy: {
          select: { id: true, fullName: true },
        },
        transferredFrom: {
          select: { id: true, member: { select: { id: true, fullName: true } } },
        },
      },
    });

    res.json({ success: true, data: loans });
  } catch (error) {
    console.error('Erro ao listar emprestimos ativos:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar emprestimos ativos' });
  }
});

// =====================================================
// GET /api/loans/:id — Loan detail
// =====================================================
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const loan = await prisma.equipmentLoan.findUnique({
      where: { id: req.params.id },
      include: {
        equipment: true,
        member: {
          select: { id: true, fullName: true, memberNumber: true, phone: true, role: true },
        },
        issuedBy: {
          select: { id: true, fullName: true },
        },
        returnedBy: {
          select: { id: true, fullName: true },
        },
        transferredFrom: {
          select: { id: true, member: { select: { id: true, fullName: true } } },
        },
        transferredTo: {
          select: { id: true, member: { select: { id: true, fullName: true } } },
        },
      },
    });

    if (!loan) {
      res.status(404).json({ success: false, error: 'Emprestimo nao encontrado' });
      return;
    }

    res.json({ success: true, data: loan });
  } catch (error) {
    console.error('Erro ao buscar emprestimo:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar emprestimo' });
  }
});

// =====================================================
// POST /api/loans — Issue equipment loan
// =====================================================
const createLoanSchema = z.object({
  equipmentId: z.string().uuid('ID do equipamento invalido'),
  memberId: z.string().uuid('ID do membro invalido'),
  expectedReturn: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createLoanSchema.parse(req.body);

    // Validate equipment exists, is available, and is active
    const equipment = await prisma.equipment.findUnique({
      where: { id: data.equipmentId },
    });

    if (!equipment) {
      res.status(404).json({ success: false, error: 'Equipamento nao encontrado' });
      return;
    }

    if (!equipment.isActive) {
      res.status(400).json({ success: false, error: 'Equipamento esta inativo' });
      return;
    }

    if (!equipment.isAvailable) {
      res.status(400).json({ success: false, error: 'Equipamento nao esta disponivel' });
      return;
    }

    // Create loan atomically
    const loan = await prisma.$transaction(async (tx) => {
      // Set equipment as unavailable
      await tx.equipment.update({
        where: { id: data.equipmentId },
        data: { isAvailable: false },
      });

      // Create the loan record
      const newLoan = await tx.equipmentLoan.create({
        data: {
          equipmentId: data.equipmentId,
          memberId: data.memberId,
          issuedById: req.user!.id,
          expectedReturn: data.expectedReturn ? new Date(data.expectedReturn) : null,
          notes: data.notes || null,
          status: 'ACTIVE',
          conditionAtLoan: equipment.condition,
        },
        include: {
          equipment: {
            select: { id: true, name: true, serialNumber: true },
          },
          member: {
            select: { id: true, fullName: true },
          },
          issuedBy: {
            select: { id: true, fullName: true },
          },
        },
      });

      return newLoan;
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'LOAN_ISSUED',
      entityType: 'Loan',
      entityId: loan.id,
      userId: data.memberId,
      newData: {
        equipmentId: data.equipmentId,
        equipmentName: equipment.name,
        expectedReturn: data.expectedReturn ?? null,
      },
      description: `Emprestimo de ${equipment.name} emitido`,
      ipAddress: req.ip as string | undefined,
    });

    res.status(201).json({ success: true, data: loan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao criar emprestimo:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar emprestimo' });
  }
});

// =====================================================
// PATCH /api/loans/:id/return — Return equipment
// =====================================================
const returnLoanSchema = z.object({
  conditionAtReturn: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_REPAIR', 'DECOMMISSIONED']),
  notes: z.string().optional().nullable(),
});

router.patch('/:id/return', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = returnLoanSchema.parse(req.body);

    const existing = await prisma.equipmentLoan.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Emprestimo nao encontrado' });
      return;
    }

    if (existing.status !== 'ACTIVE') {
      res.status(400).json({ success: false, error: 'Emprestimo nao esta ativo' });
      return;
    }

    // Return equipment atomically
    const loan = await prisma.$transaction(async (tx) => {
      // Update loan record
      const updatedLoan = await tx.equipmentLoan.update({
        where: { id: req.params.id },
        data: {
          actualReturn: new Date(),
          status: 'RETURNED',
          returnedById: req.user!.id,
          conditionAtReturn: data.conditionAtReturn,
          notes: data.notes !== undefined ? data.notes : existing.notes,
        },
        include: {
          equipment: {
            select: { id: true, name: true, serialNumber: true },
          },
          member: {
            select: { id: true, fullName: true },
          },
          issuedBy: {
            select: { id: true, fullName: true },
          },
          returnedBy: {
            select: { id: true, fullName: true },
          },
        },
      });

      // Set equipment as available again and update condition
      await tx.equipment.update({
        where: { id: existing.equipmentId },
        data: {
          isAvailable: true,
          condition: data.conditionAtReturn,
        },
      });

      return updatedLoan;
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'LOAN_RETURNED',
      entityType: 'Loan',
      entityId: loan.id,
      userId: existing.memberId,
      previousData: { conditionAtLoan: existing.conditionAtLoan },
      newData: { conditionAtReturn: data.conditionAtReturn },
      description: `Emprestimo ${loan.id} devolvido em condicao ${data.conditionAtReturn}`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({ success: true, data: loan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao devolver equipamento:', error);
    res.status(500).json({ success: false, error: 'Erro ao devolver equipamento' });
  }
});

// =====================================================
// POST /api/loans/:id/transfer — Transfer active loan to another member
//
// Atomicamente: encerra o loan atual com status=TRANSFERRED + cria novo loan
// ACTIVE para outro membro com transferredFromLoanId apontando para o anterior.
// Equipment.isAvailable continua false (segue em uso, so trocou de mao).
// =====================================================
const transferLoanSchema = z.object({
  newMemberId: z.string().uuid('ID do novo membro invalido'),
  conditionAtTransfer: z
    .enum(['EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_REPAIR', 'DECOMMISSIONED'])
    .optional(),
  notes: z.string().optional().nullable(),
});

router.post('/:id/transfer', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = transferLoanSchema.parse(req.body);

    const existing = await prisma.equipmentLoan.findUnique({
      where: { id: req.params.id },
      include: {
        equipment: { select: { id: true, name: true } },
        member: { select: { id: true, fullName: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Emprestimo nao encontrado' });
      return;
    }

    if (existing.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        error: 'Emprestimo nao esta ativo, nao pode ser transferido',
      });
      return;
    }

    if (existing.memberId === data.newMemberId) {
      res
        .status(400)
        .json({ success: false, error: 'Selecione um membro diferente do atual' });
      return;
    }

    const newMember = await prisma.user.findUnique({
      where: { id: data.newMemberId },
      select: { id: true, fullName: true, isActive: true, role: true },
    });

    if (!newMember || !newMember.isActive) {
      res.status(400).json({
        success: false,
        error: 'Novo membro nao encontrado ou inativo',
      });
      return;
    }

    const conditionToUse = data.conditionAtTransfer ?? existing.conditionAtLoan;

    const result = await prisma.$transaction(async (tx) => {
      // 1) Encerra o loan atual com status=TRANSFERRED
      const closedLoan = await tx.equipmentLoan.update({
        where: { id: existing.id },
        data: {
          status: 'TRANSFERRED',
          actualReturn: new Date(),
          returnedById: req.user!.id,
          conditionAtReturn: conditionToUse ?? undefined,
        },
      });

      // 2) Cria novo loan ACTIVE para o novo membro
      const newLoan = await tx.equipmentLoan.create({
        data: {
          equipmentId: existing.equipmentId,
          memberId: data.newMemberId,
          issuedById: req.user!.id,
          status: 'ACTIVE',
          conditionAtLoan: conditionToUse ?? undefined,
          notes: data.notes || null,
          transferredFromLoanId: existing.id,
        },
        include: {
          equipment: {
            select: { id: true, name: true, serialNumber: true, equipmentType: true },
          },
          member: {
            select: { id: true, fullName: true, memberNumber: true, role: true },
          },
          issuedBy: {
            select: { id: true, fullName: true },
          },
          transferredFrom: {
            select: { id: true, member: { select: { id: true, fullName: true } } },
          },
        },
      });

      return { previous: closedLoan, current: newLoan };
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'LOAN_TRANSFERRED',
      entityType: 'Loan',
      entityId: result.current.id,
      userId: data.newMemberId,
      previousData: {
        fromMemberId: existing.memberId,
        fromMemberName: existing.member.fullName,
        fromLoanId: existing.id,
      },
      newData: {
        toMemberId: data.newMemberId,
        toMemberName: newMember.fullName,
        toLoanId: result.current.id,
        conditionAtTransfer: conditionToUse ?? null,
      },
      description: `Emprestimo de ${existing.equipment.name} transferido de ${existing.member.fullName} para ${newMember.fullName}`,
      ipAddress: req.ip as string | undefined,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Dados invalidos', details: error.errors });
      return;
    }
    console.error('Erro ao transferir emprestimo:', error);
    res.status(500).json({ success: false, error: 'Erro ao transferir emprestimo' });
  }
});

export default router;
