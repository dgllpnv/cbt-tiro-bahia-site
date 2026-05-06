import api from './api';

// ── Dashboard consolidado (novo endpoint /api/financial/dashboard) ─────────

export interface KpiValue {
  value: number;
  prevValue?: number;
  /** % de variação (ou pontos percentuais para margem). Null quando não há base de comparação. */
  deltaPct: number | null;
}

export interface FinancialDashboard {
  period: { startDate: string; endDate: string; days: number; granularity: 'day' | 'month' };
  prev: { startDate: string; endDate: string };
  kpis: {
    revenue: KpiValue;
    expenses: KpiValue;
    result: KpiValue;
    margin: KpiValue;
    avgTicket: KpiValue;
    txCount: KpiValue;
    expiringCount: { value: number };
    overdueCount: { value: number };
  };
  series: { date: string; revenue: number; expenses: number; result: number }[];
  prevSeries: { date: string; revenue: number }[];
  revenueByType: { key: string; total: number; count: number; share: number }[];
  expensesByCategory: { key: string; total: number; count: number; share: number }[];
  paymentMethods: { method: string; total: number; count: number; share: number }[];
  topProducts: {
    productId: string | null;
    name: string;
    qty: number;
    revenue: number;
    costTotal: number | null;
    margin: number | null;
    marginPct: number | null;
  }[];
}

export async function getFinancialDashboard(params: { startDate: string; endDate: string }) {
  try {
    const response = await api.get('/api/financial/dashboard', { params });
    if (response.data.success) {
      return { success: true as const, data: response.data.data as FinancialDashboard };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao buscar dashboard financeiro',
    };
  }
}

// ── Interfaces (legado) ─────────────────────────────────────────────────────

export interface FinancialSummary {
  revenue: number;
  expenses: number;
  profit: number;
  transactionCount: number;
  period: string;
  startDate: string;
  endDate: string;
}

export interface RevenueBreakdown {
  label: string;
  total: number;
  count: number;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  vendor: string | null;
  invoiceNumber: string | null;
  expenseDate: string;
  notes: string | null;
  registeredById: string;
  createdAt: string;
  registeredBy: {
    id: string;
    fullName: string;
  };
}

export interface CreateExpenseData {
  category: string;
  description: string;
  amount: number;
  vendor?: string;
  invoiceNumber?: string;
  expenseDate: string;
  notes?: string;
}

interface SummaryParams {
  period: string;
  date?: string;
}

interface RevenueParams {
  startDate: string;
  endDate: string;
  groupBy?: string;
}

interface ListExpensesParams {
  category?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function getSummary(params: SummaryParams) {
  try {
    const response = await api.get('/api/financial/summary', { params });
    if (response.data.success) return { success: true, data: response.data.data as FinancialSummary };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar resumo financeiro' };
  }
}

export async function getRevenue(params: RevenueParams) {
  try {
    const response = await api.get('/api/financial/revenue', { params });
    if (response.data.success) return { success: true, data: response.data.data as RevenueBreakdown[] };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar detalhamento de receita' };
  }
}

export async function listExpenses(params?: ListExpensesParams) {
  try {
    const response = await api.get('/api/financial/expenses', { params });
    if (response.data.success) {
      return { success: true, data: response.data.data as Expense[], pagination: response.data.pagination };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar despesas' };
  }
}

export async function createExpense(data: CreateExpenseData) {
  try {
    const response = await api.post('/api/financial/expenses', data);
    if (response.data.success) return { success: true, data: response.data.data as Expense };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao criar despesa' };
  }
}

export async function updateExpense(id: string, data: Partial<CreateExpenseData>) {
  try {
    const response = await api.put(`/api/financial/expenses/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data as Expense };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao atualizar despesa' };
  }
}

export async function deleteExpense(id: string) {
  try {
    const response = await api.delete(`/api/financial/expenses/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao excluir despesa' };
  }
}

export async function getProfitLoss(params?: { startDate?: string; endDate?: string; period?: string }) {
  try {
    const response = await api.get('/api/financial/summary', { params: { period: 'month', ...params } });
    if (response.data.success) return { success: true, data: response.data.data as FinancialSummary };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar lucro/prejuizo' };
  }
}
