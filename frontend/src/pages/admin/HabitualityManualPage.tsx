import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Target } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import MemberSearch from '@/components/shared/MemberSearch';
import EmptyState from '@/components/shared/EmptyState';
import NewHabitualityDialog from '@/components/admin/NewHabitualityDialog';
import EditHabitualityDialog from '@/components/admin/EditHabitualityDialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { formatCalendarDate } from '@/lib/dateOnly';
import { ammunitionTypeLabels } from '@/lib/constants';
import {
  getAllMemberHabituality,
  type ActivityType,
  type HabitualityRecord,
} from '@/services/habitualityService';

// =====================================================
// HabitualityManualPage — Livro de habitualidade do socio
//
// Fluxo simplificado: busca o associado (qualquer um, independente de
// anuidade em dia) -> mostra TODO o historico de habitualidade lancado
// (mais recente primeiro) -> botao "Nova Habitualidade" abre o modal de
// lancamento retroativo (NewHabitualityDialog).
//
// Acessivel a ADMIN e CASHIER (operacao de balcao).
// =====================================================

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  TRAINING: 'Treino',
  COMPETITION: 'Competição',
};

const fmtDate = (iso: string) => formatCalendarDate(iso);

const originLabel = (r: HabitualityRecord): string => {
  if (r.description?.startsWith('[MANUAL]')) return 'Lançamento manual';
  if (r.event) return `Evento: ${r.event.title}`;
  if (r.visit) return 'Visita';
  return 'Registro';
};

const HabitualityManualPage = () => {
  const { toast } = useToast();

  const [memberId, setMemberId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [records, setRecords] = useState<HabitualityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HabitualityRecord | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!memberId) {
      setRecords([]);
      return;
    }
    setLoading(true);
    const result = await getAllMemberHabituality(memberId);
    if (result.success) {
      setRecords(result.data);
    } else {
      toast({ variant: 'destructive', title: 'Erro ao carregar habitualidade', description: result.error });
      setRecords([]);
    }
    setLoading(false);
  }, [memberId, toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSelectMember = (id: string, member?: { fullName: string }) => {
    setMemberId(id);
    setMemberName(member?.fullName ?? '');
  };

  const openEdit = (record: HabitualityRecord) => {
    setEditingRecord(record);
    setEditDialogOpen(true);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Habitualidade Manual"
        description="Selecione um associado para ver o livro de habitualidade completo e lançar novos registros retroativos."
      />

      <div className="bg-card border border-border rounded-lg p-5">
        <MemberSearch value={memberId} onChange={handleSelectMember} label="Associado *" />
      </div>

      {!memberId ? (
        <EmptyState
          icon={<Target className="w-8 h-8 text-muted-foreground/80" />}
          title="Nenhum associado selecionado"
          description="Busque um associado acima para ver o histórico de habitualidade e lançar novos registros."
        />
      ) : (
        <div className="bg-card/50 border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-military font-bold text-foreground tracking-wide flex items-center gap-2">
                <Target className="h-5 w-5 text-cbt-orange" />
                Livro de habitualidade {memberName && `— ${memberName}`}
              </h3>
              <p className="text-xs font-tactical text-muted-foreground/80 mt-1">
                Todos os registros já lançados, do mais recente para o mais antigo
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical font-bold"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova Habitualidade
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-cbt-orange" />
            </div>
          ) : records.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground/80 font-tactical text-sm">
              Nenhuma habitualidade registrada para este associado ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-tactical">Data</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Tipo</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Calibre</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Arma</TableHead>
                    <TableHead className="text-muted-foreground font-tactical text-right">Tiros</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Tipo mun.</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Origem / Notas</TableHead>
                    <TableHead className="text-muted-foreground font-tactical text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id} className="border-border hover:bg-muted/50">
                      <TableCell className="text-foreground/90 text-sm whitespace-nowrap">
                        {fmtDate(r.activityDate)}
                      </TableCell>
                      <TableCell className="text-foreground/85 text-sm">
                        {ACTIVITY_LABEL[r.activityType]}
                      </TableCell>
                      <TableCell className="text-foreground font-medium">{r.caliber}</TableCell>
                      <TableCell className="text-foreground/85 text-sm">{r.firearmName ?? '—'}</TableCell>
                      <TableCell className="text-foreground/85 text-sm text-right">
                        {r.shotsFired != null ? r.shotsFired : '—'}
                      </TableCell>
                      <TableCell className="text-foreground/85 text-sm">
                        {r.ammunitionType ? ammunitionTypeLabels[r.ammunitionType] : '—'}
                      </TableCell>
                      <TableCell className="text-foreground/75 text-sm max-w-xs">
                        <span className="block truncate" title={r.description ?? originLabel(r)}>
                          {originLabel(r)}
                        </span>
                        {r.verifiedBy && (
                          <span className="block text-xs text-muted-foreground/70">
                            por {r.verifiedBy.fullName}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-cbt-orange"
                          title="Editar"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <NewHabitualityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        memberId={memberId}
        memberName={memberName}
        onCreated={fetchRecords}
      />

      <EditHabitualityDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        record={editingRecord}
        onSaved={fetchRecords}
      />
    </div>
  );
};

export default HabitualityManualPage;
