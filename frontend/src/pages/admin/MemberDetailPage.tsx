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
  FileDown,
  DollarSign,
  Crosshair,
  Package,
  Calendar,
  AlertTriangle,
  Upload,
  Download,
  X,
  IdCard,
  ArrowRight,
  Receipt,
} from 'lucide-react';
import MemberProfileTab from '@/components/admin/MemberProfileTab';
import LoanTransferDialog from '@/components/admin/LoanTransferDialog';
import LoanReturnDialog from '@/components/admin/LoanReturnDialog';
import MemberFaceProfilesSection from '@/components/admin/MemberFaceProfilesSection';
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
import { getClubSettings } from '@/services/clubSettingsService';
import { getMemberStats } from '@/services/memberStatsService';
import { exportMemberFullReportPdf } from '@/lib/reports/pdfMemberFullReport';
import type { User, UserAttachment } from '@/types/user';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from '@/lib/formatters';
import { formatCpfMask, isValidCpf, stripCpf } from '@/lib/cpf';
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
  cpf: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  cr: string;
  crLevel: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  rg: string;
  rgIssuer: string;
  nationality: string;
  naturality: string;
  fatherName: string;
  motherName: string;
  profession: string;
  maritalStatus: string;
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
  // cpfError: validacao client-side do CPF (DV + 11 digitos). Bloqueia
  // o submit. Backend ainda valida e devolve 409 em conflito de unicidade.
  const [cpfError, setCpfError] = useState('');
  const [form, setForm] = useState<MemberFormData>({
    fullName: '',
    cpf: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    cr: '',
    crLevel: '',
    address: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
    rg: '',
    rgIssuer: '',
    nationality: '',
    naturality: '',
    fatherName: '',
    motherName: '',
    profession: '',
    maritalStatus: '',
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

  // ── Export State ─────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);

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
        cpf: formatCpfMask(m.cpf || ''),
        email: m.email || '',
        phone: m.phone || '',
        dateOfBirth: (m as any).dateOfBirth || '',
        cr: m.cr || '',
        crLevel: m.crLevel?.toString() || '',
        address: (m as any).address || '',
        neighborhood: (m as any).neighborhood || '',
        city: (m as any).city || '',
        state: (m as any).state || '',
        zipCode: (m as any).zipCode || '',
        rg: (m as any).rg || '',
        rgIssuer: (m as any).rgIssuer || '',
        nationality: (m as any).nationality || '',
        naturality: (m as any).naturality || '',
        fatherName: (m as any).fatherName || '',
        motherName: (m as any).motherName || '',
        profession: (m as any).profession || '',
        maritalStatus: (m as any).maritalStatus || '',
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

    // Valida CPF: so envia se foi alterado. Bloqueia se inseriu invalido.
    // member.cpf vem do banco sem mascara (11 digitos puros); form.cpf
    // vem com mascara progressiva do input. Normaliza ambos pra comparar.
    const cpfDigits = stripCpf(form.cpf);
    const cpfChanged = cpfDigits !== stripCpf(member.cpf || '');
    if (cpfChanged) {
      if (cpfDigits.length !== 11 || !isValidCpf(cpfDigits)) {
        setCpfError('CPF invalido. Confira os digitos.');
        toast({
          title: 'CPF invalido',
          description: 'Corrija o CPF antes de salvar.',
          variant: 'destructive',
        });
        return;
      }
    }
    setCpfError('');
    setIsSaving(true);

    const result = await updateUser(id, {
      fullName: form.fullName || undefined,
      cpf: cpfChanged ? cpfDigits : undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      cr: form.cr || undefined,
      crLevel: form.crLevel ? Number(form.crLevel) : undefined,
      address: form.address || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
      state: form.state || null,
      zipCode: form.zipCode || null,
      rg: form.rg || null,
      rgIssuer: form.rgIssuer || null,
      nationality: form.nationality || null,
      naturality: form.naturality || null,
      fatherName: form.fatherName || null,
      motherName: form.motherName || null,
      profession: form.profession || null,
      maritalStatus: form.maritalStatus || null,
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

  // ── Export Handler ───────────────────────────────────────────────────────
  // Reune todos os dados do associado (busca em paralelo as secoes ainda
  // nao carregadas pelas tabs lazy) e gera o PDF na identidade visual do CBT.
  const handleExportData = async () => {
    if (!id || !member || isExporting) return;
    setIsExporting(true);
    try {
      const [clubRes, statsRes, visitsRes, txRes, annRes, loansRes] = await Promise.all([
        getClubSettings(),
        getMemberStats(id),
        api.get('/api/visits', { params: { memberId: id, limit: 50 } }).catch(() => null),
        api.get('/api/transactions', { params: { memberId: id, limit: 50 } }).catch(() => null),
        api.get(`/api/annuities/member/${id}`).catch(() => null),
        api.get('/api/loans', { params: { memberId: id, limit: 50 } }).catch(() => null),
      ]);

      const pickList = (res: any): any[] => {
        if (!res?.data?.success) return [];
        const d = res.data.data;
        if (Array.isArray(d)) return d;
        return d?.visits || d?.transactions || d?.annuities || d?.loans || [];
      };

      await exportMemberFullReportPdf({
        member: {
          id: member.id,
          fullName: member.fullName,
          email: member.email ?? null,
          cpf: member.cpf,
          role: member.role,
          status: member.status,
          memberNumber: member.memberNumber ?? null,
          memberSince: (member as any).memberSince ?? null,
          dateOfBirth: (member as any).dateOfBirth ?? null,
          phone: member.phone ?? null,
          address: (member as any).address ?? null,
          neighborhood: (member as any).neighborhood ?? null,
          city: (member as any).city ?? null,
          state: (member as any).state ?? null,
          zipCode: (member as any).zipCode ?? null,
          rg: (member as any).rg ?? null,
          rgIssuer: (member as any).rgIssuer ?? null,
          nationality: (member as any).nationality ?? null,
          naturality: (member as any).naturality ?? null,
          fatherName: (member as any).fatherName ?? null,
          motherName: (member as any).motherName ?? null,
          profession: (member as any).profession ?? null,
          maritalStatus: (member as any).maritalStatus ?? null,
          cr: member.cr ?? null,
          crLevel: member.crLevel ?? null,
          crExpiry: (member as any).crExpiry ?? null,
          membershipTier: (member as any).membershipTier ?? null,
          annuityValidUntil: member.annuityValidUntil ?? null,
        },
        facePhoto: member.faceProfiles?.[0]?.thumbnail ?? null,
        club: clubRes.success ? clubRes.data : null,
        stats: statsRes.success ? statsRes.data : null,
        visits: pickList(visitsRes),
        transactions: pickList(txRes),
        annuities: pickList(annRes),
        loans: pickList(loansRes),
        attachments,
      });

      toast({ title: 'PDF gerado com sucesso' });
    } catch (err: any) {
      toast({
        title: 'Erro ao exportar dados',
        description: err?.message || 'Falha inesperada ao gerar o PDF.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
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
      color = 'text-red-700 dark:text-red-400';
      bgColor = 'bg-red-900/30';
      borderColor = 'border-red-800';
    } else if (daysRemaining <= 30) {
      color = 'text-yellow-700 dark:text-yellow-400';
      bgColor = 'bg-yellow-900/30';
      borderColor = 'border-yellow-800';
    } else {
      color = 'text-green-700 dark:text-green-400';
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
          <Badge variant="outline" className="bg-orange-900/50 text-orange-700 dark:text-orange-400 border-orange-800 font-tactical text-xs">
            Em uso
          </Badge>
        );
      case 'RETURNED':
        return (
          <Badge variant="outline" className="bg-green-900/50 text-green-700 dark:text-green-400 border-green-800 font-tactical text-xs">
            Devolvido
          </Badge>
        );
      case 'OVERDUE':
        return (
          <Badge variant="outline" className="bg-red-900/50 text-red-700 dark:text-red-400 border-red-800 font-tactical text-xs">
            Atrasado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border font-tactical text-xs">
            {loanStatusLabels[status] || status}
          </Badge>
        );
    }
  };

  // ── Input class helper ───────────────────────────────────────────────────
  const inputClass =
    'bg-muted border-input text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange focus-visible:ring-cbt-orange/30';
  const labelClass = 'text-sm font-tactical text-muted-foreground mb-1 block';
  const readOnlyInputClass =
    'bg-muted/50 border-border text-muted-foreground cursor-not-allowed';

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
          <Button asChild className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical">
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
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border bg-muted/60 text-muted-foreground text-xs">
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
                ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
                : critical
                ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
                : warn
                ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'
                : 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300';
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
              onClick={handleExportData}
              disabled={isExporting}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
              title="Gera PDF com todos os dados cadastrais e historicos do associado"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Exportar Dados
            </Button>
            <Button
              variant="outline"
              asChild
              className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
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
        <TabsList className="bg-card/70 border border-border p-1 mb-6">
          <TabsTrigger
            value="perfil"
            className="font-tactical data-[state=active]:bg-cbt-orange data-[state=active]:text-primary-foreground text-muted-foreground"
          >
            <IdCard className="h-4 w-4 mr-2" />
            Perfil
          </TabsTrigger>
          <TabsTrigger
            value="dados"
            className="font-tactical data-[state=active]:bg-cbt-orange data-[state=active]:text-primary-foreground text-muted-foreground"
          >
            <FileText className="h-4 w-4 mr-2" />
            Editar dados
          </TabsTrigger>
          <TabsTrigger
            value="visitas"
            className="font-tactical data-[state=active]:bg-cbt-orange data-[state=active]:text-primary-foreground text-muted-foreground"
          >
            <Crosshair className="h-4 w-4 mr-2" />
            Visitas
          </TabsTrigger>
          <TabsTrigger
            value="emprestimos"
            className="font-tactical data-[state=active]:bg-cbt-orange data-[state=active]:text-primary-foreground text-muted-foreground"
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
            facePhoto={member.faceProfiles?.[0]?.thumbnail ?? null}
            onGoToVisits={() => setActiveTab('visitas')}
          />
        </TabsContent>

        {/* ══════════════════════ TAB 1: DADOS ══════════════════════ */}
        <TabsContent value="dados">
          <div className="space-y-6">
            {/* Personal Info Form */}
            <div className="bg-card/50 border border-border rounded-lg p-6">
              <h2 className="text-lg font-military font-bold text-foreground mb-4 tracking-wide">
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

                {/* CPF — editavel (mascara progressiva + validacao DV).
                    Backend trata conflito de unicidade com HTTP 409. */}
                <div>
                  <label className={labelClass}>CPF</label>
                  <Input
                    value={form.cpf}
                    onChange={(e) => {
                      handleFormChange('cpf', formatCpfMask(e.target.value));
                      if (cpfError) setCpfError('');
                    }}
                    onBlur={() => {
                      const digits = stripCpf(form.cpf);
                      if (digits.length === 0) {
                        setCpfError('');
                        return;
                      }
                      if (digits.length < 11) {
                        setCpfError('CPF incompleto.');
                        return;
                      }
                      if (!isValidCpf(digits)) {
                        setCpfError('CPF invalido. Confira os digitos.');
                        return;
                      }
                      setCpfError('');
                    }}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                    aria-invalid={!!cpfError}
                    className={`${inputClass} ${cpfError ? 'border-red-700/60 focus:border-red-700' : ''}`}
                  />
                  {cpfError && (
                    <p className="mt-1 text-xs font-tactical text-red-500">{cpfError}</p>
                  )}
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
                          : 'bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-800 font-tactical'
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
              <h3 className="text-md font-military font-bold text-foreground mt-6 mb-3 tracking-wide">
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
                <div className="lg:col-span-2">
                  <label className={labelClass}>Bairro</label>
                  <Input
                    value={form.neighborhood}
                    onChange={(e) => handleFormChange('neighborhood', e.target.value)}
                    className={inputClass}
                    placeholder="Bairro"
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

              {/* Dados Civis (Declaracoes) */}
              <h3 className="text-md font-military font-bold text-foreground mt-6 mb-1 tracking-wide">
                Dados Civis
              </h3>
              <p className="text-xs text-muted-foreground font-tactical mb-3">
                Usados nas declaracoes oficiais (DGA, DSA, DIC, FILIACAO, etc.).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass}>RG (Identidade)</label>
                  <Input value={form.rg} onChange={(e) => handleFormChange('rg', e.target.value)} className={inputClass} placeholder="Numero" />
                </div>
                <div>
                  <label className={labelClass}>Orgao Emissor</label>
                  <Input value={form.rgIssuer} onChange={(e) => handleFormChange('rgIssuer', e.target.value)} className={inputClass} placeholder="SSP/BA" />
                </div>
                <div>
                  <label className={labelClass}>Nacionalidade</label>
                  <Input value={form.nationality} onChange={(e) => handleFormChange('nationality', e.target.value)} className={inputClass} placeholder="BRASILEIRA" />
                </div>
                <div>
                  <label className={labelClass}>Naturalidade</label>
                  <Input value={form.naturality} onChange={(e) => handleFormChange('naturality', e.target.value)} className={inputClass} placeholder="Cidade natal" />
                </div>
                <div className="lg:col-span-2">
                  <label className={labelClass}>Nome do Pai</label>
                  <Input value={form.fatherName} onChange={(e) => handleFormChange('fatherName', e.target.value)} className={inputClass} placeholder="Nome completo" />
                </div>
                <div className="lg:col-span-2">
                  <label className={labelClass}>Nome da Mae</label>
                  <Input value={form.motherName} onChange={(e) => handleFormChange('motherName', e.target.value)} className={inputClass} placeholder="Nome completo" />
                </div>
                <div>
                  <label className={labelClass}>Profissao</label>
                  <Input value={form.profession} onChange={(e) => handleFormChange('profession', e.target.value)} className={inputClass} placeholder="Ex: Empresario" />
                </div>
                <div>
                  <label className={labelClass}>Estado Civil</label>
                  <select
                    value={form.maritalStatus}
                    onChange={(e) => handleFormChange('maritalStatus', e.target.value)}
                    className="w-full rounded-md bg-muted border border-input text-foreground px-3 py-2 text-sm focus:outline-none focus:border-cbt-orange focus:ring-1 focus:ring-cbt-orange/20"
                  >
                    <option value="">Selecione</option>
                    <option value="SOLTEIRO">Solteiro(a)</option>
                    <option value="CASADO">Casado(a)</option>
                    <option value="DIVORCIADO">Divorciado(a)</option>
                    <option value="VIUVO">Viuvo(a)</option>
                    <option value="UNIAO_ESTAVEL">Uniao estavel</option>
                  </select>
                </div>
              </div>

              {/* Save Button */}
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical min-w-[180px]"
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

            {/* Identidade Facial */}
            <MemberFaceProfilesSection memberId={member.id} memberName={member.fullName} />

            {/* Attachments Section */}
            <div className="bg-card/50 border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-military font-bold text-foreground tracking-wide">
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
                    className="bg-muted border-input text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Adicionar Anexo
                  </Button>
                </div>
              </div>
              {attachments.length > 0 ? (
                <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground font-tactical">Arquivo</TableHead>
                        <TableHead className="text-muted-foreground font-tactical">Tipo</TableHead>
                        <TableHead className="text-muted-foreground font-tactical">Data de Upload</TableHead>
                        <TableHead className="text-muted-foreground font-tactical text-right">Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attachments.map((att) => (
                        <TableRow key={att.id} className="border-border hover:bg-muted/50">
                          <TableCell className="text-foreground font-medium">{att.fileName}</TableCell>
                          <TableCell className="text-foreground/85 text-sm">{att.fileType}</TableCell>
                          <TableCell className="text-foreground/85 text-sm">
                            {formatDateTime(att.uploadedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Baixa o arquivo via data URL — cria um link
                                  // temporário para forcar download com o nome original.
                                  const link = document.createElement('a');
                                  link.href = att.fileUrl;
                                  link.download = att.fileName;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                                className="text-muted-foreground hover:text-cbt-orange hover:bg-secondary font-tactical text-xs"
                                title="Baixar"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Baixar
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setConfirmDialog({
                                    open: true,
                                    title: 'Excluir anexo',
                                    description: `Tem certeza que deseja excluir o anexo "${att.fileName}"? Esta acao nao pode ser desfeita.`,
                                    variant: 'destructive',
                                    confirmLabel: 'Excluir',
                                    onConfirm: async () => {
                                      setIsActionLoading(true);
                                      try {
                                        await api.delete(`/api/users/${id}/attachments/${att.id}`);
                                        toast({ title: 'Anexo excluido com sucesso' });
                                        setConfirmDialog((p) => ({ ...p, open: false }));
                                        fetchMember();
                                      } catch {
                                        toast({
                                          title: 'Erro ao excluir anexo',
                                          variant: 'destructive',
                                        });
                                      }
                                      setIsActionLoading(false);
                                    },
                                  });
                                }}
                                className="h-8 w-8 text-muted-foreground hover:text-red-700 dark:hover:text-red-400 hover:bg-secondary"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-6 px-4 text-muted-foreground/80 border border-dashed border-border rounded-lg">
                  <FileText className="h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground font-tactical text-sm">
                      Nenhum anexo cadastrado.
                    </p>
                    <p className="text-muted-foreground/80 font-tactical text-xs mt-1">
                      Clique em "Adicionar Anexo" para enviar documentos.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Section */}
            <div className="bg-card/50 border border-border rounded-lg p-6">
              <h2 className="text-lg font-military font-bold text-foreground mb-4 tracking-wide">
                Acoes
              </h2>
              <div className="flex flex-wrap gap-3">
                {/* Change Password */}
                <Button
                  variant="outline"
                  onClick={() => setPasswordDialogOpen(true)}
                  className="bg-muted border-input text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
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
                      ? 'bg-muted border-yellow-700 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-900/30 hover:text-yellow-700 dark:text-yellow-300 font-tactical'
                      : 'bg-muted border-green-700 text-green-700 dark:text-green-400 hover:bg-green-900/30 hover:text-green-700 dark:text-green-300 font-tactical'
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
                  className="bg-muted border-red-800 text-red-700 dark:text-red-400 hover:bg-red-900/30 hover:text-red-700 dark:text-red-300 font-tactical"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Associado
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════ TAB 2: VISITAS ══════════════════════ */}
        <TabsContent value="visitas">
          <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
            {visitsLoading ? (
              <LoadingSpinner message="Carregando visitas..." />
            ) : visits.length === 0 ? (
              <EmptyState
                icon={<Crosshair className="w-8 h-8 text-muted-foreground/80" />}
                title="Nenhuma visita registrada"
                description="As visitas deste associado apareceriam aqui."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-tactical w-8" />
                    <TableHead className="text-muted-foreground font-tactical">Data</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Entrada</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Saida</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Baia</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Finalidade</TableHead>
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
                          className={`border-border hover:bg-muted/50 ${
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
                                <ChevronUp className="h-4 w-4 text-muted-foreground/80" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground/80" />
                              )
                            )}
                          </TableCell>
                          <TableCell className="text-foreground font-medium">
                            {formatDate(visit.visitDate)}
                          </TableCell>
                          <TableCell className="text-foreground/85">
                            {visit.checkInTime ? formatDateTime(visit.checkInTime).split(' ')[1] : '--'}
                          </TableCell>
                          <TableCell className="text-foreground/85">
                            {visit.checkOutTime ? (
                              formatDateTime(visit.checkOutTime).split(' ')[1]
                            ) : (
                              <Badge variant="outline" className="bg-green-900/50 text-green-700 dark:text-green-400 border-green-800 font-tactical text-xs">
                                Em andamento
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-foreground/85">
                            {visit.lane?.name || '--'}
                          </TableCell>
                          <TableCell className="text-foreground/85">
                            {visit.purpose || '--'}
                          </TableCell>
                        </TableRow>

                        {/* Expanded Details */}
                        {isExpanded && hasDetails && (
                          <TableRow key={`${visit.id}-details`} className="border-border bg-muted/30">
                            <TableCell colSpan={6} className="p-4">
                              <div className="space-y-4">
                                {/* Visit Details */}
                                {visit.details && visit.details.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-military font-bold text-foreground/85 mb-2">
                                      Detalhes do Tiro
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      {visit.details.map((detail, idx) => (
                                        <div
                                          key={idx}
                                          className="bg-card/50 border border-border rounded p-3"
                                        >
                                          <p className="text-xs text-muted-foreground/80 font-tactical">
                                            Calibre
                                          </p>
                                          <p className="text-sm text-foreground">
                                            {detail.caliber || '--'}
                                          </p>
                                          <p className="text-xs text-muted-foreground/80 font-tactical mt-1">
                                            Disparos
                                          </p>
                                          <p className="text-sm text-foreground">
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
                                    <h4 className="text-sm font-military font-bold text-foreground/85 mb-2">
                                      Transacoes da Visita
                                    </h4>
                                    <div className="space-y-2">
                                      {visit.transactions.map((tx) => (
                                        <div
                                          key={tx.id}
                                          className="flex items-center justify-between bg-card/50 border border-border rounded p-3"
                                        >
                                          <div>
                                            <Badge
                                              variant="outline"
                                              className="bg-muted text-foreground/85 border-input font-tactical text-xs mr-2"
                                            >
                                              {transactionTypeLabels[tx.type] || tx.type}
                                            </Badge>
                                            <span className="text-sm text-foreground/85">
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
                      <p className="text-sm text-muted-foreground font-tactical">
                        Valida ate
                      </p>
                      <p className={`text-lg font-bold ${info.color}`}>
                        {formatDate(info.validUntil)}
                      </p>
                    </div>
                    <div className="sm:border-l sm:border-border sm:pl-4">
                      <p className="text-sm text-muted-foreground font-tactical">
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
              <div className="bg-card/50 border border-border rounded-lg p-6">
                <h2 className="text-lg font-military font-bold text-foreground mb-4 tracking-wide">
                  Historico de Anuidades
                </h2>
                <div className="space-y-2">
                  {annuities.map((ann) => (
                    <div
                      key={ann.id}
                      className="flex items-center justify-between bg-muted/50 border border-border rounded p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={
                            ann.status === 'PAID'
                              ? 'bg-green-900/50 text-green-700 dark:text-green-400 border-green-800 font-tactical text-xs'
                              : ann.status === 'PENDING'
                              ? 'bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 border-yellow-800 font-tactical text-xs'
                              : 'bg-muted/50 text-muted-foreground border-border font-tactical text-xs'
                          }
                        >
                          {ann.status === 'PAID' ? 'Pago' : ann.status === 'PENDING' ? 'Pendente' : ann.status}
                        </Badge>
                        <span className="text-sm text-foreground/85">
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
            <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
              <div className="px-6 pt-5 pb-3">
                <h2 className="text-lg font-military font-bold text-foreground tracking-wide">
                  Transacoes
                </h2>
              </div>
              {financialLoading ? (
                <LoadingSpinner message="Carregando dados financeiros..." />
              ) : transactions.length === 0 ? (
                <EmptyState
                  icon={<DollarSign className="w-8 h-8 text-muted-foreground/80" />}
                  title="Nenhuma transacao registrada"
                  description="As transacoes deste associado apareceriam aqui."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground font-tactical">Data</TableHead>
                      <TableHead className="text-muted-foreground font-tactical">Tipo</TableHead>
                      <TableHead className="text-muted-foreground font-tactical">Descricao</TableHead>
                      <TableHead className="text-muted-foreground font-tactical text-right">Valor</TableHead>
                      <TableHead className="text-muted-foreground font-tactical">Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id} className="border-border hover:bg-muted/50">
                        <TableCell className="text-foreground font-medium">
                          {formatDate(tx.date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="bg-muted text-foreground/85 border-input font-tactical text-xs"
                          >
                            {transactionTypeLabels[tx.type] || tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-foreground/85 text-sm">
                          {tx.description || '--'}
                        </TableCell>
                        <TableCell className="text-right text-cbt-orange font-medium">
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-foreground/85 text-sm">
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
          <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
            {loansLoading ? (
              <LoadingSpinner message="Carregando emprestimos..." />
            ) : loans.length === 0 ? (
              <EmptyState
                icon={<Package className="w-8 h-8 text-muted-foreground/80" />}
                title="Nenhum emprestimo registrado"
                description="Os emprestimos de equipamentos deste associado apareceriam aqui."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-tactical">Equipamento</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Data Emprestimo</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Devolucao Prevista</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Devolucao Real</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Status</TableHead>
                    <TableHead className="text-muted-foreground font-tactical text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan) => (
                    <TableRow key={loan.id} className="border-border hover:bg-muted/50">
                      <TableCell className="text-foreground font-medium">
                        {loan.equipmentName}
                      </TableCell>
                      <TableCell className="text-foreground/85">
                        {formatDate(loan.loanDate)}
                      </TableCell>
                      <TableCell className="text-foreground/85">
                        {formatDate(loan.expectedReturn)}
                      </TableCell>
                      <TableCell className="text-foreground/85">
                        {loan.actualReturn ? formatDate(loan.actualReturn) : '--'}
                      </TableCell>
                      <TableCell>{getLoanStatusBadge(loan.status)}</TableCell>
                      <TableCell className="text-right">
                        {loan.status === 'ACTIVE' && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-blue-700 dark:text-blue-300 hover:bg-secondary"
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
                              className="h-8 w-8 text-muted-foreground hover:text-red-700 dark:text-red-300 hover:bg-secondary"
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
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground font-military">
              Alterar Senha
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-tactical">
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
              className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePasswordChange}
              disabled={isPasswordSaving}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical min-w-[120px]"
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
