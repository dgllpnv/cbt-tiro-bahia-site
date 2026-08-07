// =====================================================
// dateOnly.ts — Leitura segura da data-calendario de um valor da API
//
// PROBLEMA QUE ESTE ARQUIVO RESOLVE
// Campos `@db.Date` do Prisma (activityDate, visitDate, dateOfBirth,
// memberSince, crExpiry, annuityValidUntil, eventDate, expenseDate,
// validFrom/validUntil, acquisitionDate) nao tem hora: representam apenas
// um dia do calendario. O Prisma os serializa como meia-noite UTC —
// "2025-04-26T00:00:00.000Z".
//
// Ler esse valor com os getters locais (getDate(), toLocaleDateString())
// no fuso do Brasil (UTC-3) devolve 2025-04-25 21:00 => dia 25. Ou seja,
// TODA data-calendario aparecia com 1 dia a menos na tela e nos PDFs.
//
// Ja campos DateTime de verdade (checkInTime, transactionDate, createdAt,
// paymentDate) carregam hora real e DEVEM ser lidos no fuso local.
//
// A funcao abaixo distingue os dois casos sem precisar saber o nome do
// campo, e por isso pode ser usada em qualquer formatador.
// =====================================================

export interface CalendarParts {
  day: number;
  month: number; // 1-12
  year: number;
}

/** ISO date-only: "2025-04-26" */
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ISO em meia-noite UTC exata: "2025-04-26T00:00:00.000Z" (assinatura de @db.Date) */
const UTC_MIDNIGHT_RE = /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/;

/**
 * Extrai dia/mes/ano de um valor vindo da API.
 *
 *  - "2025-04-26"                 -> lido literalmente (sem fuso)
 *  - "2025-04-26T00:00:00.000Z"   -> data-calendario (@db.Date): lido em UTC
 *  - "2025-04-26T19:30:00.000Z"   -> timestamp real: lido no fuso local
 *
 * Retorna null quando o valor e vazio ou nao e uma data valida.
 */
export function calendarParts(value: string | Date | null | undefined): CalendarParts | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'string') {
    const literal = DATE_ONLY_RE.exec(value);
    if (literal) {
      return { year: Number(literal[1]), month: Number(literal[2]), day: Number(literal[3]) };
    }
  }

  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;

  // Data-calendario (@db.Date): a hora e exatamente meia-noite UTC, logo o dia
  // correto e o dia UTC — ler em horario local recuaria para o dia anterior.
  const isCalendarDate =
    typeof value === 'string'
      ? UTC_MIDNIGHT_RE.test(value)
      : d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;

  if (isCalendarDate) {
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }

  // Timestamp real (tem hora): o dia correto e o dia local.
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/** Formata como DD/MM/YYYY. Devolve `fallback` quando o valor e invalido/vazio. */
export function formatCalendarDate(
  value: string | Date | null | undefined,
  fallback = '—',
): string {
  const p = calendarParts(value);
  if (!p) return fallback;
  return `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`;
}

/** Chave "YYYY-MM-DD" estavel para agrupar/comparar datas sem risco de fuso. */
export function calendarKey(value: string | Date | null | undefined): string | null {
  const p = calendarParts(value);
  if (!p) return null;
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
