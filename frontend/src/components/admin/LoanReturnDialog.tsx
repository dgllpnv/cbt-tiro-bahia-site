import { useState, useEffect, type FormEvent } from 'react';
import { Loader2, Receipt } from 'lucide-react';

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
import { useToast } from '@/hooks/use-toast';
import { returnLoan, type EquipmentLoan } from '@/services/loansService';
import { equipmentConditionLabels } from '@/lib/constants';

interface LoanReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeLoan: EquipmentLoan | null;
  onReturned?: () => void;
}

const labelClasses = 'block text-sm font-tactical text-foreground/85 mb-1';

const inputClasses =
  'bg-muted border-input text-foreground placeholder:text-muted-foreground/60 focus:border-cbt-orange focus:ring-cbt-orange/20';

const selectClasses =
  'w-full rounded-md bg-muted border border-input text-foreground px-3 py-2 text-sm focus:outline-none focus:border-cbt-orange focus:ring-1 focus:ring-cbt-orange/20';

const LoanReturnDialog = ({ open, onOpenChange, activeLoan, onReturned }: LoanReturnDialogProps) => {
  const { toast } = useToast();
  const [condition, setCondition] = useState('GOOD');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && activeLoan) {
      setCondition(activeLoan.conditionAtLoan || 'GOOD');
      setNotes('');
    }
  }, [open, activeLoan]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeLoan) return;

    setIsSubmitting(true);
    const result = await returnLoan(activeLoan.id, {
      conditionAtReturn: condition,
      notes: notes.trim() || null,
    });
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: 'Equipamento devolvido',
        description: `${activeLoan.equipment.name} devolvido em condição ${equipmentConditionLabels[condition] || condition}.`,
      });
      onOpenChange(false);
      onReturned?.();
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao devolver',
        description: result.error || 'Tente novamente.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground font-military tracking-wide flex items-center gap-2">
            <Receipt className="h-5 w-5 text-red-700 dark:text-red-400" />
            Devolver Equipamento
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-tactical text-sm">
            {activeLoan && (
              <>
                Devolvendo <strong className="text-foreground">{activeLoan.equipment.name}</strong>
                {activeLoan.equipment.serialNumber && ` (Nº ${activeLoan.equipment.serialNumber})`} de{' '}
                <strong className="text-foreground">{activeLoan.member.fullName}</strong>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label htmlFor="return-condition" className={labelClasses}>
              Condição na Devolução <span className="text-red-700 dark:text-red-400">*</span>
            </label>
            <select
              id="return-condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className={selectClasses}
              required
            >
              {Object.entries(equipmentConditionLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground/80 font-tactical mt-1">
              A condição registrada atualiza o estado do equipamento.
            </p>
          </div>
          <div>
            <label htmlFor="return-notes" className={labelClasses}>Observações</label>
            <Textarea
              id="return-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações sobre a devolução (opcional)"
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
            disabled={isSubmitting}
            className="bg-red-600 hover:bg-red-700 text-foreground font-tactical"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Receipt className="h-4 w-4 mr-2" />
                Confirmar Devolução
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoanReturnDialog;
