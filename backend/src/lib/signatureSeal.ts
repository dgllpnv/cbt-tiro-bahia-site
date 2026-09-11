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

// Azul-marinho do selo ICP-Brasil do modelo antigo.
const NAVY = rgb(0.086, 0.196, 0.361);
const WHITE = rgb(1, 1, 1);

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
  return `${d} as ${t}`;
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
 * Selo "ASSINATURA ELETRONICA QUALIFICADA / ICP-Brasil", desenhado no
 * espaco da rubrica. Reproduz o modelo que o clube ja usava.
 */
function drawBadge(
  page: PDFPage,
  box: { x: number; y: number; w: number; h: number },
  fonts: { regular: PDFFont; bold: PDFFont },
): void {
  const { x, y, w, h } = box;
  const { regular, bold } = fonts;

  page.drawRectangle({ x, y, width: w, height: h, color: NAVY, borderColor: NAVY, borderWidth: 0.4 });

  const cx = x + w / 2;
  // Cabecalho: "ASSINATURA ELETRONICA" / "QUALIFICADA"
  const t1 = 'ASSINATURA ELETRONICA';
  const s1 = fitSize(regular, t1, w - 8, 4.2);
  drawCentered(page, t1, { cx, y: y + h - 6, size: s1, font: regular, color: WHITE });

  const t2 = 'QUALIFICADA';
  const s2 = fitSize(bold, t2, w - 8, 6.4);
  drawCentered(page, t2, { cx, y: y + h - 13, size: s2, font: bold, color: WHITE });

  // Bloco branco "ICP Brasil" a esquerda
  const bw = 19;
  const bh = Math.min(11, h - 4);
  const bx = x + 6;
  const by = y + 2.5;
  page.drawRectangle({ x: bx, y: by, width: bw, height: bh, color: WHITE });
  drawCentered(page, 'ICP', { cx: bx + bw / 2, y: by + bh - 5.2, size: 5, font: bold, color: NAVY });
  drawCentered(page, 'Brasil', { cx: bx + bw / 2, y: by + bh - 10, size: 4, font: bold, color: NAVY });

  // Base legal a direita. Duas linhas, nao tres: a caixa tem ~11pt uteis e
  // uma terceira linha encavalava na segunda.
  const lx = bx + bw + 5;
  const lw = x + w - lx - 4;
  const l1 = 'Conforme MP 2.200-2/01';
  const l2 = 'e Lei 14.063/20';
  const ls = Math.min(4, fitSize(bold, l1, lw, 4));
  page.drawText(l1, { x: lx, y: by + bh - 5, size: ls, font: bold, color: WHITE });
  page.drawText(l2, { x: lx, y: by + bh - 10.2, size: ls, font: bold, color: WHITE });
}

/**
 * Linha discreta com hash + validador oficial, logo abaixo do selo.
 * Mesma informacao que o modelo antigo imprimia sob o carimbo.
 */
function drawHashLine(
  page: PDFPage,
  opts: { cx: number; y: number; maxWidth: number; sha256: string; font: PDFFont },
): void {
  const muted = rgb(0.35, 0.35, 0.35);
  const l1 = toWinAnsi(`Hash SHA-256 do original: ${opts.sha256}`);
  const s1 = fitSize(opts.font, l1, opts.maxWidth, 4.2);
  drawCentered(page, l1, { cx: opts.cx, y: opts.y + 5, size: s1, font: opts.font, color: muted });
  const l2 = 'Verifique a validade em validar.iti.gov.br';
  const s2 = fitSize(opts.font, l2, opts.maxWidth, 4.2);
  drawCentered(page, l2, { cx: opts.cx, y: opts.y, size: s2, font: opts.font, color: muted });
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
        drawBadge(page, box, { regular, bold });
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
