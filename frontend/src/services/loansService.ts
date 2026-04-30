import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface EquipmentLoan {
  id: string;
  equipmentId: string;
  memberId: string;
  issuedById: string;
  returnedById: string | null;
  loanDate: string;
  expectedReturn: string | null;
  actualReturn: string | null;
  status: string;
  conditionAtLoan: string;
  conditionAtReturn: string | null;
  notes: string | null;
  equipment: {
    id: string;
    name: string;
    serialNumber: string | null;
  };
  member: {
    id: string;
    fullName: string;
  };
  issuedBy: {
    id: string;
    fullName: string;
  };
  returnedBy?: {
    id: string;
    fullName: string;
  } | null;
}

export interface IssueLoanData {
  equipmentId: string;
  memberId: string;
  expectedReturn?: string | null;
  notes?: string | null;
}

export interface ReturnLoanData {
  conditionAtReturn: string;
  notes?: string | null;
}

interface ListLoansParams {
  status?: string;
  memberId?: string;
  equipmentId?: string;
  page?: number;
  limit?: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listLoans(params?: ListLoansParams) {
  try {
    const response = await api.get('/api/loans', { params });
    if (response.data.success) {
      return { success: true, data: response.data.data as EquipmentLoan[], pagination: response.data.pagination };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar emprestimos' };
  }
}

export async function getActiveLoans() {
  try {
    const response = await api.get('/api/loans/active');
    if (response.data.success) return { success: true, data: response.data.data as EquipmentLoan[] };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar emprestimos ativos' };
  }
}

export async function getLoanById(id: string) {
  try {
    const response = await api.get(`/api/loans/${id}`);
    if (response.data.success) return { success: true, data: response.data.data as EquipmentLoan };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar emprestimo' };
  }
}

export async function issueLoan(data: IssueLoanData) {
  try {
    const response = await api.post('/api/loans', data);
    if (response.data.success) return { success: true, data: response.data.data as EquipmentLoan };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao criar emprestimo' };
  }
}

export async function returnLoan(id: string, data: ReturnLoanData) {
  try {
    const response = await api.patch(`/api/loans/${id}/return`, data);
    if (response.data.success) return { success: true, data: response.data.data as EquipmentLoan };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao devolver equipamento' };
  }
}
