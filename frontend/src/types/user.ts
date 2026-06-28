export type UserRole = 'admin' | 'cashier' | 'associate';

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
  crExpiry?: string;
  annuityValidUntil?: string;
  memberSince?: string;
  status: string;
  /** Quando true, o frontend forca a tela de "primeiro acesso" antes
   *  de liberar qualquer rota protegida. Flipa para false apos o usuario
   *  definir nova senha OU optar por manter o CPF. */
  mustChangePassword?: boolean;
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
