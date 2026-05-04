import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Eye, Download, AlertCircle } from 'lucide-react';
import MemberSearch from '@/components/shared/MemberSearch';
import type { ReportConfig, ReportFilterValues } from '@/lib/reports/_shared/reportRegistry';
import type { ClubSettings } from '@/services/clubSettingsService';

interface ReportGenerateDialogProps {
  report: ReportConfig | null;
  club: ClubSettings | null;
  onClose: () => void;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const ReportGenerateDialog = ({ report, club, onClose }: ReportGenerateDialogProps) => {
  const [filterValues, setFilterValues] = useState<ReportFilterValues>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultBlobUrl, setResultBlobUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [resultSave, setResultSave] = useState<(() => void) | null>(null);

  // Inicializa valores default ao abrir
  useEffect(() => {
    if (report) {
      const init: ReportFilterValues = {};
      for (const f of report.filters) {
        if (f.default !== undefined) init[f.key] = f.default;
      }
      setFilterValues(init);
      setError(null);
      setResultBlobUrl(null);
      setResultFilename(null);
      setResultSave(null);
    }
  }, [report]);

  // Cleanup blob URL ao fechar
  useEffect(() => {
    return () => {
      if (resultBlobUrl) URL.revokeObjectURL(resultBlobUrl);
    };
  }, [resultBlobUrl]);

  const isValid = useMemo(() => {
    if (!report) return false;
    for (const f of report.filters) {
      const v = filterValues[f.key];
      if (f.kind === 'memberSelect' && !v) return false;
      if (f.kind === 'period' && (!v?.from || !v?.to)) return false;
      if ((f.kind === 'days' || f.kind === 'year' || f.kind === 'monthYear') && (v == null || v === '')) return false;
      if (f.kind === 'multiSelect' && (!Array.isArray(v) || v.length === 0)) return false;
    }
    return true;
  }, [report, filterValues]);

  const handleGenerate = async () => {
    if (!report || !club) return;
    setGenerating(true);
    setError(null);
    if (resultBlobUrl) URL.revokeObjectURL(resultBlobUrl);
    setResultBlobUrl(null);

    try {
      const result = await report.generate(filterValues, club);
      setResultBlobUrl(result.blobUrl);
      setResultFilename(result.filename);
      setResultSave(() => result.save);
    } catch (err: any) {
      console.error('[ReportGenerate]', err);
      setError(err?.response?.data?.error || err?.message || 'Erro ao gerar relatório');
    } finally {
      setGenerating(false);
    }
  };

  if (!report) return null;

  return (
    <Dialog open={!!report} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-military tracking-wide">{report.title}</DialogTitle>
          <DialogDescription className="font-tactical">
            {report.description}
            {report.legalRef && (
              <span className="block mt-2 text-xs italic">Base legal: {report.legalRef}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!club && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm font-tactical">
            <AlertCircle size={16} />
            Configure os Dados do Clube antes de gerar relatórios.
          </div>
        )}

        {report.filters.length > 0 && (
          <div className="space-y-4 py-2">
            {report.filters.map((f) => {
              const v = filterValues[f.key];
              const setV = (next: any) =>
                setFilterValues((prev) => ({ ...prev, [f.key]: next }));

              switch (f.kind) {
                case 'monthYear':
                  return (
                    <div key={f.key}>
                      <Label className="font-tactical">{f.label}</Label>
                      <select
                        className="w-full h-10 mt-1 px-3 rounded-md bg-background border border-border text-foreground font-tactical"
                        value={v ?? ''}
                        onChange={(e) => setV(Number(e.target.value))}
                      >
                        {MONTHS.map((m, idx) => (
                          <option key={idx} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                  );

                case 'period':
                  return (
                    <div key={f.key} className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="font-tactical">De</Label>
                        <Input
                          type="date"
                          value={v?.from ?? ''}
                          onChange={(e) => setV({ ...(v ?? {}), from: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="font-tactical">Até</Label>
                        <Input
                          type="date"
                          value={v?.to ?? ''}
                          onChange={(e) => setV({ ...(v ?? {}), to: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  );

                case 'days':
                  return (
                    <div key={f.key}>
                      <Label className="font-tactical">{f.label}</Label>
                      <Input
                        type="number"
                        min={f.min ?? 1}
                        max={f.max ?? 999}
                        value={v ?? ''}
                        onChange={(e) => setV(Number(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                  );

                case 'year':
                  return (
                    <div key={f.key}>
                      <Label className="font-tactical">{f.label}</Label>
                      <Input
                        type="number"
                        min={2000}
                        max={2100}
                        value={v ?? ''}
                        onChange={(e) => setV(Number(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                  );

                case 'quarterYear':
                  return (
                    <div key={f.key} className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="font-tactical">Trimestre</Label>
                        <select
                          className="w-full h-10 mt-1 px-3 rounded-md bg-background border border-border text-foreground font-tactical"
                          value={v?.quarter ?? 1}
                          onChange={(e) => setV({ ...(v ?? {}), quarter: Number(e.target.value) })}
                        >
                          {[1, 2, 3, 4].map((q) => (
                            <option key={q} value={q}>{q}º Trimestre</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="font-tactical">Ano</Label>
                        <Input
                          type="number"
                          min={2000}
                          max={2100}
                          value={v?.year ?? new Date().getFullYear()}
                          onChange={(e) => setV({ ...(v ?? {}), year: Number(e.target.value) })}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  );

                case 'memberSelect':
                  return (
                    <div key={f.key}>
                      <MemberSearch
                        value={v ?? ''}
                        onChange={(id) => setV(id)}
                        label={f.label}
                        placeholder="Buscar associado por nome..."
                      />
                    </div>
                  );

                case 'multiSelect':
                  return (
                    <div key={f.key}>
                      <Label className="font-tactical mb-2 block">{f.label}</Label>
                      <div className="flex flex-wrap gap-3">
                        {(f.options ?? []).map((opt) => {
                          const arr = (v ?? []) as string[];
                          const checked = arr.includes(opt.value);
                          return (
                            <label
                              key={opt.value}
                              className="flex items-center gap-2 text-sm font-tactical cursor-pointer"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => {
                                  const next = c
                                    ? [...arr, opt.value]
                                    : arr.filter((x) => x !== opt.value);
                                  setV(next);
                                }}
                              />
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );

                case 'select':
                  return (
                    <div key={f.key}>
                      <Label className="font-tactical">{f.label}</Label>
                      <select
                        className="w-full h-10 mt-1 px-3 rounded-md bg-background border border-border text-foreground font-tactical"
                        value={v ?? ''}
                        onChange={(e) => setV(e.target.value)}
                      >
                        <option value="">Todos</option>
                        {(f.options ?? []).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  );

                default:
                  return null;
              }
            })}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-sm font-tactical">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {resultBlobUrl && (
          <div className="space-y-2">
            <p className="text-sm font-tactical text-muted-foreground">
              Pré-visualização: <span className="font-bold text-foreground">{resultFilename}</span>
            </p>
            <iframe
              src={resultBlobUrl}
              title="Pré-visualização"
              className="w-full h-[420px] rounded-md border border-border bg-muted"
            />
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={generating}>
            Fechar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!isValid || generating || !club}
            className="bg-cbt-orange text-black hover:bg-cbt-orange/90"
          >
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</>
            ) : (
              <><Eye className="mr-2 h-4 w-4" /> {resultBlobUrl ? 'Gerar novamente' : 'Pré-visualizar'}</>
            )}
          </Button>
          {resultBlobUrl && resultSave && (
            <Button
              onClick={() => resultSave()}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              <Download className="mr-2 h-4 w-4" /> Baixar PDF
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportGenerateDialog;
