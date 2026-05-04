import { useState, useEffect, useRef } from 'react';
import { Search, X, User, UserCheck } from 'lucide-react';
import api from '@/services/api';

interface Member {
  id: string;
  fullName: string;
  memberNumber: string | null;
  cpf?: string;
  email?: string | null;
  isVisitor?: boolean;
}

interface MemberSearchProps {
  value: string;
  onChange: (memberId: string, member?: Member) => void;
  placeholder?: string;
  label?: string;
  /**
   * Quando true, busca em /api/users e /api/visitors em paralelo e mescla
   * resultados. Visitantes recebem badge "Visitante" para diferenciar.
   */
  includeVisitors?: boolean;
}

const MemberSearch = ({
  value,
  onChange,
  placeholder = 'Buscar associado por nome...',
  label = 'Associado *',
  includeVisitors = false,
}: MemberSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const [selectedIsVisitor, setSelectedIsVisitor] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Busca o nome do membro/visitante selecionado quando o componente monta com value.
  // Quando value e limpo externamente (ex: pai reseta), zera tambem selectedName para
  // evitar exibir o nome antigo sem associado selecionado.
  useEffect(() => {
    if (!value) {
      if (selectedName) setSelectedName('');
      if (selectedIsVisitor) setSelectedIsVisitor(false);
      return;
    }
    if (value && !selectedName) {
      // /api/users/:id retorna usuarios de qualquer role (inclusive VISITOR).
      // Se for visitante, sinalizamos com badge azul.
      api
        .get(`/api/users/${value}`)
        .then((res) => {
          if (res.data?.success && res.data.data) {
            const u = res.data.data;
            const isVisitor = u.role === 'VISITOR';
            const tag = isVisitor
              ? ' — Visitante'
              : u.memberNumber
                ? ` — ${u.memberNumber}`
                : '';
            setSelectedName(`${u.fullName}${tag}`);
            setSelectedIsVisitor(isVisitor);
          }
        })
        .catch(() => {});
    }
  }, [value, selectedName, selectedIsVisitor]);

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
        if (includeVisitors) {
          // Busca em paralelo nos dois endpoints e mescla
          const [usersRes, visitorsRes] = await Promise.all([
            api
              .get('/api/users', { params: { search: text, limit: 6 } })
              .catch(() => ({ data: { success: false } })),
            api
              .get('/api/visitors', { params: { search: text, limit: 6 } })
              .catch(() => ({ data: { success: false } })),
          ]);

          const users: Member[] = usersRes.data?.success
            ? (usersRes.data.data || []).map((u: any) => ({
                id: u.id,
                fullName: u.fullName,
                memberNumber: u.memberNumber,
                cpf: u.cpf,
                email: u.email,
                isVisitor: false,
              }))
            : [];

          const visitors: Member[] = visitorsRes.data?.success
            ? (visitorsRes.data.data || []).map((v: any) => ({
                id: v.id,
                fullName: v.fullName,
                memberNumber: null,
                cpf: v.cpf,
                email: v.email,
                isVisitor: true,
              }))
            : [];

          // Visitantes primeiro porque normalmente sao novos cadastros
          setResults([...users, ...visitors]);
          setIsOpen(true);
        } else {
          const res = await api.get('/api/users', { params: { search: text, limit: 8 } });
          if (res.data?.success) {
            setResults(
              (res.data.data || []).map((u: any) => ({
                id: u.id,
                fullName: u.fullName,
                memberNumber: u.memberNumber,
                cpf: u.cpf,
                email: u.email,
                isVisitor: false,
              })),
            );
            setIsOpen(true);
          }
        }
      } catch {
        setResults([]);
      }
      setIsLoading(false);
    }, 300);
  };

  const handleSelect = (member: Member) => {
    onChange(member.id, member);
    const tag = member.isVisitor
      ? ' — Visitante'
      : member.memberNumber
        ? ` — ${member.memberNumber}`
        : '';
    setSelectedName(`${member.fullName}${tag}`);
    setSelectedIsVisitor(!!member.isVisitor);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSelectedName('');
    setSelectedIsVisitor(false);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative space-y-2">
      {label && <label className="text-foreground/85 font-tactical text-sm">{label}</label>}

      <div className="relative">
        {selectedName ? (
          <div
            className={`flex items-center gap-2 h-10 px-3 bg-muted border rounded-md ${selectedIsVisitor ? 'border-blue-500/50' : 'border-cbt-orange/50'}`}
          >
            {selectedIsVisitor ? (
              <UserCheck size={14} className="text-blue-700 dark:text-blue-400 flex-shrink-0" />
            ) : (
              <User size={14} className="text-cbt-orange flex-shrink-0" />
            )}
            <span className="text-foreground font-tactical text-sm flex-1 truncate">{selectedName}</span>
            <button onClick={handleClear} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => {
                if (results.length > 0) setIsOpen(true);
              }}
              placeholder={placeholder}
              className="w-full h-10 pl-9 pr-3 bg-muted border border-border rounded-md text-foreground font-tactical text-sm placeholder:text-muted-foreground/80 focus:border-cbt-orange focus:outline-none"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-cbt-orange/30 border-t-cbt-orange rounded-full animate-spin" />
              </div>
            )}
          </>
        )}

        {isOpen && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-muted border border-border rounded-md shadow-xl max-h-60 overflow-y-auto">
            {results.map((member) => (
              <button
                key={member.id}
                onClick={() => handleSelect(member)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary transition-colors border-b border-border/50 last:border-0"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${member.isVisitor ? 'bg-blue-500/20' : 'bg-secondary'}`}
                >
                  {member.isVisitor ? (
                    <UserCheck size={14} className="text-blue-700 dark:text-blue-400" />
                  ) : (
                    <User size={14} className="text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-foreground font-tactical text-sm truncate">{member.fullName}</p>
                    {member.isVisitor && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-tactical bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex-shrink-0">
                        Visitante
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground/80 font-tactical text-xs">
                    {member.isVisitor
                      ? `CPF ${member.cpf || '—'}`
                      : `Nº ${member.memberNumber || '—'}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
          <div className="absolute z-50 w-full mt-1 bg-muted border border-border rounded-md shadow-xl p-4 text-center">
            <p className="text-muted-foreground/80 font-tactical text-sm">
              {includeVisitors ? 'Nenhum associado ou visitante encontrado' : 'Nenhum associado encontrado'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberSearch;
