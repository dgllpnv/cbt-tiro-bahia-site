import { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  CreditCard,
  DollarSign,
  Info,
  Receipt,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { formatDate, formatCurrency } from '@/lib/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnnuityPayment {
  id: string;
  paymentDate: string;
  amount: number;
  referenceYear: number;
  validFrom: string;
  validUntil: string;
  paymentMethod?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const AnnuityPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [payments, setPayments] = useState<AnnuityPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Annuity helpers ────────────────────────────────────────────────────────
  const getDaysRemaining = useCallback(() => {
    if (!user?.annuityValidUntil) return -1;
    const now = new Date();
    const valid = new Date(user.annuityValidUntil);
    return Math.ceil((valid.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, [user]);

  const getAnnuityStatus = () => {
    const days = getDaysRemaining();
    if (days < 0) {
      return {
        label: 'VENCIDA',
        badgeClass: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
        borderClass: 'border-red-500/40',
        bgClass: 'bg-red-500/5',
        textClass: 'text-red-700 dark:text-red-400',
      };
    }
    if (days <= 30) {
      return {
        label: 'VENCENDO',
        badgeClass: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
        borderClass: 'border-yellow-500/40',
        bgClass: 'bg-yellow-500/5',
        textClass: 'text-yellow-700 dark:text-yellow-400',
      };
    }
    return {
      label: 'ATIVA',
      badgeClass: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
      borderClass: 'border-green-500/40',
      bgClass: 'bg-green-500/5',
      textClass: 'text-green-700 dark:text-green-400',
    };
  };

  // ── Fetch payments ─────────────────────────────────────────────────────────
  const fetchPayments = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/api/annuities/member/${user.id}`);
      const data = res.data;
      setPayments(Array.isArray(data) ? data : data.data || []);
    } catch {
      setPayments([]);
      toast({
        title: 'Erro ao carregar historico',
        description: 'Nao foi possivel carregar o historico de pagamentos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const annuity = getAnnuityStatus();
  const daysRemaining = getDaysRemaining();

  return (
    <div>
      <PageHeader title="Anuidade" description="Status da sua anuidade e historico de pagamentos" />

      {/* ── Big status card ──────────────────────────────────────────────── */}
      <div className={`border rounded-lg p-6 mb-6 ${annuity.borderClass} ${annuity.bgClass}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-full flex items-center justify-center border ${annuity.borderClass} bg-card/50`}>
              <CalendarCheck className={`h-7 w-7 ${annuity.textClass}`} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-military font-bold text-foreground tracking-wide">
                  Status da Anuidade
                </h2>
                <Badge variant="outline" className={`text-xs font-tactical font-bold ${annuity.badgeClass}`}>
                  {annuity.label}
                </Badge>
              </div>
              <p className="text-muted-foreground font-tactical text-sm">
                {user?.annuityValidUntil ? (
                  <>
                    Valida ate{' '}
                    <span className="text-foreground font-semibold">
                      {formatDate(user.annuityValidUntil)}
                    </span>
                  </>
                ) : (
                  'Nenhuma anuidade registrada'
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            {daysRemaining >= 0 ? (
              <>
                <p className={`text-3xl font-military font-bold ${annuity.textClass}`}>
                  {daysRemaining}
                </p>
                <p className="text-xs font-tactical text-muted-foreground">dias restantes</p>
              </>
            ) : user?.annuityValidUntil ? (
              <>
                <p className="text-3xl font-military font-bold text-red-700 dark:text-red-400">
                  {Math.abs(daysRemaining)}
                </p>
                <p className="text-xs font-tactical text-muted-foreground">dias vencida</p>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Payment history ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="h-5 w-5 text-cbt-orange" />
          <h3 className="text-lg font-military font-bold text-foreground tracking-wide">
            Historico de Pagamentos
          </h3>
        </div>

        <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <LoadingSpinner message="Carregando historico..." />
          ) : payments.length === 0 ? (
            <EmptyState
              icon={<DollarSign className="w-8 h-8 text-muted-foreground/80" />}
              title="Nenhum pagamento registrado"
              description="Nenhum historico de pagamento de anuidade foi encontrado."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-tactical text-xs uppercase">Data Pagamento</TableHead>
                  <TableHead className="text-muted-foreground font-tactical text-xs uppercase">Valor</TableHead>
                  <TableHead className="text-muted-foreground font-tactical text-xs uppercase">Ano Ref.</TableHead>
                  <TableHead className="text-muted-foreground font-tactical text-xs uppercase">Vigencia</TableHead>
                  <TableHead className="text-muted-foreground font-tactical text-xs uppercase">Metodo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id} className="border-border hover:bg-muted/30">
                    <TableCell className="text-foreground font-tactical text-sm">
                      {formatDate(payment.paymentDate)}
                    </TableCell>
                    <TableCell className="text-green-700 dark:text-green-400 font-tactical text-sm font-semibold">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="text-foreground font-tactical text-sm">
                      {payment.referenceYear}
                    </TableCell>
                    <TableCell className="text-foreground/85 font-tactical text-sm">
                      {formatDate(payment.validFrom)} — {formatDate(payment.validUntil)}
                    </TableCell>
                    <TableCell>
                      {payment.paymentMethod ? (
                        <Badge variant="outline" className="bg-muted/50 text-foreground/85 border-border text-[10px] font-tactical">
                          <CreditCard className="h-3 w-3 mr-1" />
                          {payment.paymentMethod}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/80 text-sm">---</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* ── Info card ────────────────────────────────────────────────────── */}
      <div className="bg-card/50 border border-border rounded-lg p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-cbt-orange/10 flex items-center justify-center flex-shrink-0">
            <Info className="h-4 w-4 text-cbt-orange" />
          </div>
          <div>
            <h4 className="text-sm font-military font-bold text-foreground tracking-wide mb-1">
              Como renovar sua anuidade
            </h4>
            <p className="text-sm font-tactical text-muted-foreground leading-relaxed">
              Para renovar sua anuidade, entre em contato com a administracao do clube presencialmente
              ou atraves dos canais oficiais de atendimento. O pagamento pode ser realizado via
              transferencia bancaria, PIX ou diretamente na secretaria.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnuityPage;
