// =====================================================
// fix-annuity-anniversary.ts — Realinha anuidades ao aniversario de filiacao
//
// CONTEXTO
// Ate esta correcao, o sistema calculava `validUntil = data do pagamento +
// 1 ano`. Quem pagou atrasado teve o vencimento deslocado para fora do ciclo
// de filiacao e ganhou meses de graca. Este script devolve esses associados
// ao ciclo correto: vencimento no aniversario de `memberSince`.
//
// COMO RODA
//   npm run fix:anuidade            -> DRY-RUN (nao grava nada, so lista)
//   npm run fix:anuidade:apply      -> aplica as correcoes
//
// SEGURANCA
//   - Dry-run e o padrao. Nada e alterado sem `--apply` explicito.
//   - NUNCA reduz a validade de quem esta em dia de forma a bloquear o acesso
//     hoje: se o aniversario corrigido ja passou, o associado seria bloqueado
//     no mesmo instante. Esses casos sao apenas RELATADOS (secao "revisar"),
//     para o clube decidir caso a caso — nao ha alteracao automatica.
//   - Grava AuditLog por associado alterado (previousData/newData), entao
//     tudo fica rastreavel em /admin/logs.
//   - Ajusta tambem o `AnnuityPayment` mais recente do associado, para o
//     recibo e o historico baterem com a nova vigencia.
//
// Rode SEMPRE o dry-run antes e confira a lista com a administracao do clube.
// =====================================================

import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { computeAnnuityCycle } from '../src/lib/annuityCycle.js';
import { compareDateOnly, formatIsoDate, toUtcDateOnly, todayUtc } from '../src/lib/dateOnly.js';

const APPLY = process.argv.includes('--apply');

const br = (d: Date | null | undefined) => (d ? formatIsoDate(d).split('-').reverse().join('/') : '—');

/** Aniversario de filiacao no ano de `ref`, ou no seguinte se ja tiver passado. */
function expectedValidUntil(memberSince: Date, currentValidUntil: Date): Date {
  // O ciclo correto e o aniversario que cobre a mesma "temporada" da vigencia
  // atual: pegamos o primeiro aniversario >= (vigencia atual - 1 ano), o que
  // preserva quantas anuidades o associado ja pagou.
  const anchor = toUtcDateOnly(memberSince);
  const current = toUtcDateOnly(currentValidUntil);

  const month = anchor.getUTCMonth() + 1;
  const day = anchor.getUTCDate();
  const candidateFor = (year: number) => {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return new Date(Date.UTC(year, month - 1, Math.min(day, daysInMonth)));
  };

  // Aniversario mais proximo da vigencia atual (pode ser antes ou depois).
  const sameYear = candidateFor(current.getUTCFullYear());
  const nextYear = candidateFor(current.getUTCFullYear() + 1);
  const prevYear = candidateFor(current.getUTCFullYear() - 1);

  const dist = (d: Date) => Math.abs(d.getTime() - current.getTime());
  return [prevYear, sameYear, nextYear].reduce((best, c) => (dist(c) < dist(best) ? c : best));
}

async function main() {
  const hoje = todayUtc();

  console.log('='.repeat(96));
  console.log(`  Realinhamento de anuidades ao aniversario de filiacao — ${APPLY ? 'APLICANDO' : 'DRY-RUN'}`);
  console.log(`  Data de referencia: ${br(hoje)}`);
  console.log('='.repeat(96));

  const members = await prisma.user.findMany({
    where: { role: 'ASSOCIATE', annuityValidUntil: { not: null } },
    select: { id: true, fullName: true, memberNumber: true, memberSince: true, annuityValidUntil: true },
    orderBy: { memberNumber: 'asc' },
  });

  type Item = { m: (typeof members)[number]; de: Date; para: Date };

  // Faixas com naturezas diferentes — o clube precisa ver separado:
  const corrigir: Item[] = [];      // desalinhamento real (o bug relatado)
  const ajusteMinimo: Item[] = [];  // +/- 1 dia: convencao "vespera do aniversario"
  const jaVencidos: Item[] = [];    // vencimento antigo e no passado: sem efeito pratico
  const revisar: Item[] = [];       // corrigir bloquearia o associado hoje
  let jaOk = 0;

  for (const m of members) {
    if (!m.memberSince || !m.annuityValidUntil) continue;

    const atual = toUtcDateOnly(m.annuityValidUntil);
    const correto = expectedValidUntil(m.memberSince, atual);
    const delta = Math.round((atual.getTime() - correto.getTime()) / 86_400_000);

    if (delta === 0) {
      jaOk++;
      continue;
    }

    const item: Item = { m, de: atual, para: correto };

    // Corrigir agora bloquearia o associado (vencimento corrigido no passado)?
    // Nesse caso apenas relatamos — a decisao (cobrar ou anistiar) e do clube.
    if (compareDateOnly(correto, hoje) < 0 && compareDateOnly(atual, hoje) >= 0) {
      revisar.push(item);
    } else if (compareDateOnly(atual, hoje) < 0) {
      jaVencidos.push(item);
    } else if (Math.abs(delta) <= 1) {
      ajusteMinimo.push(item);
    } else {
      corrigir.push(item);
    }
  }

  const linha = (r: Item) => {
    const dias = Math.round((r.de.getTime() - r.para.getTime()) / 86_400_000);
    return [
      (r.m.memberNumber ?? '—').padEnd(9),
      r.m.fullName.slice(0, 34).padEnd(35),
      `filiado ${br(r.m.memberSince)}`.padEnd(20),
      `${br(r.de)} -> ${br(r.para)}`.padEnd(26),
      `${dias > 0 ? '+' : ''}${dias}d`,
    ].join(' ');
  };

  const CABECALHO =
    'MATRICULA ASSOCIADO                           FILIACAO             VENCIMENTO                 DELTA';

  const bloco = (titulo: string, itens: Item[], nota?: string) => {
    if (!itens.length) return;
    console.log(`\n── ${titulo} (${itens.length}) ${'─'.repeat(Math.max(4, 66 - titulo.length))}`);
    if (nota) console.log(`   ${nota}`);
    console.log(CABECALHO);
    itens.forEach((r) => console.log(linha(r)));
  };

  console.log(`\nAssociados com anuidade registrada : ${members.length}`);
  console.log(`Ja no ciclo de filiacao            : ${jaOk}`);
  console.log(`Desalinhados (o bug relatado)      : ${corrigir.length}`);
  console.log(`Ajuste de 1 dia (convencao)        : ${ajusteMinimo.length}`);
  console.log(`Ja vencidos (sem efeito pratico)   : ${jaVencidos.length}`);
  console.log(`Para revisao manual                : ${revisar.length}`);

  bloco(
    'DESALINHADOS — pagaram atrasado e ganharam tempo extra',
    corrigir,
    'Delta positivo = tempo de graca que sera devolvido ao ciclo de filiacao.',
  );
  bloco(
    'AJUSTE DE 1 DIA — vencimento na vespera do aniversario',
    ajusteMinimo,
    'Uniformiza a convencao antiga com a maioria da base (vence no aniversario).',
  );
  bloco(
    'JA VENCIDOS — anuidade antiga, associado ja bloqueado',
    jaVencidos,
    'Correcao apenas historica; nao altera o acesso de ninguem.',
  );
  bloco(
    'REVISAO MANUAL — corrigir bloquearia o acesso hoje',
    revisar,
    'NAO serao alterados. Regularize pela tela normal de pagamento: o novo calculo ja devolve ao ciclo.',
  );

  const aplicar = [...corrigir, ...ajusteMinimo, ...jaVencidos];

  if (!APPLY) {
    console.log(
      `\n>> DRY-RUN: nada foi gravado. ${aplicar.length} registro(s) seriam alterados.` +
        '\n>> Rode `npm run fix:anuidade:apply` para aplicar.',
    );
    return;
  }

  if (!aplicar.length) {
    console.log('\nNada a aplicar.');
    return;
  }

  // Autor dos AuditLogs desta correcao em lote. Sem um ADMIN cadastrado nao ha
  // como atribuir autoria (performedById e obrigatorio) — abortamos em vez de
  // gravar auditoria enganosa.
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true, email: true, fullName: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!admin) {
    console.error('\n[ABORTADO] Nenhum ADMIN ativo encontrado para registrar a auditoria.');
    process.exitCode = 1;
    return;
  }

  const autorId = admin.id;
  console.log(`\nAuditoria sera registrada em nome de: ${admin.fullName} <${admin.email}>`);
  console.log(`Aplicando ${aplicar.length} correcao(oes)...`);
  let alterados = 0;

  for (const r of aplicar) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: r.m.id }, data: { annuityValidUntil: r.para } });

      // Realinha o pagamento mais recente para o recibo/historico baterem.
      const ultimo = await tx.annuityPayment.findFirst({
        where: { memberId: r.m.id },
        orderBy: { paymentDate: 'desc' },
        select: { id: true, validFrom: true, validUntil: true },
      });

      if (ultimo) {
        const novoFrom = computeAnnuityCycle({
          memberSince: r.m.memberSince,
          currentValidUntil: null,
          today: r.para,
        });
        await tx.annuityPayment.update({
          where: { id: ultimo.id },
          data: { validFrom: novoFrom.validFrom, validUntil: r.para },
        });
      }

      await tx.auditLog.create({
        data: {
          // Autor da correcao em lote = admin do clube (nao o proprio associado,
          // que apareceria em /admin/logs como se tivesse alterado a si mesmo).
          performedById: autorId,
          userId: r.m.id,
          action: 'UPDATE',
          entityType: 'Annuity',
          entityId: r.m.id,
          previousData: { annuityValidUntil: formatIsoDate(r.de) },
          newData: { annuityValidUntil: formatIsoDate(r.para) },
          description:
            `Vigencia da anuidade realinhada ao aniversario de filiacao ` +
            `(${br(r.de)} -> ${br(r.para)}) — correcao em lote`,
        },
      });
    });
    alterados++;
  }

  console.log(`\nConcluido: ${alterados} associado(s) realinhado(s).`);
}

main()
  .catch((e) => {
    console.error('\n[ERRO]', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
