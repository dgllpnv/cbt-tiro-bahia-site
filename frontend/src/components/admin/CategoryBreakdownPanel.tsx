import { type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface BreakdownEntry {
  key: string;
  label: string;
  total: number;
  count: number;
  share: number; // 0-1
}

interface CategoryBreakdownPanelProps {
  title: string;
  icon: LucideIcon;
  /** Cor de destaque (barra + ícone). */
  accent: string;
  /** Cor de fundo da barra (transparência). */
  accentBg: string;
  entries: BreakdownEntry[];
  /** Total geral do período (para mostrar no header). */
  total: number;
  /** Quantos itens mostrar (default 5). */
  limit?: number;
  /** Texto exibido quando array vazio. */
  emptyText?: string;
}

const CategoryBreakdownPanel = ({
  title,
  icon: Icon,
  accent,
  accentBg,
  entries,
  total,
  limit = 5,
  emptyText = 'Sem registros no período.',
}: CategoryBreakdownPanelProps) => {
  const top = entries.slice(0, limit);
  const maxValue = top.reduce((m, e) => Math.max(m, e.total), 0);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 flex-shrink-0" style={{ color: accent }} />
          <h3 className="text-sm font-military font-bold text-white tracking-wide truncate">
            {title}
          </h3>
        </div>
        <span className="text-xs font-tactical text-gray-500 flex-shrink-0">
          {formatCurrency(total)}
        </span>
      </div>

      {top.length === 0 ? (
        <p className="text-xs font-tactical text-gray-500 text-center py-6">{emptyText}</p>
      ) : (
        <div className="space-y-2 flex-1">
          {top.map((entry) => {
            const pct = maxValue > 0 ? (entry.total / maxValue) * 100 : 0;
            const sharePct = entry.share * 100;
            return (
              <div
                key={entry.key}
                className="relative bg-gray-800/40 rounded-md overflow-hidden"
              >
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${pct}%`,
                    background: accentBg,
                  }}
                />
                <div className="relative flex items-center justify-between px-3 py-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-tactical text-white truncate">
                      {entry.label}
                    </p>
                    <p className="text-[10px] font-tactical text-gray-500">
                      {entry.count} {entry.count === 1 ? 'item' : 'itens'} ·{' '}
                      {sharePct.toFixed(1)}%
                    </p>
                  </div>
                  <span
                    className="text-xs font-tactical font-semibold flex-shrink-0"
                    style={{ color: accent }}
                  >
                    {formatCurrency(entry.total)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategoryBreakdownPanel;
