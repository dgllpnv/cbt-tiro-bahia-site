import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

const LoadingSpinner = ({ message = 'Carregando...', className = '' }: LoadingSpinnerProps) => (
  <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}>
    <Loader2 className="h-8 w-8 animate-spin text-cbt-orange" />
    <p className="text-gray-400 font-tactical text-sm">{message}</p>
  </div>
);

export default LoadingSpinner;
