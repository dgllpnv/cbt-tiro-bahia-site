import { TrendingDown, TrendingUp, Minus, type LucideIcon } from 'lucide-react';

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  /** % de variação vs período anterior. Pode ser pp para margem. */
  deltaPct?: number | null;
  /** Se delta positivo é bom (Receita) ou ruim (Despesa). Default: 'positive' (↑ verde, ↓ vermelho). */
  deltaTone?: 'positive' | 'inverse';
  /** Se o delta deve ser interpretado como pontos percentuais (margem). */
  deltaUnit?: 'pct' | 'pp';
  /** Cor do icone e da barra inferior. */
  color: string;
  bgColor: string;
  borderColor: string;
  /** Texto pequeno opcional sob o valor (ex.: "12 vencidas"). */
  hint?: string;
}

const formatDelta = (delta: number, unit: 'pct' | 'pp'): string => {
  const sign = delta >= 0 ? '+' : '';
  const fixed = Math.abs(delta) >= 10 ? delta.toFixed(0) : delta.toFixed(1);
  return `${sign}${fixed}${unit === 'pp' ? ' p.p.' : '%'}`;
};

const KpiCard = ({
  icon: Icon,
  label,
  value,
  deltaPct,
  deltaTone = 'positive',
  deltaUnit = 'pct',
  color,
  bgColor,
  borderColor,
  hint,
}: KpiCardProps) => {
  const hasDelta = deltaPct !== undefined && deltaPct !== null;
  const goodIfUp = deltaTone === 'positive';
  const isUp = hasDelta && deltaPct! > 0.05;
  const isDown = hasDelta && deltaPct! < -0.05;
  const flat = hasDelta && !isUp && !isDown;
  const positive = goodIfUp ? isUp : isDown;
  const negative = goodIfUp ? isDown : isUp;

  const deltaColor = positive
    ? 'text-green-700 dark:text-green-400'
    : negative
    ? 'text-red-700 dark:text-red-400'
    : 'text-muted-foreground/80';
  const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div
      className={`relative overflow-hidden bg-card/50 border ${borderColor} rounded-lg p-4 group hover:border-opacity-80 transition-all duration-300`}
    >
      <div
        className="absolute top-0 right-0 w-20 h-20 -mr-4 -mt-4 rounded-full opacity-5 group-hover:opacity-10 transition-opacity"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-[10px] font-tactical uppercase tracking-wider text-muted-foreground/80 truncate">
            {label}
          </p>
          <p className="text-xl sm:text-2xl font-military font-bold text-foreground tracking-wide truncate">
            {value}
          </p>
          {hint && (
            <p className="text-[10px] font-tactical text-muted-foreground/80 truncate" title={hint}>
              {hint}
            </p>
          )}
          {hasDelta && (
            <div className={`flex items-center gap-1 text-xs font-tactical ${deltaColor}`}>
              <DeltaIcon className="h-3 w-3" />
              <span>{formatDelta(deltaPct!, deltaUnit)}</span>
              <span className="text-muted-foreground/60">vs anterior</span>
            </div>
          )}
          {!hasDelta && !hint && (
            <p className="text-[10px] font-tactical text-muted-foreground/60">—</p>
          )}
        </div>
        <div className={`p-2 rounded-md ${bgColor} flex-shrink-0`}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <div
        className="absolute bottom-0 left-0 h-0.5 w-full opacity-40"
        style={{ background: `linear-gradient(to right, ${color}, transparent)` }}
      />
    </div>
  );
};

export default KpiCard;
