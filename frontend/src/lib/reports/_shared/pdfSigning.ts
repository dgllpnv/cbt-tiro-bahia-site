import type jsPDF from 'jspdf';
import api from '@/services/api';

// =====================================================
// pdfSigning — ponto unico que decide se um PDF gerado no navegador deve
// ser assinado digitalmente antes de ser baixado/visualizado.
//
// Quando o clube tem um certificado configurado (ClubDigitalSignature),
// o PDF ja pronto (bytes) e enviado para POST /api/documents/sign, que
// devolve o mesmo arquivo com uma assinatura PKCS#7/ICP-Brasil real
// embutida (ver backend/src/lib/pdfSigning.ts). Sem certificado
// configurado, ou se a assinatura falhar por qualquer motivo, o
// comportamento cai de volta para o download normal sem assinatura —
// NUNCA bloqueia a geracao do documento.
// =====================================================

// Cache curto do status "configurado" — evita bater a API a cada PDF numa
// sessao onde o usuario baixa varios documentos em sequencia.
let signatureCache: { value: boolean; expiresAt: number } | null = null;

async function isSignatureConfigured(): Promise<boolean> {
  const now = Date.now();
  if (signatureCache && signatureCache.expiresAt > now) return signatureCache.value;
  try {
    const res = await api.get('/api/club-settings/digital-signature');
    const value = !!res.data?.data?.configured;
    signatureCache = { value, expiresAt: now + 30_000 };
    return value;
  } catch {
    return false;
  }
}

/** Chame apos configurar/remover a assinatura para o proximo PDF ja refletir o novo estado. */
export function invalidateSignatureCache(): void {
  signatureCache = null;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'application/pdf' });
}

async function trySignPdf(pdf: jsPDF, documentLabel?: string): Promise<Blob | null> {
  if (!(await isSignatureConfigured())) return null;
  try {
    const bytes = pdf.output('arraybuffer') as ArrayBuffer;
    const pdfData = uint8ToBase64(new Uint8Array(bytes));
    const res = await api.post('/api/documents/sign', { pdfData, documentLabel });
    if (res.data?.success && res.data.data?.signedPdfData) {
      return base64ToBlob(res.data.data.signedPdfData);
    }
    return null;
  } catch (err) {
    // Nao bloqueia o usuario — o documento ainda sai, so sem assinatura.
    console.error('[pdfSigning] Falha ao assinar PDF, baixando sem assinatura:', err);
    return null;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ReportOutput {
  filename: string;
  blobUrl: string;
  save: () => void;
}

/**
 * Usado pelo funil de Relatorios (reportRegistry.ts). Mesmo shape que
 * `{ filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) }`
 * de antes — so que assina primeiro quando ha certificado configurado.
 */
export async function finalizeReportOutput(pdf: jsPDF, filename: string): Promise<ReportOutput> {
  const signedBlob = await trySignPdf(pdf, filename);
  if (signedBlob) {
    return { filename, blobUrl: URL.createObjectURL(signedBlob), save: () => downloadBlob(signedBlob, filename) };
  }
  return {
    filename,
    blobUrl: URL.createObjectURL(pdf.output('blob')),
    save: () => pdf.save(filename),
  };
}

/**
 * Usado pelos pontos que baixam direto (`pdf.save(filename)`) fora do
 * funil de Relatorios — ex.: Meus Documentos e Habitualidade no portal.
 */
export async function downloadPdfSigned(pdf: jsPDF, filename: string): Promise<void> {
  const signedBlob = await trySignPdf(pdf, filename);
  if (signedBlob) {
    downloadBlob(signedBlob, filename);
    return;
  }
  pdf.save(filename);
}
