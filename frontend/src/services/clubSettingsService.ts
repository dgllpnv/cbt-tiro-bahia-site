import api from './api';

export interface ClubSettings {
  id: string;
  clubId: string;
  clubName: string;
  annuityAmount: number | string;
  totalLanes: number;
  logoUrl: string | null;

  cnpj: string | null;
  crPj: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
  responsibleName: string | null;
  responsibleCpf: string | null;
  responsibleRole: string | null;

  updatedAt: string;
}

export type UpdateClubSettingsData = Partial<
  Pick<
    ClubSettings,
    | 'clubName'
    | 'totalLanes'
    | 'logoUrl'
    | 'cnpj'
    | 'crPj'
    | 'addressLine'
    | 'city'
    | 'state'
    | 'zipCode'
    | 'phone'
    | 'email'
    | 'responsibleName'
    | 'responsibleCpf'
    | 'responsibleRole'
  >
> & {
  annuityAmount?: number;
};

/** Campos minimos que precisam estar preenchidos para emitir Declaracao de Habitualidade. */
export const REQUIRED_FOR_DECLARATION = [
  'cnpj',
  'crPj',
  'addressLine',
  'city',
  'state',
  'responsibleName',
  'responsibleRole',
] as const;

export function getMissingDeclarationFields(settings: ClubSettings | null): string[] {
  if (!settings) return [...REQUIRED_FOR_DECLARATION];
  return REQUIRED_FOR_DECLARATION.filter((k) => {
    const v = settings[k];
    return !v || (typeof v === 'string' && v.trim() === '');
  });
}

export async function getClubSettings() {
  try {
    const response = await api.get('/api/club-settings');
    if (response.data.success) {
      return { success: true as const, data: response.data.data as ClubSettings };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao buscar configuracoes do clube',
    };
  }
}

export async function updateClubSettings(data: UpdateClubSettingsData) {
  try {
    const response = await api.patch('/api/club-settings', data);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as ClubSettings };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao atualizar configuracoes do clube',
    };
  }
}
