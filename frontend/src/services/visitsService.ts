import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface Visit {
  id: string;
  memberId: string;
  registeredById: string;
  visitDate: string;
  checkInTime: string;
  checkOutTime: string | null;
  laneId: string | null;
  purpose: string | null;
  instructorName: string | null;
  notes: string | null;
  isGuestVisit: boolean;
  guestName: string | null;
  guestDocument: string | null;
  createdAt: string;
  member: {
    id: string;
    fullName: string;
    memberNumber: number | null;
    photoUrl: string | null;
  };
  lane: {
    id: string;
    number: number;
    name: string;
    status: string;
  } | null;
}

export interface VisitDetail {
  id: string;
  visitId: string;
  memberId: string;
  caliber: string;
  shotsFired: number;
  notes: string | null;
  createdAt: string;
}

export interface CreateVisitData {
  memberId: string;
  visitDate: string;
  checkInTime: string;
  laneId?: string;
  purpose?: string;
  instructorName?: string;
  notes?: string;
  isGuestVisit?: boolean;
  guestName?: string;
  guestDocument?: string;
}

interface ListVisitsParams {
  memberId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listVisits(params?: ListVisitsParams) {
  try {
    const response = await api.get('/api/visits', { params });
    if (response.data.success) {
      return { success: true, data: response.data.data as Visit[], pagination: response.data.pagination };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar visitas' };
  }
}

export async function getVisitById(id: string) {
  try {
    const response = await api.get(`/api/visits/${id}`);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar visita' };
  }
}

export async function getTodayVisits() {
  try {
    const response = await api.get('/api/visits/today');
    if (response.data.success) return { success: true, data: response.data.data as Visit[] };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar visitas de hoje' };
  }
}

export async function createVisit(data: CreateVisitData) {
  try {
    const response = await api.post('/api/visits', data);
    if (response.data.success) return { success: true, data: response.data.data as Visit };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao criar visita' };
  }
}

export async function updateVisit(id: string, data: Partial<CreateVisitData>) {
  try {
    const response = await api.put(`/api/visits/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data as Visit };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao atualizar visita' };
  }
}

export async function checkoutVisit(id: string) {
  try {
    const response = await api.patch(`/api/visits/${id}/checkout`);
    if (response.data.success) return { success: true, data: response.data.data as Visit };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao registrar check-out' };
  }
}

export async function deleteVisit(id: string) {
  try {
    const response = await api.delete(`/api/visits/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao excluir visita' };
  }
}
