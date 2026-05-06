import { useState } from 'react';
import { Calendar as CalIcon } from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  subMonths, subDays,
} from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface PeriodRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  label: string;
}

interface PeriodPickerProps {
  value: PeriodRange;
  onChange: (range: PeriodRange) => void;
}

const toIsoDate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatBr = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export const buildPresets = (): Record<string, PeriodRange> => {
  const now = new Date();
  const lastMonth = subMonths(now, 1);
  return {
    'this-month': {
      startDate: toIsoDate(startOfMonth(now)),
      endDate: toIsoDate(endOfMonth(now)),
      label: 'Este mês',
    },
    'last-month': {
      startDate: toIsoDate(startOfMonth(lastMonth)),
      endDate: toIsoDate(endOfMonth(lastMonth)),
      label: 'Mês passado',
    },
    'last-30': {
      startDate: toIsoDate(subDays(now, 29)),
      endDate: toIsoDate(now),
      label: 'Últimos 30 dias',
    },
    'last-90': {
      startDate: toIsoDate(subDays(now, 89)),
      endDate: toIsoDate(now),
      label: 'Últimos 90 dias',
    },
    'this-year': {
      startDate: toIsoDate(startOfYear(now)),
      endDate: toIsoDate(endOfYear(now)),
      label: 'Este ano',
    },
  };
};

const PRESET_ORDER: Array<keyof ReturnType<typeof buildPresets>> = [
  'this-month',
  'last-month',
  'last-30',
  'last-90',
  'this-year',
];

const PeriodPicker = ({ value, onChange }: PeriodPickerProps) => {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate);
  const [customEnd, setCustomEnd] = useState(value.endDate);
  const presets = buildPresets();

  const handlePreset = (key: keyof ReturnType<typeof buildPresets>) => {
    onChange(presets[key]);
    setOpen(false);
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    onChange({
      startDate: customStart,
      endDate: customEnd,
      label: `${formatBr(customStart)} – ${formatBr(customEnd)}`,
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="bg-muted border-border text-foreground hover:bg-secondary hover:text-foreground font-tactical h-9"
        >
          <CalIcon className="h-4 w-4 mr-2 text-cbt-orange" />
          {value.label}
          <span className="text-muted-foreground/80 ml-2 hidden sm:inline">
            · {formatBr(value.startDate)} – {formatBr(value.endDate)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="bg-card border-border text-foreground w-72 p-0"
      >
        <div className="p-2">
          {PRESET_ORDER.map((key) => {
            const p = presets[key];
            const active = p.startDate === value.startDate && p.endDate === value.endDate;
            return (
              <button
                key={key}
                onClick={() => handlePreset(key)}
                className={`w-full text-left px-3 py-2 rounded-md font-tactical text-sm transition-colors ${
                  active
                    ? 'bg-cbt-orange/15 text-cbt-orange'
                    : 'text-foreground/85 hover:bg-muted hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="border-t border-border p-3 space-y-2">
          <p className="text-xs font-tactical text-muted-foreground/80 uppercase tracking-wider">
            Personalizado
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-muted border-border text-foreground font-tactical text-sm h-8"
            />
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-muted border-border text-foreground font-tactical text-sm h-8"
            />
          </div>
          <Button
            size="sm"
            onClick={applyCustom}
            disabled={!customStart || !customEnd || customStart > customEnd}
            className="w-full bg-cbt-orange hover:bg-cbt-orange/90 text-primary-foreground font-tactical h-8"
          >
            Aplicar período
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default PeriodPicker;
