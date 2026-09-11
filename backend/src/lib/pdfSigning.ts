import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import signpdfPkg from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { drawSignatureSeal } from './signatureSeal.js';

// @signpdf/signpdf e um pacote CJS (Babel) — sob a interop ESM do Node, o
// "default import" traz o objeto exports inteiro ({ SignPdf, Signer,
// default: <instancia> }), nao a instancia em si. Desembrulha os dois
// formatos possiveis para funcionar em qualquer combinacao de loader.
const signpdf: { sign: typeof import('@signpdf/signpdf').SignPdf.prototype.sign } =
  (signpdfPkg as any).default ?? (signpdfPkg as any);

// =====================================================
// pdfSigning — assina um PDF (bytes) com um certificado A1 (.pfx/.p12),
// produzindo uma assinatura PKCS#7 detached embutida no proprio arquivo
// (/Filter /Adobe.PPKLite, /SubFilter /adbe.pkcs7.detached, /ByteRange) —
// o mesmo padrao que o Adobe Reader e o pyHanko do sistema antigo geram.
// Valida em qualquer verificador de assinatura ICP-Brasil (ex.:
// validar.iti.gov.br) DESDE QUE o certificado configurado seja um e-CPF/
// e-CNPJ real emitido por uma AC do ICP-Brasil.
//
// 100% local, bibliotecas open-source (@signpdf/* + node-forge por baixo
// dos panos) — sem nenhum servico pago ou chamada externa.
// =====================================================

export interface SignPdfOptions {
  reason?: string;
  location?: string;
  contactInfo?: string;
  signerName: string;
  /**
   * Desenha o selo visivel de assinatura no rodape das paginas. Default
   * true — sem ele o documento sai assinado mas visualmente identico a um
   * nao assinado (ver signatureSeal.ts).
   */
  drawSeal?: boolean;
}

// Espaco reservado no PDF para a assinatura PKCS#7, em bytes.
//
// O default do @signpdf e 8192 — suficiente para um certificado avulso,
// mas PEQUENO DEMAIS para um e-CPF ICP-Brasil de verdade: o .pfx da AC
// traz a cadeia inteira (folha + AC intermediarias + AC Raiz) e o PKCS#7
// embute todas elas. O e-CPF do responsavel legal gera ~15 KB de
// assinatura e estourava o placeholder com
// "Signature exceeds placeholder length: 15238 > 8192", derrubando a
// assinatura de TODO documento (o certificado de teste usado no
// desenvolvimento era autoassinado, sem cadeia, e cabia nos 8192 — por
// isso o bug so apareceu com o certificado real).
//
// 32 KB da folga para cadeias mais longas e para um eventual carimbo de
// tempo. O espaco nao usado vira padding no arquivo final — custo
// irrelevante perto de quebrar a assinatura.
const SIGNATURE_LENGTH_BYTES = 32768;

export async function signPdfWithCertificate(
  pdfBytes: Buffer,
  p12Buffer: Buffer,
  password: string,
  opts: SignPdfOptions,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });

  // Selo visivel primeiro: ele faz parte do conteudo assinado, entao
  // adulterar o selo depois invalida a assinatura junto. O hash carimbado
  // e o do arquivo ORIGINAL (antes do selo) — mesma semantica do "Hash
  // SHA256 do original" que o sistema antigo imprimia.
  const signedAt = new Date();
  let seal: Awaited<ReturnType<typeof drawSignatureSeal>> = null;
  if (opts.drawSeal !== false) {
    seal = await drawSignatureSeal(pdfDoc, {
      holderName: opts.signerName,
      sha256: crypto.createHash('sha256').update(pdfBytes).digest('hex'),
      signedAt,
    });
  }

  pdflibAddPlaceholder({
    pdfDoc,
    reason: opts.reason ?? 'Documento assinado digitalmente pelo clube',
    contactInfo: opts.contactInfo ?? '',
    name: opts.signerName,
    location: opts.location ?? '',
    signatureLength: SIGNATURE_LENGTH_BYTES,
    signingTime: signedAt,
    // Ancora a assinatura por cima do selo da ultima pagina: no Adobe
    // Reader, clicar no selo abre o painel de validacao. Sem selo (pagina
    // pequena), segue invisivel como antes.
    ...(seal
      ? { pdfPage: pdfDoc.getPages()[seal.pageIndex], widgetRect: seal.widgetRect }
      : {}),
  });

  // useObjectStreams:false e obrigatorio — a assinatura precisa localizar
  // o /ByteRange e o placeholder no arquivo final byte a byte; streams de
  // objeto comprimem/reordenam o corpo do PDF e quebram esse calculo.
  const pdfWithPlaceholder = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));

  const signer = new P12Signer(p12Buffer, { passphrase: password });
  const signed: Buffer = await signpdf.sign(pdfWithPlaceholder, signer);

  return signed;
}
