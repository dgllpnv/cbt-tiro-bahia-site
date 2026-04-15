import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface VisitDetailItem {
  id: string;
  visitId: string;
  memberId: string;
  caliber: string;
  shotsFired: number;
  notes: string | null;
  createdAt: string;
  member: {
    id: string;
    fullName: string;
    memberNumber: number | null;
  };
}

export interface CreateVisitDetailData {
  caliber: string;
  shotsFired: number;
  notes?: string;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listVisitDetails(visitId: string) {
  try {
    const response = await api.get(`/api/visit-details/visit/${visitId}`);
    if (response.data.success) return { success: true, data: response.data.data as VisitDetailItem[] };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar detalhes da visita' };
  }
}

export async function createVisitDetail(visitId: string, data: CreateVisitDetailData) {
  try {
    const response = await api.post(`/api/visit-details/visit/${visitId}`, data);
    if (response.data.success) return { success: true, data: response.data.data as VisitDetailItem };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao adicionar detalhe da visita' };
  }
}

export async function updateVisitDetail(id: string, data: Partial<CreateVisitDetailData>) {
  try {
    const response = await api.put(`/api/visit-details/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data as VisitDetailItem };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao atualizar detalhe da visita' };
  }
}

export async function deleteVisitDetail(id: string) {
  try {
    const response = await api.delete(`/api/visit-details/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao excluir detalhe da visita' };
  }
}
