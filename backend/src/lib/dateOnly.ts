// =====================================================
// dateOnly.ts — Aritmetica de data-calendario em UTC
//
// Campos `@db.Date` (activityDate, visitDate, memberSince, annuityValidUntil,
// validFrom/validUntil, dateOfBirth, crExpiry, eventDate, expenseDate) nao tem
// hora: o Postgres guarda so o dia e o Prisma devolve meia-noite UTC.
//
// Qualquer conta feita com os construtores/getters LOCAIS (new Date(y, m, d),
// setHours, getDate) desloca esses valores em -3h no fuso do Brasil e vira o
// dia. Foi essa mistura que produziu:
//   - registros de 01/01 sumindo do filtro por ano;
//   - visita retroativa gravada no dia anterior;
//   - associado bloqueado no proprio dia de vencimento da anuidade.
//
// Todas as funcoes aqui operam exclusivamente em UTC.
// =====================================================

/** Constroi a meia-noite UTC de um dia do calendario. Mes e 1-12. */
export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/** Zera a hora preservando o dia do calendario (em UTC). */
export function toUtcDateOnly(date: Date): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Hoje como data-calendario (meia-noite UTC). */
export function todayUtc(): Date {
  return toUtcDateOnly(new Date());
}

/** 1 de janeiro do ano, meia-noite UTC (inicio inclusivo de filtro). */
export function startOfYearUtc(year: number): Date {
  return utcDate(year, 1, 1);
}

/** 31 de dezembro do ano, meia-noite UTC (fim inclusivo de filtro). */
export function endOfYearUtc(year: number): Date {
  return utcDate(year, 12, 31);
}

/** Soma dias a uma data-calendario. */
export function addDaysUtc(date: Date, days: number): Date {
  const d = toUtcDateOnly(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Soma anos preservando dia/mes.
 *
 * 29/02 nao existe em ano comum — nesse caso cai em 28/02, que e a convencao
 * usual para vigencia de contrato/anuidade no Brasil.
 */
export function addYearsUtc(date: Date, years: number): Date {
  const y = date.getUTCFullYear() + years;
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return utcDate(y, m, Math.min(d, daysInMonth));
}

/** Compara apenas o dia do calendario. <0 se a < b, 0 se igual, >0 se a > b. */
export function compareDateOnly(a: Date, b: Date): number {
  return toUtcDateOnly(a).getTime() - toUtcDateOnly(b).getTime();
}

/** "YYYY-MM-DD" da data-calendario (para logs, notas e recibos). */
export function formatIsoDate(date: Date): string {
  return toUtcDateOnly(date).toISOString().slice(0, 10);
}
