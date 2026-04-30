import api from './api';

export interface MemberStatsCaliber {
  caliber: string;
  shots: number;
  percentage: number;
}

export interface MemberStatsAmmoItem {
  productName: string;
  totalQuantity: number;
  totalSpent: number;
  caliber: string | null;
}

export interface MemberStatsRecentVisit {
  id: string;
  visitDate: string;
  checkInTime: string;
  checkOutTime: string | null;
  durationMinutes: number | null;
  shotsFired: number;
  laneName: string | null;
}

export interface MemberStatsFirearm {
  firearmName: string;
  category: string | null;
  shots: number;
  percentage: number;
}

export interface MemberStats {
  memberSince: string | null;
  tenureMonths: number;
  totalShots: number;
  totalVisits: number;
  visitsLast12Months: number;
  averageVisitDuration: number;
  shotsByCaliber: MemberStatsCaliber[];
  shotsByFirearm: MemberStatsFirearm[];
  ammoSpentByType: MemberStatsAmmoItem[];
  recentVisits: MemberStatsRecentVisit[];
}

export async function getMemberStats(memberId: string) {
  try {
    const response = await api.get(`/api/users/${memberId}/stats`);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as MemberStats };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao buscar estatísticas',
    };
  }
}
