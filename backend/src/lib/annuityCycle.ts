// =====================================================
// annuityCycle.ts — Regra unica de vigencia da anuidade
//
// REGRA DO CLUBE
// A anuidade e ancorada na DATA DE FILIACAO do associado (`User.memberSince`).
// Ela sempre vence no aniversario de filiacao — independentemente do dia em
// que o associado efetivamente pagar.
//
// O comportamento anterior era `validUntil = data do pagamento + 1 ano`. Quem
// pagava atrasado ganhava de brinde exatamente o tempo do atraso: filiado em
// 04/04, pagando em 14/06, ficava valido ate 14/06 do ano seguinte (2 meses a
// mais) — e o vencimento saia do ciclo de filiacao para sempre.
//
// Com a regra correta:
//   filiado 04/04 · paga em 14/06/2026  -> vigencia 04/04/2026 a 04/04/2027
//   filiado 26/08 · paga em 14/06/2026  -> vigencia 26/08/2025 a 26/08/2026
//   filiado 20/05 · paga em 02/05/2026 (em dia, vence 20/05/2026)
//                                       -> vigencia 20/05/2026 a 20/05/2027
//
// Pagar varias anuidades atrasadas continua funcionando: cada POST avanca
// exatamente um ciclo, porque a referencia passa a ser o `validUntil` vigente.
// =====================================================

import { addYearsUtc, compareDateOnly, toUtcDateOnly, todayUtc, utcDate } from './dateOnly.js';

export interface AnnuityCycleInput {
  /** Data de filiacao do associado (`User.memberSince`). Ancora do ciclo. */
  memberSince: Date | null | undefined;
  /** Vigencia atual (`User.annuityValidUntil`), se ja houver. */
  currentValidUntil: Date | null | undefined;
  /** Data de referencia. Default: hoje. Parametrizavel para testes/scripts. */
  today?: Date;
}

export interface AnnuityCycle {
  validFrom: Date;
  validUntil: Date;
}

/**
 * Aniversario de `anchor` no ano informado.
 * 29/02 em ano comum cai em 28/02 (ver `addYearsUtc`).
 */
function anniversaryIn(anchor: Date, year: number): Date {
  const month = anchor.getUTCMonth() + 1;
  const day = anchor.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return utcDate(year, month, Math.min(day, daysInMonth));
}

/**
 * Primeiro aniversario de `anchor` ESTRITAMENTE depois de `reference`.
 * E o vencimento da anuidade que esta sendo paga.
 */
function firstAnniversaryAfter(anchor: Date, reference: Date): Date {
  let candidate = anniversaryIn(anchor, reference.getUTCFullYear());
  if (compareDateOnly(candidate, reference) <= 0) {
    candidate = anniversaryIn(anchor, reference.getUTCFullYear() + 1);
  }
  return candidate;
}

/**
 * Calcula a vigencia da anuidade sendo paga agora.
 *
 * `reference` = a maior data entre hoje e a vigencia atual:
 *   - em dia  -> parte do vencimento atual, empilhando o proximo ciclo;
 *   - atrasado/sem anuidade -> parte de hoje, e o vencimento e o proximo
 *     aniversario de filiacao (sem presentear os meses de atraso).
 *
 * Sem `memberSince` (nao deve acontecer: a coluna tem default e e obrigatoria)
 * o ciclo cai no comportamento antigo — 1 ano cheio a partir da referencia.
 */
export function computeAnnuityCycle(input: AnnuityCycleInput): AnnuityCycle {
  const today = toUtcDateOnly(input.today ?? todayUtc());
  const current = input.currentValidUntil ? toUtcDateOnly(input.currentValidUntil) : null;

  // Referencia: nunca retroage. Quem esta em dia empilha a partir do vencimento.
  const reference = current && compareDateOnly(current, today) > 0 ? current : today;

  if (!input.memberSince) {
    const validFrom = reference;
    return { validFrom, validUntil: addYearsUtc(validFrom, 1) };
  }

  const anchor = toUtcDateOnly(input.memberSince);
  const validUntil = firstAnniversaryAfter(anchor, reference);
  // A vigencia cobre o ciclo de aniversario que termina em `validUntil`.
  const validFrom = addYearsUtc(validUntil, -1);

  return { validFrom, validUntil };
}

/**
 * Anuidade vencida? Compara apenas o dia do calendario.
 *
 * O dia do vencimento AINDA e valido — antes, a comparacao misturava meia-noite
 * UTC (`annuityValidUntil`) com meia-noite local e bloqueava o associado no
 * proprio ultimo dia de validade.
 */
export function isAnnuityExpired(validUntil: Date | null | undefined, today?: Date): boolean {
  if (!validUntil) return true;
  return compareDateOnly(validUntil, today ?? todayUtc()) < 0;
}
