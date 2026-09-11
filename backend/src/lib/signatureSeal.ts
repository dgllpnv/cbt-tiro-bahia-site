import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

// =====================================================
// signatureSeal — desenha o SELO VISIVEL de assinatura digital no PDF,
// antes de a assinatura PKCS#7 ser aplicada (ver pdfSigning.ts).
//
// POR QUE ISSO EXISTE
// A assinatura PKCS#7 e criptografica, nao grafica: sozinha ela nao
// desenha nada na pagina (o widget nasce com `/Rect [0 0 0 0]`). O
// documento fica juridicamente assinado e visualmente identico a um
// documento sem assinatura — e o Chrome, onde o clube abre os PDFs, nao
// tem painel de assinaturas para revelar isso.
//
// O sistema antigo (dompdf + pyHanko) carimbava o selo azul "ASSINATURA
// ELETRONICA QUALIFICADA / ICP-Brasil" no lugar da rubrica, com nome,
// cargo e CPF logo abaixo. Este modulo reproduz esse selo em vetor — sem
// depender de arquivo de imagem, entao imprime nitido em qualquer zoom.
//
// ONDE E DESENHADO
//  1. Com ancora (`SealAnchor`): no espaco da rubrica que o gerador do
//     PDF reservou — ver frontend/src/lib/reports/_shared/signatureAnchor.ts.
//  2. Sem ancora: faixa discreta no rodape, entre 14,8mm e 21,5mm da
//     borda inferior — area que os dois funis de PDF ja reservam vazia
//     (reportBase para o conteudo em 22mm; declarationBase, em 30mm).
// =====================================================

/** milimetros -> pontos PDF (1pt = 1/72") */
const MM = 2.834645669;

const MARGIN_X_MM = 15;
const BAND_BOTTOM_MM = 14.8;
const BAND_HEIGHT_PT = 19;

// Paginas menores que isso nao sao documentos oficiais (recibo termico
// 80mm, carteirinha) — carimbar neles quebraria o layout.
const MIN_PAGE_WIDTH_PT = 300;
const MIN_PAGE_HEIGHT_PT = 400;

// Azul-marinho institucional do ICP-Brasil.
const ICP_NAVY = rgb(0.086, 0.196, 0.361);
const WHITE = rgb(1, 1, 1);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.35, 0.35, 0.35);

/** Retangulo reservado pelo gerador, em mm a partir do topo-esquerda. */
export interface SealAnchor {
  page: number; // 1-based
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
}

export interface SealInfo {
  /** CN do certificado, no formato "NOME:CPF" usado pelo ICP-Brasil. */
  holderName: string;
  /** SHA-256 (hex) do PDF original, antes do selo e da assinatura. */
  sha256: string;
  signedAt: Date;
  anchor?: SealAnchor | null;
}

/** [x1, y1, x2, y2] do selo — ancora do widget de assinatura. */
export type WidgetRect = [number, number, number, number];

/**
 * StandardFonts usam WinAnsi, que nao cobre todo o Unicode: um caractere
 * fora da tabela faz o pdf-lib lancar e derrubaria a assinatura inteira.
 */
function toWinAnsi(text: string): string {
  return text
    .replace(/[‐-―]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

/** "NOME:12345678901" -> { name: "NOME", cpf: "123.456.789-01" } */
function splitHolder(holderName: string): { name: string; cpf: string | null } {
  const match = holderName.match(/^(.*?):(\d{11})$/);
  if (!match) return { name: holderName.trim(), cpf: null };
  return {
    name: match[1].trim(),
    cpf: match[2].replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'),
  };
}

function formatSignedAt(date: Date): string {
  const d = date.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' });
  const t = date.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Bahia',
    hour: '2-digit',
    minute: '2-digit',
  });
  // "às" com acento: WinAnsi cobre à (0xE0), entao o toWinAnsi preserva.
  return `${d} às ${t}`;
}

/** Encolhe a fonte ate o texto caber na largura disponivel. */
function fitSize(font: PDFFont, text: string, maxWidth: number, preferred: number): number {
  let size = preferred;
  while (size > 3 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.2;
  return size;
}

/** Texto centralizado dentro de uma largura. */
function drawCentered(
  page: PDFPage,
  text: string,
  opts: { cx: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb> },
): void {
  const w = opts.font.widthOfTextAtSize(text, opts.size);
  page.drawText(text, { x: opts.cx - w / 2, y: opts.y, size: opts.size, font: opts.font, color: opts.color });
}

/**
 * Selo de assinatura: LAYOUT do Assinador Digital do gov.br (moldura
 * clara, marca a esquerda, filete separador e as linhas de identificacao
 * a direita) com a MARCA do ICP-Brasil — que e a autoridade que de fato
 * emitiu o certificado do clube (e-CPF A1 da Receita Federal). O selo nao
 * pode dizer "gov.br": o documento nao foi assinado pelo assinador do
 * gov.br, e sim pelo certificado proprio do responsavel legal.
 */
function drawBadge(
  page: PDFPage,
  box: { x: number; y: number; w: number; h: number },
  info: { signerName: string; signedAt: Date },
  fonts: { regular: PDFFont; bold: PDFFont },
): void {
  const { x, y, w, h } = box;
  const { regular, bold } = fonts;

  // Moldura clara sobre a folha — nao um bloco solido.
  page.drawRectangle({
    x, y, width: w, height: h,
    color: WHITE,
    borderColor: ICP_NAVY,
    borderWidth: 0.6,
  });

  // ── Marca "ICP / Brasil", centralizada na coluna da esquerda ──────
  const logoColW = 30;
  const icpSize = Math.min(8, h / 3.4);
  const brasilSize = icpSize * 0.62;
  const cxLogo = x + logoColW / 2;
  const blocoH = icpSize + brasilSize + 1.2;
  const baseLogo = y + (h - blocoH) / 2 + brasilSize + 1.2;
  drawCentered(page, 'ICP', { cx: cxLogo, y: baseLogo, size: icpSize, font: bold, color: ICP_NAVY });
  drawCentered(page, 'Brasil', { cx: cxLogo, y: baseLogo - brasilSize - 1.2, size: brasilSize, font: bold, color: ICP_NAVY });

  // Filete separando a marca do texto
  page.drawLine({
    start: { x: x + logoColW, y: y + 2.5 },
    end: { x: x + logoColW, y: y + h - 2.5 },
    thickness: 0.4,
    color: rgb(0.78, 0.82, 0.88),
  });

  // ── Texto a direita ───────────────────────────────────────────────
  const tx = x + logoColW + 5;
  const tw = x + w - tx - 4;
  const { name } = splitHolder(info.signerName);

  const linhas: Array<{ txt: string; size: number; font: PDFFont; color: ReturnType<typeof rgb> }> = [
    { txt: 'Documento assinado digitalmente', size: 4.8, font: bold, color: ICP_NAVY },
    { txt: toWinAnsi(name), size: 4.4, font: bold, color: INK },
    { txt: toWinAnsi(`Data: ${formatSignedAt(info.signedAt)}`), size: 3.9, font: regular, color: MUTED },
    { txt: 'Verifique em validar.iti.gov.br', size: 3.9, font: regular, color: MUTED },
  ];

  // Baselines em fracao da altura: mantem folga no topo e, principalmente,
  // embaixo — distribuir igualmente encostava a ultima linha na moldura e
  // cortava os descendentes (g, q, y).
  const FRACOES = [0.23, 0.44, 0.635, 0.83];
  linhas.forEach((l, i) => {
    const size = fitSize(l.font, l.txt, tw, l.size);
    page.drawText(l.txt, { x: tx, y: y + h - FRACOES[i] * h, size, font: l.font, color: l.color });
  });
}

/**
 * Codigo de verificacao do documento, discreto no rodape. O endereco do
 * validador ja vai dentro do selo gov.br, entao aqui fica so o hash — que
 * e o que permite conferir que o arquivo nao foi trocado.
 */
function drawHashLine(
  page: PDFPage,
  opts: { cx: number; y: number; maxWidth: number; sha256: string; font: PDFFont },
): void {
  const linha = toWinAnsi(`Código de verificação (SHA-256): ${opts.sha256}`);
  const size = fitSize(opts.font, linha, opts.maxWidth, 4.2);
  drawCentered(page, linha, { cx: opts.cx, y: opts.y, size, font: opts.font, color: MUTED });
}

/** Faixa de rodape — usada quando o gerador nao reservou espaco de rubrica. */
function drawFooterBand(
  page: PDFPage,
  lines: { signer: string; legal: string; hash: string },
  fonts: { regular: PDFFont; bold: PDFFont },
): WidgetRect | null {
  const { width } = page.getSize();
  const x = MARGIN_X_MM * MM;
  const boxWidth = width - x * 2;
  if (boxWidth <= 0) return null;
  const y = BAND_BOTTOM_MM * MM;
  const padX = 4;
  const textWidth = boxWidth - padX * 2;

  page.drawRectangle({
    x, y, width: boxWidth, height: BAND_HEIGHT_PT,
    borderColor: rgb(0.45, 0.45, 0.45), borderWidth: 0.5,
  });
  page.drawText(lines.signer, {
    x: x + padX, y: y + BAND_HEIGHT_PT - 7,
    size: fitSize(fonts.bold, lines.signer, textWidth, 6), font: fonts.bold, color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText(lines.legal, {
    x: x + padX, y: y + BAND_HEIGHT_PT - 12.5,
    size: fitSize(fonts.regular, lines.legal, textWidth, 5), font: fonts.regular, color: rgb(0.35, 0.35, 0.35),
  });
  page.drawText(lines.hash, {
    x: x + padX, y: y + 3,
    size: fitSize(fonts.regular, lines.hash, textWidth, 4.6), font: fonts.regular, color: rgb(0.35, 0.35, 0.35),
  });
  return [x, y, x + boxWidth, y + BAND_HEIGHT_PT];
}

/**
 * Carimba o selo e devolve o retangulo para ancorar o widget de
 * assinatura (clicar nele no Adobe Reader abre a validacao), ou null se
 * nenhuma pagina comportava o selo.
 */
export async function drawSignatureSeal(
  pdfDoc: PDFDocument,
  info: SealInfo,
): Promise<{ widgetRect: WidgetRect; pageIndex: number } | null> {
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) return null;

  const { name, cpf } = splitHolder(info.holderName);

  // ── Caminho 1: selo no lugar da rubrica ────────────────────────────
  const a = info.anchor;
  if (a && a.page >= 1 && a.page <= pages.length) {
    const page = pages[a.page - 1];
    const { width, height } = page.getSize();
    if (width >= MIN_PAGE_WIDTH_PT && height >= MIN_PAGE_HEIGHT_PT) {
      const box = {
        x: a.xMm * MM,
        // jsPDF mede do topo; pdf-lib, da base.
        y: height - (a.yMm + a.hMm) * MM,
        w: a.wMm * MM,
        h: a.hMm * MM,
      };
      if (box.x >= 0 && box.y >= 0 && box.x + box.w <= width && box.y + box.h <= height) {
        drawBadge(page, box, { signerName: info.holderName, signedAt: info.signedAt }, { regular, bold });
        // Hash + validador na faixa de rodape reservada da mesma pagina,
        // longe do bloco de assinatura (que ja traz nome, cargo e CPF).
        drawHashLine(page, {
          cx: width / 2,
          y: BAND_BOTTOM_MM * MM,
          maxWidth: width - MARGIN_X_MM * MM * 2,
          sha256: info.sha256,
          font: regular,
        });
        return {
          widgetRect: [box.x, box.y, box.x + box.w, box.y + box.h],
          pageIndex: a.page - 1,
        };
      }
    }
  }

  // ── Caminho 2: faixa de rodape em todas as paginas ────────────────
  const signer = toWinAnsi(
    `ASSINADO DIGITALMENTE POR ${name}${cpf ? ` - CPF ${cpf}` : ''} EM ${formatSignedAt(info.signedAt)}`,
  );
  const legal = toWinAnsi(
    'Assinatura eletronica qualificada ICP-Brasil (MP 2.200-2/2001 e Lei 14.063/2020). ' +
      'Verifique a validade em validar.iti.gov.br',
  );
  const hash = toWinAnsi(`SHA-256 do documento original: ${info.sha256}`);

  let last: { widgetRect: WidgetRect; pageIndex: number } | null = null;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    if (width < MIN_PAGE_WIDTH_PT || height < MIN_PAGE_HEIGHT_PT) continue;
    const rect = drawFooterBand(page, { signer, legal, hash }, { regular, bold });
    if (rect) last = { widgetRect: rect, pageIndex: i };
  }
  return last;
}
