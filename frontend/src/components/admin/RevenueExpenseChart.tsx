import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';

interface SeriesPoint {
  date: string; // YYYY-MM-DD ou YYYY-MM
  revenue: number;
  expenses: number;
  result: number;
}

interface RevenueExpenseChartProps {
  data: SeriesPoint[];
  granularity: 'day' | 'month';
  height?: number;
}

const formatXLabel = (raw: string, granularity: 'day' | 'month'): string => {
  if (granularity === 'month') {
    const [y, m] = raw.split('-');
    return `${m}/${y.slice(2)}`;
  }
  // 'day': YYYY-MM-DD
  const [, m, d] = raw.split('-');
  return `${d}/${m}`;
};

const formatYTick = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
};

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; dataKey?: string; value?: number; color?: string }>;
  label?: string;
  granularity: 'day' | 'month';
}

const CustomTooltip = ({ active, payload, label, granularity }: TooltipProps) => {
  if (!active || !payload?.length || !label) return null;
  const labelFmt = formatXLabel(label, granularity);
  const labelMap: Record<string, string> = {
    revenue: 'Receita',
    expenses: 'Despesa',
    result: 'Resultado',
  };
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg">
      <p className="text-[10px] font-tactical text-muted-foreground/80 uppercase tracking-wider mb-1.5">
        {granularity === 'month' ? 'Mês' : 'Dia'} · {labelFmt}
      </p>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3 text-xs font-tactical">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: p.color }}
              />
              <span className="text-muted-foreground">{labelMap[p.dataKey ?? ''] ?? p.name}</span>
            </span>
            <span className="text-foreground font-semibold">
              {formatCurrency(p.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const RevenueExpenseChart = ({
  data,
  granularity,
  height = 320,
}: RevenueExpenseChartProps) => {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center bg-card/40 border border-dashed border-border rounded-md text-muted-foreground/80 font-tactical text-sm"
        style={{ height }}
      >
        Sem dados financeiros no período selecionado.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => formatXLabel(v, granularity)}
            stroke="#6b7280"
            tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'Roboto Condensed' }}
            tickMargin={8}
          />
          <YAxis
            tickFormatter={formatYTick}
            stroke="#6b7280"
            tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'Roboto Condensed' }}
            width={60}
          />
          <Tooltip
            content={(props) => <CustomTooltip {...(props as any)} granularity={granularity} />}
            cursor={{ stroke: '#374151', strokeDasharray: '3 3' }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#22c55e"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="expenses"
            stroke="#ef4444"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="result"
            stroke="#FF8C00"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueExpenseChart;
