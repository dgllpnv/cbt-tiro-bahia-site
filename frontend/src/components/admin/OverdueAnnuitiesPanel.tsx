import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle,
  Loader2,
  CalendarClock,
  Copy,
  Check,
  CreditCard,
  Receipt,
  ChevronDown,
  FileImage,
  Scroll,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
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
import { NumberStepper } from '@/components/ui/number-stepper';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  createAnnuityPayment,
  getExpiringAnnuities,
  type ExpiringAnnuity,
  type AnnuityPayment,
} from '@/services/annuitiesService';
import { getClubSettings, type ClubSettings } from '@/services/clubSettingsService';
import { exportAnnuityReceiptPdf, type ReceiptFormat } from '@/lib/reports/pdfReceipt';

interface OverdueAnnuitiesPanelProps {
  /** Disparado após registrar pagamento, para o pai refrescar KPIs/dashboard. */
  onPaymentRegistered?: () => void;
}

const PAYMENT_METHODS = ['PIX', 'Dinheiro', 'Cartao de Credito', 'Cartao de Debito', 'Transferencia'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const OverdueAnnuitiesPanel = ({ onPaymentRegistered }: OverdueAnnuitiesPanelProps) => {
  const { toast } = useToast();
  const [items, setItems] = useState<ExpiringAnnuity[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultAmount, setDefaultAmount] = useState<number>(600);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Diálogo de pagamento inline
  const [paying, setPaying] = useState<ExpiringAnnuity | null>(null);
  const [amount, setAmount] = useState<number>(600);
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [submitting, setSubmitting] = useState(false);
  // Pagamento recém-registrado (habilita o recibo) + dados do clube p/ o PDF.
  const [paid, setPaid] = useState<AnnuityPayment | null>(null);
  const [club, setClub] = useState<ClubSettings | null>(null);
  const [generatingReceipt, setGeneratingReceipt] = useState(false);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [listRes, settingsRes] = await Promise.all([
      getExpiringAnnuities({ days: 30, includeOverdue: true }),
      getClubSettings(),
    ]);
    if (listRes.success) setItems(listRes.data);
    if (settingsRes.success) {
      setClub(settingsRes.data);
      const a = Number((settingsRes.data as any).annuityAmount ?? 600);
      if (a > 0) setDefaultAmount(a);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleOpenPayment = (item: ExpiringAnnuity) => {
    setPaying(item);
    setPaid(null);
    setAmount(defaultAmount);
    setPaymentMethod('PIX');
  };

  const handleConfirmPayment = async () => {
    if (!paying) return;
    if (amount <= 0) {
      toast({ variant: 'destructive', title: 'Valor inválido' });
      return;
    }
    setSubmitting(true);
    const res = await createAnnuityPayment({
      memberId: paying.id,
      amount,
      paymentMethod,
      referenceYear: new Date().getFullYear(),
    });
    setSubmitting(false);
    if (res.success) {
      toast({
        title: 'Anuidade registrada',
        description: `${paying.fullName} · ${formatCurrency(amount)} · ${paymentMethod}`,
      });
      // Mantém o diálogo aberto no estado de sucesso para oferecer o recibo.
      setPaid(res.data ?? null);
      // Otimista: remove do painel + refetch silencioso
      setItems((prev) => prev.filter((p) => p.id !== paying.id));
      fetch(true);
      onPaymentRegistered?.();
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar pagamento',
        description: res.error,
      });
    }
  };

  const handleGenerateAnnuityReceipt = async (format: ReceiptFormat) => {
    if (!paid) return;
    setGeneratingReceipt(true);
    try {
      await exportAnnuityReceiptPdf(paid, club, null, format);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao gerar recibo' });
    } finally {
      setGeneratingReceipt(false);
    }
  };

  const closePaymentDialog = () => {
    setPaying(null);
    setPaid(null);
  };

  const handleCopyMessage = async (item: ExpiringAnnuity) => {
    const isOverdue = (item.daysRemaining ?? 0) < 0;
    const due = item.annuityValidUntil ? formatDate(item.annuityValidUntil) : '—';
    const msg = isOverdue
      ? `Olá ${item.fullName}, sua anuidade do Clube Baiano de Tiro venceu em ${due}. Para regularizar, fale com a administração.`
      : `Olá ${item.fullName}, sua anuidade do Clube Baiano de Tiro vence em ${due}. Aguardamos sua renovação.`;
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
      toast({ title: 'Mensagem copiada para a área de transferência' });
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível copiar' });
    }
  };

  const overdueCount = items.filter((i) => (i.daysRemaining ?? 0) < 0).length;
  const expiringCount = items.length - overdueCount;
  const accentColor = overdueCount > 0 ? 'border-red-500/30' : 'border-yellow-500/20';
  const accentText = overdueCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400';

  return (
    <div className={`bg-card/50 border ${accentColor} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className={`h-4 w-4 ${accentText} flex-shrink-0`} />
          <h3 className="text-sm font-military font-bold text-foreground tracking-wide truncate">
            Anuidades pendentes
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {overdueCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300 font-tactical text-[10px] uppercase tracking-wider">
              {overdueCount} vencida{overdueCount === 1 ? '' : 's'}
            </span>
          )}
          {expiringCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-700 dark:text-yellow-300 font-tactical text-[10px] uppercase tracking-wider">
              {expiringCount} vencendo
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 text-cbt-orange animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center">
          <CalendarClock className="h-8 w-8 text-muted-foreground/60 mx-auto mb-1.5" />
          <p className="text-sm font-tactical text-muted-foreground">Tudo em dia</p>
          <p className="text-xs font-tactical text-muted-foreground/80 mt-0.5">
            Nenhum associado com anuidade vencida ou vencendo nos próximos 30 dias.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
          {items.map((item) => {
            const days = item.daysRemaining ?? 0;
            const overdue = days < 0;
            const due = item.annuityValidUntil ? formatDate(item.annuityValidUntil) : '—';
            return (
              <div key={item.id} className="flex items-center gap-3 py-2.5">
                <div className="h-8 w-8 rounded-full bg-cbt-orange/15 text-cbt-orange flex items-center justify-center font-tactical text-[10px] font-bold flex-shrink-0">
                  {getInitials(item.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-tactical text-foreground truncate">{item.fullName}</p>
                  <p className="text-[10px] font-tactical text-muted-foreground/80">
                    Nº {item.memberNumber ?? '—'} ·{' '}
                    <span className={overdue ? 'text-red-700 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400'}>
                      {overdue
                        ? `Vencida há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`
                        : days === 0
                        ? 'Vence hoje'
                        : `Vence em ${days} dia${days === 1 ? '' : 's'}`}
                    </span>{' '}
                    <span className="text-muted-foreground/60">· {due}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyMessage(item)}
                    title="Copiar mensagem de cobrança"
                    className="h-7 px-2 bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical text-xs"
                  >
                    {copiedId === item.id ? (
                      <Check className="h-3 w-3 text-green-700 dark:text-green-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleOpenPayment(item)}
                    className="h-7 px-2 bg-cbt-orange/15 border border-cbt-orange/40 text-cbt-orange hover:bg-cbt-orange/25 font-tactical text-xs"
                  >
                    <CreditCard className="h-3 w-3 mr-1" />
                    Registrar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Diálogo de registro de pagamento (inline) */}
      <Dialog open={!!paying} onOpenChange={(o) => !submitting && !o && closePaymentDialog()}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground font-military tracking-wide flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-cbt-orange" />
              Registrar anuidade
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-tactical text-sm">
              {paying?.fullName} · Nº {paying?.memberNumber ?? '—'}
            </DialogDescription>
          </DialogHeader>

          {!paid ? (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-foreground/85 font-tactical text-xs uppercase tracking-wider">
                    Valor
                  </Label>
                  <NumberStepper
                    value={amount}
                    onChange={(v) => setAmount(Math.max(0, v))}
                    min={0}
                    step={50}
                    decimals={2}
                    prefix="R$"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/85 font-tactical text-xs uppercase tracking-wider">
                    Forma de pagamento
                  </Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="bg-muted border-border text-foreground">
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
                <p className="text-[10px] font-tactical text-muted-foreground/80 leading-relaxed">
                  A anuidade será válida por 12 meses a partir da data atual e o lançamento aparecerá em{' '}
                  /admin/lancamentos e no fechamento financeiro.
                </p>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={closePaymentDialog}
                  disabled={submitting}
                  className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmPayment}
                  disabled={submitting || amount <= 0}
                  className="bg-green-600 hover:bg-green-700 text-foreground font-tactical font-bold"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Confirmar pagamento
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="py-4 flex flex-col items-center text-center gap-2">
                <div className="h-12 w-12 rounded-full bg-green-500/15 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-foreground font-tactical font-semibold">Pagamento registrado</p>
                <p className="text-sm text-muted-foreground font-tactical">
                  {paying?.fullName} · {formatCurrency(Number(paid.amount))} · {paid.paymentMethod ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground/80 font-tactical">
                  Gere o recibo para entregar ao associado, se desejar.
                </p>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={closePaymentDialog}
                  className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
                >
                  Concluir
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      disabled={generatingReceipt}
                      className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical font-bold"
                    >
                      {generatingReceipt ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Receipt className="h-4 w-4 mr-1" />
                      )}
                      Gerar recibo
                      <ChevronDown className="h-4 w-4 ml-2 opacity-80" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="font-tactical">
                    <DropdownMenuLabel>Formato do recibo</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleGenerateAnnuityReceipt('a4')}>
                      <FileImage className="h-4 w-4 mr-2" />
                      Folha A4
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleGenerateAnnuityReceipt('thermal')}>
                      <Scroll className="h-4 w-4 mr-2" />
                      Bobina 80mm (térmica)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OverdueAnnuitiesPanel;
