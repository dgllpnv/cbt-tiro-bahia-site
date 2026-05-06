import { useCallback, useEffect, useMemo, useState } from 'react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Loader2,
  Wallet,
  PieChart,
  Receipt,
  AlertTriangle,
  Download,
  CreditCard,
} from 'lucide-react';

import api from '@/services/api';
import { transactionTypeLabels, expenseCategoryLabels } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useToast } from '@/hooks/use-toast';

import {
  getFinancialDashboard,
  type FinancialDashboard,
} from '@/services/financialService';
import {
  getExpiringAnnuities,
  type ExpiringAnnuity,
} from '@/services/annuitiesService';
import { getClubSettings, type ClubSettings } from '@/services/clubSettingsService';
import { generateFinancialReportPdf } from '@/lib/pdfFinancialReport';

import PeriodPicker, {
  buildPresets,
  type PeriodRange,
} from '@/components/admin/PeriodPicker';
import KpiCard from '@/components/admin/KpiCard';
import RevenueExpenseChart from '@/components/admin/RevenueExpenseChart';
import CategoryBreakdownPanel from '@/components/admin/CategoryBreakdownPanel';
import OverdueAnnuitiesPanel from '@/components/admin/OverdueAnnuitiesPanel';

const PAGE_SIZE = 15;

const PAYMENT_OPTIONS = [
  { value: 'all', label: 'Todas as formas' },
  { value: 'PIX', label: 'PIX' },
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'Cartao de Credito', label: 'Cartão de Crédito' },
  { value: 'Cartao de Debito', label: 'Cartão de Débito' },
  { value: 'Transferencia', label: 'Transferência' },
];

const FinancialPage = () => {
  const { toast } = useToast();

  // ── Período ────────────────────────────────────────────────────────────
  const [range, setRange] = useState<PeriodRange>(() => buildPresets()['this-month']);

  // ── Dashboard agregado ────────────────────────────────────────────────
  const [dashboard, setDashboard] = useState<FinancialDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // ── Tabela de transações ──────────────────────────────────────────────
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [txPaymentFilter, setTxPaymentFilter] = useState<string>('all');
  const [txLoading, setTxLoading] = useState(true);

  // ── Tabela de despesas ────────────────────────────────────────────────
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expTotalPages, setExpTotalPages] = useState(1);
  const [expPage, setExpPage] = useState(1);
  const [expLoading, setExpLoading] = useState(true);

  // ── Diálogo Nova Despesa (preservado) ─────────────────────────────────
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'INVENTORY_PURCHASE',
    description: '',
    amount: '',
    vendor: '',
    expenseDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // ── Export PDF ────────────────────────────────────────────────────────
  const [exportingPdf, setExportingPdf] = useState(false);

  // ── Fetchers ──────────────────────────────────────────────────────────
  const fetchDashboard = useCallback(
    async (silent = false) => {
      if (!silent) setDashboardLoading(true);
      const res = await getFinancialDashboard({
        startDate: range.startDate,
        endDate: range.endDate,
      });
      if (res.success) {
        setDashboard(res.data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar painel financeiro',
          description: res.error,
        });
      }
      if (!silent) setDashboardLoading(false);
    },
    [range.startDate, range.endDate, toast],
  );

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const params: any = {
        startDate: range.startDate,
        endDate: range.endDate,
        page: txPage,
        limit: PAGE_SIZE,
      };
      const res = await api.get('/api/transactions', { params });
      if (res.data.success) {
        const all = (res.data.data || []) as any[];
        const filtered =
          txPaymentFilter === 'all'
            ? all
            : all.filter((t) => t.paymentMethod === txPaymentFilter);
        setTransactions(filtered);
        setTxTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar vendas',
        description: e?.response?.data?.error || 'Tente novamente.',
      });
    }
    setTxLoading(false);
  }, [range.startDate, range.endDate, txPage, txPaymentFilter, toast]);

  const fetchExpenses = useCallback(async () => {
    setExpLoading(true);
    try {
      const res = await api.get('/api/financial/expenses', {
        params: {
          startDate: range.startDate,
          endDate: range.endDate,
          page: expPage,
          limit: PAGE_SIZE,
        },
      });
      if (res.data.success) {
        setExpenses(res.data.data || []);
        setExpTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar despesas',
        description: e?.response?.data?.error || 'Tente novamente.',
      });
    }
    setExpLoading(false);
  }, [range.startDate, range.endDate, expPage, toast]);

  useEffect(() => {
    setTxPage(1);
    setExpPage(1);
  }, [range.startDate, range.endDate]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // ── Submit Nova Despesa ───────────────────────────────────────────────
  const handleCreateExpense = async () => {
    if (!expenseForm.description.trim()) {
      toast({ variant: 'destructive', title: 'Descrição é obrigatória' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/financial/expenses', {
        ...expenseForm,
        amount: parseFloat(expenseForm.amount) || 0,
      });
      toast({ title: 'Despesa registrada' });
      setExpenseDialog(false);
      setExpenseForm({
        category: 'INVENTORY_PURCHASE',
        description: '',
        amount: '',
        vendor: '',
        expenseDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
      // Refetch agregados + tabela
      fetchDashboard(true);
      fetchExpenses();
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar despesa',
        description: e?.response?.data?.error,
      });
    }
    setSaving(false);
  };

  // ── Export PDF ────────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    if (!dashboard) return;
    setExportingPdf(true);
    try {
      const [clubRes, annRes] = await Promise.all([
        getClubSettings(),
        getExpiringAnnuities({ days: 30, includeOverdue: true }),
      ]);
      const club: ClubSettings | null = clubRes.success ? clubRes.data : null;
      const overdueAnnuities: ExpiringAnnuity[] = annRes.success ? annRes.data : [];

      const pdf = await generateFinancialReportPdf({
        dashboard,
        club,
        overdueAnnuities,
      });
      const fileName = `fechamento-financeiro-${range.startDate}-${range.endDate}.pdf`;
      pdf.save(fileName);
      toast({ title: 'PDF gerado', description: `Salvo como ${fileName}` });
    } catch (err) {
      console.error('Erro ao gerar PDF financeiro:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar PDF',
        description: 'Tente novamente em instantes.',
      });
    } finally {
      setExportingPdf(false);
    }
  };

  // ── Adornos derivados ────────────────────────────────────────────────
  const revenueByTypeEntries = useMemo(
    () =>
      (dashboard?.revenueByType ?? []).map((r) => ({
        ...r,
        label: transactionTypeLabels[r.key] ?? r.key,
      })),
    [dashboard],
  );
  const expensesByCategoryEntries = useMemo(
    () =>
      (dashboard?.expensesByCategory ?? []).map((r) => ({
        ...r,
        label: expenseCategoryLabels[r.key] ?? r.key,
      })),
    [dashboard],
  );
  const paymentMethodEntries = useMemo(
    () =>
      (dashboard?.paymentMethods ?? []).map((r) => ({
        key: r.method,
        label: r.method,
        total: r.total,
        count: r.count,
        share: r.share,
      })),
    [dashboard],
  );

  const overdueHint = dashboard
    ? `${dashboard.kpis.overdueCount.value} vencidas · ${dashboard.kpis.expiringCount.value} a vencer`
    : undefined;

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Indicadores, fluxo de caixa, inadimplência e fechamento por período."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <PeriodPicker value={range} onChange={setRange} />
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={exportingPdf || !dashboard}
              className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical h-9"
            >
              {exportingPdf ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exportar PDF
            </Button>
            <Button
              onClick={() => setExpenseDialog(true)}
              className="bg-cbt-orange text-primary-foreground font-tactical hover:bg-cbt-orange/90 h-9"
            >
              <Plus size={16} className="mr-2" />
              Nova Despesa
            </Button>
          </div>
        }
      />

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      {dashboardLoading ? (
        <LoadingSpinner message="Carregando indicadores..." />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <KpiCard
              icon={TrendingUp}
              label="Receita"
              value={formatCurrency(dashboard?.kpis.revenue.value ?? 0)}
              deltaPct={dashboard?.kpis.revenue.deltaPct}
              deltaTone="positive"
              color="#22c55e"
              bgColor="bg-green-500/10"
              borderColor="border-green-500/20"
            />
            <KpiCard
              icon={TrendingDown}
              label="Despesas"
              value={formatCurrency(dashboard?.kpis.expenses.value ?? 0)}
              deltaPct={dashboard?.kpis.expenses.deltaPct}
              deltaTone="inverse"
              color="#ef4444"
              bgColor="bg-red-500/10"
              borderColor="border-red-500/20"
            />
            <KpiCard
              icon={Wallet}
              label="Resultado"
              value={formatCurrency(dashboard?.kpis.result.value ?? 0)}
              deltaPct={dashboard?.kpis.result.deltaPct}
              deltaTone="positive"
              color={
                (dashboard?.kpis.result.value ?? 0) >= 0 ? '#FF8C00' : '#ef4444'
              }
              bgColor={
                (dashboard?.kpis.result.value ?? 0) >= 0
                  ? 'bg-cbt-orange/10'
                  : 'bg-red-500/10'
              }
              borderColor={
                (dashboard?.kpis.result.value ?? 0) >= 0
                  ? 'border-cbt-orange/20'
                  : 'border-red-500/20'
              }
            />
            <KpiCard
              icon={PieChart}
              label="Margem"
              value={`${(dashboard?.kpis.margin.value ?? 0).toFixed(1)}%`}
              deltaPct={dashboard?.kpis.margin.deltaPct}
              deltaTone="positive"
              deltaUnit="pp"
              color="#8b5cf6"
              bgColor="bg-violet-500/10"
              borderColor="border-violet-500/20"
            />
            <KpiCard
              icon={Receipt}
              label="Ticket médio"
              value={formatCurrency(dashboard?.kpis.avgTicket.value ?? 0)}
              deltaPct={dashboard?.kpis.avgTicket.deltaPct}
              deltaTone="positive"
              color="#3b82f6"
              bgColor="bg-blue-500/10"
              borderColor="border-blue-500/20"
              hint={`${dashboard?.kpis.txCount.value ?? 0} transações`}
            />
            <KpiCard
              icon={AlertTriangle}
              label="Inadimplência"
              value={`${dashboard?.kpis.overdueCount.value ?? 0}`}
              hint={overdueHint}
              color={
                (dashboard?.kpis.overdueCount.value ?? 0) > 0
                  ? '#eab308'
                  : '#6b7280'
              }
              bgColor={
                (dashboard?.kpis.overdueCount.value ?? 0) > 0
                  ? 'bg-yellow-500/10'
                  : 'bg-muted-foreground/15'
              }
              borderColor={
                (dashboard?.kpis.overdueCount.value ?? 0) > 0
                  ? 'border-yellow-500/30'
                  : 'border-muted-foreground/30'
              }
            />
          </div>

          {/* ── Gráfico principal ─────────────────────────────────── */}
          <div className="bg-card/50 border border-border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div>
                <h3 className="text-sm font-military font-bold text-foreground tracking-wide">
                  Evolução: receita × despesa × resultado
                </h3>
                <p className="text-xs font-tactical text-muted-foreground/80 mt-0.5">
                  {range.label} ·{' '}
                  {dashboard?.period.granularity === 'month' ? 'por mês' : 'por dia'}
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-tactical text-muted-foreground/80">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  Receita
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                  Despesa
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-cbt-orange" />
                  Resultado
                </span>
              </div>
            </div>
            <RevenueExpenseChart
              data={dashboard?.series ?? []}
              granularity={dashboard?.period.granularity ?? 'day'}
            />
          </div>

          {/* ── Painéis analíticos ────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <CategoryBreakdownPanel
              title="Receita por categoria"
              icon={TrendingUp}
              accent="#22c55e"
              accentBg="rgba(34, 197, 94, 0.18)"
              entries={revenueByTypeEntries}
              total={dashboard?.kpis.revenue.value ?? 0}
              emptyText="Sem vendas no período."
            />
            <CategoryBreakdownPanel
              title="Despesa por categoria"
              icon={TrendingDown}
              accent="#ef4444"
              accentBg="rgba(239, 68, 68, 0.18)"
              entries={expensesByCategoryEntries}
              total={dashboard?.kpis.expenses.value ?? 0}
              emptyText="Sem despesas no período."
            />
            <CategoryBreakdownPanel
              title="Por forma de pagamento"
              icon={CreditCard}
              accent="#3b82f6"
              accentBg="rgba(59, 130, 246, 0.18)"
              entries={paymentMethodEntries}
              total={dashboard?.kpis.revenue.value ?? 0}
              emptyText="Sem recebimentos no período."
            />
          </div>

          {/* ── Inadimplência ─────────────────────────────────────── */}
          <div className="mb-6">
            <OverdueAnnuitiesPanel
              onPaymentRegistered={() => {
                fetchDashboard(true);
                fetchTransactions();
              }}
            />
          </div>
        </>
      )}

      {/* ── Tabs Vendas / Despesas ───────────────────────────────── */}
      <Tabs defaultValue="transactions">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger
            value="transactions"
            className="data-[state=active]:bg-cbt-orange data-[state=active]:text-primary-foreground font-tactical"
          >
            Vendas
          </TabsTrigger>
          <TabsTrigger
            value="expenses"
            className="data-[state=active]:bg-cbt-orange data-[state=active]:text-primary-foreground font-tactical"
          >
            Despesas
          </TabsTrigger>
        </TabsList>

        {/* Vendas */}
        <TabsContent value="transactions" className="mt-4">
          <div className="flex items-center justify-end mb-3">
            <div className="w-full sm:w-64">
              <Select
                value={txPaymentFilter}
                onValueChange={(v) => {
                  setTxPaymentFilter(v);
                  setTxPage(1);
                }}
              >
                <SelectTrigger className="bg-muted border-border text-foreground font-tactical h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
            {txLoading ? (
              <div className="py-10 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-cbt-orange animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="py-8 text-center text-sm font-tactical text-muted-foreground/80">
                Nenhuma venda no período {range.label.toLowerCase()}.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-tactical">Data</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Tipo</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Membro</TableHead>
                    <TableHead className="text-muted-foreground font-tactical text-right">Desconto</TableHead>
                    <TableHead className="text-muted-foreground font-tactical text-right">Valor</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Pgto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t: any) => {
                    const discount = Number(t.discount ?? 0);
                    return (
                      <TableRow key={t.id} className="border-border">
                        <TableCell className="text-muted-foreground font-tactical text-sm">
                          {formatDate(t.transactionDate)}
                        </TableCell>
                        <TableCell className="text-foreground/85 font-tactical text-sm">
                          {transactionTypeLabels[t.type] || t.type}
                        </TableCell>
                        <TableCell className="text-foreground font-tactical text-sm">
                          {t.member?.fullName}
                        </TableCell>
                        <TableCell
                          className={`text-right font-tactical text-sm ${
                            discount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground/60'
                          }`}
                        >
                          {discount > 0 ? formatCurrency(discount) : '—'}
                        </TableCell>
                        <TableCell className="text-green-700 dark:text-green-400 font-tactical font-bold text-right">
                          {formatCurrency(Number(t.totalAmount))}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-tactical text-sm">
                          {t.paymentMethod || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {txTotalPages > 1 && (
            <div className="mt-3">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (txPage > 1) setTxPage((p) => p - 1);
                      }}
                      className={
                        txPage <= 1
                          ? 'pointer-events-none opacity-40'
                          : 'text-foreground/85 hover:text-foreground'
                      }
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#" isActive className="bg-cbt-orange/20 text-cbt-orange">
                      {txPage} / {txTotalPages}
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (txPage < txTotalPages) setTxPage((p) => p + 1);
                      }}
                      className={
                        txPage >= txTotalPages
                          ? 'pointer-events-none opacity-40'
                          : 'text-foreground/85 hover:text-foreground'
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </TabsContent>

        {/* Despesas */}
        <TabsContent value="expenses" className="mt-4">
          <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
            {expLoading ? (
              <div className="py-10 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-cbt-orange animate-spin" />
              </div>
            ) : expenses.length === 0 ? (
              <p className="py-8 text-center text-sm font-tactical text-muted-foreground/80">
                Nenhuma despesa no período.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-tactical">Data</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Categoria</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Descrição</TableHead>
                    <TableHead className="text-muted-foreground font-tactical text-right">Valor</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Fornecedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e: any) => (
                    <TableRow key={e.id} className="border-border">
                      <TableCell className="text-muted-foreground font-tactical text-sm">
                        {formatDate(e.expenseDate)}
                      </TableCell>
                      <TableCell className="text-foreground/85 font-tactical text-sm">
                        {expenseCategoryLabels[e.category] || e.category}
                      </TableCell>
                      <TableCell className="text-foreground font-tactical text-sm">
                        {e.description}
                      </TableCell>
                      <TableCell className="text-red-700 dark:text-red-400 font-tactical font-bold text-right">
                        {formatCurrency(Number(e.amount))}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-tactical text-sm">
                        {e.vendor || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {expTotalPages > 1 && (
            <div className="mt-3">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (expPage > 1) setExpPage((p) => p - 1);
                      }}
                      className={
                        expPage <= 1
                          ? 'pointer-events-none opacity-40'
                          : 'text-foreground/85 hover:text-foreground'
                      }
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#" isActive className="bg-cbt-orange/20 text-cbt-orange">
                      {expPage} / {expTotalPages}
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (expPage < expTotalPages) setExpPage((p) => p + 1);
                      }}
                      className={
                        expPage >= expTotalPages
                          ? 'pointer-events-none opacity-40'
                          : 'text-foreground/85 hover:text-foreground'
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Diálogo Nova Despesa (preservado, com NumberStepper) ──── */}
      <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-military">Nova Despesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <select
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              className="w-full h-10 px-3 rounded-md bg-muted border border-input text-foreground font-tactical"
            >
              <option value="INVENTORY_PURCHASE">Compra de Estoque</option>
              <option value="MAINTENANCE">Manutenção</option>
              <option value="UTILITIES">Utilidades</option>
              <option value="STAFF">Pessoal</option>
              <option value="INSURANCE">Seguro</option>
              <option value="AMMUNITION_RESTOCK">Reposição de Munição</option>
              <option value="EQUIPMENT_PURCHASE">Compra de Equipamento</option>
              <option value="OTHER">Outro</option>
            </select>
            <Input
              placeholder="Descrição"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              className="bg-muted border-input text-foreground font-tactical"
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/80 font-tactical">Valor</Label>
                <NumberStepper
                  value={parseFloat(expenseForm.amount) || 0}
                  onChange={(v) =>
                    setExpenseForm({ ...expenseForm, amount: String(Math.max(0, v)) })
                  }
                  min={0}
                  step={10}
                  decimals={2}
                  prefix="R$"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/80 font-tactical">Data</Label>
                <Input
                  type="date"
                  value={expenseForm.expenseDate}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, expenseDate: e.target.value })
                  }
                  className="bg-muted border-input text-foreground font-tactical"
                />
              </div>
            </div>
            <Input
              placeholder="Fornecedor"
              value={expenseForm.vendor}
              onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
              className="bg-muted border-input text-foreground font-tactical"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setExpenseDialog(false)}
              className="font-tactical"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateExpense}
              disabled={saving}
              className="bg-cbt-orange text-primary-foreground font-tactical hover:bg-cbt-orange/90"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinancialPage;
