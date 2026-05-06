import { format, parseISO } from 'date-fns';

/**
 * Formats a CPF string as ###.###.###-##
 */
export function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Masks a CPF string as ###.###.***-**
 */
export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.***-**');
}

/**
 * Formats a phone string as (##) #####-####
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

/**
 * Formats a number as BRL currency: R$ #.###,##
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Formats an ISO date string as DD/MM/YYYY
 */
export function formatDate(date: string): string {
  try {
    return format(parseISO(date), 'dd/MM/yyyy');
  } catch {
    return date;
  }
}

/**
 * Formats an ISO date string as DD/MM/YYYY HH:mm
 */
export function formatDateTime(date: string): string {
  try {
    return format(parseISO(date), 'dd/MM/yyyy HH:mm');
  } catch {
    return date;
  }
}
