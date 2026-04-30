import api from './api';

export interface News {
  id: string;
  title: string;
  content: string;
  summary?: string;
  imageUrl?: string;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    photoUrl?: string;
  };
}

export interface CreateNewsData {
  title: string;
  content: string;
  summary?: string;
  imageUrl?: string;
  isPinned?: boolean;
  isPublished?: boolean;
}

export async function listNews(params?: { page?: number; limit?: number }) {
  try {
    const response = await api.get('/api/news', { params });
    if (response.data.success) {
      return { success: true, data: response.data.data as News[], pagination: response.data.pagination };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar noticias' };
  }
}

export async function getNewsById(id: string) {
  try {
    const response = await api.get(`/api/news/${id}`);
    if (response.data.success) return { success: true, data: response.data.data as News };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar noticia' };
  }
}

export async function createNews(data: CreateNewsData) {
  try {
    const response = await api.post('/api/news', data);
    if (response.data.success) return { success: true, data: response.data.data as News };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao criar noticia' };
  }
}

export async function updateNews(id: string, data: Partial<CreateNewsData>) {
  try {
    const response = await api.put(`/api/news/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data as News };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao atualizar noticia' };
  }
}

export async function deleteNews(id: string) {
  try {
    const response = await api.delete(`/api/news/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao excluir noticia' };
  }
}
