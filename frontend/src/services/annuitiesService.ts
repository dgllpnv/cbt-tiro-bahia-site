import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface AnnuityPayment {
  id: string;
  memberId: string;
  amount: number;
  paymentMethod: string | null;
  paymentDate: string;
  referenceYear: number;
  validFrom: string;
  validUntil: string;
  notes: string | null;
  registeredById: string;
  createdAt: string;
  member: {
    id: string;
    fullName: string;
    memberNumber: number | null;
    annuityValidUntil?: string | null;
  };
}

export interface CreateAnnuityPaymentData {
  memberId: string;
  amount: number;
  paymentMethod?: string | null;
  referenceYear: number;
  notes?: string | null;
}

interface ListAnnuitiesParams {
  memberId?: string;
  referenceYear?: number;
  page?: number;
  limit?: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listAnnuities(params?: ListAnnuitiesParams) {
  try {
    const response = await api.get('/api/annuities', { params });
    if (response.data.success) {
      return { success: true, data: response.data.data as AnnuityPayment[], pagination: response.data.pagination };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar anuidades' };
  }
}

export async function getMemberAnnuities(memberId: string) {
  try {
    const response = await api.get(`/api/annuities/member/${memberId}`);
    if (response.data.success) return { success: true, data: response.data.data as AnnuityPayment[] };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar historico de anuidades' };
  }
}

export async function getExpiringAnnuities(days?: number) {
  try {
    const response = await api.get('/api/annuities/expiring', { params: days ? { days } : undefined });
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar anuidades vencendo' };
  }
}

export async function createAnnuityPayment(data: CreateAnnuityPaymentData) {
  try {
    const response = await api.post('/api/annuities', data);
    if (response.data.success) return { success: true, data: response.data.data as AnnuityPayment };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao registrar anuidade' };
  }
}
