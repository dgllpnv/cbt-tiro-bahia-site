import { useEffect, useState, useCallback } from 'react';
import {
  Crosshair,
  Calendar,
  Trophy,
  Clock,
  Target,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { GiBullets } from 'react-icons/gi';

import { getMemberStats, type MemberStats } from '@/services/memberStatsService';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import {
  FIREARM_CATEGORIES,
  type FirearmCategory,
} from '@/lib/firearmsCatalog';
import { getCaliberColor } from '@/lib/ammunitionVisuals';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function tenureLabel(months: number): string {
  if (months <= 0) return 'Recém-cadastrado';
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  if (remMonths === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  return `${years} ${years === 1 ? 'ano' : 'anos'} ${remMonths} ${remMonths === 1 ? 'mês' : 'meses'}`;
}

function durationLabel(min: number | null): string {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface KpiProps {
  icon: typeof Trophy;
  label: string;
  value: string;
  accent: string;
}

const Kpi = ({ icon: Icon, label, value, accent }: KpiProps) => (
  <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs font-tactical uppercase tracking-wider text-gray-500">{label}</p>
      <Icon className="h-4 w-4" style={{ color: accent }} />
    </div>
    <p className="text-2xl font-military font-bold text-white tracking-wide">{value}</p>
  </div>
);

interface PodiumCardProps {
  rank: number;
  title: string;
  subtitle?: string | null;
  shots: number;
  topShots: number;
  IconComp?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor?: string;
}

const PodiumCard = ({
  rank,
  title,
  subtitle,
  shots,
  topShots,
  IconComp,
  iconColor,
}: PodiumCardProps) => {
  const accents = [
    { bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', text: 'text-yellow-400', label: 'Ouro' },
    { bg: 'bg-gray-400/15', border: 'border-gray-400/40', text: 'text-gray-300', label: 'Prata' },
    { bg: 'bg-amber-700/15', border: 'border-amber-700/50', text: 'text-amber-500', label: 'Bronze' },
  ];
  const a = accents[rank] || accents[2];
  const pct = topShots > 0 ? Math.round((shots / topShots) * 100) : 0;
  const Icon = IconComp ?? Crosshair;

  return (
    <div className={`${a.bg} ${a.border} border rounded-lg p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className={`${a.text} font-military text-xs tracking-wider`}>
          #{rank + 1} · {a.label}
        </span>
        <Icon
          className={`h-5 w-5 ${a.text}`}
          style={iconColor ? { color: iconColor } : undefined}
        />
      </div>
      <p className="text-white font-military text-lg tracking-wide truncate" title={title}>
        {title}
      </p>
      {subtitle && (
        <p className="text-gray-500 font-tactical text-xs truncate">{subtitle}</p>
      )}
      <p className="text-gray-300 font-tactical text-sm">
        {shots.toLocaleString('pt-BR')} disparos
      </p>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={a.bg.replace('/15', '/80')}
          style={{ width: `${pct}%`, height: '100%' }}
        />
      </div>
    </div>
  );
};

// ── Main ────────────────────────────────────────────────────────────────────

interface MemberProfileTabProps {
  memberId: string;
  fullName: string;
  memberNumber: string | null;
  cr?: string | null;
  crLevel?: number | null;
  membershipTier?: string | null;
  photoUrl?: string | null;
  onGoToVisits?: () => void;
}

const MemberProfileTab = ({
  memberId,
  fullName,
  memberNumber,
  cr,
  crLevel,
  membershipTier,
  photoUrl,
  onGoToVisits,
}: MemberProfileTabProps) => {
  const { toast } = useToast();
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const res = await getMemberStats(memberId);
    if (res.success) {
      setStats(res.data);
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar perfil',
        description: res.error,
      });
    }
    setLoading(false);
  }, [memberId, toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return <LoadingSpinner message="Carregando perfil..." />;
  }
  if (!stats) {
    return (
      <div className="py-8 text-center text-gray-500 font-tactical">
        Não foi possível carregar as estatísticas.
      </div>
    );
  }

  const topCalibers = stats.shotsByCaliber.slice(0, 3);
  const topShots = topCalibers[0]?.shots ?? 0;
  const topFirearms = (stats.shotsByFirearm ?? []).slice(0, 3);
  const topFirearmShots = topFirearms[0]?.shots ?? 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 flex items-center gap-5 flex-wrap">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={fullName}
            className="h-24 w-24 rounded-full object-cover ring-2 ring-cbt-orange/40"
          />
        ) : (
          <div className="h-24 w-24 rounded-full bg-cbt-orange/20 text-cbt-orange flex items-center justify-center font-military text-2xl font-bold ring-2 ring-cbt-orange/40">
            {getInitials(fullName)}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-2xl font-military font-bold text-white tracking-wide">{fullName}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-cbt-orange/10 border border-cbt-orange/30 text-cbt-orange font-tactical text-xs flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              {stats.memberSince
                ? `Sócio desde ${formatDate(stats.memberSince)} · ${tenureLabel(stats.tenureMonths)}`
                : 'Tempo de casa indefinido'}
            </span>
            {memberNumber && (
              <span className="px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300 font-tactical text-xs">
                Nº {memberNumber}
              </span>
            )}
            {cr && (
              <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 font-tactical text-xs">
                CR {cr} {crLevel ? `· Nível ${crLevel}` : ''}
              </span>
            )}
            {membershipTier && (
              <span className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 font-tactical text-xs">
                {membershipTier}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          icon={Crosshair}
          label="Total de disparos"
          value={stats.totalShots.toLocaleString('pt-BR')}
          accent="#dc2626"
        />
        <Kpi
          icon={Calendar}
          label="Visitas (12 meses)"
          value={String(stats.visitsLast12Months)}
          accent="#22c55e"
        />
        <Kpi
          icon={Target}
          label="Calibres usados"
          value={String(stats.shotsByCaliber.length)}
          accent="#3b82f6"
        />
        <Kpi
          icon={Clock}
          label="Duração média"
          value={
            stats.averageVisitDuration > 0
              ? durationLabel(stats.averageVisitDuration)
              : '—'
          }
          accent="#f59e0b"
        />
      </div>

      {/* Armas Favoritas (preferido) ou Calibres mais usados (fallback) */}
      {topFirearms.length > 0 ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-military font-bold text-white tracking-wide mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-cbt-orange" />
            Armas Favoritas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topFirearms.map((f, idx) => {
              const visual = f.category
                ? FIREARM_CATEGORIES[f.category as FirearmCategory]
                : null;
              return (
                <PodiumCard
                  key={f.firearmName}
                  rank={idx}
                  title={f.firearmName}
                  subtitle={visual?.label}
                  shots={f.shots}
                  topShots={topFirearmShots}
                  IconComp={visual?.icon}
                  iconColor={visual?.color}
                />
              );
            })}
          </div>
        </div>
      ) : (
        topCalibers.length > 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-military font-bold text-white tracking-wide mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-cbt-orange" />
              Calibres mais usados
            </h3>
            <p className="text-xs font-tactical text-gray-500 mb-3">
              Registre tiros com a arma para ver Armas Favoritas aqui.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {topCalibers.map((c, idx) => (
                <PodiumCard
                  key={c.caliber}
                  rank={idx}
                  title={c.caliber}
                  shots={c.shots}
                  topShots={topShots}
                  iconColor={getCaliberColor(c.caliber)}
                  IconComp={GiBullets}
                />
              ))}
            </div>
          </div>
        )
      )}

      {/* Munição por calibre — bar chart com mini-ícones */}
      {stats.shotsByCaliber.length > 0 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-military font-bold text-white tracking-wide mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cbt-orange" />
            Munição preferida (por calibre)
          </h3>
          <ul className="space-y-2.5">
            {stats.shotsByCaliber.map((c) => {
              const color = getCaliberColor(c.caliber);
              return (
                <li key={c.caliber} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-tactical">
                    <span className="inline-flex items-center gap-1.5 text-white">
                      <GiBullets className="h-3.5 w-3.5" style={{ color }} />
                      {c.caliber}
                    </span>
                    <span className="text-gray-400">
                      {c.shots.toLocaleString('pt-BR')} disparos · {c.percentage}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${c.percentage}%`, background: color }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Munição comprada */}
      {stats.ammoSpentByType.length > 0 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-military font-bold text-white tracking-wide mb-3 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-cbt-orange" />
            Munição comprada no clube
          </h3>
          <ul className="divide-y divide-gray-800">
            {stats.ammoSpentByType.map((item) => (
              <li
                key={item.productName}
                className="flex items-center justify-between py-2 text-sm font-tactical"
              >
                <div className="min-w-0 flex-1 truncate text-gray-200">{item.productName}</div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-400">
                    {item.totalQuantity.toLocaleString('pt-BR')} un
                  </span>
                  <span className="text-cbt-orange font-semibold">
                    {formatCurrency(item.totalSpent)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Últimas visitas */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-military font-bold text-white tracking-wide flex items-center gap-2">
            <Calendar className="h-4 w-4 text-cbt-orange" />
            Últimas visitas
          </h3>
          {onGoToVisits && (
            <button
              type="button"
              onClick={onGoToVisits}
              className="text-xs font-tactical text-cbt-orange hover:text-cbt-orange/80"
            >
              Ver todas →
            </button>
          )}
        </div>
        {stats.recentVisits.length === 0 ? (
          <p className="text-gray-500 font-tactical text-sm py-3 text-center">
            Nenhuma visita registrada ainda.
          </p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {stats.recentVisits.map((v) => (
              <li
                key={v.id}
                className="py-2.5 flex items-center justify-between gap-3 text-sm font-tactical"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-white">{formatDate(v.visitDate)}</p>
                  {v.laneName && <p className="text-gray-500 text-xs">{v.laneName}</p>}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{durationLabel(v.durationMinutes)}</span>
                  <span className="text-cbt-orange">{v.shotsFired} disparos</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MemberProfileTab;
