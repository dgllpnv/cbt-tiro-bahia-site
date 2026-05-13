import { useEffect, useState, useCallback } from 'react';
import {
  Wallet,
  DollarSign,
  TrendingDown,
  Receipt,
  CreditCard,
  Printer,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import KpiCard from '@/components/admin/KpiCard';

import { Button } from '@/components/ui/button';
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
import { getDailyClosing, type DailyClosing } from '@/services/cashierService';
import { getClubSettings } from '@/services/clubSettingsService';
import { exportDailyClosingPdf } from '@/lib/reports/pdfDailyClosing';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { transactionTypeLabels, expenseCategoryLabels } from '@/lib/constants';

const CashierDailyPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  const [closing, setClosing] = useState<DailyClosing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printing, setPrinting] = useState(false);

  const fetchClosing = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const result = await getDailyClosing();
    if (result.success) {
      setClosing(result.data);
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar fechamento',
        description: result.error,
      });
    }
    setLoading(false);
    setRefreshing(false);
  }, [toast]);

  useEffect(() => {
    fetchClosing();
  }, [fetchClosing]);

  const handlePrint = async () => {
    if (!closing || printing) return;
    setPrinting(true);
    try {
      const clubRes = await getClubSettings();
      await exportDailyClosingPdf({
        closing,
        club: clubRes.success ? clubRes.data : null,
        generatedByName: user?.fullName ?? null,
      });
      toast({ title: 'PDF gerado com sucesso' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar PDF',
        description: err?.message || 'Falha ao montar o documento.',
      });
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Carregando fechamento do dia..." />;
  }

  if (!closing) {
    return (
      <EmptyState
        icon={<Wallet className="w-8 h-8 text-muted-foreground/80" />}
        title="Não foi possível carregar o caixa"
        description="Tente novamente em alguns instantes."
        action={
          <Button onClick={() => fetchClosing()} className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const { totals, paymentBreakdown, typeBreakdown, transactions, expenses } = closing;

  return (
    <div>
      <PageHeader
        title="Caixa do dia"
        description={
          <span className="font-tactical text-sm">
            Fechamento operacional · {formatDate(closing.date)}
          </span>
        }
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => fetchClosing(true)}
              disabled={refreshing}
              className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
            >
              {refreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Atualizar
            </Button>
            <Button
              onClick={handlePrint}
              disabled={printing}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
            >
              {printing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
              Imprimir fechamento
            </Button>
          </div>
        }
      />

      {/* ── KPIs do dia ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          icon={DollarSign}
          label="Receita do dia"
          value={formatCurrency(totals.revenue)}
          color="#22c55e"
          bgColor="bg-green-500/10"
          borderColor="border-green-500/30"
          hint={`${totals.transactionCount} transação(ões)`}
        />
        <KpiCard
          icon={TrendingDown}
          label="Despesas do dia"
          value={formatCurrency(totals.expenses)}
          color="#ef4444"
          bgColor="bg-red-500/10"
          borderColor="border-red-500/30"
          hint={`${totals.expenseCount} despesa(s)`}
        />
        <KpiCard
          icon={Wallet}
          label="Saldo do dia"
          value={formatCurrency(totals.balance)}
          color={totals.balance >= 0 ? '#FF8C00' : '#ef4444'}
          bgColor={totals.balance >= 0 ? 'bg-cbt-orange/10' : 'bg-red-500/10'}
          borderColor={totals.balance >= 0 ? 'border-cbt-orange/30' : 'border-red-500/30'}
          hint={totals.balance >= 0 ? 'Positivo' : 'Negativo'}
        />
        <KpiCard
          icon={Receipt}
          label="Transações"
          value={String(totals.transactionCount)}
          color="#3b82f6"
          bgColor="bg-blue-500/10"
          borderColor="border-blue-500/30"
          hint={`${expenses.length} despesa(s) lançada(s)`}
        />
      </div>

      {/* ── Breakdown lado a lado ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Por forma de pagamento */}
        <div className="bg-card/50 border border-border rounded-lg p-5">
          <h3 className="text-sm font-military font-bold text-foreground tracking-wide mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-cbt-orange" />
            Por forma de pagamento
          </h3>
          {paymentBreakdown.length === 0 ? (
            <p className="text-muted-foreground/80 font-tactical text-sm py-3 text-center">
              Sem movimentação.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {paymentBreakdown.map((p) => (
                <li
                  key={p.method}
                  className="flex items-center justify-between py-2.5 text-sm font-tactical"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className="bg-muted text-foreground/85 border-input font-tactical text-xs">
                      {p.method}
                    </Badge>
                    <span className="text-muted-foreground text-xs">{p.count} {p.count === 1 ? 'transação' : 'transações'}</span>
                  </div>
                  <span className="text-cbt-orange font-semibold">{formatCurrency(p.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Por tipo de transação */}
        <div className="bg-card/50 border border-border rounded-lg p-5">
          <h3 className="text-sm font-military font-bold text-foreground tracking-wide mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-cbt-orange" />
            Por tipo de transação
          </h3>
          {typeBreakdown.length === 0 ? (
            <p className="text-muted-foreground/80 font-tactical text-sm py-3 text-center">
              Sem movimentação.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {typeBreakdown.map((t) => (
                <li
                  key={t.type}
                  className="flex items-center justify-between py-2.5 text-sm font-tactical"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-foreground truncate">{transactionTypeLabels[t.type] ?? t.type}</span>
                    <span className="text-muted-foreground text-xs">{t.count}</span>
                  </div>
                  <span className="text-cbt-orange font-semibold">{formatCurrency(t.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Tabela de transações do dia ────────────────────────────────── */}
      <div className="bg-card/50 border border-border rounded-lg overflow-hidden mb-6">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-lg font-military font-bold text-foreground tracking-wide">
            Transações de hoje
          </h2>
          <span className="text-xs font-tactical text-muted-foreground">
            {transactions.length} {transactions.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>
        {transactions.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-8 h-8 text-muted-foreground/80" />}
            title="Nenhuma transação registrada hoje"
            description="As vendas e lançamentos do dia aparecerão aqui."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-tactical">Hora</TableHead>
                <TableHead className="text-muted-foreground font-tactical">Tipo</TableHead>
                <TableHead className="text-muted-foreground font-tactical">Associado</TableHead>
                <TableHead className="text-muted-foreground font-tactical">Operador</TableHead>
                <TableHead className="text-muted-foreground font-tactical">Pagamento</TableHead>
                <TableHead className="text-muted-foreground font-tactical text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => {
                const time = new Date(t.transactionDate).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <TableRow key={t.id} className="border-border hover:bg-muted/50">
                    <TableCell className="text-foreground/85 font-tactical text-sm">{time}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted text-foreground/85 border-input font-tactical text-xs">
                        {transactionTypeLabels[t.type] ?? t.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground/85 text-sm">{t.member?.fullName ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground/80 text-sm">{t.registeredBy?.fullName ?? '—'}</TableCell>
                    <TableCell className="text-foreground/85 text-sm">{t.paymentMethod ?? '—'}</TableCell>
                    <TableCell className="text-right text-cbt-orange font-medium">
                      {formatCurrency(t.totalAmount)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ── Despesas do dia (admin-only normalmente, mas listado pra fechamento) ── */}
      {expenses.length > 0 && (
        <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-lg font-military font-bold text-foreground tracking-wide">
              Despesas de hoje
            </h2>
            <span className="text-xs font-tactical text-muted-foreground">
              {expenses.length} {expenses.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-tactical">Hora</TableHead>
                <TableHead className="text-muted-foreground font-tactical">Categoria</TableHead>
                <TableHead className="text-muted-foreground font-tactical">Descrição</TableHead>
                <TableHead className="text-muted-foreground font-tactical">Fornecedor</TableHead>
                <TableHead className="text-muted-foreground font-tactical text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => {
                const time = new Date(e.expenseDate).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <TableRow key={e.id} className="border-border hover:bg-muted/50">
                    <TableCell className="text-foreground/85 font-tactical text-sm">{time}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted text-foreground/85 border-input font-tactical text-xs">
                        {expenseCategoryLabels[e.category] ?? e.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground/85 text-sm">{e.description}</TableCell>
                    <TableCell className="text-foreground/85 text-sm">{e.vendor ?? '—'}</TableCell>
                    <TableCell className="text-right text-red-500 font-medium">
                      {formatCurrency(e.amount)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default CashierDailyPage;
