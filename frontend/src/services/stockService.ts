import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface StockItem {
  id: string;
  productId: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number | null;
  location: string | null;
  lastRestocked: string | null;
  product: {
    id: string;
    name: string;
    category: string;
    caliber: string | null;
    unit: string | null;
  };
}

export interface StockMovement {
  id: string;
  stockItemId: string;
  movementType: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceId: string | null;
  referenceType: string | null;
  notes: string | null;
  performedById: string | null;
  createdAt: string;
  stockItem: {
    product: {
      id: string;
      name: string;
    };
  };
}

export interface AdjustStockData {
  productId: string;
  quantity: number;
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  notes?: string;
}

interface ListStockParams {
  belowMinimum?: string;
  category?: string;
  page?: number;
  limit?: number;
}

interface ListMovementsParams {
  productId?: string;
  movementType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listStock(params?: ListStockParams) {
  try {
    const response = await api.get('/api/stock', { params });
    if (response.data.success) {
      return { success: true, data: response.data.data as StockItem[], pagination: response.data.pagination };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar itens de estoque' };
  }
}

export async function getLowStock() {
  try {
    const response = await api.get('/api/stock/low');
    if (response.data.success) return { success: true, data: response.data.data as StockItem[] };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar itens com estoque baixo' };
  }
}

export async function getStockByProduct(productId: string) {
  try {
    const response = await api.get(`/api/stock/${productId}`);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar detalhe do estoque' };
  }
}

export async function getStockMovements(params?: ListMovementsParams) {
  try {
    const response = await api.get('/api/stock/movements', { params });
    if (response.data.success) {
      return { success: true, data: response.data.data as StockMovement[], pagination: response.data.pagination };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar movimentacoes de estoque' };
  }
}

export async function adjustStock(data: AdjustStockData) {
  try {
    const response = await api.post('/api/stock/adjust', data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao ajustar estoque' };
  }
}
