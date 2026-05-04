import { FileText, ShieldCheck, ChevronRight } from 'lucide-react';
import type { ReportConfig } from '@/lib/reports/_shared/reportRegistry';

interface ReportCardProps {
  report: ReportConfig;
  onClick: () => void;
}

const ReportCard = ({ report, onClick }: ReportCardProps) => (
  <button
    onClick={onClick}
    type="button"
    className="group flex flex-col text-left h-full bg-card border border-border rounded-lg p-5 hover:border-cbt-orange/60 hover:shadow-lg transition-all"
  >
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="w-10 h-10 rounded-lg bg-cbt-orange/10 flex items-center justify-center text-cbt-orange flex-shrink-0">
        <FileText size={20} />
      </div>
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

    <h3 className="font-military font-bold text-foreground text-sm tracking-wide mb-1.5">
      {report.title}
    </h3>
    <p className="text-muted-foreground font-tactical text-xs leading-relaxed flex-1">
      {report.description}
    </p>

    {report.legalRef && (
      <p className="mt-3 text-[10px] text-muted-foreground/80 font-tactical italic">
        Base: {report.legalRef}
      </p>
    )}

    <div className="mt-4 flex items-center justify-end text-cbt-orange text-xs font-tactical group-hover:translate-x-0.5 transition-transform">
      Gerar relatório
      <ChevronRight size={14} className="ml-1" />
    </div>
  </button>
);

export default ReportCard;
