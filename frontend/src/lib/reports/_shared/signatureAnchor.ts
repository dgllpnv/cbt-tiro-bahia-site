import type jsPDF from 'jspdf';

// =====================================================
// signatureAnchor — onde o selo de assinatura digital deve ser carimbado
// dentro do PDF.
//
// Quem desenha o bloco de assinatura (reportBase.addSignatureBlock,
// declarationBase.declSignature/declTwoSignatures) e o unico que sabe em
// que pagina e em que altura sobrou o espaco da rubrica. O selo, porem, e
// carimbado no BACKEND — so ele tem o certificado e so ele sabe se a
// assinatura realmente saiu (ver backend/src/lib/signatureSeal.ts).
//
// Este modulo faz a ponte: o gerador registra o retangulo reservado e o
// funil de assinatura (pdfSigning.ts) envia junto com o PDF. Sem ancora,
// o backend cai no selo discreto de rodape.
//
// Usa WeakMap em vez de uma propriedade no proprio jsPDF para nao poluir
// o objeto nem segurar referencia depois que o PDF e descartado.
// =====================================================

/** Retangulo reservado para o selo, em mm, a partir do topo-esquerda da pagina. */
export interface SignatureAnchor {
  /** Pagina do jsPDF (1-based). */
  page: number;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
}

const anchors = new WeakMap<object, SignatureAnchor>();

export function setSignatureAnchor(pdf: jsPDF, anchor: SignatureAnchor): void {
  anchors.set(pdf as unknown as object, anchor);
}

export function getSignatureAnchor(pdf: jsPDF): SignatureAnchor | null {
  return anchors.get(pdf as unknown as object) ?? null;
}

/**
 * Numero da pagina corrente do jsPDF (1-based). `getCurrentPageInfo` existe
 * em runtime mas nao esta nos tipos publicos do jsPDF — daí o shape local.
 */
type WithPageInfo = { internal?: { getCurrentPageInfo?: () => { pageNumber: number } } };

export function currentPage(pdf: jsPDF): number {
  const info = (pdf as unknown as WithPageInfo).internal?.getCurrentPageInfo?.();
  return info?.pageNumber ?? pdf.getNumberOfPages();
}

/**
 * Dimensoes do selo (mm). Largura folgada porque o selo gov.br tem quatro
 * linhas de texto ao lado da marca; a altura e limitada pelo vao de 14mm
 * que o bloco de assinatura deixa acima da linha da rubrica.
 */
export const SEAL_W_MM = 62;
export const SEAL_H_MM = 10;
