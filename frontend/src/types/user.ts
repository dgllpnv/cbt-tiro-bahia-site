export type UserRole = 'admin' | 'associate';

export interface User {
  id: string;
  email: string;
  cpf: string;
  fullName: string;
  role: UserRole;
  memberNumber: string;
  photoUrl?: string;
  phone?: string;
  cr?: string;
  crLevel?: number;
  annuityValidUntil?: string;
  memberSince?: string;
  status: string;
  // Thumbnail base64 do FaceProfile mais recente ativo (1 elemento ou vazio).
  // Usado para renderizar avatar na lista e no perfil do associado.
  faceProfiles?: Array<{ thumbnail: string | null }>;
  // Anexos do associado (presente apenas em GET /api/users/:id, não no list).
  attachments?: UserAttachment[];
}

export interface UserAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
  description?: string;
  uploadedAt: string;
}
