import api from './api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  maxParticipants: number | null;
  isPublic: boolean;
  registrationDeadline: string | null;
  imageUrl: string | null;
  createdAt: string;
  _count?: {
    participations: number;
  };
}

export interface EventParticipation {
  id: string;
  eventId: string;
  memberId: string;
  caliberUsed: string | null;
  countsAsHabituality: boolean;
  placement: number | null;
  score: number | null;
  notes: string | null;
  createdAt: string;
  member: {
    id: string;
    fullName: string;
    memberNumber: number | null;
  };
}

export interface CreateEventData {
  title: string;
  description?: string;
  eventType: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  maxParticipants?: number;
  isPublic?: boolean;
  registrationDeadline?: string;
  imageUrl?: string;
}

export interface AddParticipantData {
  memberId: string;
  caliberUsed?: string;
  countsAsHabituality?: boolean;
}

export interface EventResult {
  participationId: string;
  placement?: number;
  score?: number;
  notes?: string;
}

interface ListEventsParams {
  upcoming?: string;
  eventType?: string;
  page?: number;
  limit?: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listEvents(params?: ListEventsParams) {
  try {
    const response = await api.get('/api/events', { params });
    if (response.data.success) {
      return { success: true, data: response.data.data as Event[], pagination: response.data.pagination };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao listar eventos' };
  }
}

export async function getEventById(id: string) {
  try {
    const response = await api.get(`/api/events/${id}`);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao buscar evento' };
  }
}

export async function createEvent(data: CreateEventData) {
  try {
    const response = await api.post('/api/events', data);
    if (response.data.success) return { success: true, data: response.data.data as Event };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao criar evento' };
  }
}

export async function updateEvent(id: string, data: Partial<CreateEventData>) {
  try {
    const response = await api.put(`/api/events/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data as Event };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao atualizar evento' };
  }
}

export async function deleteEvent(id: string) {
  try {
    const response = await api.delete(`/api/events/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao excluir evento' };
  }
}

export async function addParticipant(eventId: string, data: AddParticipantData) {
  try {
    const response = await api.post(`/api/events/${eventId}/participate`, data);
    if (response.data.success) return { success: true, data: response.data.data as EventParticipation };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao registrar participacao' };
  }
}

export async function updateResults(eventId: string, results: EventResult[]) {
  try {
    const response = await api.put(`/api/events/${eventId}/results`, { results });
    if (response.data.success) return { success: true };
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || 'Erro ao atualizar resultados' };
  }
}
