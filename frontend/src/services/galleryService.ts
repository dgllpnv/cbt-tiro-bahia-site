import api from './api';

export interface GalleryImage {
  id: string;
  imageUrl: string;
  caption: string | null;
  displayOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryListResult {
  success: true;
  data: GalleryImage[];
  total: number;
  max: number;
}

export interface CreateGalleryImagePayload {
  imageUrl: string;
  caption?: string;
  displayOrder?: number;
  isPublished?: boolean;
}

export type UpdateGalleryImagePayload = Partial<CreateGalleryImagePayload>;

export async function listGallery() {
  try {
    const r = await api.get('/api/gallery');
    if (r.data?.success) {
      return {
        success: true as const,
        data: r.data.data as GalleryImage[],
        total: r.data.total as number,
        max: r.data.max as number,
      };
    }
    return { success: false as const, error: r.data?.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error?.response?.data?.error || 'Erro ao listar galeria',
    };
  }
}

export async function createGalleryImage(payload: CreateGalleryImagePayload) {
  try {
    const r = await api.post('/api/gallery', payload);
    if (r.data?.success) return { success: true as const, data: r.data.data as GalleryImage };
    return { success: false as const, error: r.data?.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error?.response?.data?.error || 'Erro ao adicionar imagem',
    };
  }
}

export async function updateGalleryImage(id: string, payload: UpdateGalleryImagePayload) {
  try {
    const r = await api.put(`/api/gallery/${id}`, payload);
    if (r.data?.success) return { success: true as const, data: r.data.data as GalleryImage };
    return { success: false as const, error: r.data?.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error?.response?.data?.error || 'Erro ao atualizar imagem',
    };
  }
}

export async function deleteGalleryImage(id: string) {
  try {
    const r = await api.delete(`/api/gallery/${id}`);
    if (r.data?.success) return { success: true as const };
    return { success: false as const, error: r.data?.error };
  } catch (error: any) {
    return {
      success: false as const,
      error: error?.response?.data?.error || 'Erro ao remover imagem',
    };
  }
}
