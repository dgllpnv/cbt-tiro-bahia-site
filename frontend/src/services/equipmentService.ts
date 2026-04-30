import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface Equipment {
  id: string;
  name: string;
  description: string | null;
  equipmentType: string;
  serialNumber: string | null;
  registrationId: string | null;
  caliber: string | null;
  brand: string | null;
  model: string | null;
  condition: string;
  isAvailable: boolean;
  isActive: boolean;
  notes: string | null;
  imageUrl: string | null;
  acquisitionDate: string | null;
  createdAt: string;
}

export interface CreateEquipmentData {
  name: string;
  description?: string;
  equipmentType: string;
  serialNumber?: string;
  registrationId?: string;
  caliber?: string;
  brand?: string;
  model?: string;
  condition?: string;
  isAvailable?: boolean;
  notes?: string;
  imageUrl?: string;
  acquisitionDate?: string;
}

interface ListEquipmentParams {
  equipmentType?: string;
  isAvailable?: string;
  condition?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listEquipment(params?: ListEquipmentParams) {
  try {
    const response = await api.get('/api/equipment', { params });
    if (response.data.success) {
      return { success: true, data: response.data.data as Equipment[], pagination: response.data.pagination };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar equipamentos' };
  }
}

export async function getEquipmentById(id: string) {
  try {
    const response = await api.get(`/api/equipment/${id}`);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar equipamento' };
  }
}

export async function createEquipment(data: CreateEquipmentData) {
  try {
    const response = await api.post('/api/equipment', data);
    if (response.data.success) return { success: true, data: response.data.data as Equipment };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao criar equipamento' };
  }
}

export async function updateEquipment(id: string, data: Partial<CreateEquipmentData>) {
  try {
    const response = await api.put(`/api/equipment/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data as Equipment };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao atualizar equipamento' };
  }
}

export async function updateCondition(id: string, condition: string) {
  try {
    const response = await api.patch(`/api/equipment/${id}/condition`, { condition });
    if (response.data.success) return { success: true, data: response.data.data as Equipment };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao atualizar condicao do equipamento' };
  }
}

export async function deleteEquipment(id: string) {
  try {
    const response = await api.delete(`/api/equipment/${id}`);
    if (response.data.success) return { success: true, data: response.data.data as Equipment };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao excluir equipamento' };
  }
}
