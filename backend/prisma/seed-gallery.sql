-- Seed direto via SQL para a tabela GalleryImage.
-- Usado quando o Prisma Client esta travado pelo dev server e nao pode regenerar.
-- Apos run, o admin pode editar tudo normalmente via /admin/galeria.

DELETE FROM "GalleryImage";

INSERT INTO "GalleryImage" (id, "clubId", "imageUrl", caption, "displayOrder", "isPublished", "createdById", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/alunos_cbt.jpg', 'Alunos em treinamento no CBT', 1, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/alunos_cbtt.jpg', 'Turma de alunos do clube', 2, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/instrucao_cbt.jpg', 'Instrução tática supervisionada', 3, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/instrução_tiro.jpg', 'Aula de tiro com instrutor', 4, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/instrução_tiro_cbt.jpg', 'Treinamento individualizado', 5, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/tiro_cbt.jpg', 'Praticantes na linha de tiro', 6, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/tiro_com_pistola.jpg', 'Treinamento de pistola', 7, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/tiro_com_carabina.jpg', 'Treinamento de carabina', 8, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/tiro_ajoelhado.jpg', 'Postura ajoelhada', 9, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/tiro_deitado.jpg', 'Postura deitada', 10, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/tiro_em_movimento_clube.jpg', 'Tiro em movimento', 11, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/consertando_empunhadura.jpg', 'Correção de empunhadura', 12, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/espetar_arma.jpg', 'Apresentação da arma', 13, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/trygun.jpg', 'Prática com try gun', 14, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/torneio_cbt.jpg', 'Torneio do clube', 15, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/torneio_carabina_pressão.jpg', 'Torneio de carabina de pressão', 16, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/exibindo_medalhas.jpg', 'Atletas com suas medalhas', 17, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/entrega_certificados_cbt.jpg', 'Entrega de certificados', 18, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/treinamento_choque_cbt.jpg', 'Treinamento avançado', 19, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/selva.jpg', 'Treinamento em ambiente selvagem', 20, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/reuniao_cbt.jpg', 'Reunião do clube', 21, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/confraternizacao_cbt.jpg', 'Confraternização CBT', 22, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/confraternizacao_cbtt.jpg', 'Confraternização entre associados', 23, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/confraternizacao_2017.jpg', 'Confraternização 2017', 24, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/associado.jpg', 'Associado em treinamento', 25, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/associados_cbt.jpg', 'Comunidade de associados', 26, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/assoc.jpg', 'Associados no clube', 27, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/ass.jpg', 'Momento entre associados', 28, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/casal20.jpg', 'Casal de atiradores', 29, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/clube.jpg', 'Vista do clube', 30, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/clubee.jpg', 'Instalações do CBT', 31, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW()),
  (gen_random_uuid(), 'cbt-bahia', '/site/galeria/cbtt.jpg', 'Atividades no CBT', 32, true, '43a3ecfe-8a68-4772-9f3a-863fd906f614', NOW(), NOW());

SELECT COUNT(*) AS total_gallery_images FROM "GalleryImage";
