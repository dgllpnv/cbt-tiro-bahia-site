import api from './api';
import type { DeclarationDataPacket } from './reportsService';

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

// Pacote { member, club } para gerar a Declaracao de Filiacao no cliente
// (buildFiliacaoPdf). Endpoint self-acessivel (associado ou admin).
export async function getFiliacaoDeclarationData(memberId: string) {
  try {
    const response = await api.get(`/api/documents/declaration/filiation/${memberId}`);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as DeclarationDataPacket };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao buscar dados da declaracao',
    };
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

// ── Pacote completo da Declaracao de Habitualidade (para gerar PDF no client) ──

export interface HabitualityActivity {
  date: string;
  activityType: 'TRAINING' | 'COMPETITION';
  modality: string;
  caliber: string;
  firearmName: string | null;
  shotsFired: number | null;
  ammunitionType: 'RELOADED' | 'FACTORY' | null;
  eventTitle: string | null;
  source: 'EVENT' | 'VISIT' | 'MANUAL';
  recordId: string;
}

export interface HabitualityDeclarationPacket {
  club: {
    name: string;
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
    logoUrl: string | null;
  };
  member: {
    fullName: string;
    cpf: string;
    dateOfBirth: string | null;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    cr: string | null;
    crLevel: number | null;
    crExpiry: string | null;
    memberNumber: string;
    memberSince: string | null;
    annuityValidUntil: string | null;
  };
  period: { year: number; startDate: string; endDate: string };
  activities: HabitualityActivity[];
  totalsByCaliber: { caliber: string; count: number; required: number; compliant: boolean }[];
  totals: { trainings: number; competitions: number; total: number };
  crLevelTargets: { level: number; requiredTrainings: number; requiredCompetitions: number };
}

export async function getHabitualityDeclarationData(memberId: string, year?: number) {
  try {
    const response = await api.get(`/api/documents/declaration/habituality/${memberId}`, {
      params: year ? { year } : undefined,
    });
    if (response.data.success) {
      return { success: true as const, data: response.data.data as HabitualityDeclarationPacket };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao buscar dados da declaracao',
    };
  }
}
