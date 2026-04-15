import { useState, useEffect, useRef } from 'react';
import { Search, X, Crosshair } from 'lucide-react';
import api from '@/services/api';
import { equipmentTypeLabels } from '@/lib/constants';

interface Equipment {
  id: string;
  name: string;
  equipmentType: string;
  serialNumber?: string;
  caliber?: string;
  brand?: string;
  model?: string;
  isAvailable: boolean;
}

interface EquipmentSearchProps {
  value: string;
  onChange: (equipmentId: string) => void;
  placeholder?: string;
  label?: string;
  onlyAvailable?: boolean;
}

const EquipmentSearch = ({ value, onChange, placeholder = 'Buscar equipamento...', label = 'Equipamento *', onlyAvailable = true }: EquipmentSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Equipment[]>([]);
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
      api.get(`/api/equipment/${value}`).then((res) => {
        if (res.data?.success && res.data.data) {
          const e = res.data.data;
          setSelectedName(`${e.name}${e.caliber ? ` (${e.caliber})` : ''}${e.serialNumber ? ` — ${e.serialNumber}` : ''}`);
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
        const params: any = { search: text, limit: 10, isActive: 'true' };
        if (onlyAvailable) params.isAvailable = 'true';
        const res = await api.get('/api/equipment', { params });
        if (res.data?.success) { setResults(res.data.data || []); setIsOpen(true); }
      } catch { setResults([]); }
      setIsLoading(false);
    }, 250);
  };

  const handleSelect = (eq: Equipment) => {
    onChange(eq.id);
    setSelectedName(`${eq.name}${eq.caliber ? ` (${eq.caliber})` : ''}${eq.serialNumber ? ` — ${eq.serialNumber}` : ''}`);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleClear = () => { onChange(''); setSelectedName(''); setQuery(''); setResults([]); setIsOpen(false); };

  return (
    <div ref={wrapperRef} className="relative space-y-2">
      {label && <label className="text-gray-300 font-tactical text-sm">{label}</label>}
      <div className="relative">
        {selectedName ? (
          <div className="flex items-center gap-2 h-10 px-3 bg-gray-800 border border-cbt-orange/50 rounded-md">
            <Crosshair size={14} className="text-cbt-orange flex-shrink-0" />
            <span className="text-white font-tactical text-sm flex-1 truncate">{selectedName}</span>
            <button onClick={handleClear} className="text-gray-400 hover:text-white flex-shrink-0"><X size={14} /></button>
          </div>
        ) : (
          <>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text" value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (results.length > 0) setIsOpen(true); }}
              placeholder={placeholder}
              className="w-full h-10 pl-9 pr-3 bg-gray-800 border border-gray-700 rounded-md text-white font-tactical text-sm placeholder:text-gray-500 focus:border-cbt-orange focus:outline-none"
            />
            {isLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-cbt-orange/30 border-t-cbt-orange rounded-full animate-spin" /></div>}
          </>
        )}
        {isOpen && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-xl max-h-60 overflow-y-auto">
            {results.map((eq) => (
              <button key={eq.id} onClick={() => handleSelect(eq)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <Crosshair size={14} className="text-cbt-orange" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-tactical text-sm truncate">{eq.name}{eq.caliber ? ` (${eq.caliber})` : ''}</p>
                  <p className="text-gray-500 font-tactical text-xs">{equipmentTypeLabels[eq.equipmentType] || eq.equipmentType}{eq.serialNumber ? ` — ${eq.serialNumber}` : ''}</p>
                </div>
                <span className={`text-xs font-tactical ${eq.isAvailable ? 'text-green-400' : 'text-red-400'}`}>
                  {eq.isAvailable ? 'Livre' : 'Em uso'}
                </span>
              </button>
            ))}
          </div>
        )}
        {isOpen && query.length >= 1 && results.length === 0 && !isLoading && (
          <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-xl p-4 text-center">
            <p className="text-gray-500 font-tactical text-sm">Nenhum equipamento encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipmentSearch;
