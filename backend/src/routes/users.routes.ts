import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// =====================================================
// HELPER: Fields to select (exclude passwordHash)
// =====================================================

const userSelectFields = {
  id: true,
  email: true,
  cpf: true,
  fullName: true,
  role: true,
  status: true,
  dateOfBirth: true,
  phone: true,
  address: true,
  neighborhood: true,
  city: true,
  state: true,
  zipCode: true,
  photoUrl: true,
  rg: true,
  rgIssuer: true,
  nationality: true,
  naturality: true,
  fatherName: true,
  motherName: true,
  profession: true,
  maritalStatus: true,
  memberNumber: true,
  cr: true,
  crExpiry: true,
  crLevel: true,
  membershipTier: true,
  memberSince: true,
  annuityValidUntil: true,
  clubId: true,
  isActive: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  // Inclui apenas o thumbnail mais recente do FaceProfile ativo (1 por user).
  // Usado pelo frontend para exibir avatar na listagem e no perfil sem precisar
  // de outra chamada. thumbnail ja vem como base64 data URL do Human.js.
  faceProfiles: {
    where: { isActive: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { thumbnail: true },
  },
} as const;

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createUserSchema = z.object({
  email: z.string().email('Email invalido'),
  cpf: z.string().min(11, 'CPF deve ter 11 digitos').max(14, 'CPF invalido'),
  fullName: z.string().min(2, 'Nome completo deve ter no minimo 2 caracteres'),
  memberNumber: z.string().min(1, 'Numero de associado e obrigatorio'),
  password: z.string().min(6, 'Senha deve ter no minimo 6 caracteres'),
  role: z.enum(['ADMIN', 'ASSOCIATE'], { errorMap: () => ({ message: 'Role deve ser ADMIN ou ASSOCIATE' }) }),
  dateOfBirth: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  phone: z.string().optional(),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  cr: z.string().optional(),
  crLevel: z.number().int().min(1).max(3).optional(),
  membershipTier: z.string().optional(),
  rg: z.string().optional(),
  rgIssuer: z.string().optional(),
  nationality: z.string().optional(),
  naturality: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  profession: z.string().optional(),
  maritalStatus: z.string().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email('Email invalido').optional(),
  cpf: z.string().min(11, 'CPF deve ter 11 digitos').max(14, 'CPF invalido').optional(),
  fullName: z.string().min(2, 'Nome completo deve ter no minimo 2 caracteres').optional(),
  memberNumber: z.string().min(1, 'Numero de associado e obrigatorio').optional(),
  dateOfBirth: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  rg: z.string().nullable().optional(),
  rgIssuer: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  naturality: z.string().nullable().optional(),
  fatherName: z.string().nullable().optional(),
  motherName: z.string().nullable().optional(),
  profession: z.string().nullable().optional(),
  maritalStatus: z.string().nullable().optional(),
  cr: z.string().nullable().optional(),
  crExpiry: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  crLevel: z.number().int().min(1).max(3).nullable().optional(),
  membershipTier: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  annuityValidUntil: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  memberSince: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

const changeStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'], {
    errorMap: () => ({ message: 'Status deve ser ACTIVE, INACTIVE ou SUSPENDED' }),
  }),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Nova senha deve ter no minimo 6 caracteres'),
});

const deleteConfirmSchema = z.object({
  confirm: z.literal(true, { errorMap: () => ({ message: 'Confirmacao e obrigatoria (confirm: true)' }) }),
});

// =====================================================
// GET / — List users (ADMIN only)
// =====================================================

router.get('/', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const { role, status, search } = req.query;

    // Build where clause — por padrao, /api/users NAO retorna VISITOR
    // (visitantes vivem em /api/visitors). Filtro aceita ADMIN, ASSOCIATE ou VISITOR
    // explicitamente quando solicitado.
    const where: any = {};

    if (role && (role === 'ADMIN' || role === 'ASSOCIATE' || role === 'VISITOR')) {
      where.role = role;
    } else {
      where.role = { in: ['ADMIN', 'ASSOCIATE'] };
    }

    if (status && (status === 'ACTIVE' || status === 'INACTIVE' || status === 'SUSPENDED')) {
      where.status = status;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { fullName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { cpf: { contains: searchTerm, mode: 'insensitive' } },
        { memberNumber: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelectFields,
        skip,
        take: limit,
        orderBy: { fullName: 'asc' },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: users,
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
    console.error('[USERS] Erro ao listar usuarios:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// =====================================================
// GET /:id — Get user by ID (ADMIN, CASHIER ou self)
// =====================================================

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // ADMIN/CASHIER veem qualquer um. Outras roles só veem o proprio cadastro.
    const role = req.user!.role;
    if (role !== 'ADMIN' && role !== 'CASHIER' && req.user!.id !== id) {
      res.status(403).json({
        success: false,
        error: 'Acesso negado. Permissao insuficiente',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        ...userSelectFields,
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            description: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'Usuario nao encontrado',
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('[USERS] Erro ao buscar usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// =====================================================
// POST / — Create user (ADMIN only)
// =====================================================

router.post('/', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = createUserSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
      return;
    }

    const {
      email,
      cpf,
      fullName,
      memberNumber,
      password,
      role,
      dateOfBirth,
      phone,
      address,
      neighborhood,
      city,
      state,
      zipCode,
      cr,
      crLevel,
      membershipTier,
      rg,
      rgIssuer,
      nationality,
      naturality,
      fatherName,
      motherName,
      profession,
      maritalStatus,
    } = validation.data;

    // Check uniqueness: email, cpf, memberNumber
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { cpf },
          { memberNumber },
        ],
      },
      select: { email: true, cpf: true, memberNumber: true },
    });

    if (existingUser) {
      let field = 'Email';
      if (existingUser.cpf === cpf) field = 'CPF';
      else if (existingUser.memberNumber === memberNumber) field = 'Numero de associado';

      res.status(409).json({
        success: false,
        error: `${field} ja esta em uso`,
      });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        cpf,
        fullName,
        memberNumber,
        passwordHash,
        role,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        phone,
        address,
        neighborhood,
        city,
        state,
        zipCode,
        cr,
        crLevel,
        membershipTier,
        rg,
        rgIssuer,
        nationality,
        naturality,
        fatherName,
        motherName,
        profession,
        maritalStatus,
      },
      select: userSelectFields,
    });

    // Audit log
    await createAuditLog({
      performedById: req.user!.id,
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      newData: { email, cpf, fullName, memberNumber, role },
      description: `Usuario ${fullName} (${email}) criado por ${req.user!.email}`,
      ipAddress: req.ip as string | undefined,
    });

    console.log(`[USERS] Usuario criado: ${email} por ${req.user!.email}`);

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('[USERS] Erro ao criar usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// =====================================================
// PUT /:id — Update user (ADMIN only)
// =====================================================

router.put('/:id', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const validation = updateUserSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
      return;
    }

    const data = validation.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { ...userSelectFields },
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        error: 'Usuario nao encontrado',
      });
      return;
    }

    // Check uniqueness for changed fields
    const uniqueChecks: any[] = [];

    if (data.email && data.email !== existingUser.email) {
      uniqueChecks.push({ email: data.email });
    }
    if (data.cpf && data.cpf !== existingUser.cpf) {
      uniqueChecks.push({ cpf: data.cpf });
    }
    if (data.memberNumber && data.memberNumber !== existingUser.memberNumber) {
      uniqueChecks.push({ memberNumber: data.memberNumber });
    }

    if (uniqueChecks.length > 0) {
      const conflicting = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { OR: uniqueChecks },
          ],
        },
        select: { email: true, cpf: true, memberNumber: true },
      });

      if (conflicting) {
        let field = 'Email';
        if (data.cpf && conflicting.cpf === data.cpf) field = 'CPF';
        else if (data.memberNumber && conflicting.memberNumber === data.memberNumber) field = 'Numero de associado';

        res.status(409).json({
          success: false,
          error: `${field} ja esta em uso`,
        });
        return;
      }
    }

    // Build update data (convert date strings to Date objects)
    const updateData: any = { ...data };

    if (data.dateOfBirth !== undefined) {
      updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    }
    if (data.crExpiry !== undefined) {
      updateData.crExpiry = data.crExpiry ? new Date(data.crExpiry) : null;
    }
    if (data.annuityValidUntil !== undefined) {
      updateData.annuityValidUntil = data.annuityValidUntil ? new Date(data.annuityValidUntil) : null;
    }
    if (data.memberSince !== undefined) {
      updateData.memberSince = data.memberSince ? new Date(data.memberSince) : null;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelectFields,
    });

    // Audit log
    await createAuditLog({
      performedById: req.user!.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      userId: id,
      previousData: existingUser,
      newData: updatedUser,
      description: `Usuario ${existingUser.fullName} atualizado por ${req.user!.email}`,
      ipAddress: req.ip as string | undefined,
    });

    console.log(`[USERS] Usuario atualizado: ${existingUser.email} por ${req.user!.email}`);

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('[USERS] Erro ao atualizar usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// =====================================================
// PATCH /:id/status — Change user status (ADMIN only)
// =====================================================

router.patch('/:id/status', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Cannot change own status
    if (req.user!.id === id) {
      res.status(400).json({
        success: false,
        error: 'Nao e possivel alterar o proprio status',
      });
      return;
    }

    const validation = changeStatusSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
      return;
    }

    const { status } = validation.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, fullName: true, email: true, status: true, isActive: true },
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        error: 'Usuario nao encontrado',
      });
      return;
    }

    const isActive = status === 'ACTIVE';

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status, isActive },
      select: userSelectFields,
    });

    // Audit log
    await createAuditLog({
      performedById: req.user!.id,
      action: 'STATUS_CHANGE',
      entityType: 'User',
      entityId: id,
      userId: id,
      previousData: { status: existingUser.status, isActive: existingUser.isActive },
      newData: { status, isActive },
      description: `Status do usuario ${existingUser.fullName} alterado de ${existingUser.status} para ${status} por ${req.user!.email}`,
      ipAddress: req.ip as string | undefined,
    });

    console.log(`[USERS] Status alterado: ${existingUser.email} -> ${status} por ${req.user!.email}`);

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('[USERS] Erro ao alterar status:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// =====================================================
// PUT /:id/password — Reset user password (ADMIN only)
// =====================================================

router.put('/:id/password', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const validation = resetPasswordSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
      return;
    }

    const { newPassword } = validation.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, fullName: true, email: true },
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        error: 'Usuario nao encontrado',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    // Audit log
    await createAuditLog({
      performedById: req.user!.id,
      action: 'PASSWORD_CHANGE',
      entityType: 'User',
      entityId: id,
      userId: id,
      description: `Senha do usuario ${existingUser.fullName} resetada por ${req.user!.email}`,
      ipAddress: req.ip as string | undefined,
    });

    console.log(`[USERS] Senha resetada: ${existingUser.email} por ${req.user!.email}`);

    res.json({
      success: true,
      data: { message: 'Senha resetada com sucesso' },
    });
  } catch (error) {
    console.error('[USERS] Erro ao resetar senha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// =====================================================
// DELETE /:id — Soft delete user (ADMIN only)
// =====================================================

router.delete('/:id', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Cannot delete self
    if (req.user!.id === id) {
      res.status(400).json({
        success: false,
        error: 'Nao e possivel excluir a propria conta',
      });
      return;
    }

    // Confirmation check
    const confirmValidation = deleteConfirmSchema.safeParse(req.body);

    if (!confirmValidation.success) {
      res.status(400).json({
        success: false,
        error: confirmValidation.error.errors[0].message,
      });
      return;
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, fullName: true, email: true, status: true, isActive: true },
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        error: 'Usuario nao encontrado',
      });
      return;
    }

    // Soft delete: set isActive=false, status=INACTIVE
    const deletedUser = await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        status: 'INACTIVE',
      },
      select: userSelectFields,
    });

    // Audit log
    await createAuditLog({
      performedById: req.user!.id,
      action: 'DELETE',
      entityType: 'User',
      entityId: id,
      userId: id,
      previousData: { status: existingUser.status, isActive: existingUser.isActive },
      newData: { status: 'INACTIVE', isActive: false },
      description: `Usuario ${existingUser.fullName} desativado (soft delete) por ${req.user!.email}`,
      ipAddress: req.ip as string | undefined,
    });

    console.log(`[USERS] Usuario desativado: ${existingUser.email} por ${req.user!.email}`);

    res.json({
      success: true,
      data: deletedUser,
    });
  } catch (error) {
    console.error('[USERS] Erro ao excluir usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// =====================================================
// POST /:id/attachments — Adiciona anexo ao associado (ADMIN only)
// =====================================================

const attachmentCreateSchema = z.object({
  fileName: z.string().min(1).max(500),
  // base64 data URL pode ser longo (PDF/imagem ate 10MB). Sem max — body parser
  // ja limita em 10mb (ver index.ts).
  fileUrl: z.string().min(1),
  fileType: z.string().min(1).max(120),
  fileSize: z.number().int().nonnegative().optional(),
  description: z.string().max(500).optional(),
});

router.post('/:id/attachments', requireRole('ADMIN', 'CASHIER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.id as string;
    const validation = attachmentCreateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: validation.error.errors[0].message });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true },
    });
    if (!targetUser) {
      res.status(404).json({ success: false, error: 'Usuario nao encontrado' });
      return;
    }

    const data = validation.data;
    const attachment = await prisma.userAttachment.create({
      data: {
        userId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize ?? null,
        description: data.description ?? null,
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        description: true,
        uploadedAt: true,
      },
    });

    await createAuditLog({
      performedById: req.user!.id,
      action: 'CREATE',
      entityType: 'UserAttachment',
      entityId: attachment.id,
      userId,
      newData: { fileName: data.fileName, fileType: data.fileType, fileSize: data.fileSize },
      description: `Anexo "${data.fileName}" adicionado ao associado ${targetUser.fullName}`,
      ipAddress: req.ip as string | undefined,
    });

    // Retorna o attachment SEM o fileUrl (base64) para resposta leve.
    // Frontend ja tem o conteudo localmente; refetch traz a lista atualizada.
    res.status(201).json({ success: true, data: attachment });
  } catch (error) {
    console.error('[USERS] Erro ao criar anexo:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// =====================================================
// DELETE /:id/attachments/:attachmentId — Remove anexo (ADMIN only)
// =====================================================

router.delete(
  '/:id/attachments/:attachmentId',
  requireRole('ADMIN', 'CASHIER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.id as string;
      const attachmentId = req.params.attachmentId as string;

      const attachment = await prisma.userAttachment.findUnique({
        where: { id: attachmentId },
        select: { id: true, userId: true, fileName: true },
      });
      if (!attachment || attachment.userId !== userId) {
        res.status(404).json({ success: false, error: 'Anexo nao encontrado' });
        return;
      }

      await prisma.userAttachment.delete({ where: { id: attachmentId } });

      await createAuditLog({
        performedById: req.user!.id,
        action: 'DELETE',
        entityType: 'UserAttachment',
        entityId: attachmentId,
        userId,
        previousData: { fileName: attachment.fileName },
        description: `Anexo "${attachment.fileName}" removido`,
        ipAddress: req.ip as string | undefined,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[USERS] Erro ao remover anexo:', error);
      res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  },
);

export default router;
