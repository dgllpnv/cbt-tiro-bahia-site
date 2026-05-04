import { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Info, Filter, X } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ReportListItem from '@/components/admin/ReportListItem';
import ReportGenerateDialog from '@/components/admin/ReportGenerateDialog';
import {
  REPORT_REGISTRY,
  CATEGORY_LABELS,
  type ReportConfig,
} from '@/lib/reports/_shared/reportRegistry';
import { getClubSettings, type ClubSettings } from '@/services/clubSettingsService';
import type { ReportCategory } from '@/lib/reports/_shared/reportBase';

const CATEGORY_ORDER: ReportCategory[] = [
  'MEMBERS',
  'HABITUALIDADE',
  'ACERVO_MUNICOES',
  'COMPLIANCE',
  'DECLARACOES',
];

type TypeFilter = 'all' | 'official' | 'internal';

const ReportsPage = () => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selected, setSelected] = useState<ReportConfig | null>(null);
  const [club, setClub] = useState<ClubSettings | null>(null);
  const [loadingClub, setLoadingClub] = useState(true);

  useEffect(() => {
    getClubSettings()
      .then((res) => {
        if (res.success) setClub(res.data);
      })
      .finally(() => setLoadingClub(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return REPORT_REGISTRY.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (typeFilter === 'official' && !r.isOfficial) return false;
      if (typeFilter === 'internal' && r.isOfficial) return false;
      if (q && !r.title.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [search, categoryFilter, typeFilter]);

  // Agrupa pela categoria respeitando a ordem definida
  const grouped = useMemo(() => {
    const map: Record<string, ReportConfig[]> = {};
    for (const cat of CATEGORY_ORDER) {
      const list = filtered.filter((r) => r.category === cat);
      if (list.length > 0) map[cat] = list;
    }
    return map;
  }, [filtered]);

  // Contagem por categoria respeitando search + typeFilter (mas ignorando categoria)
  // — usado nos pills do filtro para mostrar quantos itens cada categoria tem
  const countByCategory = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = REPORT_REGISTRY.filter((r) => {
      if (typeFilter === 'official' && !r.isOfficial) return false;
      if (typeFilter === 'internal' && r.isOfficial) return false;
      if (q && !r.title.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    const counts: Record<string, number> = { all: base.length };
    for (const cat of CATEGORY_ORDER) {
      counts[cat] = base.filter((r) => r.category === cat).length;
    }
    return counts;
  }, [search, typeFilter]);

  const hasActiveFilters = search.trim() !== '' || categoryFilter !== 'all' || typeFilter !== 'all';

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Emita relatórios prontos para apresentação à PF, ao Comando do Exército e para gestão interna do clube."
      />

      <div className="flex items-start gap-3 p-4 mb-6 rounded-lg bg-cbt-orange/5 border border-cbt-orange/20">
        <Info className="text-cbt-orange flex-shrink-0 mt-0.5" size={18} />
        <div className="font-tactical text-sm text-foreground">
          <p className="font-bold mb-1">Sobre os relatórios oficiais</p>
          <p className="text-muted-foreground">
            Documentos marcados como <span className="font-bold text-cbt-orange">Oficial</span>{' '}
            são gerados conforme as normas vigentes (Decreto 11.615/2023, Portarias 166/2023 e
            260/2025, IN DG/PF 311/2025). Para entrega à PF/EB, o admin deve assinar digitalmente
            o PDF (gov.br Assinador, ICP-Brasil, etc.) antes do envio.
          </p>
        </div>
      </div>

      {/* ── Filtros ────────────────────────────────────────────────────── */}
      <div className="bg-card/50 border border-border rounded-lg p-4 mb-4 space-y-3">
        {/* Linha 1: busca + tipo */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Buscar por título ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="inline-flex bg-muted/60 border border-border rounded-md p-0.5">
            {([
              { v: 'all', label: 'Todos' },
              { v: 'official', label: 'Oficiais' },
              { v: 'internal', label: 'Internos' },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setTypeFilter(opt.v)}
                className={`px-3 py-1.5 text-xs font-tactical rounded transition-colors ${
                  typeFilter === opt.v
                    ? 'bg-cbt-orange text-black font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Linha 2: pills de categoria */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`text-xs font-tactical px-3 py-1 rounded-full border transition-colors ${
              categoryFilter === 'all'
                ? 'bg-cbt-orange/15 text-cbt-orange border-cbt-orange/40'
                : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            Todas <span className="ml-1 opacity-70">{countByCategory.all}</span>
          </button>
          {CATEGORY_ORDER.map((cat) => {
            const count = countByCategory[cat] ?? 0;
            if (count === 0 && categoryFilter !== cat) return null;
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(active ? 'all' : cat)}
                className={`text-xs font-tactical px-3 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-cbt-orange/15 text-cbt-orange border-cbt-orange/40'
                    : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                {CATEGORY_LABELS[cat]} <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setCategoryFilter('all');
                setTypeFilter('all');
              }}
              className="ml-auto h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X size={12} className="mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* ── Resultados ─────────────────────────────────────────────────── */}
      {loadingClub ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="animate-spin mr-2" size={18} />
          Carregando dados do clube...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground font-tactical">
          Nenhum relatório encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.filter((c) => grouped[c]).map((cat) => (
            <section key={cat}>
              <div className="flex items-baseline gap-2 mb-2 px-1">
                <h2 className="font-military font-bold text-foreground tracking-wide text-sm uppercase">
                  {CATEGORY_LABELS[cat]}
                </h2>
                <span className="text-muted-foreground font-tactical text-xs">
                  {grouped[cat].length} {grouped[cat].length === 1 ? 'relatório' : 'relatórios'}
                </span>
              </div>
              <div className="space-y-1.5">
                {grouped[cat].map((r) => (
                  <ReportListItem key={r.id} report={r} onClick={() => setSelected(r)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ReportGenerateDialog
        key={selected?.id ?? 'none'}
        report={selected}
        club={club}
        onClose={() => setSelected(null)}
      />
    </div>
  );
};

export default ReportsPage;
