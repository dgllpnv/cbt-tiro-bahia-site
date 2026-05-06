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

export type TransactionStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export interface Transaction {
  id: string;
  memberId: string;
  type: string;
  status: TransactionStatus;
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
    memberNumber?: string | null;
  };
  registeredBy?: {
    id: string;
    fullName: string;
  };
  items: TransactionItem[];
}

export interface DraftItemPayload {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface FinalizeTransactionPayload {
  paymentMethod: string;
  discount?: number;
  notes?: string | null;
  type?: string;
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

// ── Comanda aberta (DRAFT) ──────────────────────────────────────────────────

export async function getDraftByVisit(visitId: string) {
  try {
    const response = await api.get(`/api/transactions/draft/visit/${visitId}`);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as Transaction | null };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao buscar comanda',
    };
  }
}

export async function createOrGetDraft(memberId: string, visitId?: string | null) {
  try {
    const response = await api.post('/api/transactions/draft', { memberId, visitId });
    if (response.data.success) {
      return { success: true as const, data: response.data.data as Transaction };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao abrir comanda',
    };
  }
}

export async function addDraftItem(transactionId: string, item: DraftItemPayload) {
  try {
    const response = await api.post(`/api/transactions/${transactionId}/items`, item);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as Transaction };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao adicionar item',
    };
  }
}

export async function removeDraftItem(transactionId: string, itemId: string) {
  try {
    const response = await api.delete(`/api/transactions/${transactionId}/items/${itemId}`);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as Transaction };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao remover item',
    };
  }
}

export async function finalizeTransaction(transactionId: string, payload: FinalizeTransactionPayload) {
  try {
    const response = await api.patch(`/api/transactions/${transactionId}/finalize`, payload);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as Transaction };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao finalizar comanda',
    };
  }
}
