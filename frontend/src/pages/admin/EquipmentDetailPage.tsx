import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  ArrowRight,
  Receipt,
  Activity,
  CheckCircle2,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  getEquipmentById,
  getEquipmentHistory,
  updateEquipment,
  deleteEquipment,
  type Equipment,
  type CreateEquipmentData,
} from '@/services/equipmentService';
import type { EquipmentLoan } from '@/services/loansService';
import EquipmentForm from '@/components/admin/EquipmentForm';
import LoanTransferDialog from '@/components/admin/LoanTransferDialog';
import LoanReturnDialog from '@/components/admin/LoanReturnDialog';
import { equipmentTypeLabels, equipmentConditionLabels, loanStatusLabels } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/formatters';

const EquipmentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'movimentacoes'>('dados');
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [transferLoan, setTransferLoan] = useState<EquipmentLoan | null>(null);
  const [returnLoan, setReturnLoan] = useState<EquipmentLoan | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchEquipment = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const result = await getEquipmentById(id);
    if (result.success && result.data) {
      setEquipment(result.data);
    } else {
      toast({
        title: 'Erro ao carregar equipamento',
        description: result.error,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [id, toast]);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  const fetchHistory = useCallback(async () => {
    if (!id) return;
    const result = await getEquipmentHistory(id);
    if (result.success && result.data) {
      setHistory(result.data.loans);
    }
    setHistoryLoaded(true);
  }, [id]);

  useEffect(() => {
    if (activeTab === 'movimentacoes' && !historyLoaded) {
      fetchHistory();
    }
  }, [activeTab, historyLoaded, fetchHistory]);

  const handleSaveEdit = async (data: CreateEquipmentData) => {
    if (!equipment) return;
    setIsSaving(true);
    const result = await updateEquipment(equipment.id, data);
    setIsSaving(false);
    if (result.success && result.data) {
      toast({ title: 'Equipamento atualizado' });
      setEditOpen(false);
      setEquipment(result.data);
    } else {
      toast({
        title: 'Erro ao atualizar',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = () => {
    if (!equipment) return;
    setConfirmDialog({
      open: true,
      title: 'Desativar equipamento',
      description: `Tem certeza que deseja desativar "${equipment.name}"? O equipamento ficará indisponível para empréstimo.`,
      onConfirm: async () => {
        setIsActionLoading(true);
        const res = await deleteEquipment(equipment.id);
        setIsActionLoading(false);
        if (res.success) {
          toast({ title: 'Equipamento desativado' });
          setConfirmDialog((prev) => ({ ...prev, open: false }));
          navigate('/admin/equipamentos');
        } else {
          toast({
            title: 'Erro',
            description: res.error,
            variant: 'destructive',
          });
        }
      },
    });
  };

  const refreshHistory = () => {
    setHistoryLoaded(false);
    fetchEquipment();
  };

  if (isLoading || !equipment) {
    return (
      <div className="py-12">
        <LoadingSpinner message="Carregando equipamento..." />
      </div>
    );
  }

  const statusBadge = equipment.isAvailable ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-tactical bg-green-500/15 border border-green-500/30 text-green-700 dark:text-green-300">
      <CheckCircle2 className="h-3 w-3" />
      Disponível
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-tactical bg-orange-500/15 border border-orange-500/30 text-orange-700 dark:text-orange-300">
      <Activity className="h-3 w-3" />
      Em uso
    </span>
  );

  return (
    <div>
      <PageHeader
        title={equipment.name}
        description={
          <span className="flex items-center gap-2 flex-wrap">
            {statusBadge}
            <span>{equipmentTypeLabels[equipment.equipmentType] || equipment.equipmentType}</span>
            {equipment.serialNumber && (
              <>
                <span>·</span>
                <span className="font-mono">Nº {equipment.serialNumber}</span>
              </>
            )}
            {equipment.caliber && (
              <>
                <span>·</span>
                <span>{equipment.caliber}</span>
              </>
            )}
          </span>
        }
        actions={
          <Button
            asChild
            variant="outline"
            className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
          >
            <Link to="/admin/equipamentos">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger
            value="dados"
            className="data-[state=active]:bg-cbt-orange data-[state=active]:text-foreground"
          >
            Dados
          </TabsTrigger>
          <TabsTrigger
            value="movimentacoes"
            className="data-[state=active]:bg-cbt-orange data-[state=active]:text-foreground"
          >
            Movimentações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-6">
          <div className="bg-card/50 border border-border rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-tactical">
              <div>
                <p className="text-muted-foreground/80">Tipo</p>
                <p className="text-foreground">{equipmentTypeLabels[equipment.equipmentType] || equipment.equipmentType}</p>
              </div>
              <div>
                <p className="text-muted-foreground/80">Condição</p>
                <p className="text-foreground">{equipmentConditionLabels[equipment.condition] || equipment.condition}</p>
              </div>
              <div>
                <p className="text-muted-foreground/80">Calibre</p>
                <p className="text-foreground">{equipment.caliber || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground/80">Marca / Modelo</p>
                <p className="text-foreground">
                  {[equipment.brand, equipment.model].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground/80">Número de Série</p>
                <p className="text-foreground font-mono">{equipment.serialNumber || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground/80">Registro</p>
                <p className="text-foreground font-mono">{equipment.registrationId || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground/80">Data de Aquisição</p>
                <p className="text-foreground">{equipment.acquisitionDate ? formatDate(equipment.acquisitionDate) : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground/80">Status</p>
                <p>{statusBadge}</p>
              </div>
            </div>
            {equipment.description && (
              <div className="pt-3 border-t border-border">
                <p className="text-muted-foreground/80 text-xs uppercase tracking-wider mb-1">Descrição</p>
                <p className="text-foreground text-sm whitespace-pre-wrap">{equipment.description}</p>
              </div>
            )}
            {equipment.notes && (
              <div className="pt-3 border-t border-border">
                <p className="text-muted-foreground/80 text-xs uppercase tracking-wider mb-1">Observações Internas</p>
                <p className="text-foreground text-sm whitespace-pre-wrap">{equipment.notes}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-6">
            <Button
              variant="outline"
              onClick={handleDelete}
              className="bg-muted border-red-900/50 text-red-700 dark:text-red-400 hover:bg-red-900/30 hover:text-red-700 dark:text-red-300 font-tactical"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Desativar Equipamento
            </Button>
            <Button
              onClick={() => setEditOpen(true)}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar Dados
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="movimentacoes" className="mt-6">
          <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
            {!historyLoaded ? (
              <LoadingSpinner message="Carregando movimentações..." />
            ) : history.length === 0 ? (
              <EmptyState
                title="Nenhuma movimentação"
                description="Empréstimos, transferências e devoluções aparecerão aqui."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-tactical">Membro</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Status</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Início</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Fim</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Condição</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Origem</TableHead>
                    <TableHead className="text-muted-foreground font-tactical text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((loan) => {
                    const isActive = loan.status === 'ACTIVE';
                    const statusColor =
                      loan.status === 'ACTIVE'
                        ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30'
                        : loan.status === 'TRANSFERRED'
                          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                          : loan.status === 'RETURNED'
                            ? 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30'
                            : loan.status === 'OVERDUE'
                              ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
                              : 'bg-secondary/50 text-foreground/85 border-input/30';
                    return (
                      <TableRow key={loan.id} className="border-border hover:bg-muted/50">
                        <TableCell>
                          <Link
                            to={
                              loan.member?.role === 'VISITOR'
                                ? `/admin/visitantes/${loan.member.id}`
                                : `/admin/associados/${loan.member.id}`
                            }
                            className="text-foreground hover:text-cbt-orange font-tactical text-sm"
                          >
                            {loan.member?.fullName || '—'}
                          </Link>
                          {loan.member?.role === 'VISITOR' && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 border border-blue-500/30 text-blue-700 dark:text-blue-300">
                              Visitante
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-tactical border ${statusColor}`}
                          >
                            {loanStatusLabels[loan.status] || loan.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-foreground/85 font-mono text-xs">
                          {formatDateTime(loan.loanDate)}
                        </TableCell>
                        <TableCell className="text-foreground/85 font-mono text-xs">
                          {loan.actualReturn ? formatDateTime(loan.actualReturn) : (
                            <span className="text-amber-700 dark:text-amber-400">Em aberto</span>
                          )}
                        </TableCell>
                        <TableCell className="text-foreground/85 text-xs">
                          {equipmentConditionLabels[loan.conditionAtLoan] || loan.conditionAtLoan || '—'}
                          {loan.conditionAtReturn && (
                            <>
                              <span className="text-muted-foreground/80"> → </span>
                              {equipmentConditionLabels[loan.conditionAtReturn] || loan.conditionAtReturn}
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {loan.transferredFrom ? (
                            <span className="text-blue-700 dark:text-blue-300">
                              ← {loan.transferredFrom.member?.fullName || '—'}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {isActive && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-blue-700 dark:text-blue-300 hover:bg-secondary"
                                title="Transferir"
                                onClick={() => setTransferLoan(loan)}
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-700 dark:text-red-300 hover:bg-secondary"
                                title="Devolver"
                                onClick={() => setReturnLoan(loan)}
                              >
                                <Receipt className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground font-military tracking-wide flex items-center gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Editar Equipamento
            </DialogTitle>
          </DialogHeader>
          <EquipmentForm
            initialData={equipment}
            onSubmit={handleSaveEdit}
            onCancel={() => setEditOpen(false)}
            submitLabel="Salvar Alterações"
            isSubmitting={isSaving}
          />
        </DialogContent>
      </Dialog>

      <LoanTransferDialog
        open={!!transferLoan}
        onOpenChange={(o) => !o && setTransferLoan(null)}
        activeLoan={transferLoan}
        onTransferred={refreshHistory}
      />

      <LoanReturnDialog
        open={!!returnLoan}
        onOpenChange={(o) => !o && setReturnLoan(null)}
        activeLoan={returnLoan}
        onReturned={refreshHistory}
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

export default EquipmentDetailPage;
