import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface MemberDocument {
  id: string;
  memberId: string;
  documentType: string;
  title: string;
  description: string | null;
  templateData: any;
  generatedById: string;
  generatedAt: string;
  generatedBy: {
    id: string;
    fullName: string;
  };
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function getMemberDocuments(memberId: string) {
  try {
    const response = await api.get(`/api/documents/member/${memberId}`);
    if (response.data.success) return { success: true, data: response.data.data as MemberDocument[] };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar documentos' };
  }
}

export async function generateFiliation(memberId: string) {
  try {
    const response = await api.post(`/api/documents/generate/filiation/${memberId}`);
    if (response.data.success) return { success: true, data: response.data.data as MemberDocument };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao gerar declaracao de filiacao' };
  }
}

export async function generateHabituality(memberId: string, year?: number) {
  try {
    const response = await api.post(`/api/documents/generate/habituality/${memberId}`, { year });
    if (response.data.success) return { success: true, data: response.data.data as MemberDocument };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao gerar declaracao de habitualidade' };
  }
}

export async function generateMembershipCard(memberId: string) {
  try {
    const response = await api.post(`/api/documents/generate/membership-card/${memberId}`);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao gerar carteirinha' };
  }
}
