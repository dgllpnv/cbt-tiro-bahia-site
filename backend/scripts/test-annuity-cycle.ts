// =====================================================
// test-annuity-cycle.ts — Verificacao da regra de vigencia da anuidade
//
// Roda com:  npm run test:annuity
//
// Cobre os cenarios que motivaram a mudanca (pagamento atrasado nao pode
// deslocar o vencimento para fora do ciclo de filiacao), os casos de borda
// (pagar no dia do vencimento, 29/02, primeira anuidade) e o bloqueio de
// login no ultimo dia de validade. Sai com codigo 1 se algo regredir.
// =====================================================

import { computeAnnuityCycle, isAnnuityExpired } from '../src/lib/annuityCycle.js';
import { utcDate, formatIsoDate } from '../src/lib/dateOnly.js';

const br = (d: Date) => formatIsoDate(d).split('-').reverse().join('/');
const iso = (s: string) => new Date(`${s}T00:00:00.000Z`);

interface Caso {
  nome: string;
  filiacao: string;
  venceAtual: string | null;
  pagaEm: string;
  esperado: string;
}

const casos: Caso[] = [
  // Casos reais extraidos da base (associados que ficaram "fora do ciclo")
  { nome: 'MARCOS #0045 (atrasado 2m)', filiacao: '2017-04-04', venceAtual: '2026-04-04', pagaEm: '2026-06-14', esperado: '04/04/2027' },
  { nome: 'JOAO CARLOS #1271 (atras 10m)', filiacao: '2025-08-26', venceAtual: '2025-08-26', pagaEm: '2026-06-14', esperado: '26/08/2026' },
  { nome: 'JOSE LUIS #0706', filiacao: '2021-12-21', venceAtual: '2025-12-21', pagaEm: '2026-06-18', esperado: '21/12/2026' },
  // Pagamento em dia -> empilha no proximo aniversario
  { nome: 'Em dia (paga antes de vencer)', filiacao: '2020-05-20', venceAtual: '2026-05-20', pagaEm: '2026-05-02', esperado: '20/05/2027' },
  // Paga no proprio dia do vencimento
  { nome: 'Paga no dia do vencimento', filiacao: '2020-05-20', venceAtual: '2026-05-20', pagaEm: '2026-05-20', esperado: '20/05/2027' },
  // Primeira anuidade (nunca pagou)
  { nome: 'Nunca pagou', filiacao: '2019-03-10', venceAtual: null, pagaEm: '2026-06-14', esperado: '10/03/2027' },
  // Novo socio pagando no dia da filiacao -> ano cheio
  { nome: 'Filiou e pagou hoje', filiacao: '2026-06-14', venceAtual: null, pagaEm: '2026-06-14', esperado: '14/06/2027' },
  // Ano bissexto: 29/02 nao existe em 2027 -> 28/02
  { nome: 'Filiado em 29/02 (ano comum)', filiacao: '2024-02-29', venceAtual: null, pagaEm: '2026-06-14', esperado: '28/02/2027' },
];

let falhas = 0;

console.log('CASO                              FILIACAO    PAGA EM     VIGENCIA                  ESPERADO     OK');
console.log('-'.repeat(108));

for (const c of casos) {
  const { validFrom, validUntil } = computeAnnuityCycle({
    memberSince: iso(c.filiacao),
    currentValidUntil: c.venceAtual ? iso(c.venceAtual) : null,
    today: iso(c.pagaEm),
  });
  const ok = br(validUntil) === c.esperado;
  if (!ok) falhas++;
  console.log(
    c.nome.padEnd(33),
    br(iso(c.filiacao)).padEnd(11),
    br(iso(c.pagaEm)).padEnd(11),
    `${br(validFrom)} a ${br(validUntil)}`.padEnd(25),
    c.esperado.padEnd(12),
    ok ? 'OK' : 'FALHOU',
  );
}

console.log('\n-- Bloqueio de login (isAnnuityExpired) --');
const hoje = utcDate(2026, 5, 20);
const cenarios: Array<[string, Date, boolean]> = [
  ['vence hoje (ainda vale)', utcDate(2026, 5, 20), false],
  ['venceu ontem', utcDate(2026, 5, 19), true],
  ['vence amanha', utcDate(2026, 5, 21), false],
];
for (const [rotulo, valida, esperado] of cenarios) {
  const bloqueado = isAnnuityExpired(valida, hoje);
  if (bloqueado !== esperado) falhas++;
  console.log(`  ${rotulo.padEnd(26)} bloqueado=${String(bloqueado).padEnd(6)} ${bloqueado === esperado ? 'OK' : 'FALHOU'}`);
}

console.log(falhas === 0 ? '\nTODOS OS CASOS PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
