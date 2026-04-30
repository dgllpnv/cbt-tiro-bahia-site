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
