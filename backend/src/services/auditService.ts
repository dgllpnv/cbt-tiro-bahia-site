import { AuditAction } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// =====================================================
// AUDIT LOG SERVICE
// =====================================================

export async function createAuditLog(params: {
  performedById: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  userId?: string;
  previousData?: any;
  newData?: any;
  description: string;
  ipAddress?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        performedById: params.performedById,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
        previousData: params.previousData ?? undefined,
        newData: params.newData ?? undefined,
        description: params.description,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    // Log but don't throw — audit failures should not break the main operation
    console.error('[AUDIT] Erro ao criar log de auditoria:', error);
  }
}
