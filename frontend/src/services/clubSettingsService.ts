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
  crPjIssueDate: string | null;
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
    | 'crPjIssueDate'
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

// =====================================================
// Assinatura Digital — usada para assinar PDFs (POST /api/documents/sign).
// O arquivo do certificado (.pfx/.p12) e a senha nunca voltam do backend
// (write-only) — so metadados, extraidos automaticamente do certificado
// no upload (titular/emissor/validade vem do proprio .pfx, node-forge).
// =====================================================

export interface DigitalSignatureMeta {
  configured: boolean;
  fileName?: string;
  holderName?: string | null;
  issuer?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  uploadedByEmail?: string;
  uploadedAt?: string;
}

export interface UploadDigitalSignaturePayload {
  fileName: string;
  /** base64 puro do arquivo .pfx/.p12 (sem prefixo data:...;base64,). */
  fileData: string;
  password: string;
}

export async function getDigitalSignature() {
  try {
    const response = await api.get('/api/club-settings/digital-signature');
    if (response.data.success) {
      return { success: true as const, data: response.data.data as DigitalSignatureMeta };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao buscar assinatura digital',
    };
  }
}

export async function uploadDigitalSignature(payload: UploadDigitalSignaturePayload) {
  try {
    const response = await api.post('/api/club-settings/digital-signature', payload);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as DigitalSignatureMeta };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao anexar assinatura digital',
    };
  }
}

export async function removeDigitalSignature() {
  try {
    const response = await api.delete('/api/club-settings/digital-signature');
    if (response.data.success) {
      return { success: true as const };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao remover assinatura digital',
    };
  }
}
