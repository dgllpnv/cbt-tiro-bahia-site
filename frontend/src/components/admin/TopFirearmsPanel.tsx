import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { GiCrossedPistols } from 'react-icons/gi';

import {
  getTopFirearms,
  type TopFirearms,
  type TopFirearmsPeriod,
} from '@/services/dashboardService';
import {
  FIREARM_CATEGORIES,
  type FirearmCategory,
} from '@/lib/firearmsCatalog';

const PERIOD_LABEL: Record<TopFirearmsPeriod, string> = {
  day: 'Hoje',
  month: 'Mês',
  year: 'Ano',
};

const TopFirearmsPanel = () => {
  const [period, setPeriod] = useState<TopFirearmsPeriod>('month');
  const [data, setData] = useState<TopFirearms | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (p: TopFirearmsPeriod) => {
    setLoading(true);
    const res = await getTopFirearms(p, 10);
    if (res.success) setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  const entries = data?.topFirearms ?? [];
  const topShots = entries[0]?.totalShots ?? 0;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-military font-bold text-white tracking-wide flex items-center gap-2">
            <GiCrossedPistols className="h-5 w-5 text-cbt-orange" />
            Armas Mais Usadas no Clube
          </h3>
          <p className="text-xs font-tactical text-gray-500 mt-0.5">
            Ranking por total de disparos no período
          </p>
        </div>
        <div className="flex items-center gap-1">
          {(['day', 'month', 'year'] as TopFirearmsPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-md text-xs font-tactical transition-colors ${
                period === p
                  ? 'bg-cbt-orange/20 text-cbt-orange'
                  : 'bg-gray-800 text-gray-500 hover:text-gray-300'
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 text-cbt-orange animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="py-6 text-center text-xs font-tactical text-gray-500">
          Nenhum tiro registrado no período. Registre tiros no painel de presentes para ver o ranking aqui.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((e, idx) => {
            const visual = e.category
              ? FIREARM_CATEGORIES[e.category as FirearmCategory]
              : null;
            const Icon = visual?.icon ?? GiCrossedPistols;
            const pct = topShots > 0 ? Math.max(8, Math.round((e.totalShots / topShots) * 100)) : 0;
            return (
              <li
                key={e.firearmName}
                className="relative px-3 py-2 rounded-md bg-gray-900/40 border border-gray-800 overflow-hidden"
              >
                {/* Background bar */}
                <div
                  className="absolute inset-y-0 left-0 opacity-15"
                  style={{ width: `${pct}%`, background: visual?.color ?? '#6b7280' }}
                />
                <div className="relative flex items-center gap-3">
                  <span className="font-military text-xs text-gray-500 w-6">{idx + 1}°</span>
                  <Icon className="h-5 w-5 flex-shrink-0" style={{ color: visual?.color ?? '#6b7280' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-tactical text-sm truncate">{e.firearmName}</p>
                    {visual && (
                      <p className="text-gray-500 font-tactical text-xs">{visual.label}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-cbt-orange font-tactical text-sm font-semibold tabular-nums">
                      {e.totalShots.toLocaleString('pt-BR')} disparos
                    </p>
                    <p className="text-gray-500 font-tactical text-xs">
                      {e.uses} {e.uses === 1 ? 'sessão' : 'sessões'}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default TopFirearmsPanel;
