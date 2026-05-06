import { cn } from '@/lib/utils';

interface CbtLogoProps {
  /** Tailwind classes (ex.: "h-10 w-10"). Default: "h-8 w-8". */
  className?: string;
  /** Texto alt para acessibilidade. */
  alt?: string;
}

/**
 * Logo oficial do Clube Baiano de Tiro (substitui o icone Shield generico).
 * Arquivo em frontend/public/branding/cbt-logo.png.
 */
const CbtLogo = ({ className, alt = 'CBT - Clube Baiano de Tiro' }: CbtLogoProps) => (
  <img
    src="/branding/cbt-logo.png"
    alt={alt}
    draggable={false}
    className={cn('object-contain select-none', className ?? 'h-8 w-8')}
  />
);

export default CbtLogo;
