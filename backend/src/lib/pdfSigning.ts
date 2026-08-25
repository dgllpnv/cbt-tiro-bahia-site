import { PDFDocument } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import signpdfPkg from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';

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
}

export async function signPdfWithCertificate(
  pdfBytes: Buffer,
  p12Buffer: Buffer,
  password: string,
  opts: SignPdfOptions,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });

  pdflibAddPlaceholder({
    pdfDoc,
    reason: opts.reason ?? 'Documento assinado digitalmente pelo clube',
    contactInfo: opts.contactInfo ?? '',
    name: opts.signerName,
    location: opts.location ?? '',
  });

  // useObjectStreams:false e obrigatorio — a assinatura precisa localizar
  // o /ByteRange e o placeholder no arquivo final byte a byte; streams de
  // objeto comprimem/reordenam o corpo do PDF e quebram esse calculo.
  const pdfWithPlaceholder = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));

  const signer = new P12Signer(p12Buffer, { passphrase: password });
  const signed: Buffer = await signpdf.sign(pdfWithPlaceholder, signer);

  return signed;
}
