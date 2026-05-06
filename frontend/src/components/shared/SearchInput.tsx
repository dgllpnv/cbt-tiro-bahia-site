import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

const SearchInput = ({
  value,
  onChange,
  placeholder = 'Buscar...',
  debounceMs = 300,
}: SearchInputProps) => {
  const [localValue, setLocalValue] = useState(value);

  // Keep local value in sync when external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced onChange
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, debounceMs, onChange, value]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/80" />
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus-visible:ring-cbt-orange"
      />
    </div>
  );
};

export default SearchInput;
