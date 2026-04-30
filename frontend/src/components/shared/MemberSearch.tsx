import { useState, useEffect, useRef } from 'react';
import { Search, X, User } from 'lucide-react';
import api from '@/services/api';

interface Member {
  id: string;
  fullName: string;
  memberNumber: string;
  cpf?: string;
  email?: string;
}

interface MemberSearchProps {
  value: string;
  onChange: (memberId: string) => void;
  placeholder?: string;
  label?: string;
}

const MemberSearch = ({ value, onChange, placeholder = 'Buscar associado por nome...', label = 'Associado *' }: MemberSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch selected member name on mount if value exists
  useEffect(() => {
    if (value && !selectedName) {
      api.get(`/api/users/${value}`).then((res) => {
        if (res.data?.success && res.data.data) {
          setSelectedName(`${res.data.data.fullName} — ${res.data.data.memberNumber}`);
        }
      }).catch(() => {});
    }
  }, [value]);

  const handleSearch = (text: string) => {
    setQuery(text);
    setSelectedName('');
    onChange('');

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/api/users', { params: { search: text, limit: 8 } });
        if (res.data?.success) {
          setResults(res.data.data || []);
          setIsOpen(true);
        }
      } catch {
        setResults([]);
      }
      setIsLoading(false);
    }, 300);
  };

  const handleSelect = (member: Member) => {
    onChange(member.id);
    setSelectedName(`${member.fullName} — ${member.memberNumber}`);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSelectedName('');
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative space-y-2">
      {label && <label className="text-gray-300 font-tactical text-sm">{label}</label>}

      <div className="relative">
        {selectedName ? (
          // Selected state
          <div className="flex items-center gap-2 h-10 px-3 bg-gray-800 border border-cbt-orange/50 rounded-md">
            <User size={14} className="text-cbt-orange flex-shrink-0" />
            <span className="text-white font-tactical text-sm flex-1 truncate">{selectedName}</span>
            <button onClick={handleClear} className="text-gray-400 hover:text-white flex-shrink-0">
              <X size={14} />
            </button>
          </div>
        ) : (
          // Search state
          <>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (results.length > 0) setIsOpen(true); }}
              placeholder={placeholder}
              className="w-full h-10 pl-9 pr-3 bg-gray-800 border border-gray-700 rounded-md text-white font-tactical text-sm placeholder:text-gray-500 focus:border-cbt-orange focus:outline-none"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-cbt-orange/30 border-t-cbt-orange rounded-full animate-spin" />
              </div>
            )}
          </>
        )}

        {/* Dropdown */}
        {isOpen && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-xl max-h-60 overflow-y-auto">
            {results.map((member) => (
              <button
                key={member.id}
                onClick={() => handleSelect(member)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0"
              >
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-tactical text-sm truncate">{member.fullName}</p>
                  <p className="text-gray-500 font-tactical text-xs">Nº {member.memberNumber}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
          <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-xl p-4 text-center">
            <p className="text-gray-500 font-tactical text-sm">Nenhum associado encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberSearch;
