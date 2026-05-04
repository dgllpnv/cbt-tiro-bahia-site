import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, ScanFace, CheckCircle2, AlertCircle, RefreshCw, Receipt } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import CameraStream, { type CameraStreamHandle } from './CameraStream';
import { useToast } from '@/hooks/use-toast';
import { detectFace } from '@/lib/faceCapture';
import { verifyFace, type MatchedMember, type FaceVerifyResult } from '@/services/faceProfilesService';

interface FaceVerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando o membro identificado NAO esta presente no clube (entrada). */
  onMatched: (member: MatchedMember) => void;
  /**
   * IDs dos membros atualmente presentes no clube. Quando definido, e o
   * matched member estiver na lista, o botao muda para "Fechar conta" e
   * chama onMatchedAlreadyPresent ao inves de onMatched.
   */
  presentMemberIds?: Set<string>;
  /**
   * Chamado quando o membro identificado JA esta no clube (saida/checkout).
   * Recebe tambem o descriptor capturado, util para criar habitualidade
   * automatica via /verify-checkout sem precisar capturar novamente.
   */
  onMatchedAlreadyPresent?: (member: MatchedMember, descriptor: number[]) => void;
}

type Phase = 'scanning' | 'analyzing' | 'matched' | 'no-match';

const FaceVerifyDialog = ({
  open,
  onOpenChange,
  onMatched,
  presentMemberIds,
  onMatchedAlreadyPresent,
}: FaceVerifyDialogProps) => {
  const { toast } = useToast();
  const cameraRef = useRef<CameraStreamHandle | null>(null);
  const phaseRef = useRef<Phase>('scanning');
  const consecutiveDetectionsRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  // Mantem o ultimo descriptor capturado para reusar em "Fechar conta" sem
  // precisar pedir nova captura (ja que o admin acabou de validar).
  const lastDescriptorRef = useRef<number[] | null>(null);

  const [phase, setPhase] = useState<Phase>('scanning');
  const [result, setResult] = useState<FaceVerifyResult | null>(null);

  const updatePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const stopScanning = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(async () => {
    if (cancelledRef.current) return;
    if (phaseRef.current !== 'scanning') return;

    const video = cameraRef.current?.videoEl();
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;

    const captured = await detectFace(video);
    if (!captured) {
      consecutiveDetectionsRef.current = 0;
      return;
    }

    consecutiveDetectionsRef.current += 1;
    // Confirma com 3 frames consecutivos para evitar falsos positivos.
    if (consecutiveDetectionsRef.current < 3) return;

    stopScanning();
    updatePhase('analyzing');

    // Salva o descriptor para reuso no fluxo "Fechar conta"
    lastDescriptorRef.current = captured.descriptor;

    const res = await verifyFace(captured.descriptor);
    if (cancelledRef.current) return;

    if (!res.success) {
      toast({
        variant: 'destructive',
        title: 'Erro ao verificar',
        description: res.error || 'Tente novamente.',
      });
      consecutiveDetectionsRef.current = 0;
      updatePhase('scanning');
      startScanning();
      return;
    }

    setResult(res.data);
    updatePhase(res.data.matched ? 'matched' : 'no-match');
  }, [stopScanning, toast, updatePhase]);

  const startScanning = useCallback(() => {
    if (intervalRef.current !== null) return;
    consecutiveDetectionsRef.current = 0;
    updatePhase('scanning');
    intervalRef.current = window.setInterval(() => {
      void tick();
    }, 600);
  }, [tick, updatePhase]);

  // Reset ao abrir/fechar
  useEffect(() => {
    if (open) {
      cancelledRef.current = false;
      consecutiveDetectionsRef.current = 0;
      setResult(null);
      updatePhase('scanning');
    } else {
      cancelledRef.current = true;
      stopScanning();
    }
    return () => {
      cancelledRef.current = true;
      stopScanning();
    };
  }, [open, stopScanning, updatePhase]);

  const handleCameraReady = useCallback(() => {
    startScanning();
  }, [startScanning]);

  const handleRetry = () => {
    setResult(null);
    consecutiveDetectionsRef.current = 0;
    updatePhase('scanning');
    startScanning();
  };

  const isAlreadyPresent =
    !!result?.matched &&
    !!result.member &&
    !!presentMemberIds &&
    presentMemberIds.has(result.member.id);

  const handleConfirm = () => {
    if (!result?.matched || !result.member) return;
    if (isAlreadyPresent && onMatchedAlreadyPresent && lastDescriptorRef.current) {
      onMatchedAlreadyPresent(result.member, lastDescriptorRef.current);
    } else {
      onMatched(result.member);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white font-military tracking-wide flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-cbt-orange" />
            Identificação Facial
          </DialogTitle>
          <DialogDescription className="text-gray-400 font-tactical text-sm">
            Posicione o rosto da pessoa em frente à câmera. Identificação automática.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <CameraStream ref={cameraRef} onReady={handleCameraReady} />

          {/* Status */}
          {phase === 'scanning' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded text-blue-200 text-sm font-tactical">
              <Loader2 className="h-4 w-4 animate-spin" />
              Procurando rosto...
            </div>
          )}

          {phase === 'analyzing' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-cbt-orange/10 border border-cbt-orange/30 rounded text-cbt-orange text-sm font-tactical">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando...
            </div>
          )}

          {phase === 'matched' && result?.matched && result.member && (
            <div
              className={`p-4 rounded space-y-3 ${
                isAlreadyPresent
                  ? 'bg-blue-500/10 border border-blue-500/30'
                  : 'bg-green-500/10 border border-green-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                {result.suggestions[0]?.profileId && (
                  <FaceThumbnailById
                    profileId={result.suggestions[0].profileId}
                    accent={isAlreadyPresent ? 'blue' : 'green'}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-tactical text-xs uppercase tracking-wider flex items-center gap-1 ${isAlreadyPresent ? 'text-blue-300' : 'text-green-300'}`}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Identificado
                    {isAlreadyPresent && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-[10px]">
                        já está no clube
                      </span>
                    )}
                  </p>
                  <p className="text-white font-military text-base font-bold truncate">
                    {result.member.fullName}
                  </p>
                  <p className="text-gray-400 font-tactical text-xs">
                    {result.member.role === 'VISITOR'
                      ? 'Visitante'
                      : `Nº ${result.member.memberNumber || '—'}`}
                    {' · '}
                    Similaridade {(result.similarity! * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {phase === 'no-match' && result && !result.matched && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded space-y-3">
              <div className="flex items-start gap-2 text-yellow-200">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="font-tactical text-sm">
                  Ninguém identificado com confiança. Use a busca manual ou tente novamente.
                </p>
              </div>
              {result.suggestions.length > 0 && (
                <div>
                  <p className="text-xs font-tactical text-gray-400 mb-1">Sugestões:</p>
                  <div className="space-y-1">
                    {result.suggestions.map((s) => (
                      <div
                        key={s.profileId}
                        className="flex items-center justify-between px-2 py-1 bg-gray-800/50 rounded"
                      >
                        <span className="text-white text-xs font-tactical truncate">
                          {s.member.fullName}
                          {s.member.role === 'VISITOR' && (
                            <span className="ml-1 text-blue-300">(visitante)</span>
                          )}
                        </span>
                        <span className="text-gray-500 text-xs font-mono">
                          {(s.similarity * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
          >
            Cancelar
          </Button>
          <div className="flex gap-2">
            {(phase === 'matched' || phase === 'no-match') && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRetry}
                className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            )}
            {phase === 'matched' && (
              isAlreadyPresent ? (
                <Button
                  type="button"
                  onClick={handleConfirm}
                  className="bg-red-600 hover:bg-red-700 text-white font-tactical"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Fechar conta
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleConfirm}
                  className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar entrada
                </Button>
              )
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Thumbnail placeholder simples (o backend nao retorna thumbnail no verify hoje;
// se quisermos otimizar, estender o endpoint para incluir o thumbnail do top).
const FaceThumbnailById = ({
  profileId,
  accent = 'green',
}: {
  profileId: string;
  accent?: 'green' | 'blue';
}) => (
  <div
    className={`w-12 h-12 rounded-full bg-gray-800 border flex items-center justify-center flex-shrink-0 ${
      accent === 'blue' ? 'border-blue-500/30' : 'border-green-500/30'
    }`}
    title={`Profile ${profileId.slice(0, 8)}`}
  >
    <ScanFace className={`h-5 w-5 ${accent === 'blue' ? 'text-blue-300' : 'text-green-300'}`} />
  </div>
);

export default FaceVerifyDialog;
