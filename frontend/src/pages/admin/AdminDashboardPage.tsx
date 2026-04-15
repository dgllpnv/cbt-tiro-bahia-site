import { useState, useEffect } from 'react';
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
  Crosshair,
  Wrench,
  ArrowRight,
  Activity,
  type LucideIcon,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import api from '@/services/api';

// ── Types ──────────────────────────────────────────────────────────────────

interface DashboardStats {
  activeMembers: number;
  todayVisits: number;
  monthRevenue: number;
  lowStockItems: number;
  activeLoans: number;
  expiringAnnuities: number;
}

interface Lane {
  id: string;
  name: string;
  status: 'available' | 'occupied' | 'maintenance';
  currentUser?: string;
}

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
  <div className={`relative overflow-hidden bg-gray-900/50 border ${borderColor} rounded-lg p-5 group hover:border-opacity-80 transition-all duration-300`}>
    <div className="absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 rounded-full opacity-5 group-hover:opacity-10 transition-opacity" style={{ background: color }} />
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <p className="text-xs font-tactical uppercase tracking-wider text-gray-500">{label}</p>
        <p className="text-2xl font-military font-bold text-white tracking-wide">{value}</p>
      </div>
      <div className={`p-2.5 rounded-lg ${bgColor}`}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
    </div>
    <div className={`absolute bottom-0 left-0 h-0.5 w-full opacity-40`} style={{ background: `linear-gradient(to right, ${color}, transparent)` }} />
  </div>
);

// ── Lane Card ──────────────────────────────────────────────────────────────

const laneStatusConfig = {
  available: { label: 'Disponivel', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', dot: 'bg-green-400' },
  occupied: { label: 'Ocupada', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-400' },
  maintenance: { label: 'Manutencao', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-400' },
};

const LaneCard = ({ lane }: { lane: Lane }) => {
  const config = laneStatusConfig[lane.status] || laneStatusConfig.available;
  return (
    <div className={`${config.bg} border ${config.border} rounded-lg p-4 transition-all duration-200 hover:scale-[1.02]`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Crosshair className={`h-4 w-4 ${config.color}`} />
          <span className="text-white font-military text-sm tracking-wide">{lane.name}</span>
        </div>
        <span className={`h-2.5 w-2.5 rounded-full ${config.dot} animate-pulse`} />
      </div>
      <p className={`text-xs font-tactical ${config.color}`}>{config.label}</p>
      {lane.currentUser && (
        <p className="text-xs text-gray-500 font-tactical mt-1 truncate">{lane.currentUser}</p>
      )}
    </div>
  );
};

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
    className="group flex items-center gap-4 bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-cbt-orange/40 hover:bg-gray-800/50 transition-all duration-300"
  >
    <div className="p-2.5 rounded-lg bg-cbt-orange/10 group-hover:bg-cbt-orange/20 transition-colors">
      <Icon className="h-5 w-5 text-cbt-orange" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-white font-military text-sm tracking-wide">{label}</p>
      <p className="text-gray-500 font-tactical text-xs mt-0.5">{description}</p>
    </div>
    <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-cbt-orange group-hover:translate-x-1 transition-all" />
  </Link>
);

// ── Mock Data ──────────────────────────────────────────────────────────────

const mockLanes: Lane[] = [
  { id: '1', name: 'Baia 01', status: 'occupied', currentUser: 'Joao Silva' },
  { id: '2', name: 'Baia 02', status: 'available' },
  { id: '3', name: 'Baia 03', status: 'occupied', currentUser: 'Maria Santos' },
  { id: '4', name: 'Baia 04', status: 'maintenance' },
  { id: '5', name: 'Baia 05', status: 'available' },
  { id: '6', name: 'Baia 06', status: 'occupied', currentUser: 'Carlos Oliveira' },
];

const defaultStats: DashboardStats = {
  activeMembers: 0,
  todayVisits: 0,
  monthRevenue: 0,
  lowStockItems: 0,
  activeLoans: 0,
  expiringAnnuities: 0,
};

// ── Page ───────────────────────────────────────────────────────────────────

const AdminDashboardPage = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [lanes, setLanes] = useState<Lane[]>(mockLanes);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      setIsLoading(true);
      try {
        const [dashRes, lanesRes] = await Promise.allSettled([
          api.get('/api/dashboard/admin'),
          api.get('/api/lanes'),
        ]);

        if (dashRes.status === 'fulfilled' && dashRes.value.data?.data) {
          setStats(dashRes.value.data.data);
        }

        if (lanesRes.status === 'fulfilled' && lanesRes.value.data?.data) {
          // Normalizar status para lowercase
          const normalizedLanes = lanesRes.value.data.data.map((l: any) => ({
            ...l,
            name: l.name || `Baia ${String(l.number).padStart(2, '0')}`,
            status: (l.status || 'available').toLowerCase(),
            currentUser: l.currentMember?.fullName,
          }));
          setLanes(normalizedLanes);
        }
      } catch {
        // Usa dados mock em caso de falha
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, []);

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
              <Activity className="h-3 w-3 text-green-400 animate-pulse" />
              <span className="text-xs font-tactical text-green-400">Sistema Operacional</span>
            </div>
          </div>
        }
      />

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
        <StatCard
          icon={DollarSign}
          label="Receita do Mes"
          value={formatCurrency(stats.monthRevenue)}
          color="#22c55e"
          bgColor="bg-green-500/10"
          borderColor="border-green-500/20"
        />
      </div>

      {/* ── KPI Stats Row 2 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={AlertTriangle}
          label="Estoque Baixo"
          value={stats.lowStockItems}
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

      {/* ── Painel de Baias ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-military font-bold text-white tracking-wide">Painel de Baias</h2>
            <p className="text-xs font-tactical text-gray-500 mt-0.5">Status em tempo real das baias de tiro</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-xs font-tactical text-gray-500">Livre</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span className="text-xs font-tactical text-gray-500">Ocupada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              <span className="text-xs font-tactical text-gray-500">Manutencao</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {lanes.map((lane) => (
            <LaneCard key={lane.id} lane={lane} />
          ))}
        </div>
      </div>

      {/* ── Acoes Rapidas ───────────────────────────────────────────────── */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-military font-bold text-white tracking-wide">Acoes Rapidas</h2>
          <p className="text-xs font-tactical text-gray-500 mt-0.5">Atalhos para operacoes frequentes</p>
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
      <div className="mt-8 flex items-center gap-3 px-4 py-3 bg-gray-900/30 border border-gray-800/50 rounded-lg">
        <Wrench className="h-4 w-4 text-gray-600" />
        <p className="text-xs font-tactical text-gray-600">
          CBT Admin v1.0 &mdash; Clube de Tiro da Bahia &mdash; Painel Administrativo
        </p>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
