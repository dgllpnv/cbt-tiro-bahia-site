-- Seed de noticias para a home do site CBT.
-- 8 noticias curadas a partir de pesquisa em fontes oficiais (PF, Camara,
-- CBTP, ANCAC, etc.) — relevantes para CACs e atiradores em maio/2026.
-- Admin pode editar tudo via /admin/noticias.

DELETE FROM "News";

INSERT INTO "News" (id, "clubId", "authorId", title, content, summary, "imageUrl", "isPinned", "isPublished", "publishedAt", "createdAt", "updatedAt") VALUES

-- ============ FIXADAS (3) — entram primeiro na home ============
(
  gen_random_uuid(), 'cbt-bahia', '43a3ecfe-8a68-4772-9f3a-863fd906f614',
  'URGENTE: Renovação de CR agora é escalonada — verifique o seu prazo',
  E'A Polícia Federal publicou em 9 de abril de 2026 a Instrução Normativa DG/PF nº 330, que altera profundamente o processo de renovação dos Certificados de Registro (CR) emitidos antes de julho de 2023.\n\nA principal mudança é a substituição da data única de vencimento (21/07/2026) por um cronograma escalonado, organizado pelo mês de aniversário do portador. Os prazos vão de 31 de agosto de 2026 até 2 de agosto de 2027, evitando o acúmulo de pedidos no sistema.\n\nIMPORTANTE: perder o prazo individual sujeita o atirador a medidas administrativas e possíveis sanções penais. O CRAF permanece válido até o vencimento estabelecido para cada caso.\n\nAcesse o sistema SINARM-CAC e confira a data limite para sua renovação. Em caso de dúvidas, fale com a equipe do CBT pelo WhatsApp.',
  'A IN DG/PF nº 330 estabelece cronograma escalonado por mês de aniversário do portador. Prazos vão de agosto de 2026 a agosto de 2027 — verifique o seu.',
  NULL, true, true,
  NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
),

(
  gen_random_uuid(), 'cbt-bahia', '43a3ecfe-8a68-4772-9f3a-863fd906f614',
  'Câmara aprova porte de arma para atiradores com mais de 1 ano de CR',
  E'A Comissão de Segurança Pública da Câmara dos Deputados aprovou projeto de lei que permite a atiradores desportivos com Certificado de Registro há mais de um ano portar armas de fogo para defesa pessoal em todo o Brasil, sem custos adicionais.\n\nA proposta beneficia atiradores de nível 1 (categoria básica de CAC) que comprovem capacidade técnica e aprovem em avaliação psicológica. Hoje, a posse permite manter a arma apenas em casa ou no trabalho — o porte amplia esse direito para o transporte diário.\n\nO relator argumenta que a medida protege atiradores que ficam expostos a risco de violência durante o transporte de armas e munições para treinamento. O projeto ainda passará pelas comissões de Finanças e Tributação e de Constituição e Justiça antes de ir ao plenário.\n\nAcompanharemos as próximas etapas e comunicaremos novidades aos associados.',
  'Projeto permite porte para atiradores nível 1 com 1+ ano de CR após avaliação psicológica. Texto segue para outras comissões.',
  NULL, true, true,
  NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'
),

(
  gen_random_uuid(), 'cbt-bahia', '43a3ecfe-8a68-4772-9f3a-863fd906f614',
  'XXXIX Campeonato Brasileiro de IPSC 2026 — calendário oficial divulgado',
  E'A Confederação Brasileira de Tiro Prático (CBTP) divulgou o formato e o calendário do XXXIX Campeonato Brasileiro de IPSC Handgun e VIII Campeonato de Pistol Caliber Carbine (CCP) 2026.\n\nA competição será disputada em 6 etapas ao longo do ano. As etapas I a V (qualificatórias) têm pré-match na quarta-feira, matches principais de quinta a sábado e matches finais entre sábado e domingo. A etapa VI (final) tem pré-match na segunda e terça e matches principais de quarta a sexta.\n\nO formato padronizado permite aos competidores planejar com antecedência passagens e hospedagem. A 1ª Etapa Brasileira de 2026 já foi realizada em Medianeira (PR), reunindo mais de 600 atiradores.\n\nAtletas do CBT interessados em participar devem procurar a coordenação esportiva para informações sobre inscrições e treinamentos preparatórios.',
  'CBTP confirma 6 etapas do Brasileiro de IPSC Handgun e CCP em 2026. Formato padronizado facilita logística dos competidores.',
  NULL, true, true,
  NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'
),

-- ============ NÃO FIXADAS (5) — entram por ordem de data ============
(
  gen_random_uuid(), 'cbt-bahia', '43a3ecfe-8a68-4772-9f3a-863fd906f614',
  'Lembrete: 8 treinos por arma a cada 12 meses para manter habitualidade',
  E'A Portaria 166-COLOG/2023 mantém em vigor a exigência de comprovação de habitualidade para todos os atiradores desportivos.\n\nDesde 30 de dezembro de 2024, a contagem é feita por TIPO DE ARMA registrada (pistola, revólver, carabina, etc.), com mínimo de 8 treinos ou competições por arma a cada 12 meses. Antes desse marco, a contagem era por calibre.\n\nO CBT registra automaticamente seus treinos no portal do associado. Acesse "Histórico de Treinos" para acompanhar sua situação e baixar a Declaração de Habitualidade quando necessário (Anexo E, conforme legislação atualizada).\n\nMantenha sua habitualidade em dia para garantir a renovação do seu CR sem contratempos.',
  'Habitualidade exige 8 treinos por arma a cada 12 meses. Acompanhe no portal do associado.',
  NULL, false, true,
  NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'
),

(
  gen_random_uuid(), 'cbt-bahia', '43a3ecfe-8a68-4772-9f3a-863fd906f614',
  'Gestão CAC totalmente migrada para Polícia Federal via SINARM-CAC',
  E'Desde 2025, toda a gestão dos Colecionadores, Atiradores e Caçadores (CACs) deixou o Exército Brasileiro e passou para a Polícia Federal. O processo é agora 100% digital, conduzido pelo sistema SINARM-CAC.\n\nA mudança unifica em uma única plataforma os procedimentos de concessão, renovação, aquisição, transferência e regularização de armas, que antes eram divididos entre Exército (atiradores e caçadores) e Polícia Federal (posse e porte civil).\n\nPara o atirador, a mudança simplifica a vida — todos os trâmites em um só portal — mas exige atenção: os requisitos de idade permanecem (18 anos para atirador, 25 para caçador/colecionador) e a idoneidade deve ser mantida durante toda a vigência do CR.\n\nO CBT auxilia seus associados em todas as etapas. Em caso de dúvidas, procure nossa equipe administrativa.',
  'Desde 2025, gestão de CACs migrou do Exército para a PF via sistema SINARM-CAC, com processo 100% digital.',
  NULL, false, true,
  NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'
),

(
  gen_random_uuid(), 'cbt-bahia', '43a3ecfe-8a68-4772-9f3a-863fd906f614',
  'Comissão da Câmara aprova projeto que permite novos registros de CACs e clubes',
  E'A Comissão de Relações Exteriores e Defesa Nacional da Câmara dos Deputados aprovou projeto que destrava a criação de novos registros para CACs, escolas e clubes de tiro no país.\n\nA proposta vem em resposta a restrições que limitaram a expansão do setor nos últimos anos. Se confirmada nas demais etapas, abre caminho para a abertura de novos clubes e a regularização de Centros de Instrução, ampliando o acesso ao tiro esportivo no Brasil.\n\nPara clubes já consolidados como o CBT, a medida representa o reconhecimento da legalidade da atividade e fortalece o ambiente regulatório do tiro esportivo brasileiro.',
  'Projeto aprovado em comissão permite novos registros de CACs, escolas e clubes — sinal positivo para o setor.',
  NULL, false, true,
  NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'
),

(
  gen_random_uuid(), 'cbt-bahia', '43a3ecfe-8a68-4772-9f3a-863fd906f614',
  'Portaria 260 COLOG/2025 altera normas de gestão de armas para CACs',
  E'A Portaria nº 260 do COLOG/C Ex, publicada em 9 de junho de 2025, alterou as normas para gestão dos produtos controlados pelo Exército nas atividades de colecionamento, tiro desportivo e caça excepcional.\n\nA norma trouxe mudanças nas definições de arma de coleção (incluindo critério de antiguidade mínima de 40 anos), além de atualizações sobre quantidades permitidas e procedimentos de aquisição.\n\nA portaria foi questionada na Câmara dos Deputados pelo Projeto de Decreto Legislativo 340/25, sob o argumento de que excederia o âmbito legal. O processo segue em tramitação.\n\nO CBT acompanha as discussões e mantém os associados informados sobre eventuais ajustes operacionais.',
  'Portaria 260/2025 atualiza normas para colecionadores, atiradores e caçadores. Pontos da portaria estão sendo questionados na Câmara.',
  NULL, false, true,
  NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'
),

(
  gen_random_uuid(), 'cbt-bahia', '43a3ecfe-8a68-4772-9f3a-863fd906f614',
  'Conheça nossas instalações — visitas guiadas mediante agendamento',
  E'O Clube Baiano de Tiro abre suas portas para visitantes interessados em conhecer nossa estrutura, modalidades disponíveis e cursos oferecidos.\n\nO CBT possui estande coberto e descoberto, áreas para tiro esportivo, prático, tático e defensivo, sala de aula para os cursos teóricos e ambiente acolhedor para associados e seus convidados.\n\nAgende sua visita pelo WhatsApp e venha sentir de perto a tradição construída desde 2016. Cursos básicos e avançados, modalidades exclusivas para mulheres e eventos com instrutores parceiros disponíveis ao longo do ano.\n\nMaiores de 18 anos. Recomenda-se trajes confortáveis e calçados fechados.',
  'CBT abre portas para visitantes interessados em conhecer a estrutura, cursos e modalidades. Agendamento pelo WhatsApp.',
  NULL, false, true,
  NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'
);

SELECT COUNT(*) AS total_news, SUM(CASE WHEN "isPinned" THEN 1 ELSE 0 END) AS fixadas FROM "News";
