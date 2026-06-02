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
