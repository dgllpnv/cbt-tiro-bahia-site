import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface Lane {
  id: string;
  number: number;
  name: string;
  status: string;
  notes: string | null;
  isActive: boolean;
  sessionStartTime: string | null;
  currentMemberId: string | null;
  currentMember: {
    id: string;
    fullName: string;
    memberNumber: number | null;
  } | null;
}

export interface LaneStatusSummary {
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
  reserved: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listLanes() {
  try {
    const response = await api.get('/api/lanes');
    if (response.data.success) return { success: true, data: response.data.data as Lane[] };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar baias' };
  }
}

export async function getLaneStatus() {
  try {
    const response = await api.get('/api/lanes/status');
    if (response.data.success) return { success: true, data: response.data.data as LaneStatusSummary };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar status das baias' };
  }
}

export async function updateLaneStatus(id: string, data: { status: string; notes?: string }) {
  try {
    const response = await api.patch(`/api/lanes/${id}/status`, data);
    if (response.data.success) return { success: true, data: response.data.data as Lane };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao atualizar baia' };
  }
}

export async function assignLane(id: string, data: { memberId: string }) {
  try {
    const response = await api.patch(`/api/lanes/${id}/assign`, data);
    if (response.data.success) return { success: true, data: response.data.data as Lane };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao atribuir baia' };
  }
}
