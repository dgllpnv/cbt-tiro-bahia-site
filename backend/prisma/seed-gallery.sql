-- Seed direto via SQL para a tabela GalleryImage.
-- Usado quando o Prisma Client esta travado pelo dev server e nao pode regenerar.
-- Apos run, o admin pode editar tudo normalmente via /admin/galeria.

DELETE FROM "GalleryImage";

INSERT INTO "GalleryImage" (id, "clubId", "imageUrl", caption, "displayOrder", "isPublished", "createdById", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/alunos_cbt.png', 'Alunos em treinamento no CBT', 1, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/alunos_cbtt.png', 'Turma de alunos do clube', 2, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/instrucao_cbt.png', 'Instrução tática supervisionada', 3, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/instrução_tiro.png', 'Aula de tiro com instrutor', 4, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/instrução_tiro_cbt.png', 'Treinamento individualizado', 5, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/tiro_cbt.png', 'Praticantes na linha de tiro', 6, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/tiro_com_pistola.png', 'Treinamento de pistola', 7, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/tiro_com_carabina.png', 'Treinamento de carabina', 8, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/tiro_ajoelhado.png', 'Postura ajoelhada', 9, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/tiro_deitado.png', 'Postura deitada', 10, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/tiro_em_movimento_clube.png', 'Tiro em movimento', 11, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/consertando_empunhadura.png', 'Correção de empunhadura', 12, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/espetar_arma.png', 'Apresentação da arma', 13, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/trygun.png', 'Prática com try gun', 14, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/torneio_cbt.png', 'Torneio do clube', 15, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/torneio_carabina_pressão.png', 'Torneio de carabina de pressão', 16, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/exibindo_medalhas.png', 'Atletas com suas medalhas', 17, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/entrega_certificados_cbt.png', 'Entrega de certificados', 18, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/treinamento_choque_cbt.png', 'Treinamento avançado', 19, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/selva.png', 'Treinamento em ambiente selvagem', 20, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/reuniao_cbt.png', 'Reunião do clube', 21, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/confraternizacao_cbt.png', 'Confraternização CBT', 22, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/confraternizacao_cbtt.png', 'Confraternização entre associados', 23, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/confraternizacao_2017.png', 'Confraternização 2017', 24, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/associado.png', 'Associado em treinamento', 25, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/associados_cbt.png', 'Comunidade de associados', 26, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/assoc.png', 'Associados no clube', 27, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/ass.png', 'Momento entre associados', 28, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/casal20.png', 'Casal de atiradores', 29, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/clube.png', 'Vista do clube', 30, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/clubee.png', 'Instalações do CBT', 31, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/cbtt.png', 'Atividades no CBT', 32, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW());

SELECT COUNT(*) AS total_gallery_images FROM "GalleryImage";
