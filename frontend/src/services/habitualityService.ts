import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface HabitualityRecord {
  id: string;
  memberId: string;
  caliber: string;
  activityDate: string;
  activityType: string;
  visitId: string | null;
  eventId: string | null;
  description: string | null;
  verifiedById: string | null;
  createdAt: string;
  event: {
    id: string;
    title: string;
    eventType: string;
  } | null;
  visit: {
    id: string;
    visitDate: string;
  } | null;
  verifiedBy: {
    id: string;
    fullName: string;
  } | null;
}

export interface HabitualitySummary {
  year: number;
  summary: {
    caliber: string;
    count: number;
    required: number;
    compliant: boolean;
  }[];
}

export interface CreateHabitualityData {
  memberId: string;
  caliber: string;
  activityDate: string;
  activityType: 'TRAINING' | 'COMPETITION';
  visitId?: string;
  eventId?: string;
  description?: string;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function getMemberHabituality(memberId: string, year?: number) {
  try {
    const params = year ? { year } : undefined;
    const response = await api.get(`/api/habituality/member/${memberId}`, { params });
    if (response.data.success) return { success: true, data: response.data.data as HabitualityRecord[] };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar habitualidade' };
  }
}

export async function getMemberSummary(memberId: string, year?: number) {
  try {
    const params = year ? { year } : undefined;
    const response = await api.get(`/api/habituality/member/${memberId}/summary`, { params });
    if (response.data.success) return { success: true, data: response.data.data as HabitualitySummary };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar resumo de habitualidade' };
  }
}

export async function createRecord(data: CreateHabitualityData) {
  try {
    const response = await api.post('/api/habituality', data);
    if (response.data.success) return { success: true, data: response.data.data as HabitualityRecord };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao registrar habitualidade' };
  }
}

export async function getAlerts() {
  try {
    const response = await api.get('/api/habituality/alerts');
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar alertas de habitualidade' };
  }
}
