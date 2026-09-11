import type jsPDF from 'jspdf';
import api from '@/services/api';
import { getSignatureAnchor } from './signatureAnchor';

// =====================================================
// pdfSigning — ponto unico que decide se um PDF gerado no navegador deve
// ser assinado digitalmente antes de ser baixado/visualizado.
//
// Quando o clube tem um certificado configurado (ClubDigitalSignature),
// o PDF ja pronto (bytes) e enviado para POST /api/documents/sign, que
// devolve o mesmo arquivo com uma assinatura PKCS#7/ICP-Brasil real
// embutida (ver backend/src/lib/pdfSigning.ts).
//
// REGRA: falha de assinatura NUNCA bloqueia a geracao do documento — o
// arquivo sai mesmo assim, so que sem assinatura. Mas o chamador SEMPRE
// recebe o desfecho (`SignatureOutcome`) e e obrigado a avisar o usuario
// quando um documento oficial saiu sem a assinatura que era esperada.
// Baixar um documento nao assinado achando que esta assinado e pior do
// que nao baixar: foi exatamente assim que o certificado vencido passou
// despercebido, com a tela dizendo "Declaracao gerada" normalmente.
// =====================================================

/** Desfecho da tentativa de assinatura de um PDF. */
export interface SignatureOutcome {
  /** PDF saiu com assinatura PKCS#7 embutida. */
  signed: boolean;
  /** Havia certificado configurado — ou seja, a assinatura era esperada. */
  attempted: boolean;
  /** Motivo da falha (mensagem do backend), quando `attempted && !signed`. */
  reason?: string;
}

const NOT_CONFIGURED: SignatureOutcome = { signed: false, attempted: false };

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
  } catch (err) {
    // Nao da pra saber se ha certificado. Trata como "sem certificado" para
    // nao alarmar clubes que nao usam assinatura — o proprio painel de Dados
    // do Clube ja mostra o erro de leitura para o admin. Sem cache: a
    // proxima geracao tenta de novo.
    console.error('[pdfSigning] Nao foi possivel checar o certificado do clube:', err);
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

/** Mensagem util do backend (`{ success:false, error }`) ou fallback generico. */
function extractReason(err: any): string {
  return (
    err?.response?.data?.error ||
    err?.message ||
    'Nao foi possivel falar com o servidor de assinatura.'
  );
}

async function trySignPdf(
  pdf: jsPDF,
  documentLabel?: string,
): Promise<{ blob: Blob | null; outcome: SignatureOutcome }> {
  if (!(await isSignatureConfigured())) return { blob: null, outcome: NOT_CONFIGURED };
  try {
    const bytes = pdf.output('arraybuffer') as ArrayBuffer;
    const pdfData = uint8ToBase64(new Uint8Array(bytes));
    // Onde o gerador reservou o espaco da rubrica. Sem ancora o backend
    // carimba o selo discreto no rodape.
    const anchor = getSignatureAnchor(pdf) ?? undefined;
    const res = await api.post('/api/documents/sign', { pdfData, documentLabel, anchor });
    if (res.data?.success && res.data.data?.signedPdfData) {
      return { blob: base64ToBlob(res.data.data.signedPdfData), outcome: { signed: true, attempted: true } };
    }
    return {
      blob: null,
      outcome: { signed: false, attempted: true, reason: res.data?.error || 'Resposta invalida do servidor.' },
    };
  } catch (err) {
    // Nao bloqueia o usuario — o documento ainda sai, so sem assinatura.
    // O motivo sobe junto para quem chamou avisar na tela.
    console.error('[pdfSigning] Falha ao assinar PDF, baixando sem assinatura:', err);
    return { blob: null, outcome: { signed: false, attempted: true, reason: extractReason(err) } };
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
  /** Desfecho da assinatura — a tela deve avisar quando `attempted && !signed`. */
  signature: SignatureOutcome;
}

/**
 * Usado pelo funil de Relatorios (reportRegistry.ts). Mesmo shape que
 * `{ filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) }`
 * de antes — so que assina primeiro quando ha certificado configurado e
 * informa em `signature` se a assinatura realmente saiu.
 */
export async function finalizeReportOutput(pdf: jsPDF, filename: string): Promise<ReportOutput> {
  const { blob, outcome } = await trySignPdf(pdf, filename);
  if (blob) {
    return {
      filename,
      blobUrl: URL.createObjectURL(blob),
      save: () => downloadBlob(blob, filename),
      signature: outcome,
    };
  }
  return {
    filename,
    blobUrl: URL.createObjectURL(pdf.output('blob')),
    save: () => pdf.save(filename),
    signature: outcome,
  };
}

/**
 * Usado pelos pontos que baixam direto (`pdf.save(filename)`) fora do
 * funil de Relatorios — ex.: Meus Documentos e Habitualidade no portal.
 * Devolve o desfecho para a pagina avisar quando o documento saiu sem a
 * assinatura esperada.
 */
export async function downloadPdfSigned(pdf: jsPDF, filename: string): Promise<SignatureOutcome> {
  const { blob, outcome } = await trySignPdf(pdf, filename);
  if (blob) {
    downloadBlob(blob, filename);
  } else {
    pdf.save(filename);
  }
  return outcome;
}

/**
 * Texto pronto para toast/banner quando um documento oficial saiu sem a
 * assinatura que era esperada. `null` quando nao ha nada a avisar.
 */
export function signatureWarning(outcome: SignatureOutcome): string | null {
  if (!outcome.attempted || outcome.signed) return null;
  return `O arquivo foi baixado SEM assinatura digital. ${outcome.reason ?? ''}`.trim();
}
