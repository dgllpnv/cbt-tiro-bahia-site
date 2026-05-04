import { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Key,
  UserX,
  UserCheck,
  Trash2,
  Loader2,
  Eye,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  Crosshair,
  Package,
  Calendar,
  AlertTriangle,
  Upload,
  X,
  IdCard,
  ArrowRight,
  Receipt,
} from 'lucide-react';
import MemberProfileTab from '@/components/admin/MemberProfileTab';
import LoanTransferDialog from '@/components/admin/LoanTransferDialog';
import LoanReturnDialog from '@/components/admin/LoanReturnDialog';
import { getLoanById, type EquipmentLoan } from '@/services/loansService';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import MemberStatusBadge from '@/components/members/MemberStatusBadge';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';
import {
  getUserById,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  deleteUser,
} from '@/services/usersService';
import type { User, UserAttachment } from '@/types/user';
import {
  formatCpf,
  formatCurrency,
  formatDate,
  formatDateTime,
} from '@/lib/formatters';
import { transactionTypeLabels, loanStatusLabels, equipmentConditionLabels } from '@/lib/constants';

// ── Local Types ──────────────────────────────────────────────────────────────

interface VisitDetail {
  caliber?: string;
  shotsFired?: number;
}

interface VisitTransaction {
  id: string;
  type: string;
  items?: string;
  totalAmount: number;
}

interface Visit {
  id: string;
  visitDate: string;
  checkInTime: string;
  checkOutTime?: string | null;
  lane?: { id: string; number: number; name: string; status: string } | null;
  purpose?: string | null;
  details?: VisitDetail[];
  transactions?: VisitTransaction[];
}

interface Transaction {
  id: string;
  date: string;
  type: string;
  description?: string;
  amount: number;
  paymentMethod?: string;
}

interface Annuity {
  id: string;
  validUntil: string;
  status: string;
  paidAt?: string;
  amount?: number;
}

interface Loan {
  id: string;
  equipmentName: string;
  loanDate: string;
  expectedReturn: string;
  actualReturn?: string;
  status: string;
}

interface MemberFormData {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  cr: string;
  crLevel: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

// ── Component ────────────────────────────────────────────────────────────────

const MemberDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // ── Core State ───────────────────────────────────────────────────────────
  const [member, setMember] = useState<User | null>(null);
  const [attachments, setAttachments] = useState<UserAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('perfil');

  // ── Form State ───────────────────────────────────────────────────────────
  const [form, setForm] = useState<MemberFormData>({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    cr: '',
    crLevel: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });

  // ── Password Dialog State ────────────────────────────────────────────────
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  // ── Confirm Dialog State ─────────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: 'default' | 'destructive';
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    variant: 'default',
    onConfirm: () => {},
  });
  const [isActionLoading, setIsActionLoading] = useState(false);

  // ── Visits State ─────────────────────────────────────────────────────────
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);

  // ── Financial State ──────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [annuities, setAnnuities] = useState<Annuity[]>([]);
  const [financialLoading, setFinancialLoading] = useState(false);

  // ── Loans State ──────────────────────────────────────────────────────────
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loanTransferTarget, setLoanTransferTarget] = useState<EquipmentLoan | null>(null);
  const [loanReturnTarget, setLoanReturnTarget] = useState<EquipmentLoan | null>(null);

  // ── Fetch Member ─────────────────────────────────────────────────────────
  const fetchMember = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);

    const result = await getUserById(id);
    if (result.success && result.data) {
      const m = result.data;
      setMember(m);
      setForm({
        fullName: m.fullName || '',
        email: m.email || '',
        phone: m.phone || '',
        dateOfBirth: (m as any).dateOfBirth || '',
        cr: m.cr || '',
        crLevel: m.crLevel?.toString() || '',
        address: (m as any).address || '',
        city: (m as any).city || '',
        state: (m as any).state || '',
        zipCode: (m as any).zipCode || '',
      });
      setAttachments((m as any).attachments || []);
    } else {
      toast({
        title: 'Erro ao carregar associado',
        description: result.error,
        variant: 'destructive',
      });
      navigate('/admin/associados');
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  // ── Fetch Visits ─────────────────────────────────────────────────────────
  const fetchVisits = useCallback(async () => {
    if (!id) return;
    setVisitsLoading(true);
    try {
      const response = await api.get('/api/visits', {
        params: { memberId: id, limit: 20 },
      });
      if (response.data.success) {
        setVisits(response.data.data?.visits || response.data.data || []);
      }
    } catch {
      // Silently handle - empty state will show
    }
    setVisitsLoading(false);
  }, [id]);

  // ── Fetch Financial ──────────────────────────────────────────────────────
  const fetchFinancial = useCallback(async () => {
    if (!id) return;
    setFinancialLoading(true);
    try {
      const [txRes, annRes] = await Promise.all([
        api.get('/api/transactions', { params: { memberId: id, limit: 20 } }),
        api.get(`/api/annuities/member/${id}`),
      ]);
      if (txRes.data.success) {
        setTransactions(txRes.data.data?.transactions || txRes.data.data || []);
      }
      if (annRes.data.success) {
        setAnnuities(annRes.data.data?.annuities || annRes.data.data || []);
      }
    } catch {
      // Silently handle
    }
    setFinancialLoading(false);
  }, [id]);

  // ── Fetch Loans ──────────────────────────────────────────────────────────
  const fetchLoans = useCallback(async () => {
    if (!id) return;
    setLoansLoading(true);
    try {
      const response = await api.get('/api/loans', {
        params: { memberId: id, limit: 20 },
      });
      if (response.data.success) {
        setLoans(response.data.data?.loans || response.data.data || []);
      }
    } catch {
      // Silently handle
    }
    setLoansLoading(false);
  }, [id]);

  // ── Lazy-load tab data ───────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'visitas' && visits.length === 0 && !visitsLoading) {
      fetchVisits();
    }
    if (activeTab === 'financeiro' && transactions.length === 0 && annuities.length === 0 && !financialLoading) {
      fetchFinancial();
    }
    if (activeTab === 'emprestimos' && loans.length === 0 && !loansLoading) {
      fetchLoans();
    }
  }, [activeTab]);

  // ── Form Handlers ────────────────────────────────────────────────────────
  const handleFormChange = (field: keyof MemberFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!id || !member) return;
    setIsSaving(true);

    const result = await updateUser(id, {
      fullName: form.fullName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      cr: form.cr || undefined,
      crLevel: form.crLevel ? Number(form.crLevel) : undefined,
    });

    if (result.success && result.data) {
      setMember(result.data);
      toast({ title: 'Associado atualizado com sucesso' });
    } else {
      toast({
        title: 'Erro ao salvar alteracoes',
        description: result.error,
        variant: 'destructive',
      });
    }
    setIsSaving(false);
  };

  // ── Password Handler ─────────────────────────────────────────────────────
  const handlePasswordChange = async () => {
    if (!id) return;

    if (!newPassword || newPassword.length < 6) {
      toast({
        title: 'Senha invalida',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas nao conferem',
        description: 'A nova senha e a confirmacao devem ser iguais.',
        variant: 'destructive',
      });
      return;
    }

    setIsPasswordSaving(true);
    const result = await resetUserPassword(id, newPassword);

    if (result.success) {
      toast({ title: 'Senha alterada com sucesso' });
      setPasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } else {
      toast({
        title: 'Erro ao alterar senha',
        description: result.error,
        variant: 'destructive',
      });
    }
    setIsPasswordSaving(false);
  };

  // ── Status Toggle Handler ────────────────────────────────────────────────
  const handleToggleStatus = () => {
    if (!member || !id) return;
    const newStatus = member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const label = newStatus === 'ACTIVE' ? 'ativar' : 'desativar';

    setConfirmDialog({
      open: true,
      title: `${newStatus === 'ACTIVE' ? 'Ativar' : 'Desativar'} associado`,
      description: `Tem certeza que deseja ${label} o associado "${member.fullName}"?`,
      variant: 'default',
      confirmLabel: newStatus === 'ACTIVE' ? 'Ativar' : 'Desativar',
      onConfirm: async () => {
        setIsActionLoading(true);
        const result = await updateUserStatus(id, newStatus);
        setIsActionLoading(false);

        if (result.success) {
          toast({
            title: `Associado ${label === 'ativar' ? 'ativado' : 'desativado'} com sucesso`,
          });
          setConfirmDialog((prev) => ({ ...prev, open: false }));
          fetchMember();
        } else {
          toast({
            title: `Erro ao ${label} associado`,
            description: result.error,
            variant: 'destructive',
          });
        }
      },
    });
  };

  // ── Delete Handler ───────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!member || !id) return;

    setConfirmDialog({
      open: true,
      title: 'Excluir associado',
      description: `Tem certeza que deseja excluir permanentemente o associado "${member.fullName}"? Todos os dados vinculados serao perdidos. Esta acao nao pode ser desfeita.`,
      variant: 'destructive',
      confirmLabel: 'Excluir permanentemente',
      onConfirm: async () => {
        setIsActionLoading(true);
        const result = await deleteUser(id);
        setIsActionLoading(false);

        if (result.success) {
          toast({ title: 'Associado excluido com sucesso' });
          setConfirmDialog((prev) => ({ ...prev, open: false }));
          navigate('/admin/associados');
        } else {
          toast({
            title: 'Erro ao excluir associado',
            description: result.error,
            variant: 'destructive',
          });
        }
      },
    });
  };

  // ── Annuity helpers ──────────────────────────────────────────────────────
  const getAnnuityInfo = () => {
    const validUntil = member?.annuityValidUntil;
    if (!validUntil) return null;

    const until = new Date(validUntil);
    const now = new Date();
    const diffMs = until.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let color: string;
    let bgColor: string;
    let borderColor: string;
    if (daysRemaining <= 0) {
      color = 'text-red-400';
      bgColor = 'bg-red-900/30';
      borderColor = 'border-red-800';
    } else if (daysRemaining <= 30) {
      color = 'text-yellow-400';
      bgColor = 'bg-yellow-900/30';
      borderColor = 'border-yellow-800';
    } else {
      color = 'text-green-400';
      bgColor = 'bg-green-900/30';
      borderColor = 'border-green-800';
    }

    return { validUntil, daysRemaining, color, bgColor, borderColor };
  };

  // ── Loan status badge ────────────────────────────────────────────────────
  const getLoanStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge variant="outline" className="bg-orange-900/50 text-orange-400 border-orange-800 font-tactical text-xs">
            Em uso
          </Badge>
        );
      case 'RETURNED':
        return (
          <Badge variant="outline" className="bg-green-900/50 text-green-400 border-green-800 font-tactical text-xs">
            Devolvido
          </Badge>
        );
      case 'OVERDUE':
        return (
          <Badge variant="outline" className="bg-red-900/50 text-red-400 border-red-800 font-tactical text-xs">
            Atrasado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-800/50 text-gray-400 border-gray-700 font-tactical text-xs">
            {loanStatusLabels[status] || status}
          </Badge>
        );
    }
  };

  // ── Input class helper ───────────────────────────────────────────────────
  const inputClass =
    'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 focus:border-cbt-orange focus-visible:ring-cbt-orange/30';
  const labelClass = 'text-sm font-tactical text-gray-400 mb-1 block';
  const readOnlyInputClass =
    'bg-gray-800/50 border-gray-700 text-gray-400 cursor-not-allowed';

  // ── Loading State ────────────────────────────────────────────────────────
  if (isLoading) {
    return <LoadingSpinner message="Carregando dados do associado..." />;
  }

  if (!member) {
    return (
      <EmptyState
        title="Associado nao encontrado"
        description="O associado solicitado nao existe ou foi removido."
        action={
          <Button asChild className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical">
            <Link to="/admin/associados">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para associados
            </Link>
          </Button>
        }
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <PageHeader
        title={member.fullName}
        description={
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              {member.memberNumber ? `Associado #${member.memberNumber}` : 'Associado'}
            </span>
            <span className="text-gray-700">·</span>
            {(() => {
              if (!member.annuityValidUntil) {
                return (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-gray-700 bg-gray-800/60 text-gray-400 text-xs">
                    <Calendar className="h-3 w-3" />
                    Sem anuidade registrada
                  </span>
                );
              }
              const validUntil = new Date(member.annuityValidUntil);
              const days = Math.ceil(
                (validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );
              const expired = days < 0;
              const critical = !expired && days <= 30;
              const warn = !expired && !critical && days <= 60;
              const tone = expired
                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : critical
                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : warn
                ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
                : 'border-green-500/40 bg-green-500/10 text-green-300';
              const label = expired
                ? `Anuidade vencida em ${formatDate(member.annuityValidUntil)}`
                : days === 0
                ? `Anuidade vence hoje`
                : `Anuidade valida ate ${formatDate(member.annuityValidUntil)} (${days} dia${days === 1 ? '' : 's'})`;
              return (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs ${tone}`}
                >
                  <Calendar className="h-3 w-3" />
                  {label}
                </span>
              );
            })()}
          </div>
        }
        actions={
          <div className="flex items-center gap-3">
            <MemberStatusBadge status={member.status} />
            <Button
              variant="outline"
              asChild
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
            >
              <Link to="/admin/associados">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Link>
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-gray-900/70 border border-gray-800 p-1 mb-6">
          <TabsTrigger
            value="perfil"
            className="font-tactical data-[state=active]:bg-cbt-orange data-[state=active]:text-black text-gray-400"
          >
            <IdCard className="h-4 w-4 mr-2" />
            Perfil
          </TabsTrigger>
          <TabsTrigger
            value="dados"
            className="font-tactical data-[state=active]:bg-cbt-orange data-[state=active]:text-black text-gray-400"
          >
            <FileText className="h-4 w-4 mr-2" />
            Editar dados
          </TabsTrigger>
          <TabsTrigger
            value="visitas"
            className="font-tactical data-[state=active]:bg-cbt-orange data-[state=active]:text-black text-gray-400"
          >
            <Crosshair className="h-4 w-4 mr-2" />
            Visitas
          </TabsTrigger>
          <TabsTrigger
            value="emprestimos"
            className="font-tactical data-[state=active]:bg-cbt-orange data-[state=active]:text-black text-gray-400"
          >
            <Package className="h-4 w-4 mr-2" />
            Emprestimos
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════ TAB: PERFIL ══════════════════════ */}
        <TabsContent value="perfil">
          <MemberProfileTab
            memberId={member.id}
            fullName={member.fullName}
            memberNumber={member.memberNumber ?? null}
            cr={member.cr ?? null}
            crLevel={member.crLevel ?? null}
            membershipTier={(member as any).membershipTier ?? null}
            photoUrl={member.photoUrl ?? null}
            onGoToVisits={() => setActiveTab('visitas')}
          />
        </TabsContent>

        {/* ══════════════════════ TAB 1: DADOS ══════════════════════ */}
        <TabsContent value="dados">
          <div className="space-y-6">
            {/* Personal Info Form */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-military font-bold text-white mb-4 tracking-wide">
                Informacoes Pessoais
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Full Name */}
                <div className="lg:col-span-2">
                  <label className={labelClass}>Nome Completo</label>
                  <Input
                    value={form.fullName}
                    onChange={(e) => handleFormChange('fullName', e.target.value)}
                    className={inputClass}
                    placeholder="Nome completo"
                  />
                </div>

                {/* CPF - read only */}
                <div>
                  <label className={labelClass}>CPF</label>
                  <Input
                    value={formatCpf(member.cpf)}
                    readOnly
                    className={readOnlyInputClass}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className={labelClass}>Email</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    className={inputClass}
                    placeholder="email@exemplo.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className={labelClass}>Telefone</label>
                  <Input
                    value={form.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                    className={inputClass}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label className={labelClass}>Data de Nascimento</label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => handleFormChange('dateOfBirth', e.target.value)}
                    className={inputClass}
                  />
                </div>

                {/* Member Number - read only */}
                <div>
                  <label className={labelClass}>N. Associado</label>
                  <Input
                    value={member.memberNumber || '--'}
                    readOnly
                    className={readOnlyInputClass}
                  />
                </div>

                {/* Role */}
                <div>
                  <label className={labelClass}>Perfil</label>
                  <div className="flex items-center h-10">
                    <Badge
                      variant="outline"
                      className={
                        member.role === 'admin'
                          ? 'bg-cbt-orange/20 text-cbt-orange border-cbt-orange/50 font-tactical'
                          : 'bg-blue-900/30 text-blue-400 border-blue-800 font-tactical'
                      }
                    >
                      {member.role === 'admin' ? 'Administrador' : 'Associado'}
                    </Badge>
                  </div>
                </div>

                {/* CR */}
                <div>
                  <label className={labelClass}>CR (Certificado de Registro)</label>
                  <Input
                    value={form.cr}
                    onChange={(e) => handleFormChange('cr', e.target.value)}
                    className={inputClass}
                    placeholder="Numero do CR"
                  />
                </div>

                {/* CR Level */}
                <div>
                  <label className={labelClass}>Nivel do CR</label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={form.crLevel}
                    onChange={(e) => handleFormChange('crLevel', e.target.value)}
                    className={inputClass}
                    placeholder="1-5"
                  />
                </div>
              </div>

              {/* Address Section */}
              <h3 className="text-md font-military font-bold text-white mt-6 mb-3 tracking-wide">
                Endereco
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                  <label className={labelClass}>Endereco</label>
                  <Input
                    value={form.address}
                    onChange={(e) => handleFormChange('address', e.target.value)}
                    className={inputClass}
                    placeholder="Rua, numero, complemento"
                  />
                </div>
                <div>
                  <label className={labelClass}>Cidade</label>
                  <Input
                    value={form.city}
                    onChange={(e) => handleFormChange('city', e.target.value)}
                    className={inputClass}
                    placeholder="Cidade"
                  />
                </div>
                <div>
                  <label className={labelClass}>Estado</label>
                  <Input
                    value={form.state}
                    onChange={(e) => handleFormChange('state', e.target.value)}
                    className={inputClass}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className={labelClass}>CEP</label>
                  <Input
                    value={form.zipCode}
                    onChange={(e) => handleFormChange('zipCode', e.target.value)}
                    className={inputClass}
                    placeholder="00000-000"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical min-w-[180px]"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Alteracoes
                </Button>
              </div>
            </div>

            {/* Actions Section */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-military font-bold text-white mb-4 tracking-wide">
                Acoes
              </h2>
              <div className="flex flex-wrap gap-3">
                {/* Change Password */}
                <Button
                  variant="outline"
                  onClick={() => setPasswordDialogOpen(true)}
                  className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Alterar Senha
                </Button>

                {/* Toggle Status */}
                <Button
                  variant="outline"
                  onClick={handleToggleStatus}
                  className={
                    member.status === 'ACTIVE'
                      ? 'bg-gray-800 border-yellow-700 text-yellow-400 hover:bg-yellow-900/30 hover:text-yellow-300 font-tactical'
                      : 'bg-gray-800 border-green-700 text-green-400 hover:bg-green-900/30 hover:text-green-300 font-tactical'
                  }
                >
                  {member.status === 'ACTIVE' ? (
                    <>
                      <UserX className="h-4 w-4 mr-2" />
                      Desativar
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Ativar
                    </>
                  )}
                </Button>

                {/* Delete */}
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  className="bg-gray-800 border-red-800 text-red-400 hover:bg-red-900/30 hover:text-red-300 font-tactical"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Associado
                </Button>
              </div>
            </div>

            {/* Attachments Section */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-military font-bold text-white tracking-wide">
                  Anexos
                </h2>
                <div>
                  <input
                    type="file"
                    id="detail-file-upload"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const selectedFiles = Array.from(e.target.files || []);
                      for (const file of selectedFiles) {
                        if (file.size > 5 * 1024 * 1024) {
                          toast({ title: 'Arquivo muito grande', description: 'Maximo 5MB por arquivo', variant: 'destructive' });
                          continue;
                        }
                        const data = await new Promise<string>((resolve) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(reader.result as string);
                          reader.readAsDataURL(file);
                        });
                        try {
                          await api.post(`/api/users/${id}/attachments`, {
                            fileName: file.name,
                            fileUrl: data,
                            fileType: file.type,
                            fileSize: file.size,
                          });
                          toast({ title: 'Anexo enviado com sucesso' });
                        } catch {
                          toast({ title: 'Erro ao enviar anexo', description: file.name, variant: 'destructive' });
                        }
                      }
                      e.target.value = '';
                      fetchMember();
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('detail-file-upload')?.click()}
                    className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Adicionar Anexo
                  </Button>
                </div>
              </div>
              {attachments.length > 0 ? (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-transparent">
                        <TableHead className="text-gray-400 font-tactical">Arquivo</TableHead>
                        <TableHead className="text-gray-400 font-tactical">Tipo</TableHead>
                        <TableHead className="text-gray-400 font-tactical">Data de Upload</TableHead>
                        <TableHead className="text-gray-400 font-tactical text-right">Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attachments.map((att) => (
                        <TableRow key={att.id} className="border-gray-800 hover:bg-gray-800/50">
                          <TableCell className="text-white font-medium">{att.fileName}</TableCell>
                          <TableCell className="text-gray-300 text-sm">{att.fileType}</TableCell>
                          <TableCell className="text-gray-300 text-sm">
                            {formatDateTime(att.uploadedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(att.fileUrl, '_blank')}
                              className="text-gray-400 hover:text-white hover:bg-gray-700 font-tactical text-xs"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Visualizar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-6 px-4 text-gray-500 border border-dashed border-gray-700 rounded-lg">
                  <FileText className="h-5 w-5" />
                  <div>
                    <p className="text-gray-400 font-tactical text-sm">
                      Nenhum anexo cadastrado.
                    </p>
                    <p className="text-gray-500 font-tactical text-xs mt-1">
                      Clique em "Adicionar Anexo" para enviar documentos.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════ TAB 2: VISITAS ══════════════════════ */}
        <TabsContent value="visitas">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            {visitsLoading ? (
              <LoadingSpinner message="Carregando visitas..." />
            ) : visits.length === 0 ? (
              <EmptyState
                icon={<Crosshair className="w-8 h-8 text-gray-500" />}
                title="Nenhuma visita registrada"
                description="As visitas deste associado apareceriam aqui."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400 font-tactical w-8" />
                    <TableHead className="text-gray-400 font-tactical">Data</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Entrada</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Saida</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Baia</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Finalidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visits.map((visit) => {
                    const isExpanded = expandedVisit === visit.id;
                    const hasDetails =
                      (visit.details && visit.details.length > 0) ||
                      (visit.transactions && visit.transactions.length > 0);

                    return (
                      <Fragment key={visit.id}>
                        <TableRow
                          className={`border-gray-800 hover:bg-gray-800/50 ${
                            hasDetails ? 'cursor-pointer' : ''
                          }`}
                          onClick={() => {
                            if (hasDetails) {
                              setExpandedVisit(isExpanded ? null : visit.id);
                            }
                          }}
                        >
                          <TableCell className="w-8 text-center">
                            {hasDetails && (
                              isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              )
                            )}
                          </TableCell>
                          <TableCell className="text-white font-medium">
                            {formatDate(visit.visitDate)}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {visit.checkInTime ? formatDateTime(visit.checkInTime).split(' ')[1] : '--'}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {visit.checkOutTime ? (
                              formatDateTime(visit.checkOutTime).split(' ')[1]
                            ) : (
                              <Badge variant="outline" className="bg-green-900/50 text-green-400 border-green-800 font-tactical text-xs">
                                Em andamento
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {visit.lane?.name || '--'}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {visit.purpose || '--'}
                          </TableCell>
                        </TableRow>

                        {/* Expanded Details */}
                        {isExpanded && hasDetails && (
                          <TableRow key={`${visit.id}-details`} className="border-gray-800 bg-gray-800/30">
                            <TableCell colSpan={6} className="p-4">
                              <div className="space-y-4">
                                {/* Visit Details */}
                                {visit.details && visit.details.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-military font-bold text-gray-300 mb-2">
                                      Detalhes do Tiro
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      {visit.details.map((detail, idx) => (
                                        <div
                                          key={idx}
                                          className="bg-gray-900/50 border border-gray-700 rounded p-3"
                                        >
                                          <p className="text-xs text-gray-500 font-tactical">
                                            Calibre
                                          </p>
                                          <p className="text-sm text-white">
                                            {detail.caliber || '--'}
                                          </p>
                                          <p className="text-xs text-gray-500 font-tactical mt-1">
                                            Disparos
                                          </p>
                                          <p className="text-sm text-white">
                                            {detail.shotsFired ?? '--'}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Visit Transactions */}
                                {visit.transactions && visit.transactions.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-military font-bold text-gray-300 mb-2">
                                      Transacoes da Visita
                                    </h4>
                                    <div className="space-y-2">
                                      {visit.transactions.map((tx) => (
                                        <div
                                          key={tx.id}
                                          className="flex items-center justify-between bg-gray-900/50 border border-gray-700 rounded p-3"
                                        >
                                          <div>
                                            <Badge
                                              variant="outline"
                                              className="bg-gray-800 text-gray-300 border-gray-600 font-tactical text-xs mr-2"
                                            >
                                              {transactionTypeLabels[tx.type] || tx.type}
                                            </Badge>
                                            <span className="text-sm text-gray-300">
                                              {tx.items || '--'}
                                            </span>
                                          </div>
                                          <span className="text-sm font-medium text-cbt-orange">
                                            {formatCurrency(tx.totalAmount)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════════ TAB 3: FINANCEIRO ══════════════════════ */}
        <TabsContent value="financeiro">
          <div className="space-y-6">
            {/* Annuity Status Card */}
            {(() => {
              const info = getAnnuityInfo();
              if (!info) return null;

              return (
                <div
                  className={`${info.bgColor} border ${info.borderColor} rounded-lg p-5`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className={`h-5 w-5 ${info.color}`} />
                    <h3 className={`font-military font-bold ${info.color}`}>
                      Anuidade
                    </h3>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div>
                      <p className="text-sm text-gray-400 font-tactical">
                        Valida ate
                      </p>
                      <p className={`text-lg font-bold ${info.color}`}>
                        {formatDate(info.validUntil)}
                      </p>
                    </div>
                    <div className="sm:border-l sm:border-gray-700 sm:pl-4">
                      <p className="text-sm text-gray-400 font-tactical">
                        Dias restantes
                      </p>
                      <p className={`text-lg font-bold ${info.color}`}>
                        {info.daysRemaining > 0 ? info.daysRemaining : (
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />
                            Vencida
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Annuity History */}
            {annuities.length > 0 && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-military font-bold text-white mb-4 tracking-wide">
                  Historico de Anuidades
                </h2>
                <div className="space-y-2">
                  {annuities.map((ann) => (
                    <div
                      key={ann.id}
                      className="flex items-center justify-between bg-gray-800/50 border border-gray-700 rounded p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={
                            ann.status === 'PAID'
                              ? 'bg-green-900/50 text-green-400 border-green-800 font-tactical text-xs'
                              : ann.status === 'PENDING'
                              ? 'bg-yellow-900/50 text-yellow-400 border-yellow-800 font-tactical text-xs'
                              : 'bg-gray-800/50 text-gray-400 border-gray-700 font-tactical text-xs'
                          }
                        >
                          {ann.status === 'PAID' ? 'Pago' : ann.status === 'PENDING' ? 'Pendente' : ann.status}
                        </Badge>
                        <span className="text-sm text-gray-300">
                          Valido ate {formatDate(ann.validUntil)}
                        </span>
                      </div>
                      {ann.amount != null && (
                        <span className="text-sm font-medium text-cbt-orange">
                          {formatCurrency(ann.amount)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transactions Table */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
              <div className="px-6 pt-5 pb-3">
                <h2 className="text-lg font-military font-bold text-white tracking-wide">
                  Transacoes
                </h2>
              </div>
              {financialLoading ? (
                <LoadingSpinner message="Carregando dados financeiros..." />
              ) : transactions.length === 0 ? (
                <EmptyState
                  icon={<DollarSign className="w-8 h-8 text-gray-500" />}
                  title="Nenhuma transacao registrada"
                  description="As transacoes deste associado apareceriam aqui."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800 hover:bg-transparent">
                      <TableHead className="text-gray-400 font-tactical">Data</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Tipo</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Descricao</TableHead>
                      <TableHead className="text-gray-400 font-tactical text-right">Valor</TableHead>
                      <TableHead className="text-gray-400 font-tactical">Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id} className="border-gray-800 hover:bg-gray-800/50">
                        <TableCell className="text-white font-medium">
                          {formatDate(tx.date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="bg-gray-800 text-gray-300 border-gray-600 font-tactical text-xs"
                          >
                            {transactionTypeLabels[tx.type] || tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {tx.description || '--'}
                        </TableCell>
                        <TableCell className="text-right text-cbt-orange font-medium">
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {tx.paymentMethod || '--'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════ TAB 4: EMPRESTIMOS ══════════════════════ */}
        <TabsContent value="emprestimos">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            {loansLoading ? (
              <LoadingSpinner message="Carregando emprestimos..." />
            ) : loans.length === 0 ? (
              <EmptyState
                icon={<Package className="w-8 h-8 text-gray-500" />}
                title="Nenhum emprestimo registrado"
                description="Os emprestimos de equipamentos deste associado apareceriam aqui."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400 font-tactical">Equipamento</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Data Emprestimo</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Devolucao Prevista</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Devolucao Real</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Status</TableHead>
                    <TableHead className="text-gray-400 font-tactical text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan) => (
                    <TableRow key={loan.id} className="border-gray-800 hover:bg-gray-800/50">
                      <TableCell className="text-white font-medium">
                        {loan.equipmentName}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {formatDate(loan.loanDate)}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {formatDate(loan.expectedReturn)}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {loan.actualReturn ? formatDate(loan.actualReturn) : '--'}
                      </TableCell>
                      <TableCell>{getLoanStatusBadge(loan.status)}</TableCell>
                      <TableCell className="text-right">
                        {loan.status === 'ACTIVE' && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-blue-300 hover:bg-gray-700"
                              title="Transferir"
                              onClick={async () => {
                                const res = await getLoanById(loan.id);
                                if (res.success && res.data) setLoanTransferTarget(res.data);
                              }}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-red-300 hover:bg-gray-700"
                              title="Devolver"
                              onClick={async () => {
                                const res = await getLoanById(loan.id);
                                if (res.success && res.data) setLoanReturnTarget(res.data);
                              }}
                            >
                              <Receipt className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════ LOAN TRANSFER / RETURN ══════════════════════ */}
      <LoanTransferDialog
        open={!!loanTransferTarget}
        onOpenChange={(o) => !o && setLoanTransferTarget(null)}
        activeLoan={loanTransferTarget}
        onTransferred={() => {
          setLoanTransferTarget(null);
          fetchLoans();
        }}
      />
      <LoanReturnDialog
        open={!!loanReturnTarget}
        onOpenChange={(o) => !o && setLoanReturnTarget(null)}
        activeLoan={loanReturnTarget}
        onReturned={() => {
          setLoanReturnTarget(null);
          fetchLoans();
        }}
      />

      {/* ══════════════════════ PASSWORD DIALOG ══════════════════════ */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white font-military">
              Alterar Senha
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-tactical">
              Defina uma nova senha para o associado {member.fullName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass}>Nova Senha</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="Minimo 6 caracteres"
              />
            </div>
            <div>
              <label className={labelClass}>Confirmar Senha</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Repita a nova senha"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPasswordDialogOpen(false);
                setNewPassword('');
                setConfirmPassword('');
              }}
              disabled={isPasswordSaving}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePasswordChange}
              disabled={isPasswordSaving}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical min-w-[120px]"
            >
              {isPasswordSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Alterar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════ CONFIRM DIALOG ══════════════════════ */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        isLoading={isActionLoading}
      />
    </div>
  );
};

export default MemberDetailPage;
