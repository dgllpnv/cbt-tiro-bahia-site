import { useState, useEffect, useRef } from 'react';
import { Search, X, ShoppingCart } from 'lucide-react';
import api from '@/services/api';
import { categoryLabels } from '@/lib/constants';
import { formatCurrency } from '@/lib/formatters';

interface Product {
  id: string;
  name: string;
  category: string;
  caliber?: string;
  unitPrice: number;
  unit: string;
}

interface ProductSearchProps {
  value: string;
  onChange: (productId: string, product?: Product) => void;
  placeholder?: string;
  label?: string;
}

const ProductSearch = ({ value, onChange, placeholder = 'Buscar produto...', label = 'Produto *' }: ProductSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (value && !selectedName) {
      api.get(`/api/products/${value}`).then((res) => {
        if (res.data?.success && res.data.data) {
          const p = res.data.data;
          setSelectedName(`${p.name} — ${formatCurrency(Number(p.unitPrice))}`);
        }
      }).catch(() => {});
    }
  }, [value]);

  const handleSearch = (text: string) => {
    setQuery(text);
    setSelectedName('');
    onChange('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 1) { setResults([]); setIsOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/api/products', { params: { search: text, limit: 10, isActive: 'true' } });
        if (res.data?.success) { setResults(res.data.data || []); setIsOpen(true); }
      } catch { setResults([]); }
      setIsLoading(false);
    }, 250);
  };

  const handleSelect = (prod: Product) => {
    onChange(prod.id, prod);
    setSelectedName(`${prod.name} — ${formatCurrency(Number(prod.unitPrice))}`);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleClear = () => { onChange(''); setSelectedName(''); setQuery(''); setResults([]); setIsOpen(false); };

  return (
    <div ref={wrapperRef} className="relative space-y-2">
      {label && <label className="text-foreground/85 font-tactical text-sm">{label}</label>}
      <div className="relative">
        {selectedName ? (
          <div className="flex items-center gap-2 h-10 px-3 bg-muted border border-cbt-orange/50 rounded-md">
            <ShoppingCart size={14} className="text-cbt-orange flex-shrink-0" />
            <span className="text-foreground font-tactical text-sm flex-1 truncate">{selectedName}</span>
            <button onClick={handleClear} className="text-muted-foreground hover:text-foreground flex-shrink-0"><X size={14} /></button>
          </div>
        ) : (
          <>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80" />
            <input
              type="text" value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (results.length > 0) setIsOpen(true); }}
              placeholder={placeholder}
              className="w-full h-10 pl-9 pr-3 bg-muted border border-border rounded-md text-foreground font-tactical text-sm placeholder:text-muted-foreground/80 focus:border-cbt-orange focus:outline-none"
            />
            {isLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-cbt-orange/30 border-t-cbt-orange rounded-full animate-spin" /></div>}
          </>
        )}
        {isOpen && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-muted border border-border rounded-md shadow-xl max-h-60 overflow-y-auto">
            {results.map((prod) => (
              <button key={prod.id} onClick={() => handleSelect(prod)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary transition-colors border-b border-border/50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <ShoppingCart size={14} className="text-cbt-orange" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground font-tactical text-sm truncate">{prod.name}</p>
                  <p className="text-muted-foreground/80 font-tactical text-xs">{categoryLabels[prod.category] || prod.category}{prod.caliber ? ` — ${prod.caliber}` : ''}</p>
                </div>
                <span className="text-cbt-orange font-tactical text-sm font-bold whitespace-nowrap">
                  {formatCurrency(Number(prod.unitPrice))}
                </span>
              </button>
            ))}
          </div>
        )}
        {isOpen && query.length >= 1 && results.length === 0 && !isLoading && (
          <div className="absolute z-50 w-full mt-1 bg-muted border border-border rounded-md shadow-xl p-4 text-center">
            <p className="text-muted-foreground/80 font-tactical text-sm">Nenhum produto encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductSearch;
