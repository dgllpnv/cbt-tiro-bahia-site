/**
 * Cosine similarity entre dois vetores de mesma dimensao.
 *
 * Retorna valor em [-1, 1]. Para descriptors da Human (1024 floats normalizados
 * pelo modelo), valores >= 0.5 indicam alta probabilidade de mesma pessoa.
 *
 * Ex: similarity = 1.0 → vetores identicos
 *     similarity = 0.0 → ortogonais (faces totalmente diferentes)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Descriptors com tamanhos diferentes: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Threshold default — ajustavel via env FACE_MATCH_THRESHOLD.
 * Gap minimo evita falsos positivos quando 2 candidatos estao proximos.
 */
export const DEFAULT_THRESHOLD = parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.5');
export const DEFAULT_GAP = parseFloat(process.env.FACE_MATCH_GAP || '0.05');
