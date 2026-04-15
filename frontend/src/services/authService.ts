import api, { saveToken, removeToken } from './api';
import type { User, UserRole } from '@/types/user';

interface LoginResponse {
  success: boolean;
  user?: User;
  error?: string;
}

interface MeResponse {
  success: boolean;
  user?: User;
  error?: string;
}

function mapRole(backendRole: string): UserRole {
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

export async function login(identifier: string, password: string): Promise<LoginResponse> {
  try {
    const response = await api.post('/api/auth/login', { email: identifier, password });
    if (response.data.success) {
      const { token, user } = response.data.data;
      saveToken(token);
      const mappedUser = mapUser(user);
      return { success: true, user: mappedUser };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Erro ao fazer login',
    };
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post('/api/auth/logout');
  } catch {
    // Ignore errors on logout
  } finally {
    removeToken();
    localStorage.removeItem('cbt_auth_user');
  }
}

export async function getMe(): Promise<MeResponse & { isAuthError?: boolean }> {
  try {
    const response = await api.get('/api/auth/me');
    if (response.data.success) {
      // Backend returns { data: { user: {...} } } — extract the user object
      const rawUser = response.data.data?.user || response.data.data;
      return { success: true, user: mapUser(rawUser) };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 401) {
      return { success: false, error: 'Token expirado', isAuthError: true };
    }
    return { success: false, error: 'Erro de rede' };
  }
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await api.put('/api/auth/change-password', { oldPassword, newPassword });
    if (response.data.success) return { success: true };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao alterar senha' };
  }
}

export function hasToken(): boolean {
  return !!localStorage.getItem('cbt_auth_token');
}
