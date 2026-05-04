import { useState, useEffect, type FormEvent } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';

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
import { useToast } from '@/hooks/use-toast';
import { transferLoan, type EquipmentLoan } from '@/services/loansService';
import { equipmentConditionLabels } from '@/lib/constants';

interface LoanTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeLoan: EquipmentLoan | null;
  onTransferred?: () => void;
}

const labelClasses = 'block text-sm font-tactical text-foreground/85 mb-1';

const inputClasses =
  'bg-muted border-input text-foreground placeholder:text-muted-foreground/60 focus:border-cbt-orange focus:ring-cbt-orange/20';

const selectClasses =
  'w-full rounded-md bg-muted border border-input text-foreground px-3 py-2 text-sm focus:outline-none focus:border-cbt-orange focus:ring-1 focus:ring-cbt-orange/20';

const LoanTransferDialog = ({ open, onOpenChange, activeLoan, onTransferred }: LoanTransferDialogProps) => {
  const { toast } = useToast();
  const [newMemberId, setNewMemberId] = useState('');
  const [condition, setCondition] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && activeLoan) {
      setNewMemberId('');
      setCondition(activeLoan.conditionAtLoan || '');
      setNotes('');
    }
  }, [open, activeLoan]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeLoan) return;
    if (!newMemberId.trim()) {
      toast({ title: 'Selecione o novo membro', variant: 'destructive' });
      return;
    }
    if (newMemberId === activeLoan.memberId) {
      toast({ title: 'Selecione um membro diferente do atual', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const result = await transferLoan(activeLoan.id, {
      newMemberId,
      conditionAtTransfer: condition || undefined,
      notes: notes.trim() || null,
    });
    setIsSubmitting(false);

    if (result.success && result.data) {
      toast({
        title: 'Transferência realizada',
        description: `${activeLoan.equipment.name} transferido para ${result.data.current.member.fullName}.`,
      });
      onOpenChange(false);
      onTransferred?.();
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao transferir',
        description: result.error || 'Tente novamente.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground font-military tracking-wide flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            Transferir Empréstimo
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-tactical text-sm">
            {activeLoan && (
              <>
                <strong className="text-foreground">{activeLoan.equipment.name}</strong>
                {activeLoan.equipment.serialNumber && ` (Nº ${activeLoan.equipment.serialNumber})`} —
                atualmente com <strong className="text-foreground">{activeLoan.member.fullName}</strong>.
                Selecione o novo responsável; o empréstimo anterior será encerrado e um novo será aberto.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <MemberSearch
            value={newMemberId}
            onChange={(id) => setNewMemberId(id)}
            includeVisitors
            placeholder="Buscar associado ou visitante..."
            label="Novo Responsável *"
          />

          <div>
            <label htmlFor="transfer-condition" className={labelClasses}>
              Condição na Transferência
            </label>
            <select
              id="transfer-condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className={selectClasses}
            >
              <option value="">Manter condição atual</option>
              {Object.entries(equipmentConditionLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground/80 font-tactical mt-1">
              Permite atualizar a condição do equipamento no momento da transferência.
            </p>
          </div>

          <div>
            <label htmlFor="transfer-notes" className={labelClasses}>Observações</label>
            <Textarea
              id="transfer-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações sobre a transferência (opcional)"
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
            disabled={isSubmitting || !newMemberId}
            className="bg-blue-600 hover:bg-blue-700 text-foreground font-tactical"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Confirmar Transferência
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoanTransferDialog;
