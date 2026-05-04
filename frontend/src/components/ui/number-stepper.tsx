import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NumberStepperProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value' | 'size'> {
  value: number;
  onChange: (value: number) => void;
  /** Incremento por clique. Default: 1 (qty) ou 0.5/0.01 (preco). */
  step?: number;
  /** Limites opcionais. */
  min?: number;
  max?: number;
  /** Casas decimais para formatacao do valor exibido. Default: 0 para step inteiro, 2 para fracionario. */
  decimals?: number;
  /** Prefixo opcional dentro do input (ex.: "R$"). */
  prefix?: string;
  /** Classes extras no container. */
  className?: string;
  /** Classes extras no input central. */
  inputClassName?: string;
  /** Tamanho compacto reduz padding/altura. Default: "default". */
  size?: 'default' | 'sm';
}

/**
 * Stepper numerico tactical — botoes [-] [+] flanqueando um input central.
 * Usar no lugar de <input type="number" /> em telas onde queremos visual mais limpo
 * que os spinners nativos do browser.
 */
const NumberStepper = React.forwardRef<HTMLInputElement, NumberStepperProps>(
  (
    {
      value,
      onChange,
      step,
      min,
      max,
      decimals,
      prefix,
      className,
      inputClassName,
      size = 'default',
      disabled,
      ...inputProps
    },
    ref,
  ) => {
    const effectiveStep = step ?? 1;
    const isInteger = Number.isInteger(effectiveStep);
    const effectiveDecimals = decimals ?? (isInteger ? 0 : 2);

    const clamp = (n: number): number => {
      let result = n;
      if (typeof min === 'number') result = Math.max(min, result);
      if (typeof max === 'number') result = Math.min(max, result);
      return result;
    };

    const setNext = (next: number) => {
      const rounded = Number(next.toFixed(effectiveDecimals + 4));
      onChange(clamp(rounded));
    };

    const handleDecrement = () => setNext(value - effectiveStep);
    const handleIncrement = () => setNext(value + effectiveStep);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(',', '.');
      if (raw === '' || raw === '-') {
        onChange(0);
        return;
      }
      const parsed = parseFloat(raw);
      if (Number.isNaN(parsed)) return;
      onChange(clamp(parsed));
    };

    const decDisabled = disabled || (typeof min === 'number' && value <= min);
    const incDisabled = disabled || (typeof max === 'number' && value >= max);

    const heightClass = size === 'sm' ? 'h-8' : 'h-9';
    const buttonClass = cn(
      'flex items-center justify-center',
      heightClass,
      'w-8 shrink-0 border border-gray-700 bg-gray-800 text-gray-300',
      'hover:bg-cbt-orange/10 hover:border-cbt-orange/40 hover:text-cbt-orange',
      'active:bg-cbt-orange/20',
      'disabled:opacity-40 disabled:hover:bg-gray-800 disabled:hover:border-gray-700 disabled:hover:text-gray-300 disabled:cursor-not-allowed',
      'transition-colors',
    );

    return (
      <div className={cn('inline-flex w-full', className)}>
        <button
          type="button"
          onClick={handleDecrement}
          disabled={decDisabled}
          aria-label="Diminuir"
          className={cn(buttonClass, 'rounded-l-md border-r-0')}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <div
          className={cn(
            'flex items-center flex-1 min-w-0',
            'border border-gray-700 bg-gray-900 focus-within:border-cbt-orange/60',
            heightClass,
          )}
        >
          {prefix && (
            <span className="px-2 text-gray-500 font-tactical text-xs select-none border-r border-gray-700/60 h-full flex items-center">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            type="text"
            inputMode={effectiveDecimals > 0 ? 'decimal' : 'numeric'}
            value={value.toFixed(effectiveDecimals)}
            onChange={handleInputChange}
            disabled={disabled}
            className={cn(
              'w-full h-full bg-transparent px-2 text-center text-white font-tactical text-sm',
              'outline-none placeholder:text-gray-500 disabled:opacity-50',
              inputClassName,
            )}
            {...inputProps}
          />
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={incDisabled}
          aria-label="Aumentar"
          className={cn(buttonClass, 'rounded-r-md border-l-0')}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  },
);
NumberStepper.displayName = 'NumberStepper';

export { NumberStepper };
