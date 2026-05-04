import api from './api';

export interface ReportMember {
  id: string;
  fullName: string;
  cpf: string;
  memberNumber: string | null;
  email: string | null;
  phone: string | null;
  role?: string;
  dateOfBirth?: string | null;
  dayOfMonth?: number;
  ageThisMonth?: number;
  memberSince?: string;
  annuityValidUntil?: string | null;
  cr?: string | null;
  crLevel?: number | null;
  membershipTier?: string | null;
  status?: string;
  isActive?: boolean;
  daysRemaining?: number | null;
  daysOverdue?: number | null;
}

export interface BirthdaysReport {
  month: number;
  members: ReportMember[];
}

export interface MembersListReport {
  total: number;
  members: ReportMember[];
}

export interface MembersExpiringReport {
  days: number;
  total: number;
  members: ReportMember[];
}

export interface HabitualityBookRecord {
  id: string;
  caliber: string;
  activityDate: string;
  activityType: string;
  description: string | null;
  member: { id: string; fullName: string; cpf: string; memberNumber: string | null; cr: string | null; crLevel: number | null };
  verifiedBy: { id: string; fullName: string } | null;
  event: { id: string; title: string; eventType: string } | null;
  visit: {
    id: string;
    visitDate: string;
    checkInTime: string;
    details: Array<{ caliber: string; firearmName: string | null; shotsFired: number }>;
  } | null;
}

export interface HabitualityBookReport {
  from: string;
  to: string;
  total: number;
  records: HabitualityBookRecord[];
}

export interface HabitualityLowReport {
  year: number;
  total: number;
  associates: Array<{
    member: { id: string; fullName: string; cpf: string; memberNumber: string | null; cr: string | null; crLevel: number | null };
    caliberCounts: Array<{ caliber: string; count: number; required: number; gap: number }>;
    hasShortfall: boolean;
  }>;
}

export interface EquipmentInventoryItem {
  id: string;
  name: string;
  equipmentType: string;
  serialNumber: string | null;
  registrationId: string | null;
  caliber: string | null;
  brand: string | null;
  model: string | null;
  condition: string;
  isAvailable: boolean;
  acquisitionDate: string | null;
  notes: string | null;
}

export interface EquipmentInventoryReport {
  total: number;
  items: EquipmentInventoryItem[];
}

export interface AmmoMovement {
  id: string;
  movementType: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  notes: string | null;
  createdAt: string;
  referenceId: string | null;
  referenceType: string | null;
  stockItem: {
    id: string;
    product: { id: string; name: string; caliber: string | null; unit: string };
  };
  member?: { id: string; fullName: string; memberNumber: string | null; cpf: string } | null;
}

export interface AmmoMovementsReport {
  from: string;
  to: string;
  total: number;
  movements: AmmoMovement[];
}

export interface ShootersAmmoReport {
  from: string;
  to: string;
  totalShooters: number;
  totalShots: number;
  shooters: Array<{
    member: { id: string; fullName: string; cpf: string; memberNumber: string | null; cr: string | null; role: string };
    visits: number;
    totalShots: number;
    calibers: Array<{ caliber: string; shots: number }>;
  }>;
}

export interface AnnualPlanReport {
  year: number;
  totalEvents: number;
  events: Array<{
    id: string;
    title: string;
    eventType: string;
    eventDate: string;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
    description: string | null;
    _count: { participations: number };
  }>;
  modalities: Array<{ caliber: string; occurrences: number }>;
}

export interface ComplianceChecklistReport {
  quarter: number;
  year: number;
  period: { from: string; to: string };
  checklist: Array<{ key: string; label: string; ok: boolean; detail: string }>;
  kpis: {
    habCount: number;
    totalEquipment: number;
    totalAssociates: number;
    validAnnuities: number;
    annuityRate: number;
    totalAmmoYear: number;
    crSoon: number;
  };
}

export interface DeclarationDataPacket {
  member: {
    id: string;
    fullName: string;
    cpf: string;
    email: string | null;
    phone: string | null;
    dateOfBirth: string | null;
    role: string;
    photoUrl: string | null;
    address: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    rg: string | null;
    rgIssuer: string | null;
    nationality: string | null;
    naturality: string | null;
    fatherName: string | null;
    motherName: string | null;
    profession: string | null;
    maritalStatus: string | null;
    memberNumber: string | null;
    memberSince: string;
    cr: string | null;
    crLevel: number | null;
    crExpiry: string | null;
    annuityValidUntil: string | null;
    status: string;
    isActive: boolean;
  };
  club: {
    name: string;
    cnpj: string | null;
    crPj: string | null;
    crPjIssueDate: string | null;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    phone: string | null;
    email: string | null;
    responsibleName: string | null;
    responsibleCpf: string | null;
    responsibleRole: string | null;
    logoUrl: string | null;
  };
}

interface ApiOk<T> {
  success: true;
  data: T;
}

async function get<T>(path: string, params?: Record<string, any>): Promise<T> {
  const res = await api.get<ApiOk<T>>(path, { params });
  return res.data.data;
}

export const reportsService = {
  birthdays: (month: number, roles?: string[]) =>
    get<BirthdaysReport>('/api/reports/birthdays', { month, roles: roles?.join(',') }),

  membersActive: (hasCr?: boolean) =>
    get<MembersListReport>('/api/reports/members-active', hasCr === undefined ? {} : { hasCr: String(hasCr) }),

  membersInactive: (hasCr?: boolean) =>
    get<MembersListReport>('/api/reports/members-inactive', hasCr === undefined ? {} : { hasCr: String(hasCr) }),

  membersExpiring: (days = 30) =>
    get<MembersExpiringReport>('/api/reports/members-expiring', { days }),

  membersOverdue: (days = 30) =>
    get<MembersExpiringReport>('/api/reports/members-overdue', { days }),

  habitualityBook: (from: string, to: string) =>
    get<HabitualityBookReport>('/api/reports/habituality-book', { from, to }),

  habitualityLow: (year?: number) =>
    get<HabitualityLowReport>('/api/reports/habituality-low', { year }),

  equipmentInventory: (filters: { equipmentType?: string; condition?: string } = {}) =>
    get<EquipmentInventoryReport>('/api/reports/equipment-inventory', filters),

  ammoIn: (from: string, to: string) =>
    get<AmmoMovementsReport>('/api/reports/ammo-in', { from, to }),

  ammoOut: (from: string, to: string) =>
    get<AmmoMovementsReport>('/api/reports/ammo-out', { from, to }),

  shootersAmmo: (from: string, to: string) =>
    get<ShootersAmmoReport>('/api/reports/shooters-ammo', { from, to }),

  annualPlan: (year?: number) => get<AnnualPlanReport>('/api/reports/annual-plan', { year }),

  complianceChecklist: (quarter?: number, year?: number) =>
    get<ComplianceChecklistReport>('/api/reports/compliance-checklist', { quarter, year }),

  declarationData: (memberId: string) =>
    get<DeclarationDataPacket>(`/api/reports/declaration-data/${memberId}`),
};
