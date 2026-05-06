import { useEffect, useState } from 'react';
import { Loader2, Receipt, User, CalendarDays, CreditCard, Tag, FileText, UserCheck } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { getTransactionById, type Transaction } from '@/services/transactionsService';

interface TransactionDetailsDialogProps {
  transactionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_LABEL: Record<string, string> = {
  AMMUNITION_SALE: 'Venda de Municao',
  TARGET_SALE: 'Venda de Alvos',
  EQUIPMENT_RENTAL: 'Aluguel de Equipamento',
  MAGAZINE_RENTAL: 'Aluguel de Carregador',
  LANE_RENTAL: 'Aluguel de Baia',
  ANNUITY_PAYMENT: 'Pagamento de Anuidade',
  COURSE_ENROLLMENT: 'Inscricao em Curso',
  GUEST_ENTRY: 'Entrada de Visitante',
  OTHER_SALE: 'Outra Venda',
};

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30',
  DRAFT: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  CANCELLED: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
};

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Concluida',
  DRAFT: 'Em aberto',
  CANCELLED: 'Cancelada',
};

const InfoRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Receipt;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-start gap-2 text-sm">
    <Icon className="h-4 w-4 text-muted-foreground/80 mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-muted-foreground/80 font-tactical text-xs uppercase tracking-wider">{label}</p>
      <div className="text-foreground font-tactical break-words">{value}</div>
    </div>
  </div>
);

const TransactionDetailsDialog = ({
  transactionId,
  open,
  onOpenChange,
}: TransactionDetailsDialogProps) => {
  const { toast } = useToast();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !transactionId) {
      setTx(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getTransactionById(transactionId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.success && res.data) {
        setTx(res.data as Transaction);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar lancamento',
          description: res.error || 'Tente novamente.',
        });
        onOpenChange(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transactionId]);

  const subtotal = tx?.items.reduce(
    (s, it) => s + Number(it.subtotal ?? it.quantity * it.unitPrice),
    0,
  ) ?? 0;
  const discount = Number(tx?.discount ?? 0);
  const total = Number(tx?.totalAmount ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground font-military tracking-wide flex items-center gap-2">
            <Receipt className="h-5 w-5 text-cbt-orange" />
            Detalhes do lancamento
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-tactical text-sm">
            Resumo completo da conta fechada.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-cbt-orange animate-spin" />
          </div>
        ) : tx ? (
          <div className="space-y-4 py-2">
            {/* Header info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 bg-muted/40 border border-border rounded-md p-4">
              <InfoRow
                icon={User}
                label="Associado"
                value={
                  <span>
                    {tx.member.fullName}
                    {tx.member.memberNumber && (
                      <span className="text-muted-foreground/80 ml-2 text-xs">Nº {tx.member.memberNumber}</span>
                    )}
                  </span>
                }
              />
              <InfoRow
                icon={Tag}
                label="Categoria"
                value={TYPE_LABEL[tx.type] ?? tx.type}
              />
              <InfoRow
                icon={CalendarDays}
                label="Data"
                value={formatDateTime(tx.transactionDate)}
              />
              <InfoRow
                icon={CreditCard}
                label="Forma de pagamento"
                value={tx.paymentMethod ?? '—'}
              />
              <InfoRow
                icon={Receipt}
                label="Status"
                value={
                  <Badge variant="outline" className={STATUS_BADGE[tx.status] ?? ''}>
                    {STATUS_LABEL[tx.status] ?? tx.status}
                  </Badge>
                }
              />
              <InfoRow
                icon={UserCheck}
                label="Registrado por"
                value={tx.registeredBy?.fullName ?? '—'}
              />
            </div>

            {/* Items */}
            <div className="bg-muted/40 border border-border rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-muted/80 text-muted-foreground font-tactical text-xs uppercase tracking-wider">
                Itens ({tx.items.length})
              </div>
              {tx.items.length === 0 ? (
                <p className="px-4 py-6 text-center text-muted-foreground/80 font-tactical text-sm">
                  Nenhum item registrado neste lancamento.
                </p>
              ) : (
                <table className="w-full text-sm font-tactical">
                  <thead className="bg-card/40 text-muted-foreground/80 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-right px-3 py-2">Qtde</th>
                      <th className="text-right px-3 py-2">Unit.</th>
                      <th className="text-right px-3 py-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {tx.items.map((it) => {
                      const itSub = Number(it.subtotal ?? it.quantity * it.unitPrice);
                      return (
                        <tr key={it.id} className="text-foreground">
                          <td className="px-3 py-2 truncate max-w-[260px]" title={it.description}>
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
              )}
            </div>

            {/* Totals */}
            <div className="bg-muted/30 border border-border rounded-md p-3 space-y-1.5">
              <div className="flex justify-between text-sm font-tactical">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm font-tactical">
                  <span className="text-muted-foreground">Desconto</span>
                  <span className="text-red-700 dark:text-red-300">- {formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-foreground/85 font-military text-sm uppercase tracking-wider">Total</span>
                <span className="text-cbt-orange font-military text-lg">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Notes */}
            {tx.notes && (
              <div className="bg-muted/40 border border-border rounded-md p-3">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground/80 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground/80 font-tactical text-xs uppercase tracking-wider mb-1">
                      Observacoes
                    </p>
                    <p className="text-foreground/85 font-tactical text-sm whitespace-pre-line">{tx.notes}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionDetailsDialog;
