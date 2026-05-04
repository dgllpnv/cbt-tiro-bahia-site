import { ScanFace, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface FaceRegisterPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  onConfirm: () => void;
  onSkip: () => void;
}

const FaceRegisterPromptDialog = ({
  open,
  onOpenChange,
  memberName,
  onConfirm,
  onSkip,
}: FaceRegisterPromptDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="bg-card border-border text-foreground max-w-md">
      <DialogHeader>
        <DialogTitle className="text-foreground font-military tracking-wide flex items-center gap-2">
          <ScanFace className="h-5 w-5 text-cbt-orange" />
          Verificar Facial?
        </DialogTitle>
        <DialogDescription className="text-muted-foreground font-tactical text-sm">
          {memberName ? (
            <>
              Deseja verificar a face de <strong className="text-foreground">{memberName}</strong> antes
              de fechar a conta? A verificação confirma a saída e gera os registros de
              habitualidade para os calibres usados nesta visita.
            </>
          ) : (
            'Deseja verificar a face antes de fechar? Confirma a saída e gera habitualidade.'
          )}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter className="gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onSkip();
            onOpenChange(false);
          }}
          className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
        >
          <X className="h-4 w-4 mr-2" />
          Não, fechar sem verificar
        </Button>
        <Button
          type="button"
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
          className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
        >
          <ScanFace className="h-4 w-4 mr-2" />
          Sim, verificar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default FaceRegisterPromptDialog;
