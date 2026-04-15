import { useState, useEffect, useCallback } from 'react';
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
  type LucideIcon,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import api from '@/services/api';
import MemberSearch from '@/components/shared/MemberSearch';
import EquipmentSearch from '@/components/shared/EquipmentSearch';
import ProductSearch from '@/components/shared/ProductSearch';
import { transactionTypeLabels, loanStatusLabels } from '@/lib/constants';

// ── Types ──────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  memberId: string;
  memberName: string;
  type: string;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

interface Loan {
  id: string;
  memberId: string;
  memberName: string;
  itemName: string;
  quantity: number;
  status: string;
  borrowedAt: string;
  dueDate: string;
}

interface Visit {
  id: string;
  memberId: string;
  memberName: string;
  lane: string;
  purpose: string;
  checkIn: string;
  checkOut?: string;
  notes?: string;
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

// ── Mock Data ──────────────────────────────────────────────────────────────

const mockTransactions: Transaction[] = [
  { id: '1', memberId: 'u1', memberName: 'Joao Silva', type: 'SALE', total: 350, paymentMethod: 'PIX', status: 'COMPLETED', createdAt: new Date().toISOString() },
  { id: '2', memberId: 'u2', memberName: 'Maria Santos', type: 'SALE', total: 120, paymentMethod: 'CREDIT_CARD', status: 'COMPLETED', createdAt: new Date().toISOString() },
  { id: '3', memberId: 'u3', memberName: 'Carlos Oliveira', type: 'SALE', total: 85.5, paymentMethod: 'CASH', status: 'PENDING', createdAt: new Date().toISOString() },
];

const mockLoans: Loan[] = [
  { id: '1', memberId: 'u1', memberName: 'Joao Silva', itemName: 'Pistola Taurus G3', quantity: 1, status: 'ACTIVE', borrowedAt: new Date().toISOString(), dueDate: new Date(Date.now() + 7 * 86400000).toISOString() },
  { id: '2', memberId: 'u4', memberName: 'Ana Souza', itemName: 'Protetor Auricular', quantity: 2, status: 'ACTIVE', borrowedAt: new Date().toISOString(), dueDate: new Date(Date.now() + 1 * 86400000).toISOString() },
];

const mockVisits: Visit[] = [
  { id: '1', memberId: 'u1', memberName: 'Joao Silva', lane: 'Baia 01', purpose: 'Treino', checkIn: new Date(Date.now() - 3600000).toISOString(), notes: 'Treino de precisao' },
  { id: '2', memberId: 'u2', memberName: 'Maria Santos', lane: 'Baia 03', purpose: 'Treino', checkIn: new Date(Date.now() - 1800000).toISOString() },
  { id: '3', memberId: 'u5', memberName: 'Pedro Lima', lane: 'Baia 06', purpose: 'Avaliacao', checkIn: new Date(Date.now() - 900000).toISOString(), checkOut: new Date().toISOString() },
];

// ── Payment method label ───────────────────────────────────────────────────

const paymentMethodLabel: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartao de Credito',
  DEBIT_CARD: 'Cartao de Debito',
  CASH: 'Dinheiro',
  BANK_TRANSFER: 'Transferencia',
};

// ── Page ───────────────────────────────────────────────────────────────────

const TransactionsPage = () => {
  const { toast } = useToast();

  // ── Data State ─────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [loans, setLoans] = useState<Loan[]>(mockLoans);
  const [visits, setVisits] = useState<Visit[]>(mockVisits);
  const [isLoading, setIsLoading] = useState(true);

  // ── Dialog States ──────────────────────────────────────────────────────
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [annuityDialogOpen, setAnnuityDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Sale Form ──────────────────────────────────────────────────────────
  const [saleMemberId, setSaleMemberId] = useState('');
  const [salePaymentMethod, setSalePaymentMethod] = useState('PIX');
  const [saleItems, setSaleItems] = useState<SaleItem[]>([
    { productId: '', description: '', quantity: 1, unitPrice: 0 },
  ]);

  // ── Visit Form ─────────────────────────────────────────────────────────
  const [visitMemberId, setVisitMemberId] = useState('');
  const [visitLane, setVisitLane] = useState('');
  const [visitPurpose, setVisitPurpose] = useState('Treino');
  const [visitNotes, setVisitNotes] = useState('');

  // ── Loan Form ──────────────────────────────────────────────────────────
  const [loanMemberId, setLoanMemberId] = useState('');
  const [loanEquipmentId, setLoanEquipmentId] = useState('');
  const [loanDueDays, setLoanDueDays] = useState(7);

  // ── Annuity Form ───────────────────────────────────────────────────────
  const [annuityMemberId, setAnnuityMemberId] = useState('');
  const [annuityAmount, setAnnuityAmount] = useState('');
  const [annuityPaymentMethod, setAnnuityPaymentMethod] = useState('PIX');
  const [annuityYear, setAnnuityYear] = useState(new Date().getFullYear().toString());

  // ── Fetch Data ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [txRes, loanRes, visitRes] = await Promise.allSettled([
        api.get('/api/transactions', { params: { limit: 20 } }),
        api.get('/api/loans', { params: { status: 'ACTIVE', limit: 20 } }),
        api.get('/api/visits', { params: { today: true, limit: 20 } }),
      ]);

      if (txRes.status === 'fulfilled' && txRes.value.data?.data) {
        setTransactions(txRes.value.data.data);
      }
      if (loanRes.status === 'fulfilled' && loanRes.value.data?.data) {
        setLoans(loanRes.value.data.data);
      }
      if (visitRes.status === 'fulfilled' && visitRes.value.data?.data) {
        setVisits(visitRes.value.data.data);
      }
    } catch {
      // Fallback to mock data already set
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      toast({ title: 'Informe o ID do membro', variant: 'destructive' });
      return;
    }
    if (saleItems.some((i) => !i.productId)) {
      toast({ title: 'Selecione todos os produtos', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/api/transactions', {
        memberId: saleMemberId,
        type: 'SALE',
        paymentMethod: salePaymentMethod,
        items: saleItems,
        total: saleTotal,
      });
      toast({ title: 'Venda registrada com sucesso' });
      setSaleDialogOpen(false);
      resetSaleForm();
      fetchData();
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar venda',
        description: err.response?.data?.error || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitVisit = async () => {
    if (!visitMemberId.trim()) {
      toast({ title: 'Informe o ID do membro', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/api/visits', {
        memberId: visitMemberId,
        lane: visitLane,
        purpose: visitPurpose,
        notes: visitNotes || undefined,
      });
      toast({ title: 'Visita registrada com sucesso' });
      setVisitDialogOpen(false);
      resetVisitForm();
      fetchData();
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar visita',
        description: err.response?.data?.error || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitLoan = async () => {
    if (!loanMemberId.trim() || !loanEquipmentId) {
      toast({ title: 'Preencha todos os campos obrigatorios', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/api/loans', {
        equipmentId: loanEquipmentId,
        memberId: loanMemberId,
        dueDays: loanDueDays,
      });
      toast({ title: 'Emprestimo registrado com sucesso' });
      setLoanDialogOpen(false);
      resetLoanForm();
      fetchData();
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar emprestimo',
        description: err.response?.data?.error || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitAnnuity = async () => {
    if (!annuityMemberId.trim() || !annuityAmount) {
      toast({ title: 'Preencha todos os campos obrigatorios', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/api/annuities', {
        memberId: annuityMemberId,
        amount: parseFloat(annuityAmount),
        paymentMethod: annuityPaymentMethod,
        referenceYear: parseInt(annuityYear),
      });
      toast({ title: 'Anuidade registrada com sucesso' });
      setAnnuityDialogOpen(false);
      resetAnnuityForm();
      fetchData();
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar anuidade',
        description: err.response?.data?.error || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Reset Forms ────────────────────────────────────────────────────────
  const resetSaleForm = () => {
    setSaleMemberId('');
    setSalePaymentMethod('PIX');
    setSaleItems([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]);
  };

  const resetVisitForm = () => {
    setVisitMemberId('');
    setVisitLane('');
    setVisitPurpose('Treino');
    setVisitNotes('');
  };

  const resetLoanForm = () => {
    setLoanMemberId('');
    setLoanEquipmentId('');
    setLoanDueDays(7);
  };

  const resetAnnuityForm = () => {
    setAnnuityMemberId('');
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
                        <TableCell className="text-green-400 font-mono text-sm font-medium">
                          {formatCurrency(tx.total)}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {paymentMethodLabel[tx.paymentMethod] || tx.paymentMethod}
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
                            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"
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
                      <TableHead className="text-gray-400 font-tactical">Qtd</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Status</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Emprestimo</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Devolucao</TableHead>
                      <TableHead className="text-gray-400 font-tactical text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((loan) => {
                      const isOverdue = new Date(loan.dueDate) < new Date() && loan.status === 'ACTIVE';
                      return (
                        <TableRow key={loan.id} className="border-gray-800 hover:bg-gray-800/50">
                          <TableCell className="text-white font-medium">{loan.memberName}</TableCell>
                          <TableCell className="text-gray-300">{loan.itemName}</TableCell>
                          <TableCell className="text-gray-300 font-mono">{loan.quantity}</TableCell>
                          <TableCell>
                            <Badge className={statusBadge(isOverdue ? 'OVERDUE' : loan.status)}>
                              {isOverdue ? 'Atrasado' : loanStatusLabels[loan.status] || loan.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-400 text-sm font-tactical">
                            {formatDate(loan.borrowedAt)}
                          </TableCell>
                          <TableCell className={`text-sm font-tactical ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                            {formatDate(loan.dueDate)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
                            {visit.lane}
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700 flex-shrink-0"
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
            <DialogTitle className="text-white font-military tracking-wide flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-green-400" />
              Nova Venda
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-tactical text-sm">
              Registre uma nova venda para um membro do clube.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Member */}
            <MemberSearch value={saleMemberId} onChange={setSaleMemberId} />

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
                                    description: product?.name || '',
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
                    <div className="w-20 space-y-1.5">
                      <Label className="text-xs text-gray-500">Qtd</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateSaleItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="bg-gray-800 border-gray-700 text-white focus:border-cbt-orange h-9 text-sm"
                      />
                    </div>
                    <div className="w-28 space-y-1.5">
                      <Label className="text-xs text-gray-500">Preco Unit.</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice || ''}
                        onChange={(e) => updateSaleItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                        className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange h-9 text-sm"
                      />
                    </div>
                    <div className="flex-1 text-right">
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
            <MemberSearch value={visitMemberId} onChange={setVisitMemberId} />

            <div className="space-y-2">
              <Label className="text-gray-300 font-tactical text-sm">Baia</Label>
              <Select value={visitLane} onValueChange={setVisitLane}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Selecione a baia" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="Baia 01">Baia 01</SelectItem>
                  <SelectItem value="Baia 02">Baia 02</SelectItem>
                  <SelectItem value="Baia 03">Baia 03</SelectItem>
                  <SelectItem value="Baia 04">Baia 04</SelectItem>
                  <SelectItem value="Baia 05">Baia 05</SelectItem>
                  <SelectItem value="Baia 06">Baia 06</SelectItem>
                </SelectContent>
              </Select>
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

      {/* ── Novo Emprestimo Dialog ──────────────────────────────────────── */}
      <Dialog open={loanDialogOpen} onOpenChange={setLoanDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white font-military tracking-wide flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-400" />
              Novo Emprestimo
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-tactical text-sm">
              Registre o emprestimo de um equipamento para um membro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <MemberSearch value={loanMemberId} onChange={setLoanMemberId} />

            <EquipmentSearch
              value={loanEquipmentId}
              onChange={setLoanEquipmentId}
              label="Equipamento *"
              placeholder="Buscar arma, coldre, equipamento..."
            />

            <div className="space-y-2">
              <Label className="text-gray-300 font-tactical text-sm">Prazo (dias)</Label>
              <Input
                type="number"
                min={1}
                value={loanDueDays}
                onChange={(e) => setLoanDueDays(parseInt(e.target.value) || 7)}
                className="bg-gray-800 border-gray-700 text-white focus:border-cbt-orange"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setLoanDialogOpen(false)}
              disabled={isSaving}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitLoan}
              disabled={isSaving}
              className="bg-orange-600 hover:bg-orange-700 text-white font-tactical min-w-[160px]"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar Emprestimo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <MemberSearch value={annuityMemberId} onChange={setAnnuityMemberId} />

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
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAnnuityDialogOpen(false)}
              disabled={isSaving}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitAnnuity}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-tactical min-w-[150px]"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar Anuidade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionsPage;
