import { useState, useRef, useEffect } from 'react';
import { Loader2, Camera, Save, RefreshCw, ScanFace } from 'lucide-react';

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
  createFaceProfile,
  type CreateFaceProfileResult,
} from '@/services/faceProfilesService';

export interface FaceCaptureTarget {
  memberId: string;
  memberName: string;
  source: 'CHECK_IN' | 'CHECK_OUT' | 'MANUAL';
  visitId?: string | null;
}

interface FaceCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: FaceCaptureTarget | null;
  onCaptured?: (result: CreateFaceProfileResult) => void;
  /** Callback chamado depois do dialog fechar, sucesso ou cancelamento. */
  onClosed?: () => void;
}

const FaceCaptureDialog = ({
  open,
  onOpenChange,
  target,
  onCaptured,
  onClosed,
}: FaceCaptureDialogProps) => {
  const { toast } = useToast();
  const cameraRef = useRef<CameraStreamHandle | null>(null);

  const [pending, setPending] = useState<{ descriptor: number[]; thumbnail: string } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPending(null);
      setIsCapturing(false);
      setIsSaving(false);
    } else {
      onClosed?.();
    }
    // intencionalmente sem onClosed nas deps (callback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCapture = async () => {
    const video = cameraRef.current?.videoEl();
    if (!video || video.readyState < 2) {
      toast({ variant: 'destructive', title: 'Câmera ainda não está pronta' });
      return;
    }

    setIsCapturing(true);
    const captured = await detectFace(video);
    setIsCapturing(false);

    if (!captured) {
      toast({
        variant: 'destructive',
        title: 'Não detectou rosto',
        description: 'Aproxime, melhore a iluminação e tente novamente.',
      });
      return;
    }

    setPending({ descriptor: captured.descriptor, thumbnail: captured.thumbnail });
  };

  const handleSave = async () => {
    if (!pending || !target) return;

    setIsSaving(true);
    const result = await createFaceProfile({
      memberId: target.memberId,
      descriptor: pending.descriptor,
      thumbnail: pending.thumbnail,
      source: target.source,
      visitId: target.visitId ?? null,
    });
    setIsSaving(false);

    if (!result.success) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar face',
        description: result.error || 'Tente novamente.',
      });
      return;
    }

    const habituality = result.data.habituality;
    if (habituality && habituality.created > 0) {
      toast({
        title: 'Face registrada',
        description: `${habituality.created} habitualidade(s) criada(s) (${habituality.calibers.join(', ')}).`,
      });
    } else {
      toast({ title: 'Face registrada' });
    }

    onCaptured?.(result.data);
    onOpenChange(false);
  };

  const handleRetake = () => setPending(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white font-military tracking-wide flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-cbt-orange" />
            Registrar Facial
          </DialogTitle>
          <DialogDescription className="text-gray-400 font-tactical text-sm">
            {target ? (
              <>
                Capturando face de <strong className="text-white">{target.memberName}</strong>.
                {target.source === 'CHECK_OUT' &&
                  ' Ao salvar, será registrada habitualidade automática para os calibres usados na visita.'}
              </>
            ) : (
              'Aguardando alvo...'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!pending ? (
            <CameraStream ref={cameraRef} />
          ) : (
            <div className="flex items-center justify-center bg-black rounded-lg p-4">
              <img
                src={pending.thumbnail}
                alt="Captura"
                className="rounded-lg max-h-80 border-2 border-cbt-orange/50"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving || isCapturing}
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
          >
            Cancelar
          </Button>
          <div className="flex gap-2">
            {!pending ? (
              <Button
                type="button"
                onClick={handleCapture}
                disabled={isCapturing}
                className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical min-w-[140px]"
              >
                {isCapturing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Capturar
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRetake}
                  disabled={isSaving}
                  className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tirar de novo
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FaceCaptureDialog;
