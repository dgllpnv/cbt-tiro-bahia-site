import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  CalendarCheck,
  DollarSign,
  AlertTriangle,
  Package,
  Clock,
  Plus,
  Newspaper,
  ShoppingCart,
  Warehouse,
  Wrench,
  ArrowRight,
  Activity,
  type LucideIcon,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PresentMembersPanel from '@/components/admin/PresentMembersPanel';
import RankingsPanel from '@/components/admin/RankingsPanel';
import TopFirearmsPanel from '@/components/admin/TopFirearmsPanel';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/formatters';
import { getAdminDashboard, type AdminDashboard } from '@/services/dashboardService';

// ── Defaults ───────────────────────────────────────────────────────────────

const defaultStats: AdminDashboard = {
  activeMembers: 0,
  todayVisits: 0,
  monthRevenue: 0,
  lowStockCount: 0,
  activeLoans: 0,
  expiringAnnuities: 0,
};

// ── StatCard ───────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string;
  bgColor: string;
  borderColor: string;
}

const StatCard = ({ icon: Icon, label, value, color, bgColor, borderColor }: StatCardProps) => (
  <div className={`relative overflow-hidden bg-card/50 border ${borderColor} rounded-lg p-5 group hover:border-opacity-80 transition-all duration-300`}>
    <div className="absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 rounded-full opacity-5 group-hover:opacity-10 transition-opacity" style={{ background: color }} />
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <p className="text-xs font-tactical uppercase tracking-wider text-muted-foreground/80">{label}</p>
        <p className="text-2xl font-military font-bold text-foreground tracking-wide">{value}</p>
      </div>
      <div className={`p-2.5 rounded-lg ${bgColor}`}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
    </div>
    <div className={`absolute bottom-0 left-0 h-0.5 w-full opacity-40`} style={{ background: `linear-gradient(to right, ${color}, transparent)` }} />
  </div>
);

// ── Quick Action ───────────────────────────────────────────────────────────

interface QuickActionProps {
  icon: LucideIcon;
  label: string;
  description: string;
  to: string;
}

const QuickAction = ({ icon: Icon, label, description, to }: QuickActionProps) => (
  <Link
    to={to}
    className="group flex items-center gap-4 bg-card/50 border border-border rounded-lg p-4 hover:border-cbt-orange/40 hover:bg-muted/50 transition-all duration-300"
  >
    <div className="p-2.5 rounded-lg bg-cbt-orange/10 group-hover:bg-cbt-orange/20 transition-colors">
      <Icon className="h-5 w-5 text-cbt-orange" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-foreground font-military text-sm tracking-wide">{label}</p>
      <p className="text-muted-foreground/80 font-tactical text-xs mt-0.5">{description}</p>
    </div>
    <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-cbt-orange group-hover:translate-x-1 transition-all" />
  </Link>
);

// ── Page ───────────────────────────────────────────────────────────────────

const AdminDashboardPage = () => {
  const { toast } = useToast();
  const { isCashier } = useAuth();
  const [stats, setStats] = useState<AdminDashboard>(defaultStats);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    const dashRes = await getAdminDashboard();

    if (dashRes.success && dashRes.data) {
      setStats(dashRes.data);
    } else {
      setStats(defaultStats);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dashboard',
        description: dashRes.error || 'Nao foi possivel obter as metricas.',
      });
    }

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Visao geral do clube" />
        <LoadingSpinner message="Carregando painel..." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visao geral do clube"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
              <Activity className="h-3 w-3 text-green-700 dark:text-green-400 animate-pulse" />
              <span className="text-xs font-tactical text-green-700 dark:text-green-400">Sistema Operacional</span>
            </div>
          </div>
        }
      />

      {/* ── Presentes no Clube (foco do front-desk) ─────────────────────── */}
      <div className="mb-6">
        <PresentMembersPanel />
      </div>

      {/* ── Rankings (frequência + maestria) ───────────────────────────── */}
      <div className="mb-6">
        <RankingsPanel />
      </div>

      {/* ── Armas mais usadas (clube todo) ─────────────────────────────── */}
      <div className="mb-8">
        <TopFirearmsPanel />
      </div>

      {/* ── KPI Stats Row 1 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <StatCard
          icon={Users}
          label="Membros Ativos"
          value={stats.activeMembers}
          color="#3b82f6"
          bgColor="bg-blue-500/10"
          borderColor="border-blue-500/20"
        />
        <StatCard
          icon={CalendarCheck}
          label="Visitas Hoje"
          value={stats.todayVisits}
          color="#8b5cf6"
          bgColor="bg-violet-500/10"
          borderColor="border-violet-500/20"
        />
        {/* Receita do Mes: oculta para o caixa (nao deve ver receita) */}
        {!isCashier && (
          <StatCard
            icon={DollarSign}
            label="Receita do Mes"
            value={formatCurrency(stats.monthRevenue)}
            color="#22c55e"
            bgColor="bg-green-500/10"
            borderColor="border-green-500/20"
          />
        )}
      </div>

      {/* ── KPI Stats Row 2 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={AlertTriangle}
          label="Estoque Baixo"
          value={stats.lowStockCount}
          color="#eab308"
          bgColor="bg-yellow-500/10"
          borderColor="border-yellow-500/20"
        />
        <StatCard
          icon={Package}
          label="Emprestimos Ativos"
          value={stats.activeLoans}
          color="#f97316"
          bgColor="bg-orange-500/10"
          borderColor="border-orange-500/20"
        />
        <StatCard
          icon={Clock}
          label="Anuidades Vencendo"
          value={stats.expiringAnnuities}
          color="#ef4444"
          bgColor="bg-red-500/10"
          borderColor="border-red-500/20"
        />
      </div>

      {/* ── Acoes Rapidas ───────────────────────────────────────────────── */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-military font-bold text-foreground tracking-wide">Acoes Rapidas</h2>
          <p className="text-xs font-tactical text-muted-foreground/80 mt-0.5">Atalhos para operacoes frequentes</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickAction
            icon={ShoppingCart}
            label="Novo Lancamento"
            description="Registrar venda, visita ou emprestimo"
            to="/admin/lancamentos"
          />
          <QuickAction
            icon={Plus}
            label="Novo Associado"
            description="Cadastrar membro no sistema"
            to="/admin/associados/novo"
          />
          <QuickAction
            icon={Newspaper}
            label="Gerenciar Noticias"
            description="Publicar e editar noticias"
            to="/admin/noticias"
          />
          <QuickAction
            icon={Warehouse}
            label="Controle de Estoque"
            description="Gerenciar produtos e inventario"
            to="/admin/estoque"
          />
        </div>
      </div>

      {/* ── Decorative Footer ───────────────────────────────────────────── */}
      <div className="mt-8 flex items-center gap-3 px-4 py-3 bg-card/30 border border-border/50 rounded-lg">
        <Wrench className="h-4 w-4 text-muted-foreground/60" />
        <p className="text-xs font-tactical text-muted-foreground/60">
          CBT Admin v1.0 &mdash; Clube de Tiro da Bahia &mdash; Painel Administrativo
        </p>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
