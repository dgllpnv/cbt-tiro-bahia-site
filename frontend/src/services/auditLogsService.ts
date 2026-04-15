import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  performedById: string;
  userId: string | null;
  details: any;
  ipAddress: string | null;
  createdAt: string;
  performedBy: {
    id: string;
    fullName: string;
  };
  user: {
    id: string;
    fullName: string;
  } | null;
}

interface ListAuditLogsParams {
  action?: string;
  entityType?: string;
  performedById?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listAuditLogs(params?: ListAuditLogsParams) {
  try {
    const response = await api.get('/api/audit-logs', { params });
    if (response.data.success) {
      return { success: true, data: response.data.data as AuditLog[], pagination: response.data.pagination };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar logs de auditoria' };
  }
}

export async function getAuditLogById(id: string) {
  try {
    const response = await api.get(`/api/audit-logs/${id}`);
    if (response.data.success) return { success: true, data: response.data.data as AuditLog };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar log de auditoria' };
  }
}
