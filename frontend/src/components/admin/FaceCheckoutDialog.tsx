import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Loader2,
  ScanFace,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Camera,
  UserPlus,
} from 'lucide-react';

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
import {
  verifyFaceForCheckout,
  createFaceProfile,
  type CheckoutVerifyResult,
} from '@/services/faceProfilesService';

export interface FaceCheckoutTarget {
  memberId: string;
  memberName: string;
  visitId: string;
}

interface FaceCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: FaceCheckoutTarget | null;
  /**
   * Chamado apos confirmar identidade (match) ou apos cadastro inicial bem-sucedido
   * (caso o membro nao tivesse perfil ainda). Em ambos os casos a habitualidade
   * ja foi criada no backend.
   */
  onConfirmed?: (info: { habitualityCreated: number; calibers: string[] }) => void;
}

type Phase =
  | 'scanning'        // procurando rosto na camera
  | 'analyzing'       // enviou descriptor, esperando backend
  | 'matched'         // verificacao OK
  | 'no-match'        // similaridade baixa, oferece tentar de novo
  | 'no-profile'      // membro sem facial cadastrado, oferece registrar agora
  | 'capture-pending' // capturou, mostra preview antes de salvar (modo registro inicial)
  | 'saving';         // salvando registro inicial

const FaceCheckoutDialog = ({
  open,
  onOpenChange,
  target,
  onConfirmed,
}: FaceCheckoutDialogProps) => {
  const { toast } = useToast();
  const cameraRef = useRef<CameraStreamHandle | null>(null);
  const phaseRef = useRef<Phase>('scanning');
  const consecutiveDetectionsRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('scanning');
  const [result, setResult] = useState<CheckoutVerifyResult | null>(null);
  const [pendingCapture, setPendingCapture] = useState<{ descriptor: number[]; thumbnail: string } | null>(
    null,
  );

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
    if (!target) return;

    const video = cameraRef.current?.videoEl();
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;

    const captured = await detectFace(video);
    if (!captured) {
      consecutiveDetectionsRef.current = 0;
      return;
    }

    consecutiveDetectionsRef.current += 1;
    if (consecutiveDetectionsRef.current < 3) return;

    stopScanning();
    updatePhase('analyzing');

    const res = await verifyFaceForCheckout({
      descriptor: captured.descriptor,
      memberId: target.memberId,
      visitId: target.visitId,
    });

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

    if (res.data.matched) {
      updatePhase('matched');
      // Notifica pai apos breve delay para mostrar feedback
      setTimeout(() => {
        if (cancelledRef.current) return;
        onConfirmed?.({
          habitualityCreated: res.data.matched ? res.data.habituality.created : 0,
          calibers: res.data.matched ? res.data.habituality.calibers : [],
        });
        onOpenChange(false);
      }, 1500);
      return;
    }

    if (res.data.reason === 'NO_PROFILE_REGISTERED') {
      // Captura o frame atual para usar como descriptor inicial
      setPendingCapture({ descriptor: captured.descriptor, thumbnail: captured.thumbnail });
      updatePhase('no-profile');
    } else {
      updatePhase('no-match');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopScanning, target, toast, updatePhase, onConfirmed, onOpenChange]);

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
    if (open && target) {
      cancelledRef.current = false;
      consecutiveDetectionsRef.current = 0;
      setResult(null);
      setPendingCapture(null);
      updatePhase('scanning');
    } else {
      cancelledRef.current = true;
      stopScanning();
    }
    return () => {
      cancelledRef.current = true;
      stopScanning();
    };
  }, [open, target, stopScanning, updatePhase]);

  const handleCameraReady = useCallback(() => {
    startScanning();
  }, [startScanning]);

  const handleRetry = () => {
    setResult(null);
    setPendingCapture(null);
    consecutiveDetectionsRef.current = 0;
    updatePhase('scanning');
    startScanning();
  };

  const handleRegisterNow = async () => {
    if (!target || !pendingCapture) return;

    updatePhase('saving');
    const created = await createFaceProfile({
      memberId: target.memberId,
      descriptor: pendingCapture.descriptor,
      thumbnail: pendingCapture.thumbnail,
      source: 'CHECK_OUT',
      visitId: target.visitId,
    });

    if (cancelledRef.current) return;

    if (!created.success) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar facial',
        description: created.error || 'Tente novamente.',
      });
      updatePhase('no-profile');
      return;
    }

    const habituality = created.data.habituality;
    onConfirmed?.({
      habitualityCreated: habituality?.created ?? 0,
      calibers: habituality?.calibers ?? [],
    });
    onOpenChange(false);
  };

  const memberName = target?.memberName ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground font-military tracking-wide flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-cbt-orange" />
            Verificação Facial
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-tactical text-sm">
            Posicione <strong className="text-foreground">{memberName}</strong> em frente à câmera. O
            reconhecimento valida a saída e cria os registros de habitualidade automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {phase !== 'capture-pending' ? (
            <CameraStream ref={cameraRef} onReady={handleCameraReady} />
          ) : (
            <div className="flex items-center justify-center bg-black rounded-lg p-4">
              {pendingCapture && (
                <img
                  src={pendingCapture.thumbnail}
                  alt="Captura"
                  className="rounded-lg max-h-72 border-2 border-cbt-orange/50"
                />
              )}
            </div>
          )}

          {/* Status */}
          {phase === 'scanning' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded text-blue-800 dark:text-blue-200 text-sm font-tactical">
              <Loader2 className="h-4 w-4 animate-spin" />
              Procurando rosto...
            </div>
          )}

          {phase === 'analyzing' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-cbt-orange/10 border border-cbt-orange/30 rounded text-cbt-orange text-sm font-tactical">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando identidade...
            </div>
          )}

          {phase === 'matched' && result?.matched && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-tactical">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-bold">Identidade confirmada</span>
                <span className="text-muted-foreground/80 ml-auto text-xs">
                  Similaridade {(result.similarity * 100).toFixed(1)}%
                </span>
              </div>
              {result.habituality.created > 0 ? (
                <p className="text-xs font-tactical text-foreground/85">
                  {result.habituality.created} registro(s) de habitualidade criado(s):{' '}
                  <span className="text-foreground">{result.habituality.calibers.join(', ')}</span>
                </p>
              ) : (
                <p className="text-xs font-tactical text-muted-foreground/80">
                  Habitualidade já registrada anteriormente para esta visita.
                </p>
              )}
            </div>
          )}

          {phase === 'no-match' && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded space-y-2">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 font-tactical">
                <AlertCircle className="h-5 w-5" />
                <span className="font-bold">Não bateu com o cadastro</span>
                {result && !result.matched && result.similarity !== null && (
                  <span className="text-muted-foreground/80 ml-auto text-xs">
                    Similaridade {(result.similarity * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-xs font-tactical text-muted-foreground">
                Confira a iluminação e a posição do rosto, ou tente novamente. Se o problema
                persistir, atualize o perfil facial em{' '}
                <span className="text-foreground">Identidade Facial</span> no detalhe do membro.
              </p>
            </div>
          )}

          {phase === 'no-profile' && (
            <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded space-y-3">
              <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200 font-tactical">
                <AlertCircle className="h-5 w-5" />
                <span className="font-bold">Membro sem facial cadastrada</span>
              </div>
              <p className="text-xs font-tactical text-muted-foreground">
                Esta é a primeira captura de <strong className="text-foreground">{memberName}</strong>.
                Confirme o registro abaixo para validar a habitualidade.
              </p>
              {pendingCapture && (
                <div className="flex items-center gap-3 bg-card/60 rounded p-2">
                  <img
                    src={pendingCapture.thumbnail}
                    alt="Pré-visualização"
                    className="w-16 h-16 rounded object-cover border border-border"
                  />
                  <p className="text-xs font-tactical text-muted-foreground">
                    Pré-visualização da captura. Ao clicar em <strong>Cadastrar agora</strong>, o
                    descriptor é salvo e a habitualidade é gerada para os calibres da visita.
                  </p>
                </div>
              )}
            </div>
          )}

          {phase === 'saving' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-cbt-orange/10 border border-cbt-orange/30 rounded text-cbt-orange text-sm font-tactical">
              <Loader2 className="h-4 w-4 animate-spin" />
              Registrando facial e habitualidade...
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={phase === 'analyzing' || phase === 'saving'}
            className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
          >
            Pular verificação
          </Button>

          <div className="flex gap-2">
            {(phase === 'no-match' || phase === 'matched') && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRetry}
                disabled={phase === 'matched'}
                className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            )}
            {phase === 'no-profile' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRetry}
                  className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Capturar de novo
                </Button>
                <Button
                  type="button"
                  onClick={handleRegisterNow}
                  className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Cadastrar agora
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FaceCheckoutDialog;
