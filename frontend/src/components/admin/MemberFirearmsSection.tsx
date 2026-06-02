import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, Crosshair } from 'lucide-react';

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
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { FIREARM_CATEGORIES, POPULAR_FIREARMS, type FirearmCategory } from '@/lib/firearmsCatalog';
import {
  listMemberFirearms,
  createMemberFirearm,
  updateMemberFirearm,
  deleteMemberFirearm,
  type MemberFirearm,
  type RegistrationBody,
} from '@/services/memberFirearmsService';

interface MemberFirearmsSectionProps {
  memberId: string;
  /** Modo somente leitura (portal do associado) */
  readOnly?: boolean;
}

const registrationBodyLabels: Record<RegistrationBody, string> = {
  EXERCITO: 'Exército',
  PF: 'Polícia Federal',
};

interface FormState {
  category: FirearmCategory;
  brand: string;
  model: string;
  caliber: string;
  serialNumber: string;
  registrationId: string;
  registrationBody: '' | RegistrationBody;
  acquisitionDate: string;
  notes: string;
}

const emptyForm: FormState = {
  category: 'PISTOL',
  brand: '',
  model: '',
  caliber: '',
  serialNumber: '',
  registrationId: '',
  registrationBody: '',
  acquisitionDate: '',
  notes: '',
};

const inputCls =
  'mt-1 bg-muted border-border text-foreground';
const labelCls = 'font-tactical text-xs text-muted-foreground/90';

const MemberFirearmsSection = ({ memberId, readOnly = false }: MemberFirearmsSectionProps) => {
  const { toast } = useToast();
  const [firearms, setFirearms] = useState<MemberFirearm[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; id: string }>({
    open: false,
    id: '',
  });
  const [deleting, setDeleting] = useState(false);

  const fetchFirearms = useCallback(async () => {
    setLoading(true);
    const result = await listMemberFirearms(memberId);
    if (result.success) {
      setFirearms(result.data);
    } else {
      toast({ variant: 'destructive', title: 'Erro ao carregar armas', description: result.error });
    }
    setLoading(false);
  }, [memberId, toast]);

  useEffect(() => {
    fetchFirearms();
  }, [fetchFirearms]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (f: MemberFirearm) => {
    setEditingId(f.id);
    setForm({
      category: f.category,
      brand: f.brand ?? '',
      model: f.model ?? '',
      caliber: f.caliber ?? '',
      serialNumber: f.serialNumber ?? '',
      registrationId: f.registrationId ?? '',
      registrationBody: f.registrationBody ?? '',
      acquisitionDate: f.acquisitionDate ? f.acquisitionDate.slice(0, 10) : '',
      notes: f.notes ?? '',
    });
    setDialogOpen(true);
  };

  // Ao escolher um modelo conhecido, prefill categoria + calibre.
  const onModelChange = (value: string) => {
    const known = POPULAR_FIREARMS.find((f) => f.name.toLowerCase() === value.trim().toLowerCase());
    setForm((prev) => ({
      ...prev,
      model: value,
      category: known ? known.category : prev.category,
      caliber: known && !prev.caliber ? known.defaultCaliber : prev.caliber,
    }));
  };

  const handleSave = async () => {
    if (!form.model.trim() && !form.brand.trim()) {
      toast({ variant: 'destructive', title: 'Informe ao menos marca ou modelo' });
      return;
    }
    setSaving(true);
    const payload = {
      category: form.category,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      caliber: form.caliber.trim() || null,
      serialNumber: form.serialNumber.trim() || null,
      registrationId: form.registrationId.trim() || null,
      registrationBody: form.registrationBody || null,
      acquisitionDate: form.acquisitionDate || null,
      notes: form.notes.trim() || null,
    };
    const result = editingId
      ? await updateMemberFirearm(editingId, payload)
      : await createMemberFirearm({ memberId, ...payload });
    setSaving(false);
    if (result.success) {
      toast({ title: editingId ? 'Arma atualizada' : 'Arma cadastrada' });
      setDialogOpen(false);
      fetchFirearms();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: result.error });
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const res = await deleteMemberFirearm(confirmDialog.id);
    setDeleting(false);
    if (res.success) {
      toast({ title: 'Arma removida' });
      setConfirmDialog({ open: false, id: '' });
      fetchFirearms();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao remover', description: res.error });
    }
  };

  return (
    <div className="bg-card/50 border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-military font-bold text-foreground tracking-wide flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-cbt-orange" />
            Acervo de Armas
          </h3>
          <p className="text-xs font-tactical text-muted-foreground/80 mt-1">
            Armas de fogo pessoais do associado (registro do clube)
          </p>
        </div>
        {!readOnly && (
          <Button
            type="button"
            onClick={openCreate}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar arma
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-cbt-orange" />
        </div>
      ) : firearms.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground/80 font-tactical text-sm">
          Nenhuma arma cadastrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {firearms.map((f) => {
            const visual = FIREARM_CATEGORIES[f.category];
            const Icon = visual.icon;
            return (
              <div
                key={f.id}
                className={`bg-muted/50 border rounded-lg p-3 flex flex-col gap-2 ${visual.border}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-5 w-5 shrink-0" style={{ color: visual.color }} />
                    <div className="min-w-0">
                      <p className="text-foreground font-semibold font-tactical truncate">
                        {[f.brand, f.model].filter(Boolean).join(' ') || visual.label}
                      </p>
                      <p className="text-xs text-muted-foreground/80 font-tactical">
                        {visual.label}
                        {f.caliber ? ` · ${f.caliber}` : ''}
                      </p>
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-cbt-orange"
                        title="Editar"
                        onClick={() => openEdit(f)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-700 dark:text-red-400"
                        title="Remover"
                        onClick={() => setConfirmDialog({ open: true, id: f.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="text-xs font-tactical text-muted-foreground/85 space-y-0.5">
                  {f.serialNumber && <p>Nº série: <span className="text-foreground/90 font-mono">{f.serialNumber}</span></p>}
                  {f.registrationId && (
                    <p>
                      SIGMA: <span className="text-foreground/90 font-mono">{f.registrationId}</span>
                      {f.registrationBody ? ` (${registrationBodyLabels[f.registrationBody]})` : ''}
                    </p>
                  )}
                  {f.notes && <p className="text-muted-foreground/70 italic truncate" title={f.notes}>{f.notes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog cadastro/edicao */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-military">
              {editingId ? 'Editar arma' : 'Adicionar arma'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className={labelCls}>Modelo</Label>
              <Input
                list="firearm-models"
                value={form.model}
                onChange={(e) => onModelChange(e.target.value)}
                placeholder="Ex: Taurus G2c"
                className={inputCls}
              />
              <datalist id="firearm-models">
                {POPULAR_FIREARMS.map((f) => (
                  <option key={f.name} value={f.name} />
                ))}
              </datalist>
            </div>

            <div>
              <Label className={labelCls}>Categoria</Label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as FirearmCategory })}
                className="mt-1 w-full rounded-md bg-muted border border-border text-foreground px-3 py-2 text-sm font-tactical"
              >
                {(Object.keys(FIREARM_CATEGORIES) as FirearmCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {FIREARM_CATEGORIES[c].label}
                  </option>
                ))}
              </select>
            </div>

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
              <Label className={labelCls}>Marca</Label>
              <Input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Ex: Taurus"
                className={inputCls}
              />
            </div>

            <div>
              <Label className={labelCls}>Nº de série</Label>
              <Input
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <Label className={labelCls}>Nº SIGMA / SINARM</Label>
              <Input
                value={form.registrationId}
                onChange={(e) => setForm({ ...form, registrationId: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <Label className={labelCls}>Órgão de registro</Label>
              <select
                value={form.registrationBody}
                onChange={(e) =>
                  setForm({ ...form, registrationBody: e.target.value as '' | RegistrationBody })
                }
                className="mt-1 w-full rounded-md bg-muted border border-border text-foreground px-3 py-2 text-sm font-tactical"
              >
                <option value="">—</option>
                <option value="EXERCITO">Exército</option>
                <option value="PF">Polícia Federal</option>
              </select>
            </div>

            <div className="col-span-2">
              <Label className={labelCls}>Data de aquisição</Label>
              <Input
                type="date"
                value={form.acquisitionDate}
                onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="col-span-2">
              <Label className={labelCls}>Observações</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="font-tactical"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title="Remover arma"
        description="Remove esta arma do acervo do associado. Continuar?"
        variant="destructive"
        onConfirm={confirmDelete}
        isLoading={deleting}
      />
    </div>
  );
};

export default MemberFirearmsSection;
