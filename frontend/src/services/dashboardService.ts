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

// ── Rankings ────────────────────────────────────────────────────────────────

export type RankingPeriod = 'month' | 'year' | 'all';

export interface RankingFrequencyEntry {
  memberId: string;
  fullName: string;
  memberNumber: string | null;
  photoUrl: string | null;
  facePhoto: string | null;
  visitCount: number;
}

export interface RankingMasteryEntry {
  memberId: string;
  fullName: string;
  memberNumber: string | null;
  photoUrl: string | null;
  facePhoto: string | null;
  totalShots: number;
}

export interface DashboardRankings {
  byFrequency: RankingFrequencyEntry[];
  byMastery: RankingMasteryEntry[];
  period: RankingPeriod;
}

export interface RankingsParams {
  period?: RankingPeriod;
  limit?: number;
  firearmCategory?: string;
  firearmName?: string;
}

export async function getDashboardRankings(params: RankingsParams = {}) {
  try {
    const response = await api.get('/api/dashboard/rankings', {
      params: {
        period: params.period ?? 'month',
        limit: params.limit ?? 5,
        ...(params.firearmCategory ? { firearmCategory: params.firearmCategory } : {}),
        ...(params.firearmName ? { firearmName: params.firearmName } : {}),
      },
    });
    if (response.data.success) {
      return { success: true as const, data: response.data.data as DashboardRankings };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao buscar rankings',
    };
  }
}

// ── Top Firearms ────────────────────────────────────────────────────────────

export type TopFirearmsPeriod = 'day' | 'month' | 'year';

export interface TopFirearmEntry {
  firearmName: string;
  category: string | null;
  totalShots: number;
  uses: number;
}

export interface TopFirearms {
  topFirearms: TopFirearmEntry[];
  period: TopFirearmsPeriod;
}

export async function getTopFirearms(period: TopFirearmsPeriod = 'month', limit = 10) {
  try {
    const response = await api.get('/api/dashboard/top-firearms', { params: { period, limit } });
    if (response.data.success) {
      return { success: true as const, data: response.data.data as TopFirearms };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao buscar armas mais usadas',
    };
  }
}
