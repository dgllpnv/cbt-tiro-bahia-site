import { z } from 'zod';
import { prisma } from './prisma.js';

export const firearmOwnershipSchema = z.enum(['OWN', 'THIRD_PARTY']).nullable().optional();
export const memberFirearmIdSchema = z.string().uuid().nullable().optional();

export interface FirearmFieldsInput {
  firearmOwnership?: 'OWN' | 'THIRD_PARTY' | null;
  memberFirearmId?: string | null;
  firearmName?: string | null;
  caliber?: string | null;
}

export interface FirearmFields {
  firearmOwnership?: string | null;
  memberFirearmId?: string | null;
  firearmSerial?: string | null;
  firearmRegistrationId?: string | null;
  firearmName?: string | null;
  caliber?: string;
}

export interface FirearmResolution { ok: boolean; error?: string; fields: FirearmFields }

/**
 * Resolve os campos de arma (propria/terceiro) de uma linha de tiro.
 * Retorna apenas o que deve ser gravado: se nem firearmOwnership nem
 * memberFirearmId vieram, retorna {} (nao altera nada no PUT; no create
 * os campos ficam null por default).
 * Para OWN + memberFirearmId, valida no servidor que a arma existe, esta
 * ativa e pertence ao socio (impede IDOR) e preenche nome/calibre/serie/registro.
 */
export async function resolveFirearmFields(
  memberId: string,
  input: FirearmFieldsInput,
): Promise<FirearmResolution> {
  const { firearmOwnership, memberFirearmId } = input;
  if (firearmOwnership === undefined && memberFirearmId === undefined) {
    return { ok: true, fields: {} };
  }

  const ownership = firearmOwnership === undefined && memberFirearmId ? 'OWN' : firearmOwnership;

  if (ownership === 'OWN' && memberFirearmId) {
    const firearm = await prisma.memberFirearm.findUnique({ where: { id: memberFirearmId } });
    if (!firearm || !firearm.isActive || firearm.memberId !== memberId) {
      return { ok: false, error: 'Arma invalida ou nao pertence ao associado', fields: {} };
    }
    const composed = `${firearm.brand ?? ''} ${firearm.model ?? ''}`.trim();
    const fields: FirearmFields = {
      firearmOwnership: 'OWN',
      memberFirearmId: firearm.id,
      firearmSerial: firearm.serialNumber ?? null,
      firearmRegistrationId: firearm.registrationId ?? null,
      firearmName: composed || input.firearmName?.trim() || null,
    };
    if (firearm.caliber && firearm.caliber.trim()) fields.caliber = firearm.caliber.trim();
    return { ok: true, fields };
  }

  // OWN sem arma cadastrada, THIRD_PARTY ou null: limpa vinculo/serie/registro.
  return {
    ok: true,
    fields: {
      firearmOwnership: ownership ?? null,
      memberFirearmId: null,
      firearmSerial: null,
      firearmRegistrationId: null,
    },
  };
}

/** Campos de arma de uma linha, para devolver nas leituras. */
export const FIREARM_DETAIL_SELECT = {
  id: true,
  caliber: true,
  firearmName: true,
  shotsFired: true,
  ammunitionType: true,
  firearmOwnership: true,
  firearmSerial: true,
  firearmRegistrationId: true,
  memberFirearmId: true,
} as const;
