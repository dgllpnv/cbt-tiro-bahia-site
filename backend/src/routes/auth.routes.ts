import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const loginSchema = z.object({
  email: z.string().min(1, 'Email ou CPF e obrigatorio'),
  password: z.string().min(1, 'Senha e obrigatoria'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual e obrigatoria'),
  newPassword: z.string().min(6, 'Nova senha deve ter no minimo 6 caracteres'),
});

// Fluxo de "primeiro acesso" — usuario logou com CPF e o flag mustChange
// Password=true forca esta tela. Aceita duas acoes:
//   - 'change': define nova senha (>= 6 chars)
//   - 'keep':   confirma manter a atual (CPF) e so flipa o flag
const finalizeFirstAccessSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('change'),
    newPassword: z.string().min(6, 'Nova senha deve ter no minimo 6 caracteres'),
  }),
  z.object({ action: z.literal('keep') }),
]);

// Helper: le mustChangePassword via raw SQL ate o Prisma client ser regenerado.
// Retorna false se o user nao for encontrado (defensivo — nao deve acontecer).
async function readMustChangePassword(userId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ mustChangePassword: boolean }>>`
    SELECT "mustChangePassword" FROM "User" WHERE id = ${userId} LIMIT 1
  `;
  return rows[0]?.mustChangePassword ?? false;
}

// =====================================================
// POST /login
// =====================================================

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
      return;
    }

    const { email, password } = validation.data;

    // Find user by email OR cpf
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { cpf: email },
        ],
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Credenciais invalidas',
      });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        error: 'Conta desativada. Entre em contato com a administracao',
      });
      return;
    }

    // Visitantes nao tem acesso ao portal — apenas admin/associate logam.
    // passwordHash null tambem indica conta sem credenciais (visitantes).
    if (user.role === 'VISITOR' || !user.passwordHash) {
      res.status(401).json({
        success: false,
        error: 'Credenciais invalidas',
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Credenciais invalidas',
      });
      return;
    }

    // Bloqueio por anuidade: associado com anuidade vencida OU sem registro
    // nao acessa o sistema (decisao do clube). Admin e Caixa nunca sao bloqueados.
    // Comparacao por inicio do dia — nao bloqueia no ultimo dia de validade.
    if (user.role === 'ASSOCIATE') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const annuityExpired = !user.annuityValidUntil || user.annuityValidUntil < today;
      if (annuityExpired) {
        res.status(403).json({
          success: false,
          error:
            'Anuidade vencida ou nao registrada. Entre em contato com o clube para renovar sua anuidade e liberar o acesso ao sistema.',
        });
        return;
      }
    }

    // Generate JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[AUTH] JWT_SECRET nao configurado');
      res.status(500).json({
        success: false,
        error: 'Erro interno de configuracao',
      });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        clubId: user.clubId,
      },
      secret,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string & jwt.SignOptions['expiresIn'] },
    );

    console.log(`[AUTH] Login bem-sucedido: ${user.email} (${user.role})`);

    await createAuditLog({
      performedById: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      description: `Login: ${user.email}`,
      ipAddress: req.ip as string | undefined,
    });

    const mustChangePassword = await readMustChangePassword(user.id);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          cpf: user.cpf,
          fullName: user.fullName,
          role: user.role,
          memberNumber: user.memberNumber,
          photoUrl: user.photoUrl,
          annuityValidUntil: user.annuityValidUntil,
          crLevel: user.crLevel,
          mustChangePassword,
        },
      },
    });
  } catch (error) {
    console.error('[AUTH] Erro no login:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// =====================================================
// POST /logout
// =====================================================

router.post('/logout', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`[AUTH] Logout: ${req.user?.email}`);

    if (req.user) {
      await createAuditLog({
        performedById: req.user.id,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: req.user.id,
        userId: req.user.id,
        description: `Logout: ${req.user.email}`,
        ipAddress: req.ip as string | undefined,
      });
    }

    res.json({
      success: true,
      data: { message: 'Logout realizado com sucesso' },
    });
  } catch (error) {
    console.error('[AUTH] Erro no logout:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// =====================================================
// GET /me
// =====================================================

router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
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
        cr: true,
        crExpiry: true,
        crLevel: true,
        membershipTier: true,
        memberSince: true,
        annuityValidUntil: true,
        clubId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'Usuario nao encontrado',
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        error: 'Conta desativada',
      });
      return;
    }

    const mustChangePassword = await readMustChangePassword(user.id);

    res.json({
      success: true,
      data: { user: { ...user, mustChangePassword } },
    });
  } catch (error) {
    console.error('[AUTH] Erro ao buscar perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// =====================================================
// PUT /change-password
// =====================================================

router.put('/change-password', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = changePasswordSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
      return;
    }

    const { currentPassword, newPassword } = validation.data;

    // Fetch current user from DB
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'Usuario nao encontrado',
      });
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Senha atual incorreta',
      });
      return;
    }

    // Hash new password and update
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash: newPasswordHash },
    });

    // Limpa o flag de primeiro acesso (raw — Prisma client nao foi regenerado)
    await prisma.$executeRaw`
      UPDATE "User" SET "mustChangePassword" = false WHERE id = ${req.user!.id}
    `;

    console.log(`[AUTH] Senha alterada: ${user.email}`);

    await createAuditLog({
      performedById: user.id,
      action: 'PASSWORD_CHANGE',
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      description: `Senha alterada pelo proprio usuario: ${user.email}`,
      ipAddress: req.ip as string | undefined,
    });

    res.json({
      success: true,
      data: { message: 'Senha alterada com sucesso' },
    });
  } catch (error) {
    console.error('[AUTH] Erro ao alterar senha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// =====================================================
// POST /finalize-first-access
// =====================================================
// Fluxo forcado pelo flag mustChangePassword. Usuario ja autenticado (acabou
// de logar com CPF). Aceita duas decisoes:
//   - action='change' + newPassword: troca a senha e limpa o flag
//   - action='keep':                 mantem CPF como senha, so limpa o flag
//
// Nao requer currentPassword — a confirmacao da identidade ja veio do JWT
// recem-emitido. Diferente de /change-password, que e o fluxo voluntario.
router.post('/finalize-first-access', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = finalizeFirstAccessSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: validation.error.errors[0].message });
      return;
    }

    const userId = req.user!.id;

    // Verifica se o fluxo realmente esta ativo — endpoint nao pode ser usado
    // como atalho permanente para trocar senha sem currentPassword.
    const mustChange = await readMustChangePassword(userId);
    if (!mustChange) {
      res.status(400).json({
        success: false,
        error: 'Fluxo de primeiro acesso ja concluido',
      });
      return;
    }

    const decision = validation.data;

    if (decision.action === 'change') {
      const newPasswordHash = await bcrypt.hash(decision.newPassword, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });
      await createAuditLog({
        performedById: userId,
        action: 'PASSWORD_CHANGE',
        entityType: 'User',
        entityId: userId,
        userId: userId,
        description: `Primeiro acesso: usuario definiu senha propria`,
        ipAddress: req.ip as string | undefined,
      });
    } else {
      // action === 'keep' — apenas registra a decisao no audit log
      await createAuditLog({
        performedById: userId,
        action: 'PASSWORD_CHANGE',
        entityType: 'User',
        entityId: userId,
        userId: userId,
        description: `Primeiro acesso: usuario optou por manter CPF como senha`,
        ipAddress: req.ip as string | undefined,
      });
    }

    // Limpa o flag em ambos os casos
    await prisma.$executeRaw`
      UPDATE "User" SET "mustChangePassword" = false WHERE id = ${userId}
    `;

    res.json({ success: true, data: { message: 'Configuracao concluida' } });
  } catch (error) {
    console.error('[AUTH] Erro em finalize-first-access:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

export default router;
