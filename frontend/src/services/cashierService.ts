import api from './api';

export interface DailyClosingMember {
  id: string;
  fullName: string;
  memberNumber: string | null;
}

export interface DailyClosingRegisteredBy {
  id: string;
  fullName: string;
}

export interface DailyClosingTransactionItem {
  description: string;
  quantity: number;
  subtotal: number;
}

export interface DailyClosingTransaction {
  id: string;
  transactionDate: string;
  type: string;
  totalAmount: number;
  paymentMethod: string | null;
  notes: string | null;
  member: DailyClosingMember | null;
  registeredBy: DailyClosingRegisteredBy | null;
  items: DailyClosingTransactionItem[];
}

export interface DailyClosingExpense {
  id: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  vendor: string | null;
  registeredBy: DailyClosingRegisteredBy | null;
}

export interface DailyClosingBreakdown {
  method?: string;
  type?: string;
  total: number;
  count: number;
}

export interface DailyClosing {
  date: string;
  endOfDay: string;
  totals: {
    revenue: number;
    expenses: number;
    balance: number;
    transactionCount: number;
    expenseCount: number;
  };
  paymentBreakdown: Array<{ method: string; total: number; count: number }>;
  typeBreakdown: Array<{ type: string; total: number; count: number }>;
  transactions: DailyClosingTransaction[];
  expenses: DailyClosingExpense[];
}

export async function getDailyClosing() {
  try {
    const response = await api.get('/api/financial/daily-closing');
    if (response.data.success) {
      return { success: true as const, data: response.data.data as DailyClosing };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao buscar fechamento do dia',
    };
  }
}

// Fechamento por periodo arbitrario (admin-only no backend). Mesmo shape do
// DailyClosing, trocando `date/endOfDay` por `startDate/endDate` + `truncated`
// (sinaliza se o teto de seguranca de registros foi atingido).
export interface PeriodClosing {
  startDate: string;
  endDate: string;
  truncated: boolean;
  totals: {
    revenue: number;
    expenses: number;
    balance: number;
    transactionCount: number;
    expenseCount: number;
  };
  paymentBreakdown: Array<{ method: string; total: number; count: number }>;
  typeBreakdown: Array<{ type: string; total: number; count: number }>;
  transactions: DailyClosingTransaction[];
  expenses: DailyClosingExpense[];
}

export async function getPeriodClosing(params: { startDate: string; endDate: string }) {
  try {
    const response = await api.get('/api/financial/period-closing', { params });
    if (response.data.success) {
      return { success: true as const, data: response.data.data as PeriodClosing };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao buscar fechamento por periodo',
    };
  }
}
