import api from './api';

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface MatchedMember {
  id: string;
  fullName: string;
  memberNumber: string | null;
  cpf: string;
  role: 'ADMIN' | 'ASSOCIATE' | 'VISITOR';
  photoUrl: string | null;
}

export interface FaceVerifyResult {
  matched: boolean;
  member?: MatchedMember;
  similarity?: number;
  profileId?: string;
  suggestions: Array<{
    member: MatchedMember;
    similarity: number;
    profileId: string;
  }>;
}

export interface FaceProfileSummary {
  id: string;
  source: 'CHECK_IN' | 'CHECK_OUT' | 'MANUAL';
  thumbnail: string | null;
  notes: string | null;
  visitId: string | null;
  createdAt: string;
  capturedBy: { id: string; fullName: string };
}

export interface CreateFaceProfileData {
  memberId: string;
  descriptor: number[];
  thumbnail?: string | null;
  source: 'CHECK_IN' | 'CHECK_OUT' | 'MANUAL';
  visitId?: string | null;
  notes?: string | null;
  // Origem da habitualidade gerada no checkout (treino/competicao).
  activityType?: 'TRAINING' | 'COMPETITION';
}

export interface CreateFaceProfileResult {
  profile: {
    id: string;
    source: string;
    createdAt: string;
    thumbnail: string | null;
  };
  habituality: {
    created: number;
    calibers: string[];
  } | null;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function verifyFace(descriptor: number[], threshold?: number) {
  try {
    const response = await api.post('/api/face-profiles/verify', { descriptor, threshold });
    if (response.data.success) {
      return { success: true as const, data: response.data.data as FaceVerifyResult };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao verificar face',
    };
  }
}

export type CheckoutVerifyResult =
  | {
      matched: true;
      similarity: number;
      profileId: string;
      habituality: { created: number; calibers: string[] };
    }
  | {
      matched: false;
      reason: 'NO_PROFILE_REGISTERED' | 'LOW_SIMILARITY';
      similarity: number | null;
    };

export async function verifyFaceForCheckout(params: {
  descriptor: number[];
  memberId: string;
  visitId: string;
  threshold?: number;
  activityType?: 'TRAINING' | 'COMPETITION';
}) {
  try {
    const response = await api.post('/api/face-profiles/verify-checkout', params);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as CheckoutVerifyResult };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao verificar facial no checkout',
    };
  }
}

export async function createFaceProfile(data: CreateFaceProfileData) {
  try {
    const response = await api.post('/api/face-profiles', data);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as CreateFaceProfileResult };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao registrar face',
    };
  }
}

export async function listMemberFaceProfiles(memberId: string) {
  try {
    const response = await api.get(`/api/face-profiles/member/${memberId}`);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as FaceProfileSummary[] };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao listar perfis faciais',
    };
  }
}

export async function deleteFaceProfile(id: string) {
  try {
    const response = await api.delete(`/api/face-profiles/${id}`);
    if (response.data.success) {
      return { success: true as const };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao excluir perfil facial',
    };
  }
}
