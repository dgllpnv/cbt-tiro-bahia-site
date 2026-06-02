import api from './api';

// ── Tipos ───────────────────────────────────────────────────────────────────

export type FirearmCategory = 'PISTOL' | 'REVOLVER' | 'RIFLE' | 'SHOTGUN';
export type RegistrationBody = 'EXERCITO' | 'PF';

export interface MemberFirearm {
  id: string;
  memberId: string;
  category: FirearmCategory;
  brand: string | null;
  model: string | null;
  caliber: string | null;
  serialNumber: string | null;
  registrationId: string | null;
  registrationBody: RegistrationBody | null;
  acquisitionDate: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberFirearmData {
  memberId: string;
  category: FirearmCategory;
  brand?: string | null;
  model?: string | null;
  caliber?: string | null;
  serialNumber?: string | null;
  registrationId?: string | null;
  registrationBody?: RegistrationBody | null;
  acquisitionDate?: string | null;
  notes?: string | null;
}

export type UpdateMemberFirearmData = Partial<Omit<CreateMemberFirearmData, 'memberId'>>;

// ── Service Functions ───────────────────────────────────────────────────────

export async function listMemberFirearms(memberId: string) {
  try {
    const response = await api.get(`/api/member-firearms/member/${memberId}`);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as MemberFirearm[] };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao listar armas do associado',
    };
  }
}

export async function createMemberFirearm(data: CreateMemberFirearmData) {
  try {
    const response = await api.post('/api/member-firearms', data);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as MemberFirearm };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao cadastrar arma',
    };
  }
}

export async function updateMemberFirearm(id: string, data: UpdateMemberFirearmData) {
  try {
    const response = await api.patch(`/api/member-firearms/${id}`, data);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as MemberFirearm };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao editar arma',
    };
  }
}

export async function deleteMemberFirearm(id: string) {
  try {
    const response = await api.delete(`/api/member-firearms/${id}`);
    if (response.data.success) {
      return { success: true as const };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao remover arma',
    };
  }
}
