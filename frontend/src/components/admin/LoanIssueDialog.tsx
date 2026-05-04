import { useState, useEffect, type FormEvent } from 'react';
import { Loader2, Package } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import MemberSearch from '@/components/shared/MemberSearch';
import EquipmentSearch from '@/components/shared/EquipmentSearch';
import { useToast } from '@/hooks/use-toast';
import { issueLoan, type EquipmentLoan } from '@/services/loansService';

interface LoanIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedMemberId?: string;
  preselectedMemberName?: string;
  preselectedEquipmentId?: string;
  preselectedEquipmentName?: string;
  onCreated?: (loan: EquipmentLoan) => void;
}

const labelClasses = 'block text-sm font-tactical text-foreground/85 mb-1';

const inputClasses =
  'bg-muted border-input text-foreground placeholder:text-muted-foreground/60 focus:border-cbt-orange focus:ring-cbt-orange/20';

const LoanIssueDialog = ({
  open,
  onOpenChange,
  preselectedMemberId,
  preselectedMemberName,
  preselectedEquipmentId,
  preselectedEquipmentName,
  onCreated,
}: LoanIssueDialogProps) => {
  const { toast } = useToast();
  const [memberId, setMemberId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMemberId(preselectedMemberId || '');
      setEquipmentId(preselectedEquipmentId || '');
      setNotes('');
    }
  }, [open, preselectedMemberId, preselectedEquipmentId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!memberId.trim()) {
      toast({ title: 'Selecione o membro', variant: 'destructive' });
      return;
    }
    if (!equipmentId.trim()) {
      toast({ title: 'Selecione o equipamento', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const result = await issueLoan({
      memberId,
      equipmentId,
      notes: notes.trim() || null,
    });
    setIsSubmitting(false);

    if (result.success && result.data) {
      toast({ title: 'Empréstimo registrado' });
      onOpenChange(false);
      onCreated?.(result.data);
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar empréstimo',
        description: result.error || 'Tente novamente.',
      });
    }
  };

  const memberLocked = !!preselectedMemberId;
  const equipmentLocked = !!preselectedEquipmentId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground font-military tracking-wide flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            Novo Empréstimo
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-tactical text-sm">
            Empréstimo de equipamento do clube. Uso dentro do clube — devolução no fim do dia.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {memberLocked ? (
            <div>
              <span className={labelClasses}>Membro</span>
              <div className="flex items-center gap-2 h-10 px-3 bg-muted border border-cbt-orange/50 rounded-md">
                <Package className="h-4 w-4 text-cbt-orange flex-shrink-0" />
                <span className="text-foreground font-tactical text-sm flex-1 truncate">
                  {preselectedMemberName || 'Membro pré-selecionado'}
                </span>
              </div>
            </div>
          ) : (
            <MemberSearch
              value={memberId}
              onChange={(id) => setMemberId(id)}
              includeVisitors
              placeholder="Buscar associado ou visitante..."
              label="Associado / Visitante *"
            />
          )}

          {equipmentLocked ? (
            <div>
              <span className={labelClasses}>Equipamento</span>
              <div className="flex items-center gap-2 h-10 px-3 bg-muted border border-cbt-orange/50 rounded-md">
                <Package className="h-4 w-4 text-cbt-orange flex-shrink-0" />
                <span className="text-foreground font-tactical text-sm flex-1 truncate">
                  {preselectedEquipmentName || 'Equipamento pré-selecionado'}
                </span>
              </div>
            </div>
          ) : (
            <EquipmentSearch
              value={equipmentId}
              onChange={(id) => setEquipmentId(id)}
              onlyAvailable
            />
          )}

          <div>
            <label htmlFor="loan-notes" className={labelClasses}>Observações</label>
            <Textarea
              id="loan-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações sobre o empréstimo (opcional)"
              className={inputClasses}
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !memberId || !equipmentId}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Confirmar Empréstimo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoanIssueDialog;
