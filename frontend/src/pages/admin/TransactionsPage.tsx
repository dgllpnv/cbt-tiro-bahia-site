import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  CalendarCheck,
  Package,
  CreditCard,
  Plus,
  Trash2,
  Eye,
  Loader2,
  Receipt,
  Crosshair,
  DollarSign,
  Clock,
  UserCheck,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import MemberSearch from '@/components/shared/MemberSearch';
import EquipmentSearch from '@/components/shared/EquipmentSearch';
import ProductSearch from '@/components/shared/ProductSearch';
import { loanStatusLabels } from '@/lib/constants';

import { listTransactions, createTransaction } from '@/services/transactionsService';
import { listLoans, issueLoan } from '@/services/loansService';
import { getTodayVisits, createVisit, checkoutVisit } from '@/services/visitsService';
import { createAnnuityPayment } from '@/services/annuitiesService';
import { listLanes, type Lane as ApiLane } from '@/services/lanesService';
import { getVisitorById, type Visitor } from '@/services/visitorsService';
import TransactionDetailsDialog from '@/components/admin/TransactionDetailsDialog';
import ConvertVisitorDialog from '@/components/admin/ConvertVisitorDialog';
import LoanIssueDialog from '@/components/admin/LoanIssueDialog';
import LoanTransferDialog from '@/components/admin/LoanTransferDialog';
import LoanReturnDialog from '@/components/admin/LoanReturnDialog';
import { getLoanById, type EquipmentLoan } from '@/services/loansService';

// ── Display Types (mapped from API responses) ──────────────────────────────

interface TxRow {
  id: string;
  memberName: string;
  type: string;
  total: number;
  paymentMethod: string | null;
  status: string;
  createdAt: string;
}

interface LoanRow {
  id: string;
  memberName: string;
  itemName: string;
  quantity: number;
  status: string;
  borrowedAt: string;
  dueDate: string | null;
}

interface VisitRow {
  id: string;
  memberName: string;
  laneName: string;
  purpose: string;
  checkIn: string;
  checkOut: string | null;
  notes: string | null;
}

interface SaleItem {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

// ── Quick Action Card ──────────────────────────────────────────────────────

interface ActionCardProps {
  icon: LucideIcon;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  onClick: () => void;
}

const ActionCard = ({ icon: Icon, label, description, color, bgColor, borderColor, onClick }: ActionCardProps) => (
  <button
    onClick={onClick}
    className={`text-left w-full group bg-gray-900/50 border ${borderColor} rounded-lg p-5 hover:bg-gray-800/50 transition-all duration-300 hover:scale-[1.01]`}
  >
    <div className="flex items-start gap-4">
      <div className={`p-3 rounded-lg ${bgColor} group-hover:scale-110 transition-transform`}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p className="text-white font-military text-sm tracking-wide">{label}</p>
        <p className="text-gray-500 font-tactical text-xs mt-0.5">{description}</p>
      </div>
    </div>
  </button>
);

// ── Payment method label ───────────────────────────────────────────────────

const paymentMethodLabel: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartao de Credito',
  DEBIT_CARD: 'Cartao de Debito',
  CASH: 'Dinheiro',
  BANK_TRANSFER: 'Transferencia',
};

const saleTypeLabel: Record<string, string> = {
  AMMUNITION_SALE: 'Venda de Municao',
  TARGET_SALE: 'Venda de Alvos',
  EQUIPMENT_RENTAL: 'Aluguel de Equipamento',
  MAGAZINE_RENTAL: 'Aluguel de Carregador',
  LANE_RENTAL: 'Aluguel de Baia',
  COURSE_ENROLLMENT: 'Inscricao em Curso',
  GUEST_ENTRY: 'Entrada de Visitante',
  OTHER_SALE: 'Outra Venda',
};

// ── Page ───────────────────────────────────────────────────────────────────

const TransactionsPage = () => {
  const { toast } = useToast();

  // ── Data State ─────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [lanesList, setLanesList] = useState<ApiLane[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Dialog States ──────────────────────────────────────────────────────
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [annuityDialogOpen, setAnnuityDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);

  // ── Sale Form ──────────────────────────────────────────────────────────
  const [saleMemberId, setSaleMemberId] = useState('');
  const [saleVisitId, setSaleVisitId] = useState<string | null>(null);
  const [saleType, setSaleType] = useState('OTHER_SALE');
  const [salePaymentMethod, setSalePaymentMethod] = useState('PIX');
  const [saleItems, setSaleItems] = useState<SaleItem[]>([
    { productId: '', description: '', quantity: 1, unitPrice: 0 },
  ]);

  // ── Visit Form ─────────────────────────────────────────────────────────
  const [visitMemberId, setVisitMemberId] = useState('');
  const [visitLaneId, setVisitLaneId] = useState('');
  const [visitPurpose, setVisitPurpose] = useState('Treino');
  const [visitNotes, setVisitNotes] = useState('');

  // ── Loan Form (mantidos para compat — agora dialog usa LoanIssueDialog) ──
  const [loanMemberId, setLoanMemberId] = useState('');
  const [loanEquipmentId, setLoanEquipmentId] = useState('');

  // Transfer/Return loan dialogs ativados na aba de empréstimos
  const [loanTransferTarget, setLoanTransferTarget] = useState<EquipmentLoan | null>(null);
  const [loanReturnTarget, setLoanReturnTarget] = useState<EquipmentLoan | null>(null);

  // ── Details dialogs (botao Eye em cada aba) ────────────────────────────
  const [detailTxId, setDetailTxId] = useState<string | null>(null);
  const [detailLoan, setDetailLoan] = useState<LoanRow | null>(null);
  const [detailVisit, setDetailVisit] = useState<VisitRow | null>(null);

  // ── Annuity Form ───────────────────────────────────────────────────────
  const [annuityMemberId, setAnnuityMemberId] = useState('');
  const [annuityIsVisitor, setAnnuityIsVisitor] = useState(false);
  const [annuityAmount, setAnnuityAmount] = useState('');
  const [annuityPaymentMethod, setAnnuityPaymentMethod] = useState('PIX');
  const [annuityYear, setAnnuityYear] = useState(new Date().getFullYear().toString());

  // ── Conversao de visitante (acionada via Nova Anuidade) ────────────────
  const [convertVisitor, setConvertVisitor] = useState<Visitor | null>(null);
  const [isLoadingVisitor, setIsLoadingVisitor] = useState(false);

  // ── Fetch Data ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [txRes, loanRes, visitRes, laneRes] = await Promise.all([
      listTransactions({ limit: 20 }),
      listLoans({ status: 'ACTIVE', limit: 20 }),
      getTodayVisits(),
      listLanes(),
    ]);

    if (txRes.success && txRes.data) {
      setTransactions(
        txRes.data.map((t) => ({
          id: t.id,
          memberName: t.member?.fullName || '—',
          type: t.type,
          total: Number(t.totalAmount) || 0,
          paymentMethod: t.paymentMethod,
          status: 'COMPLETED',
          createdAt: t.transactionDate,
        })),
      );
    } else {
      setTransactions([]);
      if (!txRes.success) {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar vendas',
          description: txRes.error || 'Tente novamente.',
        });
      }
    }

    if (loanRes.success && loanRes.data) {
      setLoans(
        loanRes.data.map((l) => ({
          id: l.id,
          memberName: l.member?.fullName || '—',
          itemName: l.equipment?.name || '—',
          quantity: 1,
          status: l.status,
          borrowedAt: l.loanDate,
          dueDate: l.expectedReturn,
        })),
      );
    } else {
      setLoans([]);
      if (!loanRes.success) {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar emprestimos',
          description: loanRes.error || 'Tente novamente.',
        });
      }
    }

    if (visitRes.success && visitRes.data) {
      setVisits(
        visitRes.data.map((v) => ({
          id: v.id,
          memberName: v.member?.fullName || '—',
          laneName: v.lane?.name || (v.lane?.number != null ? `Baia ${String(v.lane.number).padStart(2, '0')}` : 'Sem baia'),
          purpose: v.purpose || '—',
          checkIn: v.checkInTime,
          checkOut: v.checkOutTime,
          notes: v.notes,
        })),
      );
    } else {
      setVisits([]);
      if (!visitRes.success) {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar visitas',
          description: visitRes.error || 'Tente novamente.',
        });
      }
    }

    if (laneRes.success && laneRes.data) {
      setLanesList(laneRes.data);
    } else {
      setLanesList([]);
      if (!laneRes.success) {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar baias',
          description: laneRes.error || 'Tente novamente.',
        });
      }
    }

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Abrir diálogo de Venda quando navegado do dashboard ────────────────
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const s = location.state as { openSale?: { memberId: string; visitId?: string } } | null;
    if (s?.openSale) {
      // Reset inline (sem dependência de resetSaleForm pra não recriar o effect)
      setSaleMemberId(s.openSale.memberId);
      setSaleVisitId(s.openSale.visitId || null);
      setSaleType('OTHER_SALE');
      setSalePaymentMethod('PIX');
      setSaleItems([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]);
      setSaleDialogOpen(true);
      // Limpa o state pra não reabrir em F5/voltar
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // ── Sale Helpers ───────────────────────────────────────────────────────
  const addSaleItem = () => {
    setSaleItems((prev) => [...prev, { productId: '', description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeSaleItem = (index: number) => {
    if (saleItems.length <= 1) return;
    setSaleItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSaleItem = (index: number, field: keyof SaleItem, value: string | number) => {
    setSaleItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const saleTotal = saleItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  // ── Submit Handlers ────────────────────────────────────────────────────
  const handleSubmitSale = async () => {
    if (!saleMemberId.trim()) {
      toast({ title: 'Selecione o associado', variant: 'destructive' });
      return;
    }
    if (saleItems.some((i) => !i.description || i.quantity <= 0 || i.unitPrice < 0)) {
      toast({ title: 'Complete os itens da venda', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const res = await createTransaction({
      memberId: saleMemberId,
      type: saleType,
      paymentMethod: salePaymentMethod,
      visitId: saleVisitId || undefined,
      items: saleItems.map((it) => ({
        productId: it.productId || null,
        description: it.description || 'Item avulso',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    });
    setIsSaving(false);

    if (res.success) {
      toast({ title: 'Venda registrada com sucesso.' });
      setSaleDialogOpen(false);
      resetSaleForm();
      fetchData();
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar venda',
        description: res.error || 'Tente novamente.',
      });
    }
  };

  const handleSubmitVisit = async () => {
    if (!visitMemberId.trim()) {
      toast({ title: 'Selecione o associado', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const now = new Date();
    const visitDate = now.toISOString().slice(0, 10);
    const res = await createVisit({
      memberId: visitMemberId,
      visitDate,
      checkInTime: now.toISOString(),
      laneId: visitLaneId || undefined,
      purpose: visitPurpose,
      notes: visitNotes || undefined,
    });
    setIsSaving(false);

    if (res.success) {
      toast({ title: 'Visita registrada com sucesso.' });
      setVisitDialogOpen(false);
      resetVisitForm();
      fetchData();
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar visita',
        description: res.error || 'Tente novamente.',
      });
    }
  };

  const handleSubmitLoan = async () => {
    if (!loanMemberId.trim() || !loanEquipmentId) {
      toast({ title: 'Preencha todos os campos obrigatorios', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const res = await issueLoan({
      memberId: loanMemberId,
      equipmentId: loanEquipmentId,
    });
    setIsSaving(false);

    if (res.success) {
      toast({ title: 'Emprestimo registrado com sucesso.' });
      setLoanDialogOpen(false);
      resetLoanForm();
      fetchData();
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar emprestimo',
        description: res.error || 'Tente novamente.',
      });
    }
  };

  const handleSubmitAnnuity = async () => {
    if (!annuityMemberId.trim()) {
      toast({ title: 'Selecione um membro', variant: 'destructive' });
      return;
    }

    // Visitante: anuidade so e possivel via conversao em associado.
    // Fecha esse dialog e abre o ConvertVisitorDialog (que coleta dados que faltam + anuidade).
    if (annuityIsVisitor) {
      setIsLoadingVisitor(true);
      const res = await getVisitorById(annuityMemberId);
      setIsLoadingVisitor(false);

      if (res.success && res.data) {
        setAnnuityDialogOpen(false);
        setConvertVisitor(res.data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar visitante',
          description: res.error || 'Tente novamente.',
        });
      }
      return;
    }

    if (!annuityAmount) {
      toast({ title: 'Preencha todos os campos obrigatorios', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const res = await createAnnuityPayment({
      memberId: annuityMemberId,
      amount: parseFloat(annuityAmount),
      paymentMethod: annuityPaymentMethod,
      referenceYear: parseInt(annuityYear, 10),
    });
    setIsSaving(false);

    if (res.success) {
      toast({ title: 'Anuidade registrada com sucesso.' });
      setAnnuityDialogOpen(false);
      resetAnnuityForm();
      fetchData();
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar anuidade',
        description: res.error || 'Tente novamente.',
      });
    }
  };

  const handleCheckoutVisit = async (visitId: string) => {
    setCheckoutLoadingId(visitId);
    const res = await checkoutVisit(visitId);
    setCheckoutLoadingId(null);

    if (res.success) {
      toast({ title: 'Visita finalizada. Baia liberada.' });
      fetchData();
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao finalizar visita',
        description: res.error || 'Tente novamente.',
      });
    }
  };

  // ── Reset Forms ────────────────────────────────────────────────────────
  const resetSaleForm = () => {
    setSaleMemberId('');
    setSaleVisitId(null);
    setSaleType('OTHER_SALE');
    setSalePaymentMethod('PIX');
    setSaleItems([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]);
  };

  const resetVisitForm = () => {
    setVisitMemberId('');
    setVisitLaneId('');
    setVisitPurpose('Treino');
    setVisitNotes('');
  };

  const resetLoanForm = () => {
    setLoanMemberId('');
    setLoanEquipmentId('');
  };

  const resetAnnuityForm = () => {
    setAnnuityMemberId('');
    setAnnuityIsVisitor(false);
    setAnnuityAmount('');
    setAnnuityPaymentMethod('PIX');
    setAnnuityYear(new Date().getFullYear().toString());
  };

  // ── Status badge color ─────────────────────────────────────────────────
  const statusBadge = (status: string) => {
    const config: Record<string, string> = {
      COMPLETED: 'bg-green-500/10 text-green-400 border-green-500/20',
      PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      ACTIVE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      OVERDUE: 'bg-red-500/10 text-red-400 border-red-500/20',
      RETURNED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    };
    return config[status] || config['PENDING'];
  };

  const statusLabel: Record<string, string> = {
    COMPLETED: 'Concluida',
    PENDING: 'Pendente',
    ACTIVE: 'Ativo',
    OVERDUE: 'Atrasado',
    RETURNED: 'Devolvido',
  };

  // Lanes available for Nova Visita (not occupied / not under maintenance)
  const availableLanes = lanesList.filter((l) => l.status === 'AVAILABLE' || l.status === 'RESERVED');

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Lancamentos"
        description="Registrar visitas, vendas, emprestimos e anuidades"
      />

      {/* ── Quick Action Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <ActionCard
          icon={CalendarCheck}
          label="Nova Visita"
          description="Check-in de membro"
          color="#8b5cf6"
          bgColor="bg-violet-500/10"
          borderColor="border-violet-500/20"
          onClick={() => { resetVisitForm(); setVisitDialogOpen(true); }}
        />
        <ActionCard
          icon={ShoppingCart}
          label="Nova Venda"
          description="Registrar transacao"
          color="#22c55e"
          bgColor="bg-green-500/10"
          borderColor="border-green-500/20"
          onClick={() => { resetSaleForm(); setSaleDialogOpen(true); }}
        />
        <ActionCard
          icon={Package}
          label="Novo Emprestimo"
          description="Emprestar equipamento"
          color="#f97316"
          bgColor="bg-orange-500/10"
          borderColor="border-orange-500/20"
          onClick={() => { resetLoanForm(); setLoanDialogOpen(true); }}
        />
        <ActionCard
          icon={CreditCard}
          label="Nova Anuidade"
          description="Registrar pagamento"
          color="#3b82f6"
          bgColor="bg-blue-500/10"
          borderColor="border-blue-500/20"
          onClick={() => { resetAnnuityForm(); setAnnuityDialogOpen(true); }}
        />
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingSpinner message="Carregando lancamentos..." />
      ) : (
        <Tabs defaultValue="sales" className="space-y-4">
          <TabsList className="bg-gray-900/50 border border-gray-800 p-1">
            <TabsTrigger
              value="sales"
              className="font-tactical text-sm data-[state=active]:bg-cbt-orange data-[state=active]:text-white data-[state=inactive]:text-gray-400"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Vendas Recentes
            </TabsTrigger>
            <TabsTrigger
              value="loans"
              className="font-tactical text-sm data-[state=active]:bg-cbt-orange data-[state=active]:text-white data-[state=inactive]:text-gray-400"
            >
              <Package className="h-4 w-4 mr-2" />
              Emprestimos Ativos
            </TabsTrigger>
            <TabsTrigger
              value="visits"
              className="font-tactical text-sm data-[state=active]:bg-cbt-orange data-[state=active]:text-white data-[state=inactive]:text-gray-400"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Visitas de Hoje
            </TabsTrigger>
          </TabsList>

          {/* ── Sales Tab ─────────────────────────────────────────────── */}
          <TabsContent value="sales">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
              {transactions.length === 0 ? (
                <EmptyState
                  icon={<Receipt className="w-8 h-8 text-gray-500" />}
                  title="Nenhuma venda registrada"
                  description="Registre a primeira venda usando o botao acima."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800 hover:bg-transparent">
                      <TableHead className="text-gray-400 font-tactical">Membro</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Tipo</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Valor</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Pagamento</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Status</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Data</TableHead>
                      <TableHead className="text-gray-400 font-tactical text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id} className="border-gray-800 hover:bg-gray-800/50">
                        <TableCell className="text-white font-medium">{tx.memberName}</TableCell>
                        <TableCell className="text-gray-300 text-xs font-tactical">
                          {saleTypeLabel[tx.type] || tx.type}
                        </TableCell>
                        <TableCell className="text-green-400 font-mono text-sm font-medium">
                          {formatCurrency(tx.total)}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {tx.paymentMethod ? paymentMethodLabel[tx.paymentMethod] || tx.paymentMethod : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadge(tx.status)}>
                            {statusLabel[tx.status] || tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-400 text-sm font-tactical">
                          {formatDate(tx.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetailTxId(tx.id)}
                            title="Ver resumo"
                            className="h-8 w-8 text-gray-400 hover:text-cbt-orange hover:bg-cbt-orange/10"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* ── Loans Tab ─────────────────────────────────────────────── */}
          <TabsContent value="loans">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
              {loans.length === 0 ? (
                <EmptyState
                  icon={<Package className="w-8 h-8 text-gray-500" />}
                  title="Nenhum emprestimo ativo"
                  description="Nao ha emprestimos de equipamentos no momento."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800 hover:bg-transparent">
                      <TableHead className="text-gray-400 font-tactical">Membro</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Item</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Status</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Emprestimo</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Devolucao</TableHead>
                      <TableHead className="text-gray-400 font-tactical text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((loan) => {
                      const isOverdue = loan.dueDate ? new Date(loan.dueDate) < new Date() && loan.status === 'ACTIVE' : false;
                      return (
                        <TableRow key={loan.id} className="border-gray-800 hover:bg-gray-800/50">
                          <TableCell className="text-white font-medium">{loan.memberName}</TableCell>
                          <TableCell className="text-gray-300">{loan.itemName}</TableCell>
                          <TableCell>
                            <Badge className={statusBadge(isOverdue ? 'OVERDUE' : loan.status)}>
                              {isOverdue ? 'Atrasado' : loanStatusLabels[loan.status] || loan.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-400 text-sm font-tactical">
                            {formatDate(loan.borrowedAt)}
                          </TableCell>
                          <TableCell className={`text-sm font-tactical ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                            {loan.dueDate ? formatDate(loan.dueDate) : 'Uso interno'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {loan.status === 'ACTIVE' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={async () => {
                                      const res = await getLoanById(loan.id);
                                      if (res.success && res.data) setLoanTransferTarget(res.data);
                                    }}
                                    title="Transferir"
                                    className="h-8 w-8 text-gray-400 hover:text-blue-300 hover:bg-gray-700"
                                  >
                                    <UserCheck className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={async () => {
                                      const res = await getLoanById(loan.id);
                                      if (res.success && res.data) setLoanReturnTarget(res.data);
                                    }}
                                    title="Devolver"
                                    className="h-8 w-8 text-gray-400 hover:text-red-300 hover:bg-gray-700"
                                  >
                                    <Receipt className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDetailLoan(loan)}
                                title="Ver detalhes"
                                className="h-8 w-8 text-gray-400 hover:text-cbt-orange hover:bg-cbt-orange/10"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* ── Visits Tab ────────────────────────────────────────────── */}
          <TabsContent value="visits">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
              {visits.length === 0 ? (
                <EmptyState
                  icon={<CalendarCheck className="w-8 h-8 text-gray-500" />}
                  title="Nenhuma visita hoje"
                  description="Nenhum membro realizou check-in hoje."
                />
              ) : (
                <div className="divide-y divide-gray-800">
                  {visits.map((visit) => (
                    <div key={visit.id} className="flex items-center gap-4 p-4 hover:bg-gray-800/30 transition-colors">
                      <div className="p-2.5 rounded-lg bg-violet-500/10 flex-shrink-0">
                        <Crosshair className="h-4 w-4 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium text-sm">{visit.memberName}</span>
                          <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-xs">
                            {visit.laneName}
                          </Badge>
                          <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20 text-xs">
                            {visit.purpose}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-tactical">
                          <span className="text-gray-500">
                            Entrada: {formatDateTime(visit.checkIn)}
                          </span>
                          {visit.checkOut ? (
                            <span className="text-green-500">
                              Saida: {formatDateTime(visit.checkOut)}
                            </span>
                          ) : (
                            <span className="text-cbt-orange flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Em andamento
                            </span>
                          )}
                        </div>
                        {visit.notes && (
                          <p className="text-xs text-gray-600 font-tactical mt-1">{visit.notes}</p>
                        )}
                      </div>
                      {!visit.checkOut && (
                        <Button
                          onClick={() => handleCheckoutVisit(visit.id)}
                          disabled={checkoutLoadingId === visit.id}
                          variant="outline"
                          size="sm"
                          className="bg-gray-800 border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200 flex-shrink-0"
                        >
                          {checkoutLoadingId === visit.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <LogOut className="h-4 w-4 mr-1.5" />
                              Finalizar
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDetailVisit(visit)}
                        title="Ver detalhes"
                        className="h-8 w-8 text-gray-400 hover:text-cbt-orange hover:bg-cbt-orange/10 flex-shrink-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* ════════════════════════════════════════════════════════════════════
           DIALOGS
         ════════════════════════════════════════════════════════════════════ */}

      {/* ── Nova Venda Dialog ───────────────────────────────────────────── */}
      <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white font-military tracking-wide flex items-center gap-2 flex-wrap">
              <ShoppingCart className="h-5 w-5 text-green-400" />
              Nova Venda
              {saleVisitId && (
                <Badge variant="outline" className="ml-1 border-cbt-orange/40 bg-cbt-orange/10 text-cbt-orange font-tactical text-[10px]">
                  Vinculada à visita
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-tactical text-sm">
              {saleVisitId
                ? 'Lançamento rápido vinculado à visita atual do associado.'
                : 'Registre uma nova venda para um membro do clube.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Member */}
            <MemberSearch
              value={saleMemberId}
              onChange={setSaleMemberId}
              includeVisitors
              placeholder="Buscar associado ou visitante..."
              label="Associado / Visitante *"
            />

            {/* Type */}
            <div className="space-y-2">
              <Label className="text-gray-300 font-tactical text-sm">Tipo de Lancamento</Label>
              <Select value={saleType} onValueChange={setSaleType}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {Object.entries(saleTypeLabel).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300 font-tactical text-sm">Itens *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSaleItem}
                  className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar Item
                </Button>
              </div>
              {saleItems.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <ProductSearch
                        value={item.productId}
                        onChange={(productId, product) => {
                          setSaleItems((prev) =>
                            prev.map((si, i) =>
                              i === idx
                                ? {
                                    ...si,
                                    productId,
                                    description: product?.name || si.description,
                                    unitPrice: product ? Number(product.unitPrice) : si.unitPrice,
                                  }
                                : si
                            )
                          );
                        }}
                        label="Produto"
                        placeholder="Buscar produto..."
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSaleItem(idx)}
                      disabled={saleItems.length <= 1}
                      className="h-9 w-9 text-gray-500 hover:text-red-400 hover:bg-gray-700 flex-shrink-0 mt-7"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs text-gray-500">Descricao</Label>
                      <Input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateSaleItem(idx, 'description', e.target.value)}
                        placeholder="Descricao do item"
                        className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange h-9 text-sm"
                      />
                    </div>
                    <div className="w-32 space-y-1.5">
                      <Label className="text-xs text-gray-500">Qtd</Label>
                      <NumberStepper
                        value={item.quantity}
                        onChange={(v) => updateSaleItem(idx, 'quantity', Math.max(1, Math.round(v)))}
                        min={1}
                        step={1}
                      />
                    </div>
                    <div className="w-44 space-y-1.5">
                      <Label className="text-xs text-gray-500">Preco Unit.</Label>
                      <NumberStepper
                        value={item.unitPrice}
                        onChange={(v) => updateSaleItem(idx, 'unitPrice', Math.max(0, v))}
                        min={0}
                        step={0.5}
                        decimals={2}
                        prefix="R$"
                      />
                    </div>
                    <div className="w-24 text-right">
                      <Label className="text-xs text-gray-500 block mb-1.5">Subtotal</Label>
                      <span className="text-green-400 font-mono text-sm font-medium">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label className="text-gray-300 font-tactical text-sm">Forma de Pagamento</Label>
              <Select value={salePaymentMethod} onValueChange={setSalePaymentMethod}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartao de Credito</SelectItem>
                  <SelectItem value="DEBIT_CARD">Cartao de Debito</SelectItem>
                  <SelectItem value="CASH">Dinheiro</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
              <span className="text-gray-300 font-tactical text-sm">Total da Venda</span>
              <span className="text-green-400 font-military text-lg font-bold">
                {formatCurrency(saleTotal)}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSaleDialogOpen(false)}
              disabled={isSaving}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitSale}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white font-tactical min-w-[140px]"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar Venda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Nova Visita Dialog ──────────────────────────────────────────── */}
      <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white font-military tracking-wide flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-violet-400" />
              Nova Visita
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-tactical text-sm">
              Registre o check-in de um membro no clube.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <MemberSearch
              value={visitMemberId}
              onChange={setVisitMemberId}
              includeVisitors
              placeholder="Buscar associado ou visitante..."
              label="Associado / Visitante *"
            />

            <div className="space-y-2">
              <Label className="text-gray-300 font-tactical text-sm">Baia (opcional)</Label>
              <Select value={visitLaneId} onValueChange={setVisitLaneId}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder={availableLanes.length === 0 ? 'Nenhuma baia disponivel' : 'Selecione a baia'} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {availableLanes.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-gray-500 font-tactical">Nenhuma baia disponivel.</div>
                  ) : (
                    availableLanes.map((lane) => (
                      <SelectItem key={lane.id} value={lane.id}>
                        {lane.name || `Baia ${String(lane.number).padStart(2, '0')}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {lanesList.length > 0 && availableLanes.length < lanesList.length && (
                <p className="text-xs text-gray-500 font-tactical">
                  {lanesList.length - availableLanes.length} baia(s) em uso ou manutencao.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300 font-tactical text-sm">Finalidade</Label>
              <Select value={visitPurpose} onValueChange={setVisitPurpose}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="Treino">Treino</SelectItem>
                  <SelectItem value="Avaliacao">Avaliacao</SelectItem>
                  <SelectItem value="Competicao">Competicao</SelectItem>
                  <SelectItem value="Instrucao">Instrucao</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300 font-tactical text-sm">Observacoes (opcional)</Label>
              <Textarea
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                placeholder="Notas adicionais sobre a visita..."
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setVisitDialogOpen(false)}
              disabled={isSaving}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitVisit}
              disabled={isSaving}
              className="bg-violet-600 hover:bg-violet-700 text-white font-tactical min-w-[140px]"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar Visita'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Novo Emprestimo (componente reutilizavel) ───────────────────── */}
      <LoanIssueDialog
        open={loanDialogOpen}
        onOpenChange={setLoanDialogOpen}
        onCreated={() => fetchData()}
      />

      {/* ── Transferir / Devolver emprestimo ativo ─────────────────────── */}
      <LoanTransferDialog
        open={!!loanTransferTarget}
        onOpenChange={(o) => !o && setLoanTransferTarget(null)}
        activeLoan={loanTransferTarget}
        onTransferred={() => {
          setLoanTransferTarget(null);
          fetchData();
        }}
      />

      <LoanReturnDialog
        open={!!loanReturnTarget}
        onOpenChange={(o) => !o && setLoanReturnTarget(null)}
        activeLoan={loanReturnTarget}
        onReturned={() => {
          setLoanReturnTarget(null);
          fetchData();
        }}
      />

      {/* ── Nova Anuidade Dialog ────────────────────────────────────────── */}
      <Dialog open={annuityDialogOpen} onOpenChange={setAnnuityDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white font-military tracking-wide flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-400" />
              Nova Anuidade
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-tactical text-sm">
              Registre o pagamento de anuidade de um membro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <MemberSearch
              value={annuityMemberId}
              onChange={(id, member) => {
                setAnnuityMemberId(id);
                setAnnuityIsVisitor(!!member?.isVisitor);
              }}
              includeVisitors
              placeholder="Buscar associado ou visitante..."
              label="Associado / Visitante *"
            />

            {annuityIsVisitor ? (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3">
                <UserCheck className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm font-tactical text-blue-100 space-y-1">
                  <p className="font-semibold">Visitante selecionado.</p>
                  <p className="text-blue-200/80">
                    Para pagar anuidade, o visitante precisa virar associado. Ao continuar, abriremos
                    a tela de conversao para completar o cadastro (e-mail, senha, n. de associado) e
                    registrar o pagamento da anuidade na mesma operacao.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300 font-tactical text-sm">Valor *</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={annuityAmount}
                      onChange={(e) => setAnnuityAmount(e.target.value)}
                      placeholder="0,00"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300 font-tactical text-sm">Ano de Referencia</Label>
                    <Input
                      type="number"
                      min={2020}
                      max={2030}
                      value={annuityYear}
                      onChange={(e) => setAnnuityYear(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white focus:border-cbt-orange"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 font-tactical text-sm">Forma de Pagamento</Label>
                  <Select value={annuityPaymentMethod} onValueChange={setAnnuityPaymentMethod}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="CREDIT_CARD">Cartao de Credito</SelectItem>
                      <SelectItem value="DEBIT_CARD">Cartao de Debito</SelectItem>
                      <SelectItem value="CASH">Dinheiro</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {annuityAmount && (
                  <div className="flex items-center justify-between p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <span className="text-gray-300 font-tactical text-sm">Valor da Anuidade</span>
                    <span className="text-blue-400 font-military text-lg font-bold">
                      {formatCurrency(parseFloat(annuityAmount) || 0)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAnnuityDialogOpen(false)}
              disabled={isSaving || isLoadingVisitor}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitAnnuity}
              disabled={isSaving || isLoadingVisitor}
              className={`text-white font-tactical min-w-[180px] ${annuityIsVisitor ? 'bg-cbt-orange hover:bg-cbt-orange/90' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isSaving || isLoadingVisitor ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : annuityIsVisitor ? (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Continuar Conversao
                </>
              ) : (
                'Registrar Anuidade'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Conversao de visitante (acionada via Nova Anuidade) ───────────── */}
      {convertVisitor && (
        <ConvertVisitorDialog
          visitor={convertVisitor}
          open={!!convertVisitor}
          onOpenChange={(o) => {
            if (!o) setConvertVisitor(null);
          }}
          onConverted={() => {
            setConvertVisitor(null);
            resetAnnuityForm();
            fetchData();
          }}
        />
      )}

      {/* ── Detalhes da venda (botao olho) ────────────────────────────────── */}
      <TransactionDetailsDialog
        transactionId={detailTxId}
        open={!!detailTxId}
        onOpenChange={(o) => !o && setDetailTxId(null)}
      />

      {/* ── Detalhes do emprestimo ────────────────────────────────────────── */}
      <Dialog open={!!detailLoan} onOpenChange={(o) => !o && setDetailLoan(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-military tracking-wide flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-400" />
              Detalhes do emprestimo
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-tactical text-sm">
              Informacoes do emprestimo de equipamento.
            </DialogDescription>
          </DialogHeader>
          {detailLoan && (
            <div className="space-y-3 py-2">
              <div className="bg-gray-800/40 border border-gray-700 rounded-md p-4 space-y-2.5 font-tactical text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 uppercase text-xs tracking-wider">Membro</span>
                  <span className="text-white text-right">{detailLoan.memberName}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 uppercase text-xs tracking-wider">Item</span>
                  <span className="text-white text-right">{detailLoan.itemName}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 uppercase text-xs tracking-wider">Status</span>
                  <Badge className={statusBadge(
                    detailLoan.dueDate && new Date(detailLoan.dueDate) < new Date() && detailLoan.status === 'ACTIVE'
                      ? 'OVERDUE'
                      : detailLoan.status,
                  )}>
                    {detailLoan.dueDate && new Date(detailLoan.dueDate) < new Date() && detailLoan.status === 'ACTIVE'
                      ? 'Atrasado'
                      : loanStatusLabels[detailLoan.status] || detailLoan.status}
                  </Badge>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 uppercase text-xs tracking-wider">Emprestado em</span>
                  <span className="text-white text-right">{formatDateTime(detailLoan.borrowedAt)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 uppercase text-xs tracking-wider">Devolucao prevista</span>
                  <span className="text-white text-right">
                    {detailLoan.dueDate ? formatDate(detailLoan.dueDate) : '—'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 uppercase text-xs tracking-wider">Quantidade</span>
                  <span className="text-white text-right">{detailLoan.quantity}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailLoan(null)}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detalhes da visita ────────────────────────────────────────────── */}
      <Dialog open={!!detailVisit} onOpenChange={(o) => !o && setDetailVisit(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-military tracking-wide flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-violet-400" />
              Detalhes da visita
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-tactical text-sm">
              Sessao do associado registrada hoje.
            </DialogDescription>
          </DialogHeader>
          {detailVisit && (
            <div className="space-y-3 py-2">
              <div className="bg-gray-800/40 border border-gray-700 rounded-md p-4 space-y-2.5 font-tactical text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 uppercase text-xs tracking-wider">Membro</span>
                  <span className="text-white text-right">{detailVisit.memberName}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 uppercase text-xs tracking-wider">Baia</span>
                  <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20">
                    {detailVisit.laneName}
                  </Badge>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 uppercase text-xs tracking-wider">Proposito</span>
                  <span className="text-white text-right">{detailVisit.purpose}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 uppercase text-xs tracking-wider">Check-in</span>
                  <span className="text-white text-right">{formatDateTime(detailVisit.checkIn)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 uppercase text-xs tracking-wider">Check-out</span>
                  <span className={`text-right ${detailVisit.checkOut ? 'text-green-400' : 'text-cbt-orange'}`}>
                    {detailVisit.checkOut ? formatDateTime(detailVisit.checkOut) : 'Em andamento'}
                  </span>
                </div>
                {detailVisit.notes && (
                  <div className="pt-2 border-t border-gray-700">
                    <span className="text-gray-500 uppercase text-xs tracking-wider block mb-1">
                      Observacoes
                    </span>
                    <p className="text-gray-300 whitespace-pre-line">{detailVisit.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailVisit(null)}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionsPage;
