import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Target,
  FileCheck,
  Calendar,
  Trophy,
  Crosshair,
  Download,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { formatDate } from '@/lib/formatters';
import {
  getClubSettings,
  getMissingDeclarationFields,
  type ClubSettings,
} from '@/services/clubSettingsService';
import { getHabitualityDeclarationData } from '@/services/documentsService';
import { generateHabitualityPdf } from '@/lib/pdfHabituality';

const REQUIRED_TRAININGS = 8;

interface CaliberSummary {
  caliber: string;
  count: number;
}

interface ActivityRecord {
  id: string;
  date: string;
  caliber: string;
  type: 'TRAINING' | 'COMPETITION';
  description?: string;
}

const HabitualityPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [calibers, setCalibers] = useState<CaliberSummary[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  // Estado do diálogo "Solicitar Declaração"
  const [declarationOpen, setDeclarationOpen] = useState(false);
  const [declarationYear, setDeclarationYear] = useState(currentYear);
  const [isDownloading, setIsDownloading] = useState(false);
  const [clubSettings, setClubSettings] = useState<ClubSettings | null>(null);

  // ── Fetch summary ──────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    if (!user) return;
    setIsLoadingSummary(true);
    try {
      const res = await api.get(`/api/habituality/member/${user.id}/summary`, {
        params: { year },
      });
      const data = res.data;
      setCalibers(Array.isArray(data) ? data : data.calibers || []);
    } catch {
      setCalibers([]);
      toast({
        title: 'Erro ao carregar habitualidade',
        description: 'Nao foi possivel carregar os dados de habitualidade.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSummary(false);
    }
  }, [user, year]);

  // ── Fetch activities ───────────────────────────────────────────────────
  const fetchActivities = useCallback(async () => {
    if (!user) return;
    setIsLoadingActivities(true);
    try {
      const res = await api.get(`/api/habituality/member/${user.id}`, {
        params: { year },
      });
      const data = res.data;
      setActivities(Array.isArray(data) ? data : data.activities || data.data || []);
    } catch {
      setActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [user, year]);

  useEffect(() => {
    fetchSummary();
    fetchActivities();
  }, [fetchSummary, fetchActivities]);

  // ── Abrir diálogo de solicitação ───────────────────────────────────────
  const handleOpenDeclaration = async () => {
    setDeclarationYear(year);
    setDeclarationOpen(true);
    // Carrega dados do clube em paralelo (para validar prontidão)
    const res = await getClubSettings();
    if (res.success) setClubSettings(res.data);
  };

  // ── Baixar PDF da declaração ───────────────────────────────────────────
  const handleDownloadDeclaration = async () => {
    if (!user) return;
    setIsDownloading(true);
    try {
      const packetRes = await getHabitualityDeclarationData(user.id, declarationYear);
      if (!packetRes.success) {
        toast({
          variant: 'destructive',
          title: 'Erro ao montar declaração',
          description: packetRes.error,
        });
        return;
      }
      const pdf = await generateHabitualityPdf(packetRes.data);
      const fileName = `declaracao-habitualidade-${user.memberNumber || 'cbt'}-${declarationYear}.pdf`;
      pdf.save(fileName);

      toast({
        title: 'Declaração gerada',
        description: `Salva como ${fileName}`,
      });
      setDeclarationOpen(false);
    } catch (err) {
      console.error('Erro ao gerar PDF da declaração:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar PDF',
        description: 'Tente novamente em instantes.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const declarationYearActivityCount = activities.filter((a) => {
    const d = new Date(a.date);
    return d.getFullYear() === declarationYear;
  }).length;
  const declarationYearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const missingClubFields = getMissingDeclarationFields(clubSettings);
  const clubReady = clubSettings != null && missingClubFields.length === 0;

  // ── Progress color helper ──────────────────────────────────────────────
  const getProgressColor = (count: number) => {
    if (count >= REQUIRED_TRAININGS) return 'bg-green-500';
    if (count >= 4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusLabel = (count: number) => {
    if (count >= REQUIRED_TRAININGS) return { text: 'Completo', className: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30' };
    if (count >= 4) return { text: 'Em progresso', className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' };
    return { text: 'Pendente', className: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30' };
  };

  const getActivityIcon = (type: string) => {
    if (type === 'COMPETITION') return Trophy;
    return Crosshair;
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Minha Habitualidade"
        description="Controle de frequencia de treinos por calibre — minimo de 8 treinos/ano por calibre conforme legislacao vigente"
        actions={
          <Button
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
            onClick={handleOpenDeclaration}
          >
            <FileCheck className="h-4 w-4 mr-2" />
            Solicitar Declaração
          </Button>
        }
      />

      {/* Year selector */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="sm"
          className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground"
          onClick={() => setYear((y) => y - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 bg-card/50 border border-border rounded-lg px-4 py-2">
          <Calendar className="h-4 w-4 text-cbt-orange" />
          <span className="text-foreground font-military font-bold tracking-wide">{year}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground"
          onClick={() => setYear((y) => Math.min(y + 1, currentYear))}
          disabled={year >= currentYear}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Caliber progress cards */}
      <div className="mb-8">
        {isLoadingSummary ? (
          <LoadingSpinner message="Carregando habitualidade..." />
        ) : calibers.length === 0 ? (
          <div className="bg-card/50 border border-border rounded-lg">
            <EmptyState
              icon={<Target className="w-8 h-8 text-muted-foreground/80" />}
              title="Nenhum registro de habitualidade encontrado"
              description={`Nenhuma atividade registrada para o ano de ${year}.`}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {calibers.map((cal) => {
              const pct = Math.min((cal.count / REQUIRED_TRAININGS) * 100, 100);
              const status = getStatusLabel(cal.count);
              return (
                <div
                  key={cal.caliber}
                  className="bg-card/50 border border-border rounded-lg p-5 hover:border-border transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-cbt-orange" />
                      <span className="text-foreground font-military font-bold tracking-wide">
                        {cal.caliber}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-tactical ${status.className}`}
                    >
                      {status.text}
                    </Badge>
                  </div>

                  <div className="mb-2">
                    <Progress
                      value={pct}
                      className="h-3 bg-muted"
                      style={
                        {
                          '--progress-color': getProgressColor(cal.count),
                        } as React.CSSProperties
                      }
                    />
                    <style>{`
                      [style*="--progress-color"] [data-state] {
                        background-color: var(--progress-color) !important;
                      }
                    `}</style>
                  </div>

                  <p className="text-sm font-tactical text-muted-foreground">
                    <span className="text-foreground font-semibold">{cal.count}</span> de{' '}
                    <span className="text-foreground font-semibold">{REQUIRED_TRAININGS}</span> treinos
                    completos
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity history */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Crosshair className="h-5 w-5 text-cbt-orange" />
          <h3 className="text-lg font-military font-bold text-foreground tracking-wide">
            Historico de Atividades
          </h3>
        </div>

        <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
          {isLoadingActivities ? (
            <LoadingSpinner message="Carregando atividades..." />
          ) : activities.length === 0 ? (
            <EmptyState
              icon={<Crosshair className="w-8 h-8 text-muted-foreground/80" />}
              title="Nenhuma atividade registrada"
              description={`Nenhuma atividade encontrada para ${year}.`}
            />
          ) : (
            <div className="divide-y divide-gray-800">
              {activities.map((activity) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        activity.type === 'COMPETITION'
                          ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
                          : 'bg-cbt-orange/15 text-cbt-orange'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-tactical text-foreground font-medium">
                          {activity.caliber}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-tactical ${
                            activity.type === 'COMPETITION'
                              ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30'
                              : 'bg-cbt-orange/10 text-cbt-orange border-cbt-orange/30'
                          }`}
                        >
                          {activity.type === 'COMPETITION' ? 'Competicao' : 'Treino'}
                        </Badge>
                      </div>
                      {activity.description && (
                        <p className="text-xs font-tactical text-muted-foreground/80 truncate">
                          {activity.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-tactical text-foreground/85">
                        {formatDate(activity.date)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Diálogo de Solicitação de Declaração de Habitualidade */}
      <Dialog open={declarationOpen} onOpenChange={(o) => !isDownloading && setDeclarationOpen(o)}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground font-military tracking-wide flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-cbt-orange" />
              Solicitar Declaração de Habitualidade
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-tactical text-sm">
              Documento no formato Anexo E (Portaria 166-COLOG/2023, alterada pela 260-COLOG/2025).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Selector de ano */}
            <div className="space-y-1.5">
              <label className="text-foreground/85 font-tactical text-xs uppercase tracking-wider">
                Ano de referência
              </label>
              <Select
                value={String(declarationYear)}
                onValueChange={(v) => setDeclarationYear(parseInt(v))}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border">
                  {declarationYearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Resumo */}
            <div className="bg-muted/40 border border-border rounded-md p-3 space-y-1 font-tactical text-sm">
              <p className="text-foreground/85">
                Você tem{' '}
                <span className="text-foreground font-semibold">{declarationYearActivityCount}</span>{' '}
                atividade(s) registrada(s) em {declarationYear}.
              </p>
              <p className="text-muted-foreground/80 text-xs">
                Mínimo recomendado: 8 eventos por calibre (Nível 1) — verifique seu nível CR.
              </p>
            </div>

            {/* Status dos dados do clube */}
            {!clubReady && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-md p-3">
                <AlertTriangle className="h-4 w-4 text-red-700 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm font-tactical text-red-700 dark:text-red-300">
                  <p className="font-semibold">Dados do clube incompletos</p>
                  <p className="text-xs text-red-800 dark:text-red-200/80 mt-0.5">
                    O administrador precisa preencher os dados legais em{' '}
                    <span className="font-semibold">/admin/cadastros → Dados do Clube</span> antes
                    de emitir declarações.
                  </p>
                </div>
              </div>
            )}

            {/* Aviso geral */}
            <p className="text-xs font-tactical text-muted-foreground/80 leading-relaxed">
              A declaração é gerada com base nos registros oficiais deste clube. Verifique seus
              dados pessoais e a anuidade antes de baixar.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeclarationOpen(false)}
              disabled={isDownloading}
              className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDownloadDeclaration}
              disabled={isDownloading || !clubReady}
              className="bg-green-600 hover:bg-green-700 text-foreground font-tactical font-bold"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar declaração em PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HabitualityPage;
