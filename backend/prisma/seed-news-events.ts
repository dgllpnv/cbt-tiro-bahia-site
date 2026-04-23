// =====================================================
// CBT — DEMO SEED: NEWS + EVENTS (idempotente)
//
// Conteúdo realista para apresentação ao investidor:
//   • 12 notícias cobrindo regulamentação CAC, lançamentos,
//     competições, decisões judiciais, avisos internos
//   • 15 eventos próximos 3-6 meses (competições, cursos,
//     palestras, social, manutenção, externos)
//
// Pesquisa: Decreto 11.615/2023, Portaria COLOG 17, CBTE,
// IPSC Brasil, Magnum, Tiro Defesa Brasil, jurisprudência STF/STJ.
//
// Idempotente: pula notícias/eventos já existentes (lookup por título).
// Run: npx tsx prisma/seed-news-events.ts
// =====================================================

import { PrismaClient, EventType } from '@prisma/client';

const prisma = new PrismaClient();
const CLUB_ID = 'cbt-bahia';

// =====================================================
// NEWS
// =====================================================

interface NewsSeed {
  title: string;
  summary: string;
  content: string;
  imageUrl?: string;
  isPinned: boolean;
  daysAgo: number; // publishedAt = now - daysAgo
}

const NEWS_ITEMS: NewsSeed[] = [
  {
    title: 'Portaria COLOG nº 17 atualiza regras de habitualidade para CACs em 2026',
    summary:
      'Comando Logístico do Exército publica atualização que altera comprovação de habitualidade para atiradores e caçadores. Confira o impacto.',
    content:
      'O Comando Logístico do Exército Brasileiro (COLOG) divulgou em março de 2026 uma nova atualização da Portaria nº 17, reforçando os critérios de habitualidade para atiradores desportivos. A norma mantém o mínimo de 16 sessões anuais para atiradores nível 1 e 2, e 32 sessões para níveis superiores, mas detalha o registro digital obrigatório por meio do SIGMA modernizado.\n\nClubes credenciados deverão emitir comprovantes assinados digitalmente em até 72 horas após cada sessão. Segundo a publicação no Diário Oficial da União, a fiscalização passa a ocorrer anualmente, com cruzamento automático de dados entre SIGMA, SINARM e Receita Federal.\n\nNossa direção orienta que todos os associados confirmem seus dados cadastrais junto à secretaria até o final de maio, evitando pendências em renovações. Lembramos que a frequência irregular pode resultar em indeferimento do CR (Certificado de Registro) e da renovação dos acervos. Estamos preparando uma cartilha exclusiva com todos os pontos práticos da nova exigência.',
    isPinned: true,
    daysAgo: 35,
  },
  {
    title: 'Taurus lança nova linha TX22 Competition SCR no Brasil',
    summary:
      'Pistola .22 LR voltada à competição esportiva chega ao mercado nacional com cano roscado e gatilho aprimorado.',
    content:
      'A Taurus Armas anunciou no início de abril o lançamento da TX22 Competition SCR no mercado brasileiro. O modelo, derivado da consagrada TX22 norte-americana, traz cano de 5,4 polegadas, sistema de gatilho PTI (Performance Trigger Integration), trilho Picatinny estendido e capacidade para 16 cartuchos calibre .22 LR.\n\nA peça é homologada pelo Exército na categoria de uso permitido, atendendo CACs e atiradores esportivos. O preço sugerido fica entre R$ 6.800 e R$ 7.400, conforme distribuidor.\n\nPara os atiradores do clube, a TX22 Competition representa uma excelente opção de entrada em modalidades como Steel Challenge e Rimfire Challenge, com baixo custo de munição e mínima manutenção. A loja parceira do clube já está recebendo pré-reservas. Em breve agendaremos um Test Drive supervisionado em nossa Baia 3 para que sócios interessados possam experimentar o equipamento antes da compra.',
    isPinned: false,
    daysAgo: 14,
  },
  {
    title: 'Inscrições abertas: Brasileiro IPSC Handgun 2026 em Cascavel/PR',
    summary:
      'A Confederação Brasileira de IPSC abriu inscrições para o campeonato nacional, que ocorrerá em julho. Vagas limitadas.',
    content:
      'A IPSC Brasil confirmou as datas do Campeonato Brasileiro de Pistola 2026, que será realizado entre os dias 16 e 19 de julho no Stand de Tiro de Cascavel, no Paraná. O evento contará com 16 stages oficiais, classificação por divisões (Open, Standard, Production, Classic, Production Optics e Revolver) e premiação para top 3 de cada categoria, além de prêmios por região.\n\nAtletas filiados à CBTE com classificação mínima Bronze podem se inscrever pelo portal oficial até 20 de junho. A taxa de inscrição é de R$ 1.150 e inclui kit do atleta, almoço nos quatro dias e participação no jantar de premiação.\n\nNosso clube organizará uma caravana com transporte fretado e hospedagem em hotel parceiro, com desconto exclusivo para sócios adimplentes. Interessados devem procurar a secretaria ou o coordenador de IPSC do clube até 31 de maio para garantir vaga na delegação baiana.',
    isPinned: true,
    daysAgo: 20,
  },
  {
    title: 'STF mantém validade do Decreto 11.615/2023 e regras para CACs',
    summary:
      'Plenário do Supremo decidiu pela constitucionalidade das normas que reorganizaram o setor de armas em 2023, encerrando ações pendentes.',
    content:
      'O Supremo Tribunal Federal concluiu em fevereiro o julgamento conjunto das ADIs que questionavam o Decreto 11.615/2023, que reorganizou as regras de aquisição, posse e porte de armas para CACs. Por 8 votos a 3, a Corte considerou constitucional a redução do quantitativo de acervo, a obrigatoriedade do laudo psicológico bienal e a vedação ao porte de trânsito automático.\n\nA decisão pacifica o entendimento e encerra a insegurança jurídica que vigorava desde 2023. Para nossos associados, o impacto prático é mínimo, já que o clube vinha orientando a adequação progressiva desde a publicação do decreto.\n\nA direção reforça que o serviço jurídico parceiro continua disponível para esclarecimentos individuais, especialmente em casos de transferência de acervo, atualização de CRAFs e renovação de CR. Mais informações na secretaria ou pelo canal oficial do WhatsApp.',
    isPinned: true,
    daysAgo: 57,
  },
  {
    title: 'CBC apresenta nova munição 9mm Gold +P para defesa pessoal',
    summary:
      'Companhia Brasileira de Cartuchos lança projétil expansivo com performance equiparada a importados premium.',
    content:
      'A CBC — Companhia Brasileira de Cartuchos lançou a nova linha Gold Hex +P em calibre 9mm Luger, voltada ao mercado de defesa pessoal e uso profissional. O projétil de 124 grains com ponta oca expansiva foi desenvolvido em parceria com laboratórios alemães e apresenta expansão controlada entre 1,5 e 1,7 vezes o calibre original em testes em gel balístico padrão FBI.\n\nA velocidade de boca registrada é de 380 m/s em canos de 4 polegadas. O produto chega com preço sugerido de R$ 12,90 por cartucho na embalagem com 20 unidades.\n\nPara os atiradores do clube, a nova munição estará disponível na loja interna a partir de maio, com desconto progressivo para compras acima de 100 unidades. Recomendamos o teste em nossas baias antes de incorporar a munição ao acervo de defesa, garantindo confiabilidade no funcionamento do equipamento individual.',
    isPinned: false,
    daysAgo: 23,
  },
  {
    title: 'Copa Nordeste de Tiro Prático 2026 será em Salvador',
    summary:
      'Federação Baiana sediará a etapa nordestina do circuito IPSC entre 22 e 24 de maio, reunindo atiradores de toda a região.',
    content:
      'A Federação Baiana de Tiro Esportivo confirmou Salvador como sede da Copa Nordeste de Tiro Prático 2026, que acontecerá entre os dias 22 e 24 de maio no Centro de Treinamento Tático da capital baiana. O evento, qualificado como Level 2 pela IPSC Brasil, contará com 12 stages e expectativa de público de 180 atiradores vindos dos nove estados do Nordeste.\n\nNosso clube atuará como apoiador oficial e disponibilizará 15 voluntários nas funções de Range Officer e Stats. Atletas associados terão prioridade de inscrição e desconto de 20% sobre a taxa oficial de R$ 850.\n\nInscrições abertas até 10 de maio pelo portal da CBTE. Haverá ainda uma palestra técnica gratuita aberta ao público no sábado à noite, com o atirador olímpico Felipe Wu como convidado especial. Programe-se e prestigie o tiro esportivo baiano.',
    isPinned: true,
    daysAgo: 10,
  },
  {
    title: 'Aviso: Manutenção programada das Baias 4 e 5 de 5 a 7 de maio',
    summary:
      'Sistema de captura de projéteis e iluminação serão substituídos. Outras baias funcionarão normalmente no período.',
    content:
      'A direção comunica que entre os dias 5 e 7 de maio (terça a quinta-feira) as Baias 4 e 5 estarão fechadas para manutenção preventiva. Serão substituídas as placas do sistema de captura balística traseira (backstop), além de modernização da iluminação LED para atender o novo padrão de visibilidade exigido pelo COLOG.\n\nDurante o período, as Baias 1, 2, 3 e 6 funcionarão em horário estendido, das 7h às 22h, para suprir a demanda. As reservas já agendadas para essas duas baias serão automaticamente realocadas, e os associados afetados receberão contato individual da secretaria.\n\nPedimos compreensão e reforçamos o compromisso da diretoria com a segurança e a qualidade da estrutura disponível aos atiradores. Em caso de dúvidas, falar com o gerente operacional na recepção ou pelo telefone do clube.',
    isPinned: false,
    daysAgo: 7,
  },
  {
    title: 'Novo instrutor: Sgt. Reformado Anderson Lima reforça equipe técnica',
    summary:
      'Com 22 anos de experiência militar e certificação NRA, novo instrutor assume aulas de Tiro Defensivo a partir de maio.',
    content:
      'Temos a satisfação de anunciar a chegada do Sgt. (Ref.) Anderson Lima ao corpo técnico do clube. Com 22 anos de carreira no Exército Brasileiro, atuação em operações especiais e formação como Instrutor Civil pela National Rifle Association (NRA-USA), Anderson assumirá a coordenação dos cursos de Tiro Defensivo Residencial e Saque Rápido a partir de 5 de maio.\n\nEle também é instrutor de armamento credenciado pelo Exército e possui certificações em IPSC Black Badge e formação como Range Officer Internacional. A chegada do novo profissional amplia em 40% nossa capacidade de oferta de cursos, permitindo turmas semanais e atendimento personalizado a iniciantes.\n\nOs primeiros cursos sob sua responsabilidade já estão com inscrições abertas no portal do associado. Sejam todos bem-vindos ao Anderson e bons treinos.',
    isPinned: false,
    daysAgo: 12,
  },
  {
    title: 'STJ uniformiza entendimento sobre transporte de armas por CACs',
    summary:
      'Decisão da 6ª Turma confirma legalidade do transporte com guia de tráfego eletrônica emitida pelo SIGMA.',
    content:
      'A Sexta Turma do Superior Tribunal de Justiça consolidou em março o entendimento de que o transporte de armas por CACs entre residência, clube e local de competição é legal desde que acompanhado da guia de tráfego eletrônica emitida pelo SIGMA, mesmo quando o policial militar fiscalizador não tenha familiaridade com o documento digital.\n\nO acórdão, relatado pela ministra Laurita Vaz, determinou o trancamento de ação penal contra atirador paulista flagrado em barreira policial portando arma desmuniciada e em estojo lacrado, com guia válida no celular. A decisão serve como precedente nacional e reforça a orientação da direção do clube: sempre transporte sua arma desmontada ou desmuniciada, em estojo apropriado, separada da munição, e com a guia de tráfego ativa no aplicativo do SIGMA ou impressa.\n\nEm caso de abordagem, mantenha a calma e apresente o documento. Nosso jurídico está à disposição para suporte em qualquer ocorrência.',
    isPinned: false,
    daysAgo: 31,
  },
  {
    title: 'Dicas técnicas: como prolongar a vida útil do seu cano',
    summary:
      'Limpeza, lubrificação correta e descanso entre disparos são fundamentais. Confira as recomendações dos nossos instrutores.',
    content:
      'Um dos investimentos mais valiosos de qualquer atirador é seu cano, e cuidados simples podem dobrar sua vida útil. A primeira regra é evitar disparos contínuos em alta cadência sem pausa: o calor excessivo acelera a erosão do throat (área inicial do raiamento), comprometendo a precisão. Em sessões longas, faça intervalos de 5 minutos a cada 30 disparos.\n\nA limpeza deve usar solvente específico para resíduos de cobre e pólvora, com escovinha de bronze ou nylon, sempre no sentido culatra-boca. Após a limpeza, aplique fina camada de óleo protetivo e remova o excesso com flanela. Evite o uso de palha de aço ou abrasivos, que riscam o raiamento.\n\nPara armas pouco utilizadas, faça inspeção visual mensal e aplique lubrificação anti-corrosão, especialmente em climas úmidos como o nosso. Nossa loja oferece kit completo de limpeza com desconto para associados. Em caso de dúvidas, procure qualquer instrutor durante o horário de funcionamento.',
    isPinned: false,
    daysAgo: 17,
  },
  {
    title: 'Glock Brasil confirma fabricação nacional da G19 Gen5 em São Leopoldo',
    summary:
      'Linha de produção brasileira começa a operar em maio, reduzindo prazos de entrega e custo final ao consumidor CAC.',
    content:
      'A Glock Brasil confirmou para 5 de maio o início da produção nacional da Glock 19 Gen5 em sua nova planta de São Leopoldo (RS), em parceria com o grupo industrial sul-rio-grandense. A pistola calibre 9mm, uma das mais populares no mundo, era até então totalmente importada da Áustria, com prazos de entrega que ultrapassavam 90 dias e preço final ao consumidor CAC superior a R$ 18 mil.\n\nCom a produção local, a expectativa é reduzir o preço para a faixa de R$ 13 mil a R$ 14 mil, mantendo as especificações originais e garantia de fábrica. A unidade brasileira terá capacidade inicial de 12 mil unidades anuais, atendendo CACs, forças de segurança e exportação para América do Sul.\n\nPara os associados interessados em adquirir o modelo, recomendamos contato com a loja parceira do clube para reserva antecipada, dada a alta procura esperada nos primeiros lotes nacionais.',
    isPinned: false,
    daysAgo: 4,
  },
  {
    title: 'Confraternização Junina do Clube acontece dia 13 de junho',
    summary:
      'Sócios e familiares são convidados para arraial com comidas típicas, quadrilha e premiação dos campeões internos.',
    content:
      'Tradição há mais de uma década, a Confraternização Junina do clube acontece neste ano no sábado, 13 de junho, a partir das 17h, no Salão Principal e área externa coberta. A festa contará com fogueira (de origem cenográfica), barraquinhas com comidas típicas baianas e nordestinas (canjica, milho, pamonha, acarajé, vatapá), música ao vivo com trio pé-de-serra e quadrilha aberta a todos os participantes.\n\nO ponto alto da noite será a entrega de troféus aos campeões das competições internas do primeiro semestre nas modalidades IPSC, Steel Challenge, Precisão .22 e Defensivo. Os ingressos custam R$ 80 (sócios) e R$ 120 (convidados), com gratuidade para crianças até 12 anos.\n\nAs reservas devem ser feitas na secretaria até 7 de junho, considerando capacidade limitada a 250 pessoas. Tragam a família, vamos celebrar mais um semestre de bons treinos e amizade.',
    isPinned: true,
    daysAgo: 2,
  },
];

// =====================================================
// EVENTS
// =====================================================

interface EventSeed {
  title: string;
  description: string;
  eventType: EventType;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  startHour?: string;
  /** HH:MM (same day) */
  endHour?: string;
  location: string;
  maxParticipants?: number;
  /** Days before event for registration deadline (defaults to 7) */
  deadlineDaysBefore?: number;
}

const EVENTS: EventSeed[] = [
  {
    title: '3ª Etapa do Campeonato Interno IPSC 2026',
    description:
      'Terceira etapa do circuito anual de tiro prático do clube, válida pela classificação geral. Stages medium e short course com classificação por divisão (Production, Standard, Open). Taxa: R$ 180.',
    eventType: EventType.COMPETITION,
    date: '2026-05-04',
    startHour: '08:00',
    endHour: '17:00',
    location: 'Baias 1 a 4',
    maxParticipants: 60,
    deadlineDaysBefore: 5,
  },
  {
    title: 'Curso de Habitualidade CAC — Maio 2026',
    description:
      'Sessão coletiva orientada para cumprimento dos requisitos de habitualidade COLOG. Inclui prática supervisionada e emissão de comprovante digital. Taxa: R$ 150.',
    eventType: EventType.COURSE,
    date: '2026-05-11',
    startHour: '14:00',
    endHour: '18:00',
    location: 'Baia 5',
    maxParticipants: 20,
    deadlineDaysBefore: 3,
  },
  {
    title: 'Steel Challenge — 2ª Etapa Regional',
    description:
      'Modalidade de velocidade contra alvos de aço. Excelente para iniciantes e atiradores .22 LR. Cronometragem oficial CBTE. Taxa: R$ 120.',
    eventType: EventType.COMPETITION,
    date: '2026-05-18',
    startHour: '09:00',
    endHour: '13:00',
    location: 'Baia 6',
    maxParticipants: 40,
    deadlineDaysBefore: 5,
  },
  {
    title: 'Palestra: Decreto 11.615 e jurisprudência atual do STF',
    description:
      'Análise prática das mudanças regulatórias e impactos para CACs, com advogado especializado em direito armamentista. Entrada gratuita para sócios.',
    eventType: EventType.WORKSHOP,
    date: '2026-05-22',
    startHour: '19:30',
    endHour: '21:30',
    location: 'Auditório',
    maxParticipants: 80,
    deadlineDaysBefore: 2,
  },
  {
    title: 'Curso IPSC Black Badge — Turma de outono',
    description:
      'Curso oficial de iniciação à modalidade IPSC reconhecido pela Confederação. Pré-requisito obrigatório para competições oficiais. Carga: 16h. Taxa: R$ 950.',
    eventType: EventType.COURSE,
    date: '2026-05-30',
    startHour: '08:00',
    endHour: '18:00',
    location: 'Baias 2 e 3',
    maxParticipants: 16,
    deadlineDaysBefore: 14,
  },
  {
    title: 'Day-Off Operacional — Manutenção Geral',
    description:
      'Clube fechado para limpeza profunda das baias, manutenção dos sistemas de ventilação e calibração dos pórticos balísticos. Sem inscrição.',
    eventType: EventType.WORKSHOP,
    date: '2026-06-01',
    startHour: '00:00',
    endHour: '23:59',
    location: 'Todas as instalações',
    maxParticipants: 0,
    deadlineDaysBefore: 1,
  },
  {
    title: '1ª Copa Defensivo do Clube — Categoria Sócio',
    description:
      'Competição de tiro defensivo residencial com cenários simulados, exclusiva para sócios. Premiação por categoria etária. Taxa: R$ 200.',
    eventType: EventType.COMPETITION,
    date: '2026-06-08',
    startHour: '08:30',
    endHour: '16:00',
    location: 'Baias 1 e 2',
    maxParticipants: 32,
    deadlineDaysBefore: 7,
  },
  {
    title: 'Confraternização Junina dos Sócios',
    description:
      'Festa tradicional com comidas típicas, quadrilha, música ao vivo e entrega de troféus aos campeões internos do semestre. Ingresso R$ 80 sócio / R$ 120 convidado.',
    eventType: EventType.WORKSHOP,
    date: '2026-06-13',
    startHour: '17:00',
    endHour: '23:00',
    location: 'Salão Principal',
    maxParticipants: 250,
    deadlineDaysBefore: 6,
  },
  {
    title: 'Curso de Saque Rápido e Tiro Reativo',
    description:
      'Treinamento avançado focado em técnicas de saque do coldre, controle de gatilho rápido e tiro contra alvos reativos. Pré-requisito: 6 meses de prática regular. Taxa: R$ 480.',
    eventType: EventType.COURSE,
    date: '2026-06-21',
    startHour: '08:00',
    endHour: '17:00',
    location: 'Baia 4',
    maxParticipants: 12,
    deadlineDaysBefore: 7,
  },
  {
    title: '4ª Etapa do Campeonato Interno IPSC 2026',
    description:
      'Quarta etapa do circuito anual. Será realizada com stages inéditos desenhados pelo coordenador técnico do clube. Taxa: R$ 180.',
    eventType: EventType.COMPETITION,
    date: '2026-06-28',
    startHour: '08:00',
    endHour: '17:00',
    location: 'Baias 1 a 4',
    maxParticipants: 60,
    deadlineDaysBefore: 5,
  },
  {
    title: 'Caravana — Brasileiro IPSC Handgun 2026 (Cascavel/PR)',
    description:
      'Delegação oficial do clube para o Campeonato Brasileiro de Pistola IPSC. Pacote inclui transporte fretado, hospedagem e inscrição oficial. Taxa total: R$ 3.850.',
    eventType: EventType.COMPETITION,
    date: '2026-07-15',
    startHour: '06:00',
    endHour: '22:00',
    location: 'Externo - Cascavel/PR',
    maxParticipants: 18,
    deadlineDaysBefore: 30,
  },
  {
    title: 'Palestra: Saúde Auditiva e Proteção Individual no Tiro',
    description:
      'Médico otorrinolaringologista discute prevenção de perda auditiva, escolha de protetores e exames recomendados para atiradores. Gratuito.',
    eventType: EventType.WORKSHOP,
    date: '2026-07-24',
    startHour: '19:30',
    endHour: '21:00',
    location: 'Auditório',
    maxParticipants: 80,
    deadlineDaysBefore: 2,
  },
  {
    title: 'Curso de Espingarda Tática Nível 1',
    description:
      'Manuseio seguro, recarga tática, transição entre alvos e fundamentos da espingarda calibre 12 para defesa residencial. Taxa: R$ 520.',
    eventType: EventType.COURSE,
    date: '2026-08-02',
    startHour: '08:00',
    endHour: '17:00',
    location: 'Baia 5',
    maxParticipants: 14,
    deadlineDaysBefore: 7,
  },
  {
    title: 'Visita Técnica à Fábrica CBC — Ribeirão Pires/SP',
    description:
      'Excursão exclusiva para sócios conhecerem a linha de produção de munição da Companhia Brasileira de Cartuchos. Inclui transporte e hospedagem. Taxa: R$ 1.980.',
    eventType: EventType.WORKSHOP,
    date: '2026-08-22',
    startHour: '06:00',
    endHour: '22:00',
    location: 'Externo - Ribeirão Pires/SP',
    maxParticipants: 25,
    deadlineDaysBefore: 21,
  },
  {
    title: 'Aniversário de 18 Anos do Clube — Jantar Comemorativo',
    description:
      'Jantar de gala com homenagens aos sócios fundadores, atiradores destaque do ano e apresentação do plano estratégico 2026-2028. Ingresso R$ 280.',
    eventType: EventType.WORKSHOP,
    date: '2026-09-19',
    startHour: '20:00',
    endHour: '23:59',
    location: 'Salão Principal',
    maxParticipants: 200,
    deadlineDaysBefore: 14,
  },
];

// =====================================================
// HELPERS
// =====================================================

function dateAtTime(yyyymmdd: string, hhmm: string): Date {
  // Treat as local time of São Paulo (UTC-3) to match Brasília TZ; create UTC ISO accordingly.
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  // Build UTC date offset by +3h to represent BRT local time.
  return new Date(Date.UTC(y, m - 1, d, h + 3, mi, 0));
}

function dateOnly(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

function daysAgoDate(daysAgo: number): Date {
  const now = new Date();
  return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('--- CBT Demo Seed (News + Events): começando ---\n');

  const admin = await prisma.user.findFirst({
    where: { email: 'admin@cbt.com.br' },
    select: { id: true },
  });
  if (!admin) {
    console.error('[ERRO] Admin não encontrado. Rode `npx prisma db seed` antes.');
    process.exit(1);
  }

  // ──────────────── NEWS ────────────────
  console.log('▶ Cadastrando notícias...');
  let newsCreated = 0;
  let newsSkipped = 0;
  for (const n of NEWS_ITEMS) {
    const existing = await prisma.news.findFirst({
      where: { clubId: CLUB_ID, title: n.title },
      select: { id: true },
    });
    if (existing) {
      newsSkipped++;
      continue;
    }
    const publishedAt = daysAgoDate(n.daysAgo);
    await prisma.news.create({
      data: {
        clubId: CLUB_ID,
        authorId: admin.id,
        title: n.title,
        summary: n.summary,
        content: n.content,
        imageUrl: n.imageUrl ?? null,
        isPinned: n.isPinned,
        isPublished: true,
        publishedAt,
      },
    });
    newsCreated++;
  }
  console.log(`  ✓ ${newsCreated} notícias criadas, ${newsSkipped} já existiam\n`);

  // ──────────────── EVENTS ────────────────
  console.log('▶ Cadastrando eventos...');
  let eventsCreated = 0;
  let eventsSkipped = 0;
  for (const e of EVENTS) {
    const existing = await prisma.event.findFirst({
      where: { clubId: CLUB_ID, title: e.title },
      select: { id: true },
    });
    if (existing) {
      eventsSkipped++;
      continue;
    }

    const eventDate = dateOnly(e.date);
    const startTime = e.startHour ? dateAtTime(e.date, e.startHour) : null;
    const endTime = e.endHour ? dateAtTime(e.date, e.endHour) : null;

    const deadline = (() => {
      if (!e.deadlineDaysBefore) return null;
      const d = new Date(eventDate);
      d.setDate(d.getDate() - e.deadlineDaysBefore);
      return d;
    })();

    await prisma.event.create({
      data: {
        clubId: CLUB_ID,
        title: e.title,
        description: e.description,
        eventType: e.eventType,
        eventDate,
        startTime,
        endTime,
        location: e.location,
        maxParticipants: e.maxParticipants ?? null,
        isPublic: true,
        registrationDeadline: deadline,
      },
    });
    eventsCreated++;
  }
  console.log(`  ✓ ${eventsCreated} eventos criados, ${eventsSkipped} já existiam\n`);

  // ──────────────── SUMMARY ────────────────
  console.log('--- CBT Demo Seed (News + Events): concluído ---');
  console.log(`  Notícias:  ${NEWS_ITEMS.length} (${newsCreated} novas)`);
  console.log(`  Eventos:   ${EVENTS.length} (${eventsCreated} novos)`);
  console.log('-------------------------------------------------\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('\n[ERRO] Falha ao executar seed-news-events:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
