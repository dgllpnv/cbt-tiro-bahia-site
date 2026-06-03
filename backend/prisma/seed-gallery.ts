// =====================================================
// SEED — Galeria publica do site
// Popula GalleryImage com as 32 fotos da comunidade armazenadas
// em frontend/public/site/galeria/. Os caminhos sao relativos ao
// servidor estatico do frontend (Vite/build), de forma que
// <img src={imageUrl}> resolve para /site/galeria/{arquivo}.
// =====================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Lista pareada (arquivo, legenda). Legendas curtas e descritivas,
// em portugues, evitando jargao para o publico geral do site.
const GALLERY_ITEMS: Array<{ file: string; caption: string }> = [
  { file: 'alunos_cbt.jpg', caption: 'Alunos em treinamento no CBT' },
  { file: 'alunos_cbtt.jpg', caption: 'Turma de alunos do clube' },
  { file: 'instrucao_cbt.jpg', caption: 'Instrução tática supervisionada' },
  { file: 'instrução_tiro.jpg', caption: 'Aula de tiro com instrutor' },
  { file: 'instrução_tiro_cbt.jpg', caption: 'Treinamento individualizado' },
  { file: 'tiro_cbt.jpg', caption: 'Praticantes na linha de tiro' },
  { file: 'tiro_com_pistola.jpg', caption: 'Treinamento de pistola' },
  { file: 'tiro_com_carabina.jpg', caption: 'Treinamento de carabina' },
  { file: 'tiro_ajoelhado.jpg', caption: 'Postura ajoelhada' },
  { file: 'tiro_deitado.jpg', caption: 'Postura deitada' },
  { file: 'tiro_em_movimento_clube.jpg', caption: 'Tiro em movimento' },
  { file: 'consertando_empunhadura.jpg', caption: 'Correção de empunhadura' },
  { file: 'espetar_arma.jpg', caption: 'Apresentação da arma' },
  { file: 'trygun.jpg', caption: 'Prática com try gun' },
  { file: 'torneio_cbt.jpg', caption: 'Torneio do clube' },
  { file: 'torneio_carabina_pressão.jpg', caption: 'Torneio de carabina de pressão' },
  { file: 'exibindo_medalhas.jpg', caption: 'Atletas com suas medalhas' },
  { file: 'entrega_certificados_cbt.jpg', caption: 'Entrega de certificados' },
  { file: 'treinamento_choque_cbt.jpg', caption: 'Treinamento avançado' },
  { file: 'selva.jpg', caption: 'Treinamento em ambiente selvagem' },
  { file: 'reuniao_cbt.jpg', caption: 'Reunião do clube' },
  { file: 'confraternizacao_cbt.jpg', caption: 'Confraternização CBT' },
  { file: 'confraternizacao_cbtt.jpg', caption: 'Confraternização entre associados' },
  { file: 'confraternizacao_2017.jpg', caption: 'Confraternização 2017' },
  { file: 'associado.jpg', caption: 'Associado em treinamento' },
  { file: 'associados_cbt.jpg', caption: 'Comunidade de associados' },
  { file: 'assoc.jpg', caption: 'Associados no clube' },
  { file: 'ass.jpg', caption: 'Momento entre associados' },
  { file: 'casal20.jpg', caption: 'Casal de atiradores' },
  { file: 'clube.jpg', caption: 'Vista do clube' },
  { file: 'clubee.jpg', caption: 'Instalações do CBT' },
  { file: 'cbtt.jpg', caption: 'Atividades no CBT' },
];

async function main() {
  console.log('[SEED gallery] Iniciando...');

  // Garante autor: pega o primeiro ADMIN ativo, fallback para qualquer admin.
  const author = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true, fullName: true },
  });

  if (!author) {
    console.error('[SEED gallery] Nenhum ADMIN encontrado. Rode o seed base primeiro (npm run db:seed).');
    process.exit(1);
  }

  console.log(`[SEED gallery] Autor: ${author.fullName} (${author.id})`);

  // Limpa galeria existente (idempotencia — pode rodar o seed multiplas vezes)
  const existing = await prisma.galleryImage.count();
  if (existing > 0) {
    console.log(`[SEED gallery] Removendo ${existing} imagens existentes...`);
    await prisma.galleryImage.deleteMany({});
  }

  for (let i = 0; i < GALLERY_ITEMS.length; i++) {
    const item = GALLERY_ITEMS[i];
    await prisma.galleryImage.create({
      data: {
        imageUrl: `/site/galeria/${item.file}`,
        caption: item.caption,
        displayOrder: i + 1,
        isPublished: true,
        createdById: author.id,
      },
    });
  }

  console.log(`[SEED gallery] ${GALLERY_ITEMS.length} imagens criadas com sucesso.`);
}

main()
  .catch((e) => {
    console.error('[SEED gallery] Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
