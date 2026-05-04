import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Loader2 } from 'lucide-react';
import { GiBullets } from 'react-icons/gi';

import {
  getDashboardRankings,
  type DashboardRankings,
  type RankingPeriod,
} from '@/services/dashboardService';
import {
  FIREARM_CATEGORIES,
  POPULAR_FIREARMS,
  getFirearmsInCategory,
  type FirearmCategory,
} from '@/lib/firearmsCatalog';

const PERIOD_LABEL: Record<RankingPeriod, string> = {
  month: 'Mês',
  year: 'Ano',
  all: 'Todos',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function rankAccent(idx: number): { ring: string; text: string; bg: string; label: string } {
  if (idx === 0) return { ring: 'ring-yellow-500/60', text: 'text-yellow-400', bg: 'bg-yellow-500/10', label: '1°' };
  if (idx === 1) return { ring: 'ring-gray-400/50', text: 'text-foreground/85', bg: 'bg-gray-400/10', label: '2°' };
  if (idx === 2) return { ring: 'ring-amber-700/60', text: 'text-amber-500', bg: 'bg-amber-700/10', label: '3°' };
  return { ring: 'ring-gray-700', text: 'text-muted-foreground/80', bg: 'bg-muted/40', label: `${idx + 1}°` };
}

const FIREARM_CAT_KEYS: FirearmCategory[] = ['PISTOL', 'REVOLVER', 'RIFLE', 'SHOTGUN'];

interface PeriodSelectorProps {
  period: RankingPeriod;
  onChange: (p: RankingPeriod) => void;
}

const PeriodSelector = ({ period, onChange }: PeriodSelectorProps) => (
  <div className="flex items-center gap-1">
    {(['month', 'year', 'all'] as RankingPeriod[]).map((p) => (
      <button
        key={p}
        type="button"
        onClick={() => onChange(p)}
        className={`px-2 py-1 rounded-md text-xs font-tactical transition-colors ${
          period === p ? 'bg-cbt-orange/20 text-cbt-orange' : 'bg-muted text-muted-foreground/80 hover:text-foreground/85'
        }`}
      >
        {PERIOD_LABEL[p]}
      </button>
    ))}
  </div>
);

interface RankingCardProps {
  title: string;
  icon: typeof Trophy;
  period: RankingPeriod;
  onPeriodChange: (p: RankingPeriod) => void;
  entries: Array<{
    memberId: string;
    fullName: string;
    memberNumber: string | null;
    photoUrl: string | null;
    value: number;
  }>;
  valueLabel: (v: number) => string;
  loading: boolean;
  /** Optional content rendered between header and entries */
  filters?: React.ReactNode;
}

const RankingCard = ({
  title,
  icon: Icon,
  period,
  onPeriodChange,
  entries,
  valueLabel,
  loading,
  filters,
}: RankingCardProps) => (
  <div className="bg-card/50 border border-border rounded-lg p-5">
    <div className="flex items-center justify-between mb-3 gap-2">
      <h3 className="text-sm font-military font-bold text-foreground tracking-wide flex items-center gap-2">
        <Icon className="h-4 w-4 text-cbt-orange" />
        {title}
      </h3>
      <PeriodSelector period={period} onChange={onPeriodChange} />
    </div>

    {filters && <div className="mb-3">{filters}</div>}

    {loading ? (
      <div className="py-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-cbt-orange animate-spin" />
      </div>
    ) : entries.length === 0 ? (
      <div className="py-6 text-center text-xs font-tactical text-muted-foreground/80">
        Sem dados no período
      </div>
    ) : (
      <ul className="space-y-2">
        {entries.map((entry, idx) => {
          const accent = rankAccent(idx);
          return (
            <li key={entry.memberId}>
              <Link
                to={`/admin/associados/${entry.memberId}`}
                className={`flex items-center gap-3 p-2 rounded-md ${accent.bg} hover:bg-muted/60 transition-colors`}
              >
                <span
                  className={`h-6 w-8 flex items-center justify-center rounded text-xs font-military font-bold ${accent.text}`}
                >
                  {accent.label}
                </span>
                <div
                  className={`h-9 w-9 rounded-full bg-cbt-orange/20 text-cbt-orange flex items-center justify-center font-tactical text-xs font-bold ring-2 ${accent.ring}`}
                >
                  {getInitials(entry.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground font-tactical text-sm truncate">{entry.fullName}</p>
                  <p className="text-muted-foreground/80 font-tactical text-xs truncate">
                    Nº {entry.memberNumber ?? '—'}
                  </p>
                </div>
                <span className="text-cbt-orange font-tactical text-sm font-semibold flex-shrink-0">
                  {valueLabel(entry.value)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

const RankingsPanel = () => {
  // Frequency uses its own period
  const [freqPeriod, setFreqPeriod] = useState<RankingPeriod>('month');
  const [freqData, setFreqData] = useState<DashboardRankings | null>(null);
  const [freqLoading, setFreqLoading] = useState(true);

  // Mastery uses its own period + firearm filter
  const [masteryPeriod, setMasteryPeriod] = useState<RankingPeriod>('month');
  const [firearmCategory, setFirearmCategory] = useState<FirearmCategory | 'ALL'>('ALL');
  const [firearmName, setFirearmName] = useState<string>('ALL');
  const [masteryData, setMasteryData] = useState<DashboardRankings | null>(null);
  const [masteryLoading, setMasteryLoading] = useState(true);

  const fetchFreq = useCallback(async (p: RankingPeriod) => {
    setFreqLoading(true);
    const res = await getDashboardRankings({ period: p, limit: 5 });
    if (res.success) setFreqData(res.data);
    setFreqLoading(false);
  }, []);

  const fetchMastery = useCallback(
    async (p: RankingPeriod, cat: FirearmCategory | 'ALL', name: string) => {
      setMasteryLoading(true);
      const res = await getDashboardRankings({
        period: p,
        limit: 5,
        ...(cat !== 'ALL' ? { firearmCategory: cat } : {}),
        ...(name !== 'ALL' ? { firearmName: name } : {}),
      });
      if (res.success) setMasteryData(res.data);
      setMasteryLoading(false);
    },
    [],
  );

  useEffect(() => {
    fetchFreq(freqPeriod);
  }, [freqPeriod, fetchFreq]);

  useEffect(() => {
    fetchMastery(masteryPeriod, firearmCategory, firearmName);
  }, [masteryPeriod, firearmCategory, firearmName, fetchMastery]);

  const firearmsInCat = useMemo<{ name: string }[]>(() => {
    if (firearmCategory === 'ALL') return [];
    return getFirearmsInCategory(firearmCategory);
  }, [firearmCategory]);

  const masteryTitle = (() => {
    if (firearmName !== 'ALL') return `Top Maestria · ${firearmName}`;
    if (firearmCategory !== 'ALL') return `Top Maestria · ${FIREARM_CATEGORIES[firearmCategory].label}`;
    return 'Top Maestria';
  })();

  const masteryFilters = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          label="Todas armas"
          active={firearmCategory === 'ALL'}
          onClick={() => {
            setFirearmCategory('ALL');
            setFirearmName('ALL');
          }}
        />
        {FIREARM_CAT_KEYS.map((c) => {
          const v = FIREARM_CATEGORIES[c];
          const Icon = v.icon;
          const active = firearmCategory === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                setFirearmCategory(c);
                setFirearmName('ALL');
              }}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-tactical transition-colors ${
                active ? `${v.bg} ${v.border} ${v.text}` : 'bg-muted border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3 w-3" />
              {v.label}
            </button>
          );
        })}
      </div>
      {firearmCategory !== 'ALL' && firearmsInCat.length > 0 && (
        <div>
          <select
            value={firearmName}
            onChange={(e) => setFirearmName(e.target.value)}
            className="w-full h-8 rounded-md bg-muted border border-border text-foreground/85 px-2 text-xs font-tactical focus:outline-none focus:border-cbt-orange"
          >
            <option value="ALL">Toda categoria</option>
            {firearmsInCat.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <RankingCard
        title="Top Frequentadores"
        icon={Trophy}
        period={freqPeriod}
        onPeriodChange={setFreqPeriod}
        entries={(freqData?.byFrequency ?? []).map((e) => ({
          memberId: e.memberId,
          fullName: e.fullName,
          memberNumber: e.memberNumber,
          photoUrl: e.photoUrl,
          value: e.visitCount,
        }))}
        valueLabel={(v) => `${v} ${v === 1 ? 'visita' : 'visitas'}`}
        loading={freqLoading}
      />
      <RankingCard
        title={masteryTitle}
        icon={GiBullets as unknown as typeof Trophy}
        period={masteryPeriod}
        onPeriodChange={setMasteryPeriod}
        entries={(masteryData?.byMastery ?? []).map((e) => ({
          memberId: e.memberId,
          fullName: e.fullName,
          memberNumber: e.memberNumber,
          photoUrl: e.photoUrl,
          value: e.totalShots,
        }))}
        valueLabel={(v) => `${v.toLocaleString('pt-BR')} disparos`}
        loading={masteryLoading}
        filters={masteryFilters}
      />
    </div>
  );
};

const FilterChip = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2 py-1 rounded-md border text-xs font-tactical transition-colors ${
      active
        ? 'bg-cbt-orange/20 border-cbt-orange/60 text-cbt-orange'
        : 'bg-muted border-border text-muted-foreground hover:text-foreground'
    }`}
  >
    {label}
  </button>
);

export default RankingsPanel;
