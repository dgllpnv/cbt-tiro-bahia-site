import api from './api';
import type { User } from '@/types/user';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface CreateUserData {
  email: string;
  cpf: string;
  fullName: string;
  password: string;
  memberNumber: string;
  role: 'ADMIN' | 'ASSOCIATE';
  dateOfBirth?: string;
  phone?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  cr?: string;
  crLevel?: number;
  membershipTier?: string;
  // Dados civis usados em declaracoes oficiais (DGA, DSA, DIC, etc.)
  rg?: string;
  rgIssuer?: string;
  nationality?: string;
  naturality?: string;
  fatherName?: string;
  motherName?: string;
  profession?: string;
  maritalStatus?: string;
}

export interface UpdateUserData {
  email?: string;
  fullName?: string;
  phone?: string;
  role?: string;
  cr?: string;
  crLevel?: number;
  annuityValidUntil?: string;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  rg?: string | null;
  rgIssuer?: string | null;
  nationality?: string | null;
  naturality?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  profession?: string | null;
  maritalStatus?: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UsersListResponse {
  success: boolean;
  data?: {
    users: User[];
    pagination: PaginationMeta;
  };
  error?: string;
}

export interface UserResponse {
  success: boolean;
  data?: User;
  error?: string;
}

export interface SimpleResponse {
  success: boolean;
  error?: string;
}

interface ListUsersParams {
  role?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ── Helper to map backend user fields ───────────────────────────────────────

function mapRole(backendRole: string): 'admin' | 'associate' {
  switch (backendRole) {
    case 'ADMIN': return 'admin';
    case 'ASSOCIATE': return 'associate';
    default: return 'associate';
  }
}

function mapUser(raw: any): User {
  return {
    id: raw.id,
    email: raw.email,
    cpf: raw.cpf,
    fullName: raw.fullName,
    role: mapRole(raw.role),
    memberNumber: raw.memberNumber,
    photoUrl: raw.photoUrl,
    phone: raw.phone,
    cr: raw.cr,
    crLevel: raw.crLevel,
    annuityValidUntil: raw.annuityValidUntil,
    memberSince: raw.memberSince,
    status: raw.status || 'ACTIVE',
  };
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listUsers(params?: ListUsersParams): Promise<UsersListResponse> {
  try {
    const response = await api.get('/api/users', { params });
    if (response.data.success) {
      const usersRaw: any[] = Array.isArray(response.data.data) ? response.data.data : [];
      const pagination: PaginationMeta = response.data.pagination ?? {
        page: 1,
        limit: usersRaw.length,
        total: usersRaw.length,
        totalPages: 1,
      };
      return {
        success: true,
        data: {
          users: usersRaw.map(mapUser),
          pagination,
        },
      };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Erro ao listar usuarios',
    };
  }
}

export async function getUserById(id: string): Promise<UserResponse> {
  try {
    const response = await api.get(`/api/users/${id}`);
    if (response.data.success) {
      return { success: true, data: mapUser(response.data.data) };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Erro ao buscar usuario',
    };
  }
}

export async function createUser(data: CreateUserData): Promise<UserResponse> {
  try {
    const response = await api.post('/api/users', data);
    if (response.data.success) {
      return { success: true, data: mapUser(response.data.data) };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Erro ao criar usuario',
    };
  }
}

export async function updateUser(id: string, data: UpdateUserData): Promise<UserResponse> {
  try {
    const response = await api.put(`/api/users/${id}`, data);
    if (response.data.success) {
      return { success: true, data: mapUser(response.data.data) };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Erro ao atualizar usuario',
    };
  }
}

export async function updateUserStatus(id: string, status: string): Promise<SimpleResponse> {
  try {
    const response = await api.patch(`/api/users/${id}/status`, { status });
    if (response.data.success) {
      return { success: true };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Erro ao atualizar status',
    };
  }
}

export async function resetUserPassword(id: string, newPassword: string): Promise<SimpleResponse> {
  try {
    const response = await api.put(`/api/users/${id}/password`, { newPassword });
    if (response.data.success) {
      return { success: true };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Erro ao redefinir senha',
    };
  }
}

export async function deleteUser(id: string): Promise<SimpleResponse> {
  try {
    const response = await api.delete(`/api/users/${id}`, { data: { confirm: true } });
    if (response.data.success) {
      return { success: true };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Erro ao excluir usuario',
    };
  }
}
