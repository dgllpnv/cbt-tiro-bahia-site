import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export interface CameraStreamHandle {
  videoEl: () => HTMLVideoElement | null;
  switchCamera: () => Promise<void>;
}

interface CameraStreamProps {
  onReady?: (videoEl: HTMLVideoElement) => void;
  onError?: (err: Error) => void;
  mirrored?: boolean;
}

const CameraStream = forwardRef<CameraStreamHandle, CameraStreamProps>(
  ({ onReady, onError, mirrored = true }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState<string>('');

    useImperativeHandle(ref, () => ({
      videoEl: () => videoRef.current,
      switchCamera: async () => {
        setFacingMode((m) => (m === 'user' ? 'environment' : 'user'));
      },
    }));

    useEffect(() => {
      let cancelled = false;

      async function start() {
        setStatus('loading');
        setErrorMsg('');
        try {
          // Para qualquer stream anterior
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }

          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode,
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          });

          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {});
            setStatus('ready');
            onReady?.(videoRef.current);
          }
        } catch (err: any) {
          if (cancelled) return;
          setStatus('error');
          const msg =
            err?.name === 'NotAllowedError'
              ? 'Permissão de câmera negada. Habilite nas configurações do navegador.'
              : err?.name === 'NotFoundError'
                ? 'Nenhuma câmera detectada.'
                : err?.message || 'Erro ao acessar a câmera.';
          setErrorMsg(msg);
          onError?.(err);
        }
      }

      start();

      return () => {
        cancelled = true;
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };
    }, [facingMode, onError, onReady]);

    return (
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`}
        />
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-foreground gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-cbt-orange" />
            <p className="text-sm font-tactical">Iniciando câmera...</p>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-foreground gap-3 p-6 text-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm font-tactical">{errorMsg}</p>
            <button
              type="button"
              onClick={() => setFacingMode((m) => m)}
              className="px-3 py-1.5 bg-cbt-orange/20 border border-cbt-orange/40 rounded text-cbt-orange text-xs font-tactical flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Tentar novamente
            </button>
          </div>
        )}
        {status === 'ready' && (
          <button
            type="button"
            onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
            className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-foreground hover:bg-black/70 transition-colors"
            title="Trocar câmera"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  },
);

CameraStream.displayName = 'CameraStream';

export default CameraStream;
