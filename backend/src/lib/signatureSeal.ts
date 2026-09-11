import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';

// =====================================================
// signatureSeal — desenha o SELO VISIVEL de assinatura digital no PDF,
// antes de a assinatura PKCS#7 ser aplicada (ver pdfSigning.ts).
//
// POR QUE ISSO EXISTE
// A assinatura PKCS#7 e criptografica, nao grafica: sozinha ela nao
// desenha absolutamente nada na pagina (o widget nasce com
// `/Rect [0 0 0 0]`). O documento fica juridicamente assinado, mas
// visualmente identico a um documento sem assinatura — e o Chrome, que e
// onde o clube abre os PDFs, nao tem painel de assinaturas para revelar
// isso. Resultado pratico: "anexei o certificado e continua saindo sem
// assinar", quando na verdade estava assinando o tempo todo.
//
// O sistema antigo (dompdf + pyHanko) carimbava um selo visivel com o
// nome do signatario, a referencia legal e o hash do documento. Este
// modulo reproduz esse selo — e o `widgetRect` devolvido ancora a
// assinatura real por cima dele, de modo que clicar no selo no Adobe
// Reader abre os detalhes de validacao.
//
// ONDE O SELO E DESENHADO
// Na faixa de rodape que TODOS os PDFs do sistema ja reservam e deixam
// vazia, entre 14,8mm e 21,5mm da borda inferior:
//   - relatorios (reportBase): conteudo para em MARGIN_BOTTOM = 22mm e o
//     rodape institucional comeca em 14mm — a faixa entre os dois e livre;
//   - declaracoes (declarationBase): margem inferior de 30mm, sem rodape.
// Por isso o selo nunca sobrepoe conteudo em nenhum dos dois layouts.
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

export interface SealInfo {
  /** CN do certificado, no formato "NOME:CPF" usado pelo ICP-Brasil. */
  holderName: string;
  /** SHA-256 (hex) do PDF original, antes do selo e da assinatura. */
  sha256: string;
  signedAt: Date;
}

/** [x1, y1, x2, y2] do selo na ultima pagina — ancora do widget de assinatura. */
export type WidgetRect = [number, number, number, number];

/**
 * StandardFonts usam WinAnsi, que nao cobre todo o Unicode: um caractere
 * fora da tabela faz o pdf-lib lancar e derrubaria a assinatura inteira.
 * Normaliza os poucos sinais tipograficos que costumam aparecer e remove
 * o que sobrar de fora da faixa Latin-1.
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
  const digits = match[2];
  return {
    name: match[1].trim(),
    cpf: digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'),
  };
}

function formatSignedAt(date: Date): string {
  // Horario de Salvador/BA — o clube le a data no fuso dele, nao em UTC.
  const d = date.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' });
  const t = date.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Bahia',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${d} as ${t}`;
}

/**
 * Encolhe a fonte ate o texto caber na largura disponivel. Hashes e nomes
 * longos nao podem vazar para fora da faixa.
 */
function fitSize(font: PDFFont, text: string, maxWidth: number, preferred: number): number {
  let size = preferred;
  while (size > 3.2 && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.25;
  }
  return size;
}

/**
 * Carimba o selo em todas as paginas elegiveis e devolve o retangulo do
 * selo na ULTIMA pagina (para ancorar o widget de assinatura), ou null se
 * nenhuma pagina comportava o selo.
 */
export async function drawSignatureSeal(
  pdfDoc: PDFDocument,
  info: SealInfo,
): Promise<{ widgetRect: WidgetRect; pageIndex: number } | null> {
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { name, cpf } = splitHolder(info.holderName);
  const signerLine = toWinAnsi(
    `ASSINADO DIGITALMENTE POR ${name}${cpf ? ` - CPF ${cpf}` : ''} EM ${formatSignedAt(info.signedAt)}`,
  );
  const legalLine = toWinAnsi(
    'Assinatura eletronica qualificada ICP-Brasil (MP 2.200-2/2001 e Lei 14.063/2020). ' +
      'Verifique a validade em validar.iti.gov.br',
  );
  const hashLine = toWinAnsi(`SHA-256 do documento original: ${info.sha256}`);

  const border = rgb(0.45, 0.45, 0.45);
  const ink = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.35, 0.35, 0.35);

  const pages = pdfDoc.getPages();
  let last: { widgetRect: WidgetRect; pageIndex: number } | null = null;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    if (width < MIN_PAGE_WIDTH_PT || height < MIN_PAGE_HEIGHT_PT) continue;

    const x = MARGIN_X_MM * MM;
    const boxWidth = width - x * 2;
    if (boxWidth <= 0) continue;
    const y = BAND_BOTTOM_MM * MM;
    const padX = 4;
    const textWidth = boxWidth - padX * 2;

    // So a moldura: sem preenchimento, para nunca encobrir o que ja estava
    // desenhado na pagina.
    page.drawRectangle({
      x,
      y,
      width: boxWidth,
      height: BAND_HEIGHT_PT,
      borderColor: border,
      borderWidth: 0.5,
    });

    const signerSize = fitSize(helvBold, signerLine, textWidth, 6);
    page.drawText(signerLine, {
      x: x + padX,
      y: y + BAND_HEIGHT_PT - 7,
      size: signerSize,
      font: helvBold,
      color: ink,
    });

    const legalSize = fitSize(helv, legalLine, textWidth, 5);
    page.drawText(legalLine, {
      x: x + padX,
      y: y + BAND_HEIGHT_PT - 12.5,
      size: legalSize,
      font: helv,
      color: muted,
    });

    const hashSize = fitSize(helv, hashLine, textWidth, 4.6);
    page.drawText(hashLine, {
      x: x + padX,
      y: y + 3,
      size: hashSize,
      font: helv,
      color: muted,
    });

    last = { widgetRect: [x, y, x + boxWidth, y + BAND_HEIGHT_PT], pageIndex: i };
  }

  return last;
}
