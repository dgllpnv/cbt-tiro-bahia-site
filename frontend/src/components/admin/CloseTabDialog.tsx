import { useState, useMemo, useEffect } from 'react';
import { Loader2, Receipt } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { finalizeTransaction, type Transaction } from '@/services/transactionsService';

interface CloseTabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: Transaction | null;
  /** Chamado apos finalize bem-sucedido. Espera-se que o pai libere a baia / refresque. */
  onFinalized: (finalized: Transaction) => void | Promise<void>;
  /**
   * Se fornecido + draft tem visitId, ao inves de chamar onFinalized direto,
   * delega ao pai para mostrar prompt "Registrar Facial?". O pai fica responsavel
   * por liberar a baia depois (via captura ou pulando).
   */
  onRequestFaceRegister?: (params: {
    memberId: string;
    memberName: string;
    visitId: string;
    finalized: Transaction;
  }) => void;
}

const PAYMENT_METHODS = ['PIX', 'Dinheiro', 'Cartao de Credito', 'Cartao de Debito', 'Transferencia'];

const TRANSACTION_TYPES: Record<string, string> = {
  AMMUNITION_SALE: 'Venda de Municao',
  TARGET_SALE: 'Venda de Alvo',
  EQUIPMENT_RENTAL: 'Aluguel de Equipamento',
  MAGAZINE_RENTAL: 'Aluguel de Carregador',
  LANE_RENTAL: 'Aluguel de Baia',
  COURSE_ENROLLMENT: 'Inscricao em Curso',
  GUEST_ENTRY: 'Entrada de Convidado',
  OTHER_SALE: 'Outra Venda',
};

const CloseTabDialog = ({
  open,
  onOpenChange,
  draft,
  onFinalized,
  onRequestFaceRegister,
}: CloseTabDialogProps) => {
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [type, setType] = useState('OTHER_SALE');
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Reseta estado ao abrir
  useEffect(() => {
    if (open) {
      setPaymentMethod('PIX');
      setType('OTHER_SALE');
      setDiscount(0);
    }
  }, [open]);

  const subtotal = useMemo(() => {
    if (!draft) return 0;
    return draft.items.reduce(
      (sum, it) => sum + Number(it.subtotal ?? it.quantity * it.unitPrice),
      0,
    );
  }, [draft]);

  const total = Math.max(0, subtotal - discount);

  const handleConfirm = async () => {
    if (!draft) return;
    if (!paymentMethod.trim()) {
      toast({ variant: 'destructive', title: 'Selecione a forma de pagamento' });
      return;
    }
    if (discount > subtotal) {
      toast({
        variant: 'destructive',
        title: 'Desconto invalido',
        description: 'O desconto nao pode exceder o subtotal.',
      });
      return;
    }

    setSubmitting(true);
    const res = await finalizeTransaction(draft.id, {
      paymentMethod,
      discount,
      type,
    });
    setSubmitting(false);

    if (res.success) {
      toast({
        title: 'Conta fechada',
        description: `Total: ${formatCurrency(total)} via ${paymentMethod}`,
      });

      // Se ha callback de face register e a transacao tem visitId+memberId,
      // delega ao pai (que mostrara o prompt e cuidara de liberar a baia).
      if (onRequestFaceRegister && draft.visitId && draft.memberId) {
        onRequestFaceRegister({
          memberId: draft.memberId,
          memberName: draft.member.fullName,
          visitId: draft.visitId,
          finalized: res.data,
        });
        onOpenChange(false);
      } else {
        await onFinalized(res.data);
        onOpenChange(false);
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao fechar conta',
        description: res.error,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="bg-card border-border text-foreground max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-foreground font-military tracking-wide flex items-center gap-2">
            <Receipt className="h-5 w-5 text-red-700 dark:text-red-400" />
            Fechar conta — {draft?.member.fullName ?? ''}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-tactical text-sm">
            Confirme o resumo, aplique desconto se necessario e selecione a forma de pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resumo dos itens */}
          <div className="bg-muted/40 border border-border rounded-md max-h-56 overflow-y-auto">
            {draft?.items.length ? (
              <table className="w-full text-sm font-tactical">
                <thead className="bg-muted/80 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2">Item</th>
                    <th className="text-right px-3 py-2">Qtde</th>
                    <th className="text-right px-3 py-2">Unit.</th>
                    <th className="text-right px-3 py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {draft.items.map((it) => {
                    const itSub = Number(it.subtotal ?? it.quantity * it.unitPrice);
                    return (
                      <tr key={it.id} className="text-foreground">
                        <td className="px-3 py-2 truncate max-w-[200px]" title={it.description}>
                          {it.description}
                        </td>
                        <td className="text-right px-3 py-2">{it.quantity}</td>
                        <td className="text-right px-3 py-2 text-muted-foreground">
                          {formatCurrency(Number(it.unitPrice))}
                        </td>
                        <td className="text-right px-3 py-2">{formatCurrency(itSub)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-6 text-center text-muted-foreground/80 font-tactical text-sm">
                Comanda vazia.
              </p>
            )}
          </div>

          {/* Categoria + Pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-foreground/85 font-tactical text-xs uppercase tracking-wider">
                Categoria
              </Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-muted border-border text-foreground h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border">
                  {Object.entries(TRANSACTION_TYPES).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/85 font-tactical text-xs uppercase tracking-wider">
                Forma de pagamento *
              </Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="bg-muted border-border text-foreground h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border">
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Totais */}
          <div className="bg-muted/30 border border-border rounded-md p-3 space-y-2">
            <div className="flex justify-between text-sm font-tactical">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-muted-foreground font-tactical text-sm m-0">Desconto</Label>
              <div className="w-44">
                <NumberStepper
                  value={discount}
                  onChange={setDiscount}
                  min={0}
                  max={subtotal}
                  step={1}
                  decimals={2}
                  prefix="R$"
                  size="sm"
                />
              </div>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-foreground/85 font-military text-sm uppercase tracking-wider">Total</span>
              <span className="text-cbt-orange font-military text-lg">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !draft?.items.length}
            className="bg-green-600 hover:bg-green-700 text-foreground font-tactical font-bold"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Receipt className="h-4 w-4 mr-1" />
                Confirmar pagamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CloseTabDialog;
