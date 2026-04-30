import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface TransactionItem {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Transaction {
  id: string;
  memberId: string;
  type: string;
  totalAmount: number;
  discount: number;
  paymentMethod: string | null;
  notes: string | null;
  visitId: string | null;
  registeredById: string;
  transactionDate: string;
  member: {
    id: string;
    fullName: string;
  };
  registeredBy: {
    id: string;
    fullName: string;
  };
  items: TransactionItem[];
}

export interface CreateTransactionData {
  memberId: string;
  type: string;
  paymentMethod?: string | null;
  discount?: number | null;
  notes?: string | null;
  visitId?: string | null;
  items: {
    productId?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
}

interface ListTransactionsParams {
  type?: string;
  memberId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listTransactions(params?: ListTransactionsParams) {
  try {
    const response = await api.get('/api/transactions', { params });
    if (response.data.success) {
      return { success: true, data: response.data.data as Transaction[], pagination: response.data.pagination };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar transacoes' };
  }
}

export async function getTransactionById(id: string) {
  try {
    const response = await api.get(`/api/transactions/${id}`);
    if (response.data.success) return { success: true, data: response.data.data as Transaction };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar transacao' };
  }
}

export async function createTransaction(data: CreateTransactionData) {
  try {
    const response = await api.post('/api/transactions', data);
    if (response.data.success) return { success: true, data: response.data.data as Transaction };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao criar transacao' };
  }
}

export async function deleteTransaction(id: string) {
  try {
    const response = await api.delete(`/api/transactions/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao cancelar transacao' };
  }
}
