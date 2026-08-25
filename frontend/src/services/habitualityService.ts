import api from './api';
import type { AmmunitionType } from './visitDetailsService';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ManualSessionDetail {
  caliber: string;
  firearmName?: string;
  shotsFired: number;
  ammunitionType?: AmmunitionType | null;
}

export interface ManualSessionPayload {
  memberId: string;
  activityDate: string; // ISO YYYY-MM-DD
  activityType: 'TRAINING' | 'COMPETITION';
  notes?: string;
  details: ManualSessionDetail[];
}

export interface ManualSessionResult {
  visitId: string;
  calibers: number;
  details: number;
}

export type ActivityType = 'TRAINING' | 'COMPETITION';

export interface HabitualityRecord {
  id: string;
  caliber: string;
  activityDate: string;
  activityType: ActivityType;
  description?: string | null;
  visit?: { id: string; visitDate: string } | null;
  event?: { id: string; title: string; eventType: string } | null;
  verifiedBy?: { id: string; fullName: string } | null;
  /** Enriquecido pelo backend a partir do VisitDetail casado por calibre — mesmo dado que sai na Declaração de Habitualidade. */
  firearmName?: string | null;
  shotsFired?: number | null;
  ammunitionType?: AmmunitionType | null;
  /** Id da linha do VisitDetail casada (para reenviar no PUT e editar arma/tiros/munição). Null se o registro não tem visita vinculada. */
  visitDetailId?: string | null;
}

export interface UpdateHabitualityPayload {
  caliber: string;
  activityDate: string; // ISO YYYY-MM-DD
  activityType: ActivityType;
  description?: string | null;
  /** Repassa o mesmo id vindo em HabitualityRecord.visitDetailId — so envie quando o registro tiver visita vinculada. */
  visitDetailId?: string | null;
  firearmName?: string | null;
  shotsFired?: number | null;
  ammunitionType?: AmmunitionType | null;
}

// ── Service Functions ───────────────────────────────────────────────────────

/**
 * Lanca uma sessao retroativa completa de habitualidade.
 *
 * Backend cria Visit fantasma (notes prefixados [MANUAL]), VisitDetails
 * e HabitualityRecord (1 por calibre unico) numa transaction. O registro
 * aparece em todos os relatorios e na contagem de habitualidade do socio.
 *
 * Apenas ADMIN — cashier nao tem poder retroativo.
 */
export async function createManualSession(payload: ManualSessionPayload) {
  try {
    const response = await api.post('/api/habituality/manual', payload);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as ManualSessionResult };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao lancar sessao manual',
    };
  }
}

/**
 * Lista as habitualidades de um associado num ano (com notas/origem).
 * ADMIN pode consultar qualquer associado; associado so o proprio.
 */
export async function getMemberHabituality(memberId: string, year: number) {
  try {
    const response = await api.get(`/api/habituality/member/${memberId}`, { params: { year } });
    if (response.data.success) {
      return { success: true as const, data: response.data.data as HabitualityRecord[] };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao buscar habitualidade',
    };
  }
}

/**
 * Lista o livro de habitualidade COMPLETO de um associado (todos os anos),
 * mais recente primeiro. Usado na tela de lancamento manual.
 */
export async function getAllMemberHabituality(memberId: string) {
  try {
    const response = await api.get(`/api/habituality/member/${memberId}`, { params: { all: 'true' } });
    if (response.data.success) {
      return { success: true as const, data: response.data.data as HabitualityRecord[] };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao buscar habitualidade',
    };
  }
}

/** Edita um registro de habitualidade (ADMIN/CASHIER). */
export async function updateHabituality(id: string, payload: UpdateHabitualityPayload) {
  try {
    const response = await api.put(`/api/habituality/${id}`, payload);
    if (response.data.success) {
      return { success: true as const, data: response.data.data as HabitualityRecord };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao editar habitualidade',
    };
  }
}

/** Exclui um registro de habitualidade (ADMIN/CASHIER). */
export async function deleteHabituality(id: string) {
  try {
    const response = await api.delete(`/api/habituality/${id}`);
    if (response.data.success) {
      return { success: true as const };
    }
    return { success: false as const, error: response.data.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.response?.data?.error || 'Erro ao excluir habitualidade',
    };
  }
}
