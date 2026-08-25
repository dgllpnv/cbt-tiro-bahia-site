import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import { useToast } from '@/hooks/use-toast';
import { calendarKey } from '@/lib/dateOnly';
import { ammunitionTypeLabels } from '@/lib/constants';
import {
  updateHabituality,
  type ActivityType,
  type HabitualityRecord,
} from '@/services/habitualityService';
import type { AmmunitionType } from '@/services/visitDetailsService';

// =====================================================
// EditHabitualityDialog — edita um registro ja lancado: calibre, data,
// tipo, notas e, quando o registro tem visita vinculada (visitDetailId),
// tambem arma / tiros / tipo de municao (atualiza o VisitDetail casado).
// =====================================================

interface EditHabitualityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: HabitualityRecord | null;
  onSaved: () => void;
}

interface FormState {
  caliber: string;
  activityDate: string;
  activityType: ActivityType;
  description: string;
  firearmName: string;
  shotsFired: string;
  ammunitionType: AmmunitionType | null;
}

const inputCls = 'bg-muted border-input text-foreground font-tactical';

const EditHabitualityDialog = ({ open, onOpenChange, record, onSaved }: EditHabitualityDialogProps) => {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>({
    caliber: '',
    activityDate: '',
    activityType: 'TRAINING',
    description: '',
    firearmName: '',
    shotsFired: '',
    ammunitionType: null,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record) {
      setForm({
        caliber: record.caliber,
        activityDate: calendarKey(record.activityDate) ?? '',
        activityType: record.activityType,
        description: record.description ?? '',
        firearmName: record.firearmName ?? '',
        shotsFired: record.shotsFired != null ? String(record.shotsFired) : '',
        ammunitionType: record.ammunitionType ?? null,
      });
    }
  }, [record]);

  const hasVisitDetail = !!record?.visitDetailId;

  const handleSave = async () => {
    if (!record) return;
    if (!form.caliber.trim()) {
      toast({ variant: 'destructive', title: 'Informe o calibre' });
      return;
    }
    if (!form.activityDate) {
      toast({ variant: 'destructive', title: 'Informe a data da atividade' });
      return;
    }
    if (hasVisitDetail && parseInt(form.shotsFired || '0', 10) <= 0) {
      toast({ variant: 'destructive', title: 'Informe a quantidade de tiros' });
      return;
    }
    setSaving(true);
    const result = await updateHabituality(record.id, {
      caliber: form.caliber.trim(),
      activityDate: form.activityDate,
      activityType: form.activityType,
      description: form.description.trim() || null,
      ...(hasVisitDetail
        ? {
            visitDetailId: record.visitDetailId,
            firearmName: form.firearmName.trim() || null,
            shotsFired: parseInt(form.shotsFired, 10),
            ammunitionType: form.ammunitionType,
          }
        : {}),
    });
    setSaving(false);
    if (result.success) {
      toast({ title: 'Habitualidade atualizada' });
      onOpenChange(false);
      onSaved();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: result.error });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-military">Editar habitualidade</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="font-tactical text-xs text-muted-foreground/90">Calibre</Label>
            <Input
              value={form.caliber}
              onChange={(e) => setForm({ ...form, caliber: e.target.value })}
              placeholder="Ex: 9mm"
              className={`mt-1 ${inputCls}`}
            />
          </div>
          <div>
            <Label className="font-tactical text-xs text-muted-foreground/90">Data da atividade</Label>
            <Input
              type="date"
              value={form.activityDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setForm({ ...form, activityDate: e.target.value })}
              className={`mt-1 ${inputCls}`}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label className="font-tactical text-xs text-muted-foreground/90">Tipo</Label>
            <div className="flex gap-2">
              {(['TRAINING', 'COMPETITION'] as const).map((t) => {
                const active = form.activityType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, activityType: t })}
                    className={`flex-1 px-3 py-2 rounded-md border text-sm font-tactical transition-colors ${
                      active
                        ? 'bg-cbt-orange/20 border-cbt-orange text-cbt-orange'
                        : 'bg-muted border-border text-foreground/85 hover:border-muted-foreground/30'
                    }`}
                  >
                    {t === 'TRAINING' ? 'Treinamento' : 'Competição'}
                  </button>
                );
              })}
            </div>
          </div>

          {hasVisitDetail ? (
            <>
              <div className="col-span-2">
                <Label className="font-tactical text-xs text-muted-foreground/90">
                  Arma <span className="text-muted-foreground/70">(opcional)</span>
                </Label>
                <Input
                  value={form.firearmName}
                  onChange={(e) => setForm({ ...form, firearmName: e.target.value })}
                  placeholder="Ex: Glock G17"
                  className={`mt-1 ${inputCls}`}
                />
              </div>
              <div>
                <Label className="font-tactical text-xs text-muted-foreground/90">Tiros</Label>
                <div className="mt-1">
                  <NumberStepper
                    value={parseInt(form.shotsFired) || 0}
                    onChange={(v) => setForm({ ...form, shotsFired: String(Math.max(0, Math.round(v))) })}
                    min={0}
                    step={5}
                  />
                </div>
              </div>
              <div>
                <Label className="font-tactical text-xs text-muted-foreground/90">Tipo de munição</Label>
                <div className="mt-1 flex gap-2">
                  {(['FACTORY', 'RELOADED'] as const).map((t) => {
                    const active = form.ammunitionType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setForm({ ...form, ammunitionType: form.ammunitionType === t ? null : t })
                        }
                        className={`flex-1 px-2 py-2 rounded-md border text-xs font-tactical transition-colors ${
                          active
                            ? 'bg-cbt-orange/20 border-cbt-orange text-cbt-orange'
                            : 'bg-muted border-border text-foreground/85 hover:border-muted-foreground/30'
                        }`}
                      >
                        {ammunitionTypeLabels[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="col-span-2 text-xs font-tactical text-muted-foreground/70">
              Este registro não tem visita vinculada — arma, tiros e munição não se aplicam.
            </div>
          )}

          <div className="col-span-2">
            <Label className="font-tactical text-xs text-muted-foreground/90">Notas / descrição</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Opcional"
              className={`mt-1 ${inputCls}`}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
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
  );
};

export default EditHabitualityDialog;
