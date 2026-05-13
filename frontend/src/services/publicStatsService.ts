import axios from 'axios';

// Endpoints publicos NAO devem reusar a instancia `api` autenticada
// (interceptors injetam JWT desnecessariamente e podem falhar se token
// expirado). Cliente separado, sem auth.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export interface SiteStats {
  totalViews: number;
}

/** Incrementa o contador de visitas do site e retorna o novo total. */
export async function registerSiteView() {
  try {
    const r = await publicApi.post('/api/public/site-view');
    if (r.data?.success) {
      return { success: true as const, data: r.data.data as SiteStats };
    }
    return { success: false as const, error: r.data?.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error?.response?.data?.error || 'Erro ao registrar visita',
    };
  }
}

/** Le o contador atual sem incrementar. */
export async function getSiteStats() {
  try {
    const r = await publicApi.get('/api/public/site-stats');
    if (r.data?.success) {
      return { success: true as const, data: r.data.data as SiteStats };
    }
    return { success: false as const, error: r.data?.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error?.response?.data?.error || 'Erro ao buscar estatisticas',
    };
  }
}
