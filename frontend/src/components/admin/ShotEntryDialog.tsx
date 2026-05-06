import { useEffect, useState, useCallback } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { GiBullets } from 'react-icons/gi';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  createVisitDetail,
  deleteVisitDetail,
  listVisitDetails,
  type VisitDetailItem,
} from '@/services/visitDetailsService';
import {
  FIREARM_CATEGORIES,
  POPULAR_FIREARMS,
  getFirearmEntry,
  getFirearmCategory,
  getFirearmsInCategory,
  type FirearmCategory,
} from '@/lib/firearmsCatalog';
import { getCaliberColor } from '@/lib/ammunitionVisuals';

const COMMON_CALIBERS = [
  '9mm',
  '.380 ACP',
  '.40 S&W',
  '.45 ACP',
  '.357 Mag',
  '.38 SPL',
  '.22 LR',
  '12 GA',
  '.223 Rem',
  '.308 Win',
];

const QUICK_QTY = [10, 25, 50, 100];

interface ShotEntryDialogProps {
  visitId: string | null;
  memberName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const FIREARM_CAT_KEYS: FirearmCategory[] = ['PISTOL', 'REVOLVER', 'RIFLE', 'SHOTGUN'];

const ShotEntryDialog = ({ visitId, memberName, open, onOpenChange, onSaved }: ShotEntryDialogProps) => {
  const { toast } = useToast();

  // Existing details
  const [details, setDetails] = useState<VisitDetailItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Form state
  const [firearmCategory, setFirearmCategory] = useState<FirearmCategory>('PISTOL');
  const [firearmName, setFirearmName] = useState<string>('');
  const [otherFirearmName, setOtherFirearmName] = useState('');
  const [caliber, setCaliber] = useState('9mm');
  const [otherCaliber, setOtherCaliber] = useState('');
  const [shotsFired, setShotsFired] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [touchedAny, setTouchedAny] = useState(false);

  // Reset form on open / visit change
  useEffect(() => {
    if (open) {
      setFirearmCategory('PISTOL');
      setFirearmName('');
      setOtherFirearmName('');
      setCaliber('9mm');
      setOtherCaliber('');
      setShotsFired('');
      setNotes('');
      setTouchedAny(false);
    }
  }, [open, visitId]);

  // Load existing details when dialog opens
  const refreshList = useCallback(async () => {
    if (!visitId) return;
    setLoadingList(true);
    const res = await listVisitDetails(visitId);
    if (res.success && res.data) {
      setDetails(res.data);
    }
    setLoadingList(false);
  }, [visitId]);

  useEffect(() => {
    if (open && visitId) {
      refreshList();
    }
  }, [open, visitId, refreshList]);

  // When firearm picked, auto-set its default caliber
  const handlePickFirearm = (name: string) => {
    setFirearmName(name);
    const entry = getFirearmEntry(name);
    if (entry) {
      setCaliber(entry.defaultCaliber);
      setOtherCaliber('');
    }
  };

  // When category changes, clear firearm
  const handlePickCategory = (cat: FirearmCategory) => {
    setFirearmCategory(cat);
    setFirearmName('');
  };

  const finalCaliber = caliber === 'OTHER' ? otherCaliber.trim() : caliber;
  const finalFirearm = firearmName === 'OTHER' ? otherFirearmName.trim() : firearmName;
  const shotsNum = parseInt(shotsFired || '0', 10);
  const canSave = !!visitId && !!finalCaliber && shotsNum > 0 && !saving;

  const handleAdd = async () => {
    if (!visitId || !canSave) return;
    setSaving(true);
    const result = await createVisitDetail(visitId, {
      caliber: finalCaliber,
      firearmName: finalFirearm || undefined,
      shotsFired: shotsNum,
      notes: notes.trim() || undefined,
    });
    setSaving(false);

    if (result.success) {
      setTouchedAny(true);
      toast({
        title: 'Tiro registrado',
        description: `${shotsNum} disparo(s) de ${finalCaliber}${finalFirearm ? ` · ${finalFirearm}` : ''}`,
      });
      // Reset only qty + notes; keep firearm + caliber selected for fast repeat entries
      setShotsFired('');
      setNotes('');
      refreshList();
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar tiro',
        description: result.error || 'Tente novamente.',
      });
    }
  };

  const handleDelete = async (detail: VisitDetailItem) => {
    const previous = details;
    setDetails((d) => d.filter((x) => x.id !== detail.id));
    const result = await deleteVisitDetail(detail.id);
    if (!result.success) {
      setDetails(previous);
      toast({
        variant: 'destructive',
        title: 'Erro ao remover tiro',
        description: result.error || 'Tente novamente.',
      });
      return;
    }
    setTouchedAny(true);
    toast({ title: 'Tiro removido' });
  };

  const handleClose = () => {
    onOpenChange(false);
    if (touchedAny) onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-military flex items-center gap-2">
            <GiBullets className="h-5 w-5 text-cbt-orange" />
            Registrar tiros
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-tactical text-sm">
            Para <span className="text-foreground font-semibold">{memberName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Already-registered list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-foreground/85 font-tactical text-sm">
              Já registrados nesta visita {details.length > 0 && `(${details.length})`}
            </Label>
            {loadingList && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/80" />}
          </div>
          {details.length === 0 ? (
            <div className="px-3 py-2 rounded-md bg-muted/40 border border-dashed border-border text-muted-foreground/80 font-tactical text-xs text-center">
              Nenhum tiro registrado nesta visita ainda.
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {details.map((d) => {
                const cat = getFirearmCategory(d.firearmName);
                const visual = cat ? FIREARM_CATEGORIES[cat] : null;
                const Icon = visual?.icon ?? GiBullets;
                return (
                  <li
                    key={d.id}
                    className="flex items-center gap-2 px-3 py-2 bg-muted/60 border border-border rounded-md"
                  >
                    <Icon
                      className="h-4 w-4 flex-shrink-0"
                      style={{ color: visual?.color ?? getCaliberColor(d.caliber) }}
                    />
                    <div className="min-w-0 flex-1 text-xs font-tactical">
                      <span className="text-foreground">
                        {d.firearmName || 'Arma não informada'}
                      </span>
                      <span className="text-muted-foreground/80"> · {d.caliber} · </span>
                      <span className="text-cbt-orange font-semibold">{d.shotsFired} disparos</span>
                      {d.notes && <span className="text-muted-foreground/80"> · {d.notes}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(d)}
                      className="text-muted-foreground/80 hover:text-red-700 dark:text-red-400 transition-colors flex-shrink-0"
                      title="Remover"
                      aria-label="Remover tiro"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border pt-4 space-y-4">
          <p className="text-xs font-tactical uppercase tracking-wider text-muted-foreground/80">
            Adicionar novo tiro
          </p>

          {/* Firearm category */}
          <div className="space-y-2">
            <Label className="text-foreground/85 font-tactical text-sm">Categoria de arma</Label>
            <div className="flex flex-wrap gap-2">
              {FIREARM_CAT_KEYS.map((c) => {
                const v = FIREARM_CATEGORIES[c];
                const Icon = v.icon;
                const active = firearmCategory === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handlePickCategory(c)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-tactical transition-colors ${
                      active
                        ? `${v.bg} ${v.border} ${v.text}`
                        : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Firearm name */}
          <div className="space-y-2">
            <Label className="text-foreground/85 font-tactical text-sm">Arma</Label>
            <div className="flex flex-wrap gap-2">
              {getFirearmsInCategory(firearmCategory).map((f) => {
                const active = firearmName === f.name;
                return (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => handlePickFirearm(f.name)}
                    className={`px-3 py-1.5 rounded-md border text-xs font-tactical transition-colors ${
                      active
                        ? 'bg-cbt-orange/20 border-cbt-orange text-cbt-orange'
                        : 'bg-muted border-border text-foreground/85 hover:border-muted-foreground/30'
                    }`}
                  >
                    {f.name}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setFirearmName('OTHER')}
                className={`px-3 py-1.5 rounded-md border text-xs font-tactical transition-colors ${
                  firearmName === 'OTHER'
                    ? 'bg-cbt-orange/20 border-cbt-orange text-cbt-orange'
                    : 'bg-muted border-border text-foreground/85 hover:border-muted-foreground/30'
                }`}
              >
                Outra arma…
              </button>
            </div>
            {firearmName === 'OTHER' && (
              <Input
                placeholder="Nome da arma"
                value={otherFirearmName}
                onChange={(e) => setOtherFirearmName(e.target.value)}
                className="bg-muted border-input text-foreground font-tactical mt-2"
              />
            )}
          </div>

          {/* Caliber */}
          <div className="space-y-2">
            <Label className="text-foreground/85 font-tactical text-sm">Calibre *</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_CALIBERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCaliber(c)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-tactical transition-colors ${
                    caliber === c
                      ? 'bg-cbt-orange/20 border-cbt-orange text-cbt-orange'
                      : 'bg-muted border-border text-foreground/85 hover:border-muted-foreground/30'
                  }`}
                >
                  <GiBullets className="h-3 w-3" style={{ color: getCaliberColor(c) }} />
                  {c}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCaliber('OTHER')}
                className={`px-3 py-1.5 rounded-md border text-xs font-tactical transition-colors ${
                  caliber === 'OTHER'
                    ? 'bg-cbt-orange/20 border-cbt-orange text-cbt-orange'
                    : 'bg-muted border-border text-foreground/85 hover:border-muted-foreground/30'
                }`}
              >
                Outro…
              </button>
            </div>
            {caliber === 'OTHER' && (
              <Input
                placeholder="Digite o calibre"
                value={otherCaliber}
                onChange={(e) => setOtherCaliber(e.target.value)}
                className="bg-muted border-input text-foreground font-tactical mt-2"
              />
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label className="text-foreground/85 font-tactical text-sm">Quantidade *</Label>
            <NumberStepper
              value={parseInt(shotsFired) || 0}
              onChange={(v) => setShotsFired(String(Math.max(0, Math.round(v))))}
              min={0}
              step={5}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_QTY.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setShotsFired(String(q))}
                  className="px-3 py-1.5 text-xs font-tactical bg-muted border border-border rounded-md text-foreground/85 hover:border-cbt-orange hover:text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-foreground/85 font-tactical text-sm">Observações (opcional)</Label>
            <Textarea
              placeholder="Ex: treino de saque, tiros a 25m..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-muted border-input text-foreground font-tactical placeholder:text-muted-foreground/80 min-h-[50px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!canSave}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar tiro
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShotEntryDialog;
