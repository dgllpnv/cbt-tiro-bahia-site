import axios from 'axios';

// Cliente publico (sem JWT interceptor) — mesmo padrao de publicStatsService.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export interface PublicNews {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  imageUrl: string | null;
  isPinned: boolean;
  publishedAt: string;
  author: { fullName: string };
}

export interface PublicGalleryImage {
  id: string;
  imageUrl: string;
  caption: string | null;
  displayOrder: number;
}

export async function fetchPublicNews(limit = 6) {
  try {
    const r = await publicApi.get('/api/public/news', { params: { limit } });
    if (r.data?.success) return { success: true as const, data: r.data.data as PublicNews[] };
    return { success: false as const, error: r.data?.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error?.response?.data?.error || 'Erro ao buscar noticias',
    };
  }
}

export async function fetchPublicGallery() {
  try {
    const r = await publicApi.get('/api/public/gallery');
    if (r.data?.success) return { success: true as const, data: r.data.data as PublicGalleryImage[] };
    return { success: false as const, error: r.data?.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error?.response?.data?.error || 'Erro ao buscar galeria',
    };
  }
}
