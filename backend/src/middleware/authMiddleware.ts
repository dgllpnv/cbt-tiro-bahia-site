import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

// =====================================================
// EXTEND EXPRESS REQUEST TYPE
// =====================================================

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
        clubId: string;
      };
    }
  }
}

// =====================================================
// JWT PAYLOAD INTERFACE
// =====================================================

interface JwtPayload {
  id: string;
  email: string;
  role: Role;
  clubId: string;
  iat?: number;
  exp?: number;
}

// =====================================================
// AUTH MIDDLEWARE - Verify JWT Token
// =====================================================

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Token de autenticacao nao fornecido',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Token de autenticacao invalido',
      });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[AUTH] JWT_SECRET nao configurado');
      res.status(500).json({
        success: false,
        error: 'Erro interno de configuracao',
      });
      return;
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      clubId: decoded.clubId,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expirado. Faca login novamente',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Token invalido',
      });
      return;
    }

    console.error('[AUTH] Erro ao verificar token:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao verificar autenticacao',
    });
  }
};

// =====================================================
// REQUIRE ROLE MIDDLEWARE - Check user role
// =====================================================

export const requireRole = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Usuario nao autenticado',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Acesso negado. Permissao insuficiente',
      });
      return;
    }

    next();
  };
};
