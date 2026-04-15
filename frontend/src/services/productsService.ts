import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category: string;
  caliber: string | null;
  caliberCategory: string | null;
  unitPrice: number;
  costPrice: number | null;
  unit: string | null;
  isForSale: boolean;
  isForLoan: boolean;
  isActive: boolean;
  imageUrl: string | null;
  createdAt: string;
  stockItems: {
    id: string;
    currentStock: number;
    minimumStock: number;
    maximumStock: number | null;
    location: string | null;
    lastRestocked: string | null;
  }[];
}

export interface CreateProductData {
  name: string;
  description?: string;
  sku?: string;
  category: string;
  caliber?: string;
  caliberCategory?: string;
  unitPrice: number;
  costPrice?: number;
  unit?: string;
  isForSale?: boolean;
  isForLoan?: boolean;
  imageUrl?: string;
  initialStock?: number;
  minimumStock?: number;
  maximumStock?: number;
  location?: string;
}

interface ListProductsParams {
  category?: string;
  search?: string;
  isActive?: string;
  page?: number;
  limit?: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listProducts(params?: ListProductsParams) {
  try {
    const response = await api.get('/api/products', { params });
    if (response.data.success) {
      return { success: true, data: response.data.data as Product[], pagination: response.data.pagination };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar produtos' };
  }
}

export async function getProductById(id: string) {
  try {
    const response = await api.get(`/api/products/${id}`);
    if (response.data.success) return { success: true, data: response.data.data as Product };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar produto' };
  }
}

export async function createProduct(data: CreateProductData) {
  try {
    const response = await api.post('/api/products', data);
    if (response.data.success) return { success: true, data: response.data.data as Product };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao criar produto' };
  }
}

export async function updateProduct(id: string, data: Partial<CreateProductData>) {
  try {
    const response = await api.put(`/api/products/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data as Product };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao atualizar produto' };
  }
}

export async function toggleProductStatus(id: string) {
  try {
    const response = await api.patch(`/api/products/${id}/status`);
    if (response.data.success) return { success: true, data: response.data.data as Product };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao alterar status do produto' };
  }
}

export async function deleteProduct(id: string) {
  try {
    const response = await api.delete(`/api/products/${id}`);
    if (response.data.success) return { success: true, data: response.data.data as Product };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao excluir produto' };
  }
}
