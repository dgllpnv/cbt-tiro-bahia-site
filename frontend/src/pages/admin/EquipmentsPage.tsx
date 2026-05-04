import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  Pencil,
  Plus,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Headphones,
  Box,
  Package,
  Eye as EyeIcon,
  ArrowRight,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Activity,
  type LucideIcon,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import SearchInput from '@/components/shared/SearchInput';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

import { useToast } from '@/hooks/use-toast';
import {
  listEquipment,
  getEquipmentDashboard,
  deleteEquipment,
  type Equipment,
  type EquipmentDashboard,
} from '@/services/equipmentService';
import { listLoans } from '@/services/loansService';
import type { EquipmentLoan } from '@/services/loansService';
import { equipmentTypeLabels, equipmentConditionLabels } from '@/lib/constants';
import LoanTransferDialog from '@/components/admin/LoanTransferDialog';
import LoanReturnDialog from '@/components/admin/LoanReturnDialog';

const ITEMS_PER_PAGE = 20;

function iconForType(type: string): LucideIcon {
  switch (type) {
    case 'FIREARM':
      return Crosshair;
    case 'EAR_PROTECTION':
      return Headphones;
    case 'EYE_PROTECTION':
      return EyeIcon;
    case 'MAGAZINE':
      return Box;
    case 'HOLSTER':
    default:
      return Package;
  }
}

const KpiCard = ({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
  borderColor,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string;
  bgColor: string;
  borderColor: string;
}) => (
  <div
    className={`relative overflow-hidden bg-gray-900/50 border ${borderColor} rounded-lg p-4 hover:border-opacity-80 transition-all`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-1 min-w-0">
        <p className="text-xs font-tactical uppercase tracking-wider text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-military font-bold text-white tracking-wide">{value}</p>
      </div>
      <div className={`p-2 rounded-lg ${bgColor} flex-shrink-0`}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
    </div>
  </div>
);

const EquipmentsPage = () => {
  const { toast } = useToast();

  const [items, setItems] = useState<Equipment[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 0 });
  const [dashboard, setDashboard] = useState<EquipmentDashboard | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'free' | 'inUse'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [activeLoanByEquip, setActiveLoanByEquip] = useState<Record<string, EquipmentLoan>>({});

  const [transferLoan, setTransferLoan] = useState<EquipmentLoan | null>(null);
  const [returnLoan, setReturnLoan] = useState<EquipmentLoan | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    const res = await getEquipmentDashboard();
    if (res.success && res.data) setDashboard(res.data);
  }, []);

  const fetchEquipment = useCallback(async () => {
    setIsLoading(true);
    const params: any = {
      page,
      limit: ITEMS_PER_PAGE,
      includeActiveLoans: 'true',
      isActive: 'true',
    };
    if (search.trim()) params.search = search.trim();
    if (typeFilter) params.equipmentType = typeFilter;
    if (conditionFilter) params.condition = conditionFilter;
    if (availabilityFilter === 'free') params.isAvailable = 'true';
    if (availabilityFilter === 'inUse') params.isAvailable = 'false';

    const result = await listEquipment(params);
    if (result.success && result.data) {
      setItems(result.data);
      setPagination(result.pagination || pagination);

      // Para cada equipamento em uso, busca loan ativo (ja vem em loans[0])
      const map: Record<string, EquipmentLoan> = {};
      const idsWithoutInline: string[] = [];
      for (const eq of result.data) {
        const inline = eq.loans?.[0];
        if (inline) {
          // Os campos minimos que precisamos para abrir os dialogs
          map[eq.id] = {
            id: inline.id,
            equipmentId: eq.id,
            memberId: inline.member.id,
            issuedById: '',
            returnedById: null,
            loanDate: '',
            expectedReturn: null,
            actualReturn: null,
            status: 'ACTIVE',
            conditionAtLoan: eq.condition,
            conditionAtReturn: null,
            notes: null,
            equipment: {
              id: eq.id,
              name: eq.name,
              serialNumber: eq.serialNumber,
              equipmentType: eq.equipmentType,
            },
            member: inline.member,
            issuedBy: { id: '', fullName: '' },
          };
        } else if (!eq.isAvailable) {
          // Não tem inline mas equipment esta em uso — busca via API
          idsWithoutInline.push(eq.id);
        }
      }
      // Hidrata os que faltam (raro)
      if (idsWithoutInline.length) {
        const loansRes = await listLoans({ status: 'ACTIVE', limit: 50 });
        if (loansRes.success && loansRes.data) {
          for (const loan of loansRes.data) {
            if (idsWithoutInline.includes(loan.equipmentId)) {
              map[loan.equipmentId] = loan;
            }
          }
        }
      }
      setActiveLoanByEquip(map);
    } else {
      toast({
        title: 'Erro ao carregar equipamentos',
        description: result.error,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [page, search, typeFilter, conditionFilter, availabilityFilter, toast]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, conditionFilter, availabilityFilter]);

  const refreshAll = () => {
    fetchEquipment();
    fetchDashboard();
  };

  const handleDelete = (eq: Equipment) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir equipamento',
      description: `Tem certeza que deseja excluir "${eq.name}"? O equipamento sera desativado (soft delete).`,
      onConfirm: async () => {
        setIsActionLoading(true);
        const res = await deleteEquipment(eq.id);
        setIsActionLoading(false);
        if (res.success) {
          toast({ title: 'Equipamento desativado' });
          setConfirmDialog((prev) => ({ ...prev, open: false }));
          refreshAll();
        } else {
          toast({
            title: 'Erro ao excluir',
            description: res.error,
            variant: 'destructive',
          });
        }
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Equipamentos"
        description="Cadastro, empréstimos e movimentações de equipamentos do clube"
        actions={
          <Button asChild className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical">
            <Link to="/admin/equipamentos/novo">
              <Plus className="h-4 w-4 mr-2" />
              Novo Equipamento
            </Link>
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <KpiCard
          icon={Package}
          label="Total"
          value={dashboard?.totals.totalEquipment ?? '—'}
          color="#3b82f6"
          bgColor="bg-blue-500/10"
          borderColor="border-blue-500/20"
        />
        <KpiCard
          icon={Activity}
          label="Em uso"
          value={dashboard?.totals.inUse ?? '—'}
          color="#f97316"
          bgColor="bg-orange-500/10"
          borderColor="border-orange-500/20"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Disponíveis"
          value={dashboard?.totals.available ?? '—'}
          color="#22c55e"
          bgColor="bg-green-500/10"
          borderColor="border-green-500/20"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Atrasados"
          value={dashboard?.totals.overdueLoans ?? '—'}
          color="#ef4444"
          bgColor="bg-red-500/10"
          borderColor="border-red-500/20"
        />
        <KpiCard
          icon={Wrench}
          label="Em reparo"
          value={dashboard?.totals.needsRepair ?? '—'}
          color="#eab308"
          bgColor="bg-yellow-500/10"
          borderColor="border-yellow-500/20"
        />
      </div>

      {/* Filtros */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nome, marca, série..."
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-md bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-cbt-orange font-tactical"
          >
            <option value="">Todos os tipos</option>
            {Object.entries(equipmentTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="w-full rounded-md bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-cbt-orange font-tactical"
          >
            <option value="">Todas as condições</option>
            {Object.entries(equipmentConditionLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 mt-3">
          {(['all', 'free', 'inUse'] as const).map((opt) => {
            const labels = { all: 'Todos', free: 'Disponíveis', inUse: 'Em uso' };
            const isActive = availabilityFilter === opt;
            return (
              <button
                key={opt}
                onClick={() => setAvailabilityFilter(opt)}
                className={`px-3 py-1.5 rounded-md text-xs font-tactical transition-colors ${
                  isActive
                    ? 'bg-cbt-orange/20 border border-cbt-orange/40 text-cbt-orange'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                {labels[opt]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Carregando equipamentos..." />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Package className="w-8 h-8 text-gray-500" />}
            title="Nenhum equipamento encontrado"
            description={
              search || typeFilter || conditionFilter || availabilityFilter !== 'all'
                ? 'Ajuste os filtros para ver mais resultados.'
                : 'Cadastre o primeiro equipamento.'
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400 font-tactical w-12"></TableHead>
                    <TableHead className="text-gray-400 font-tactical">Nome</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Tipo</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Série</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Condição</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Em poder de</TableHead>
                    <TableHead className="text-gray-400 font-tactical text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((eq) => {
                    const Icon = iconForType(eq.equipmentType);
                    const activeLoan = activeLoanByEquip[eq.id];
                    const holder = activeLoan?.member;
                    return (
                      <TableRow key={eq.id} className="border-gray-800 hover:bg-gray-800/50">
                        <TableCell>
                          <div className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                            <Icon className="h-4 w-4 text-cbt-orange" />
                          </div>
                        </TableCell>
                        <TableCell className="text-white font-medium">
                          {eq.name}
                          {eq.caliber && (
                            <span className="text-gray-500 font-tactical text-xs ml-2">
                              ({eq.caliber})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {equipmentTypeLabels[eq.equipmentType] || eq.equipmentType}
                        </TableCell>
                        <TableCell className="text-gray-300 font-mono text-xs">
                          {eq.serialNumber || '—'}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {equipmentConditionLabels[eq.condition] || eq.condition}
                        </TableCell>
                        <TableCell>
                          {holder ? (
                            <Link
                              to={
                                holder.role === 'VISITOR'
                                  ? `/admin/visitantes/${holder.id}`
                                  : `/admin/associados/${holder.id}`
                              }
                              className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 font-tactical text-sm"
                            >
                              {holder.fullName}
                              {holder.role === 'VISITOR' && (
                                <span className="px-1 py-0.5 rounded text-[10px] bg-blue-500/20 border border-blue-500/30">
                                  V
                                </span>
                              )}
                            </Link>
                          ) : eq.isAvailable ? (
                            <span className="inline-flex items-center gap-1 text-green-400 font-tactical text-xs">
                              <CheckCircle2 className="h-3 w-3" />
                              Disponível
                            </span>
                          ) : (
                            <span className="text-gray-500 font-tactical text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {activeLoan && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gray-400 hover:text-blue-300 hover:bg-gray-700"
                                  title="Transferir"
                                  onClick={() => setTransferLoan(activeLoan)}
                                >
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gray-400 hover:text-red-300 hover:bg-gray-700"
                                  title="Devolver"
                                  onClick={() => setReturnLoan(activeLoan)}
                                >
                                  <Receipt className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"
                              title="Detalhes"
                            >
                              <Link to={`/admin/equipamentos/${eq.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              className="h-8 w-8 text-gray-400 hover:text-cbt-orange hover:bg-gray-700"
                              title="Editar"
                            >
                              <Link to={`/admin/equipamentos/${eq.id}`}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                <p className="text-sm text-gray-400 font-tactical">
                  Mostrando {(page - 1) * ITEMS_PER_PAGE + 1} a{' '}
                  {Math.min(page * ITEMS_PER_PAGE, pagination.total)} de {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-sm text-gray-400 font-tactical px-2">
                    {page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <LoanTransferDialog
        open={!!transferLoan}
        onOpenChange={(o) => !o && setTransferLoan(null)}
        activeLoan={transferLoan}
        onTransferred={refreshAll}
      />

      <LoanReturnDialog
        open={!!returnLoan}
        onOpenChange={(o) => !o && setReturnLoan(null)}
        activeLoan={returnLoan}
        onReturned={refreshAll}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant="destructive"
        onConfirm={confirmDialog.onConfirm}
        isLoading={isActionLoading}
      />
    </div>
  );
};

export default EquipmentsPage;
