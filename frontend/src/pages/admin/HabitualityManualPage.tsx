import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { GiBullets } from 'react-icons/gi';

import PageHeader from '@/components/shared/PageHeader';
import MemberSearch from '@/components/shared/MemberSearch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NumberStepper } from '@/components/ui/number-stepper';
import { useToast } from '@/hooks/use-toast';
import { ammunitionTypeLabels } from '@/lib/constants';
import { getCaliberColor } from '@/lib/ammunitionVisuals';
import {
  FIREARM_CATEGORIES,
  getFirearmEntry,
  getFirearmsInCategory,
  type FirearmCategory,
} from '@/lib/firearmsCatalog';
import { createManualSession } from '@/services/habitualityService';
import type { AmmunitionType } from '@/services/visitDetailsService';

// =====================================================
// HabitualityManualPage — Lancamento retroativo de habitualidade
//
// Permite ao admin registrar sessao completa (sócio + data + tipo +
// linhas de calibre/arma/tiros/municao) de uma atividade que nao foi
// registrada no momento. Cria Visit fantasma (notes [MANUAL]) +
// VisitDetail + HabitualityRecord no backend, em uma transaction.
//
// Acessivel apenas a ADMIN (poder retroativo). Posicionado entre
// Relatorios e Associados na sidebar.
// =====================================================

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

const FIREARM_CAT_KEYS: FirearmCategory[] = ['PISTOL', 'REVOLVER', 'RIFLE', 'SHOTGUN'];

interface DetailLine {
  id: string; // local-only, pra key do React
  firearmCategory: FirearmCategory;
  firearmName: string; // pode ser 'OTHER'
  otherFirearmName: string;
  caliber: string; // pode ser 'OTHER'
  otherCaliber: string;
  shotsFired: string;
  ammunitionType: AmmunitionType | null;
}

function newLine(): DetailLine {
  return {
    id: Math.random().toString(36).slice(2),
    firearmCategory: 'PISTOL',
    firearmName: '',
    otherFirearmName: '',
    caliber: '9mm',
    otherCaliber: '',
    shotsFired: '',
    ammunitionType: null,
  };
}

function resolveCaliber(l: DetailLine): string {
  return l.caliber === 'OTHER' ? l.otherCaliber.trim() : l.caliber;
}
function resolveFirearm(l: DetailLine): string {
  return l.firearmName === 'OTHER' ? l.otherFirearmName.trim() : l.firearmName;
}

const HabitualityManualPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [memberId, setMemberId] = useState('');
  const [activityDate, setActivityDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activityType, setActivityType] = useState<'TRAINING' | 'COMPETITION'>('TRAINING');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DetailLine[]>([newLine()]);
  const [saving, setSaving] = useState(false);

  const updateLine = (id: string, patch: Partial<DetailLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };
  const removeLine = (id: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  };
  const addLine = () => setLines((prev) => [...prev, newLine()]);

  const handlePickFirearm = (lineId: string, firearmName: string) => {
    const entry = getFirearmEntry(firearmName);
    updateLine(lineId, {
      firearmName,
      ...(entry ? { caliber: entry.defaultCaliber, otherCaliber: '' } : {}),
    });
  };
  const handlePickCategory = (lineId: string, cat: FirearmCategory) => {
    updateLine(lineId, { firearmCategory: cat, firearmName: '' });
  };

  // Valida que cada linha tem calibre + tiros > 0; ao menos 1 linha.
  const validLines = lines.filter((l) => resolveCaliber(l) && parseInt(l.shotsFired || '0', 10) > 0);
  const canSubmit = !!memberId && !!activityDate && validLines.length === lines.length && lines.length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const payload = {
      memberId,
      activityDate,
      activityType,
      notes: notes.trim() || undefined,
      details: lines.map((l) => ({
        caliber: resolveCaliber(l),
        firearmName: resolveFirearm(l) || undefined,
        shotsFired: parseInt(l.shotsFired, 10),
        ammunitionType: l.ammunitionType,
      })),
    };
    const result = await createManualSession(payload);
    setSaving(false);

    if (result.success) {
      toast({
        title: 'Sessao lancada',
        description: `${result.data.details} linha(s) registradas em ${result.data.calibers} calibre(s).`,
      });
      navigate(`/admin/associados/${memberId}`);
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao lancar sessao',
        description: result.error || 'Tente novamente.',
      });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Lancar Habitualidade Manual"
        description="Registre retroativamente uma sessao de treino ou competicao que nao foi lancada no momento. Cria visita marcada como [MANUAL] e atualiza o livro de habitualidade do socio."
      />

      <div className="space-y-5 bg-card border border-border rounded-lg p-5">
        {/* Associado */}
        <MemberSearch value={memberId} onChange={(id) => setMemberId(id)} label="Associado *" />

        {/* Data + Tipo */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-foreground/85 font-tactical text-sm">Data da atividade *</Label>
            <Input
              type="date"
              value={activityDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setActivityDate(e.target.value)}
              className="bg-muted border-input text-foreground font-tactical"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground/85 font-tactical text-sm">Tipo *</Label>
            <div className="flex gap-2">
              {(['TRAINING', 'COMPETITION'] as const).map((t) => {
                const active = activityType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActivityType(t)}
                    className={`flex-1 px-3 py-2 rounded-md border text-sm font-tactical transition-colors ${
                      active
                        ? 'bg-cbt-orange/20 border-cbt-orange text-cbt-orange'
                        : 'bg-muted border-border text-foreground/85 hover:border-muted-foreground/30'
                    }`}
                  >
                    {t === 'TRAINING' ? 'Treinamento' : 'Competicao'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Observacao opcional do admin */}
        <div className="space-y-2">
          <Label className="text-foreground/85 font-tactical text-sm">
            Observacao <span className="text-muted-foreground/70 normal-case">(opcional — fica nas notes da visita)</span>
          </Label>
          <Textarea
            placeholder="Ex: regularizando treino feito no clube em 2024-03-15 sem registro digital..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-muted border-input text-foreground font-tactical min-h-[60px]"
            maxLength={500}
          />
        </div>
      </div>

      {/* Linhas de tiros */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground font-military font-bold text-sm uppercase tracking-wider">
            Linhas de tiros ({lines.length})
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLine}
            className="bg-muted border-border text-foreground/85 hover:bg-secondary font-tactical"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar linha
          </Button>
        </div>

        {lines.map((line, idx) => (
          <div key={line.id} className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-cbt-orange font-military font-bold text-xs uppercase tracking-wider">
                Linha #{idx + 1}
              </span>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  className="text-muted-foreground/80 hover:text-red-700 dark:text-red-400 transition-colors"
                  title="Remover linha"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Categoria de arma */}
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-xs">Categoria de arma</Label>
              <div className="flex flex-wrap gap-2">
                {FIREARM_CAT_KEYS.map((c) => {
                  const v = FIREARM_CATEGORIES[c];
                  const Icon = v.icon;
                  const active = line.firearmCategory === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handlePickCategory(line.id, c)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-tactical transition-colors ${
                        active ? `${v.bg} ${v.border} ${v.text}` : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Arma */}
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-xs">Arma (opcional)</Label>
              <div className="flex flex-wrap gap-2">
                {getFirearmsInCategory(line.firearmCategory).map((f) => {
                  const active = line.firearmName === f.name;
                  return (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => handlePickFirearm(line.id, f.name)}
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
                  onClick={() => updateLine(line.id, { firearmName: 'OTHER' })}
                  className={`px-3 py-1.5 rounded-md border text-xs font-tactical transition-colors ${
                    line.firearmName === 'OTHER'
                      ? 'bg-cbt-orange/20 border-cbt-orange text-cbt-orange'
                      : 'bg-muted border-border text-foreground/85 hover:border-muted-foreground/30'
                  }`}
                >
                  Outra arma…
                </button>
              </div>
              {line.firearmName === 'OTHER' && (
                <Input
                  placeholder="Nome da arma"
                  value={line.otherFirearmName}
                  onChange={(e) => updateLine(line.id, { otherFirearmName: e.target.value })}
                  className="bg-muted border-input text-foreground font-tactical mt-2"
                />
              )}
            </div>

            {/* Calibre */}
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-xs">Calibre *</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_CALIBERS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateLine(line.id, { caliber: c })}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-tactical transition-colors ${
                      line.caliber === c
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
                  onClick={() => updateLine(line.id, { caliber: 'OTHER' })}
                  className={`px-3 py-1.5 rounded-md border text-xs font-tactical transition-colors ${
                    line.caliber === 'OTHER'
                      ? 'bg-cbt-orange/20 border-cbt-orange text-cbt-orange'
                      : 'bg-muted border-border text-foreground/85 hover:border-muted-foreground/30'
                  }`}
                >
                  Outro…
                </button>
              </div>
              {line.caliber === 'OTHER' && (
                <Input
                  placeholder="Digite o calibre"
                  value={line.otherCaliber}
                  onChange={(e) => updateLine(line.id, { otherCaliber: e.target.value })}
                  className="bg-muted border-input text-foreground font-tactical mt-2"
                />
              )}
            </div>

            {/* Tipo de municao + Quantidade */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground/85 font-tactical text-xs">
                  Tipo de municao <span className="text-muted-foreground/70">(opcional)</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {(['FACTORY', 'RELOADED'] as const).map((t) => {
                    const active = line.ammunitionType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          updateLine(line.id, { ammunitionType: line.ammunitionType === t ? null : t })
                        }
                        className={`px-3 py-1.5 rounded-md border text-xs font-tactical transition-colors ${
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

              <div className="space-y-2">
                <Label className="text-foreground/85 font-tactical text-xs">Quantidade de tiros *</Label>
                <NumberStepper
                  value={parseInt(line.shotsFired) || 0}
                  onChange={(v) => updateLine(line.id, { shotsFired: String(Math.max(0, Math.round(v))) })}
                  min={0}
                  step={5}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Acoes */}
      <div className="flex items-center justify-between gap-3 pb-8">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(-1)}
          className="bg-muted border-border text-foreground/85 hover:bg-secondary font-tactical"
        >
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical font-bold"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Salvar sessao retroativa
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default HabitualityManualPage;
