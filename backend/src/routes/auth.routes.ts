import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

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

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Credenciais invalidas',
      });
      return;
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

    res.json({
      success: true,
      data: { user },
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

    console.log(`[AUTH] Senha alterada: ${user.email}`);

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

export default router;
