import { FileText, ShieldCheck, ChevronRight } from 'lucide-react';
import type { ReportConfig } from '@/lib/reports/_shared/reportRegistry';
import { CATEGORY_LABELS } from '@/lib/reports/_shared/reportRegistry';

interface ReportListItemProps {
  report: ReportConfig;
  onClick: () => void;
}

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  MEMBERS: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  HABITUALIDADE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  ACERVO_MUNICOES: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  FINANCEIRO: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  COMPLIANCE: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  DECLARACOES: 'bg-cbt-orange/15 text-cbt-orange border-cbt-orange/30',
};

const ReportListItem = ({ report, onClick }: ReportListItemProps) => {
  const categoryStyle = CATEGORY_BADGE_STYLES[report.category] ?? 'bg-muted text-muted-foreground border-border';

  return (
    <button
      onClick={onClick}
      type="button"
      className="group w-full text-left flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-md hover:border-cbt-orange/50 hover:bg-muted/40 transition-all"
    >
      {/* Icone */}
      <div className="w-10 h-10 rounded-md bg-cbt-orange/10 flex items-center justify-center text-cbt-orange flex-shrink-0">
        <FileText size={18} />
      </div>

      {/* Conteudo principal */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="font-military font-bold text-foreground text-sm tracking-wide truncate">
            {report.title}
          </h3>
          <span
            className={`inline-flex items-center text-[10px] font-tactical uppercase tracking-wide px-2 py-0.5 rounded-full border ${categoryStyle}`}
          >
            {CATEGORY_LABELS[report.category]}
          </span>
          {report.isOfficial ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-tactical uppercase tracking-wide bg-cbt-orange/15 text-cbt-orange border border-cbt-orange/30 px-2 py-0.5 rounded-full">
              <ShieldCheck size={10} />
              Oficial
            </span>
          ) : (
            <span className="text-[10px] font-tactical uppercase tracking-wide bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">
              Interno
            </span>
          )}
        </div>
        <p className="text-muted-foreground font-tactical text-xs leading-relaxed line-clamp-2">
          {report.description}
        </p>
        {report.legalRef && (
          <p className="mt-1 text-[10px] text-muted-foreground/80 font-tactical italic truncate">
            Base: {report.legalRef}
          </p>
        )}
      </div>

      {/* Acao */}
      <div className="flex items-center gap-2 text-cbt-orange text-xs font-tactical flex-shrink-0 group-hover:translate-x-0.5 transition-transform">
        <span className="hidden sm:inline">Gerar</span>
        <ChevronRight size={16} />
      </div>
    </button>
  );
};

export default ReportListItem;
