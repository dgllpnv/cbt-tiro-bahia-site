import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface AssociateDashboard {
  recentNews: {
    id: string;
    title: string;
    summary: string | null;
    publishedAt: string;
    imageUrl: string | null;
  }[];
  myVisits: number;
  totalShots: number;
  annuityStatus: {
    validUntil: string | null;
    daysRemaining: number | null;
    isExpired: boolean;
  };
  habitualitySummary: any[];
}

export interface AdminDashboard {
  activeMembers: number;
  todayVisits: number;
  monthRevenue: number;
  lowStockCount: number;
  activeLoans: number;
  expiringAnnuities: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function getAssociateDashboard() {
  try {
    const response = await api.get('/api/dashboard/associate');
    if (response.data.success) return { success: true, data: response.data.data as AssociateDashboard };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar dashboard do associado' };
  }
}

export async function getAdminDashboard() {
  try {
    const response = await api.get('/api/dashboard/admin');
    if (response.data.success) return { success: true, data: response.data.data as AdminDashboard };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar dashboard administrativo' };
  }
}
