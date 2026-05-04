import { useEffect, useMemo, useState } from 'react';
import { Search, X, Check } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import {
  ICON_REGISTRY,
  ICON_GROUPS,
  searchIcons,
  type IconEntry,
  type IconGroup,
} from '@/lib/iconRegistry';
import { ICON_COLOR_PALETTE, getColorLabel } from '@/lib/iconColors';

export interface IconPickerSelection {
  key: string | null;
  color: string | null;
}

interface IconPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently chosen selection (key + color) */
  value?: IconPickerSelection;
  /** Called when user confirms a selection */
  onSelect: (selection: IconPickerSelection) => void;
  /** Optional title; defaults to "Escolher ícone" */
  title?: string;
  /** Optional description shown under the title */
  description?: string;
}

const ALL_KEY = 'ALL' as const;
const DEFAULT_COLOR = '#FF8C00'; // cbt-orange — usado se nada selecionado mas user escolhe um ícone

const IconPicker = ({
  open,
  onOpenChange,
  value,
  onSelect,
  title,
  description,
}: IconPickerProps) => {
  const [activeGroup, setActiveGroup] = useState<typeof ALL_KEY | IconGroup>(ALL_KEY);
  const [search, setSearch] = useState('');
  const [tempKey, setTempKey] = useState<string | null>(value?.key ?? null);
  const [tempColor, setTempColor] = useState<string | null>(value?.color ?? null);

  // Reset state when dialog re-opens
  useEffect(() => {
    if (open) {
      setActiveGroup(ALL_KEY);
      setSearch('');
      setTempKey(value?.key ?? null);
      setTempColor(value?.color ?? null);
    }
  }, [open, value?.key, value?.color]);

  const visible = useMemo<IconEntry[]>(() => {
    let list = search.trim() ? searchIcons(search) : ICON_REGISTRY;
    if (activeGroup !== ALL_KEY) {
      list = list.filter((e) => e.group === activeGroup);
    }
    return list;
  }, [activeGroup, search]);

  const handleConfirm = () => {
    onSelect({ key: tempKey, color: tempColor });
    onOpenChange(false);
  };

  const handleClear = () => {
    setTempKey(null);
    setTempColor(null);
  };

  // The color we render the icons with inside the grid
  const previewColor = tempColor ?? DEFAULT_COLOR;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground font-military tracking-wide">
            {title ?? 'Escolher ícone'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-tactical text-sm">
            {description ??
              `Galeria com ${ICON_REGISTRY.length} mini-ícones (Game Icons) + paleta de ${ICON_COLOR_PALETTE.length} cores.`}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/80 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome (ex: pistola, alvo, escudo...)"
            className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 hover:text-foreground/85"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Group chips */}
        <div className="flex flex-wrap gap-1.5">
          <GroupChip
            label="Todos"
            count={ICON_REGISTRY.length}
            active={activeGroup === ALL_KEY}
            onClick={() => setActiveGroup(ALL_KEY)}
          />
          {ICON_GROUPS.map((g) => (
            <GroupChip
              key={g.key}
              label={g.label}
              count={ICON_REGISTRY.filter((e) => e.group === g.key).length}
              active={activeGroup === g.key}
              onClick={() => setActiveGroup(g.key)}
            />
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 min-h-[220px] overflow-y-auto bg-gray-950/40 border border-border rounded-lg p-2">
          {visible.length === 0 ? (
            <div className="h-full flex items-center justify-center py-12">
              <p className="text-muted-foreground/80 font-tactical text-sm">
                Nenhum ícone encontrado para “{search}”.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {visible.map((entry) => {
                const Icon = entry.Icon;
                const isSelected = tempKey === entry.key;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => {
                      setTempKey(entry.key);
                      // If the user hasn't picked a color yet, set the default so the grid
                      // updates immediately with cbt-orange.
                      if (!tempColor) setTempColor(DEFAULT_COLOR);
                    }}
                    title={entry.label}
                    className={`group relative aspect-square flex items-center justify-center rounded-md border transition-all ${
                      isSelected
                        ? 'bg-cbt-orange/10 border-cbt-orange ring-2 ring-cbt-orange/40'
                        : 'bg-muted border-border hover:border-cbt-orange/50 hover:bg-secondary'
                    }`}
                  >
                    <Icon
                      className="h-7 w-7 transition-colors"
                      style={{
                        color: isSelected
                          ? previewColor
                          : tempColor ?? '#9ca3af', // gray-400 quando inativo
                      }}
                    />
                    {isSelected && (
                      <span className="absolute top-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-cbt-orange text-primary-foreground flex items-center justify-center">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    )}
                    <span className="absolute -bottom-0.5 left-0 right-0 px-1 truncate text-[9px] font-tactical text-muted-foreground/80 group-hover:text-foreground/85 text-center opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 rounded-b-md">
                      {entry.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Color palette */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-tactical uppercase tracking-wider text-muted-foreground/80">
              Cor do ícone
            </p>
            {tempColor && (
              <span className="text-[11px] font-tactical text-muted-foreground">
                {getColorLabel(tempColor)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ICON_COLOR_PALETTE.map((swatch) => {
              const isSelected = (tempColor ?? '').toLowerCase() === swatch.hex.toLowerCase();
              return (
                <button
                  key={swatch.hex}
                  type="button"
                  onClick={() => setTempColor(swatch.hex)}
                  title={`${swatch.label}${swatch.source ? ` · ${swatch.source}` : ''}`}
                  className={`relative h-7 w-7 rounded-md border-2 transition-all ${
                    isSelected
                      ? 'ring-2 ring-cbt-orange ring-offset-1 ring-offset-gray-900 border-white/40'
                      : 'border-border hover:border-white/60'
                  }`}
                  style={{ background: swatch.hex }}
                >
                  {isSelected && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Check
                        className="h-4 w-4"
                        strokeWidth={3}
                        style={{
                          color: isLightColor(swatch.hex) ? '#000' : '#fff',
                        }}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selection preview */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/40 border border-border rounded-md">
          <div className="flex items-center gap-3 min-w-0">
            {tempKey ? (
              (() => {
                const entry = ICON_REGISTRY.find((e) => e.key === tempKey);
                if (!entry) return null;
                const Icon = entry.Icon;
                return (
                  <>
                    <div className="h-9 w-9 rounded-md bg-card border border-border flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5" style={{ color: previewColor }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground font-tactical text-sm truncate">{entry.label}</p>
                      <p className="text-muted-foreground/80 font-tactical text-xs truncate">
                        {entry.key}
                        {tempColor && (
                          <>
                            {' · '}
                            <span style={{ color: tempColor }}>{tempColor}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </>
                );
              })()
            ) : (
              <p className="text-muted-foreground/80 font-tactical text-sm">
                Nenhum ícone selecionado — usar padrão da categoria.
              </p>
            )}
          </div>
          {(tempKey || tempColor) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-muted-foreground hover:text-red-700 dark:text-red-400 font-tactical h-8"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const GroupChip = ({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-tactical transition-colors ${
      active
        ? 'bg-cbt-orange/20 border-cbt-orange/60 text-cbt-orange'
        : 'bg-muted border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
    }`}
  >
    {label}
    <span className={`text-[10px] ${active ? 'opacity-70' : 'opacity-50'}`}>{count}</span>
  </button>
);

// Compute perceived brightness to choose check-mark color (black on light, white on dark).
function isLightColor(hex: string): boolean {
  const m = hex.replace('#', '');
  if (m.length !== 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  // ITU-R BT.601 luma
  const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return y > 0.6;
}

export default IconPicker;
