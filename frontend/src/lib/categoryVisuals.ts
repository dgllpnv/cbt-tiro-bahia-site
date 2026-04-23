import {
  Crosshair,
  Target,
  Wrench,
  ShieldCheck,
  KeyRound,
  GraduationCap,
  Package,
  type LucideIcon,
} from 'lucide-react';

export interface CategoryVisual {
  icon: LucideIcon;
  label: string;
  color: string;       // hex for inline styles (icon, accent strip)
  bg: string;          // tailwind bg-*/10
  bgStrong: string;    // tailwind bg-*/20
  border: string;      // tailwind border-*/40
  text: string;        // tailwind text-*
  ring: string;        // tailwind ring-*
}

const FALLBACK: CategoryVisual = {
  icon: Package,
  label: 'Outro',
  color: '#6b7280',
  bg: 'bg-gray-500/10',
  bgStrong: 'bg-gray-500/20',
  border: 'border-gray-500/40',
  text: 'text-gray-300',
  ring: 'ring-gray-500/40',
};

export const categoryVisuals: Record<string, CategoryVisual> = {
  AMMUNITION: {
    icon: Crosshair,
    label: 'Munição',
    color: '#dc2626',
    bg: 'bg-red-500/10',
    bgStrong: 'bg-red-500/20',
    border: 'border-red-500/40',
    text: 'text-red-300',
    ring: 'ring-red-500/40',
  },
  TARGET: {
    icon: Target,
    label: 'Alvo',
    color: '#2563eb',
    bg: 'bg-blue-500/10',
    bgStrong: 'bg-blue-500/20',
    border: 'border-blue-500/40',
    text: 'text-blue-300',
    ring: 'ring-blue-500/40',
  },
  ACCESSORY: {
    icon: Wrench,
    label: 'Acessório',
    color: '#7c3aed',
    bg: 'bg-violet-500/10',
    bgStrong: 'bg-violet-500/20',
    border: 'border-violet-500/40',
    text: 'text-violet-300',
    ring: 'ring-violet-500/40',
  },
  SAFETY_EQUIPMENT: {
    icon: ShieldCheck,
    label: 'Segurança',
    color: '#f59e0b',
    bg: 'bg-amber-500/10',
    bgStrong: 'bg-amber-500/20',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
    ring: 'ring-amber-500/40',
  },
  RENTAL_ITEM: {
    icon: KeyRound,
    label: 'Aluguel',
    color: '#0891b2',
    bg: 'bg-cyan-500/10',
    bgStrong: 'bg-cyan-500/20',
    border: 'border-cyan-500/40',
    text: 'text-cyan-300',
    ring: 'ring-cyan-500/40',
  },
  COURSE: {
    icon: GraduationCap,
    label: 'Curso',
    color: '#16a34a',
    bg: 'bg-green-500/10',
    bgStrong: 'bg-green-500/20',
    border: 'border-green-500/40',
    text: 'text-green-300',
    ring: 'ring-green-500/40',
  },
  OTHER: FALLBACK,
};

export function getCategoryVisual(category: string | null | undefined): CategoryVisual {
  if (!category) return FALLBACK;
  return categoryVisuals[category] ?? FALLBACK;
}

export const CATEGORY_KEYS = ['AMMUNITION', 'TARGET', 'ACCESSORY', 'SAFETY_EQUIPMENT', 'RENTAL_ITEM', 'COURSE', 'OTHER'] as const;
