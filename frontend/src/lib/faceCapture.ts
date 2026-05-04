/**
 * Wrapper enxuto da Human library para reconhecimento facial in-browser.
 *
 * - Singleton lazy: a Human (com modelos) so e instanciada na primeira chamada.
 * - Apenas o necessario: face detection + descriptor (1024-d).
 * - Modelos servidos em /models/ (cache do browser apos primeira carga).
 *
 * Uso tipico:
 *   const human = await getHuman();
 *   const result = await detectFace(videoElement);
 *   if (result) { sendToBackend(result.descriptor); }
 */

import { Human, type Config } from '@vladmandic/human';

const config: Partial<Config> = {
  modelBasePath: '/models/',
  cacheModels: true,
  warmup: 'none',
  filter: { enabled: true },
  face: {
    enabled: true,
    detector: { rotation: true, maxDetected: 1, return: false },
    mesh: { enabled: true },
    iris: { enabled: false },
    description: { enabled: true },
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  hand: { enabled: false },
  body: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
  object: { enabled: false },
};

let humanInstance: Human | null = null;
let humanLoading: Promise<Human> | null = null;

/**
 * Retorna a instancia singleton da Human, carregando os modelos no primeiro uso.
 */
export async function getHuman(): Promise<Human> {
  if (humanInstance) return humanInstance;
  if (humanLoading) return humanLoading;

  humanLoading = (async () => {
    const h = new Human(config);
    await h.load();
    humanInstance = h;
    humanLoading = null;
    return h;
  })();

  return humanLoading;
}

export interface FaceCaptureResult {
  descriptor: number[];
  thumbnail: string;
  confidence: number;
}

/**
 * Detecta uma face no video e retorna descriptor + thumbnail JPEG (200x200).
 *
 * Retorna null se nao houver face detectada ou descriptor (face muito distante,
 * mal iluminada, parcialmente oculta, etc.).
 */
export async function detectFace(video: HTMLVideoElement): Promise<FaceCaptureResult | null> {
  const human = await getHuman();
  const result = await human.detect(video);

  if (!result.face || result.face.length === 0) return null;

  const face = result.face[0];
  if (!face.embedding || face.embedding.length === 0) return null;

  const descriptor = Array.from(face.embedding);
  const confidence = face.boxScore ?? face.faceScore ?? 0;

  // Recorta o rosto e gera thumbnail 200x200 JPEG base64
  const thumbnail = cropFaceToJpegDataUrl(video, face);

  return { descriptor, thumbnail, confidence };
}

/**
 * Recorta a regiao da face do video e exporta como JPEG base64 (200x200).
 *
 * Usa a bounding box da deteccao com pequena margem ao redor.
 */
function cropFaceToJpegDataUrl(
  video: HTMLVideoElement,
  face: { box: [number, number, number, number] | number[] },
): string {
  const [x, y, w, h] = face.box;
  const margin = Math.max(w, h) * 0.2;
  const cx = Math.max(0, x - margin);
  const cy = Math.max(0, y - margin);
  const cw = Math.min(video.videoWidth - cx, w + margin * 2);
  const ch = Math.min(video.videoHeight - cy, h + margin * 2);

  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(video, cx, cy, cw, ch, 0, 0, 200, 200);
  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Pre-carrega os modelos da Human em background (sem detectar nada).
 * Util para chamar quando o admin abre o dashboard, antes de clicar Facial.
 */
export async function warmup(): Promise<void> {
  await getHuman();
}
