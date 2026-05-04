import api from './api';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Visitor {
  id: string;
  email: string | null;
  cpf: string;
  fullName: string;
  role: 'VISITOR';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  dateOfBirth?: string | null;
  phone: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  photoUrl?: string | null;
  memberNumber: null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisitorData {
  fullName: string;
  cpf: string;
  phone: string;
  email?: string | null;
  dateOfBirth?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  photoUrl?: string | null;
}

export interface UpdateVisitorData {
  fullName?: string;
  cpf?: string;
  phone?: string;
  email?: string | null;
  dateOfBirth?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  photoUrl?: string | null;
}

export interface ConvertVisitorData {
  email: string;
  password: string;
  memberNumber: string;
  annuityAmount: number;
  annuityPaymentMethod?: string | null;
  annuityReferenceYear: number;
  annuityNotes?: string | null;
  cr?: string | null;
  crLevel?: number | null;
  membershipTier?: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export interface ListVisitorsResponse {
  success: boolean;
  data?: {
    visitors: Visitor[];
    pagination: PaginationMeta;
  };
  error?: string;
}

export interface VisitorResponse {
  success: boolean;
  data?: Visitor;
  error?: string;
}

export interface SimpleResponse {
  success: boolean;
  error?: string;
}

interface ListVisitorsParams {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listVisitors(params?: ListVisitorsParams): Promise<ListVisitorsResponse> {
  try {
    const response = await api.get('/api/visitors', { params });
    if (response.data.success) {
      const visitors: Visitor[] = Array.isArray(response.data.data) ? response.data.data : [];
      const pagination: PaginationMeta = response.data.pagination ?? {
        page: 1,
        limit: visitors.length,
        total: visitors.length,
        totalPages: 1,
      };
      return { success: true, data: { visitors, pagination } };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar visitantes' };
  }
}

export async function getVisitorById(id: string): Promise<VisitorResponse> {
  try {
    const response = await api.get(`/api/visitors/${id}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar visitante' };
  }
}

export async function createVisitor(data: CreateVisitorData): Promise<VisitorResponse> {
  try {
    const response = await api.post('/api/visitors', data);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao criar visitante' };
  }
}

export async function updateVisitor(id: string, data: UpdateVisitorData): Promise<VisitorResponse> {
  try {
    const response = await api.put(`/api/visitors/${id}`, data);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao atualizar visitante' };
  }
}

export async function deleteVisitor(id: string): Promise<SimpleResponse> {
  try {
    const response = await api.delete(`/api/visitors/${id}`, { data: { confirm: true } });
    if (response.data.success) {
      return { success: true };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao excluir visitante' };
  }
}

export async function convertVisitorToAssociate(
  id: string,
  data: ConvertVisitorData,
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await api.post(`/api/visitors/${id}/convert`, data);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao converter visitante' };
  }
}
