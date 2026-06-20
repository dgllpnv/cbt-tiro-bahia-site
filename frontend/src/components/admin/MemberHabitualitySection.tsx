import { useState, useEffect, useCallback, useMemo } from 'react';
import { Pencil, Trash2, Loader2, Target, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import {
  getMemberHabituality,
  updateHabituality,
  deleteHabituality,
  type HabitualityRecord,
  type ActivityType,
} from '@/services/habitualityService';

interface MemberHabitualitySectionProps {
  memberId: string;
}

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  TRAINING: 'Treino',
  COMPETITION: 'Competição',
};

const inputCls = 'mt-1 bg-muted border-border text-foreground';
const labelCls = 'font-tactical text-xs text-muted-foreground/90';

// Anos disponiveis: de 2023 ate o ano corrente (descendente).
const CURRENT_YEAR = new Date().getFullYear();
const YEARS: number[] = [];
for (let y = CURRENT_YEAR; y >= 2023; y--) YEARS.push(y);

interface FormState {
  caliber: string;
  activityDate: string;
  activityType: ActivityType;
  description: string;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
};

// Origem legivel a partir dos vinculos/descricao.
const originLabel = (r: HabitualityRecord): string => {
  if (r.description?.startsWith('[MANUAL]')) return 'Lançamento manual';
  if (r.event) return `Evento: ${r.event.title}`;
  if (r.visit) return 'Visita';
  return 'Registro';
};

const MemberHabitualitySection = ({ memberId }: MemberHabitualitySectionProps) => {
  const { toast } = useToast();
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [records, setRecords] = useState<HabitualityRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    caliber: '',
    activityDate: '',
    activityType: 'TRAINING',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; record: HabitualityRecord | null }>({
    open: false,
    record: null,
  });
  const [deleting, setDeleting] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const result = await getMemberHabituality(memberId, year);
    if (result.success) {
      setRecords(result.data);
    } else {
      toast({ variant: 'destructive', title: 'Erro ao carregar habitualidade', description: result.error });
      setRecords([]);
    }
    setLoading(false);
  }, [memberId, year, toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Chaves (calibre + data) que aparecem mais de uma vez = possivel duplicata.
  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of records) {
      const key = `${r.caliber}|${r.activityDate.slice(0, 10)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, c]) => c > 1).map(([k]) => k));
  }, [records]);

  const isDuplicate = (r: HabitualityRecord) =>
    duplicateKeys.has(`${r.caliber}|${r.activityDate.slice(0, 10)}`);

  const openEdit = (r: HabitualityRecord) => {
    setEditingId(r.id);
    setForm({
      caliber: r.caliber,
      activityDate: r.activityDate.slice(0, 10),
      activityType: r.activityType,
      description: r.description ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingId) return;
    if (!form.caliber.trim()) {
      toast({ variant: 'destructive', title: 'Informe o calibre' });
      return;
    }
    if (!form.activityDate) {
      toast({ variant: 'destructive', title: 'Informe a data da atividade' });
      return;
    }
    setSaving(true);
    const result = await updateHabituality(editingId, {
      caliber: form.caliber.trim(),
      activityDate: form.activityDate,
      activityType: form.activityType,
      description: form.description.trim() || null,
    });
    setSaving(false);
    if (result.success) {
      toast({ title: 'Habitualidade atualizada' });
      setDialogOpen(false);
      fetchRecords();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: result.error });
    }
  };

  const confirmDelete = async () => {
    if (!confirmDialog.record) return;
    setDeleting(true);
    const res = await deleteHabituality(confirmDialog.record.id);
    setDeleting(false);
    if (res.success) {
      toast({ title: 'Habitualidade excluída' });
      setConfirmDialog({ open: false, record: null });
      fetchRecords();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: res.error });
    }
  };

  return (
    <div className="bg-card/50 border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-military font-bold text-foreground tracking-wide flex items-center gap-2">
            <Target className="h-5 w-5 text-cbt-orange" />
            Habitualidade
          </h3>
          <p className="text-xs font-tactical text-muted-foreground/80 mt-1">
            Registros de prática de tiro do associado por ano — edite ou exclua para corrigir duplicatas
          </p>
        </div>
        <div className="flex items-center gap-1">
          {YEARS.map((y) => (
            <Button
              key={y}
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setYear(y)}
              className={`font-tactical ${
                y === year
                  ? 'bg-cbt-orange text-foreground hover:bg-cbt-orange/90'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {y}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-cbt-orange" />
        </div>
      ) : records.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground/80 font-tactical text-sm">
          Nenhuma habitualidade registrada em {year}.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-tactical">Data</TableHead>
                <TableHead className="text-muted-foreground font-tactical">Calibre</TableHead>
                <TableHead className="text-muted-foreground font-tactical">Tipo</TableHead>
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
                  <TableCell className="text-foreground font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {r.caliber}
                      {isDuplicate(r) && (
                        <span
                          title="Possível duplicata (mesmo calibre e data)"
                          className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          duplicata?
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-foreground/85 text-sm">
                    {ACTIVITY_LABEL[r.activityType]}
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
                    <div className="flex items-center justify-end gap-0.5">
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-700 dark:hover:text-red-400"
                        title="Excluir"
                        onClick={() => setConfirmDialog({ open: true, record: r })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog de edicao */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-military">Editar habitualidade</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={labelCls}>Calibre</Label>
              <Input
                value={form.caliber}
                onChange={(e) => setForm({ ...form, caliber: e.target.value })}
                placeholder="Ex: 9mm"
                className={inputCls}
              />
            </div>
            <div>
              <Label className={labelCls}>Data da atividade</Label>
              <Input
                type="date"
                value={form.activityDate}
                onChange={(e) => setForm({ ...form, activityDate: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="col-span-2">
              <Label className={labelCls}>Tipo</Label>
              <select
                value={form.activityType}
                onChange={(e) => setForm({ ...form, activityType: e.target.value as ActivityType })}
                className="mt-1 w-full rounded-md bg-muted border border-border text-foreground px-3 py-2 text-sm font-tactical"
              >
                <option value="TRAINING">Treino</option>
                <option value="COMPETITION">Competição</option>
              </select>
            </div>
            <div className="col-span-2">
              <Label className={labelCls}>Notas / descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Opcional"
                className={inputCls}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="text-foreground/85"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical min-w-[100px]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ open, record: open ? confirmDialog.record : null })}
        title="Excluir habitualidade"
        description={
          confirmDialog.record
            ? `Excluir o registro de ${confirmDialog.record.caliber} em ${fmtDate(confirmDialog.record.activityDate)}? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={confirmDelete}
        isLoading={deleting}
      />
    </div>
  );
};

export default MemberHabitualitySection;
