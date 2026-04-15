import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Target,
  FileCheck,
  Calendar,
  Trophy,
  Crosshair,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { formatDate } from '@/lib/formatters';

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
  const [isGenerating, setIsGenerating] = useState(false);

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

  // ── Generate declaration ───────────────────────────────────────────────
  const handleGenerateDeclaration = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      await api.post(`/api/documents/generate/habituality/${user.id}`, { year });
      toast({
        title: 'Declaracao gerada',
        description: 'Sua declaracao de habitualidade foi gerada com sucesso.',
      });
    } catch {
      toast({
        title: 'Erro ao gerar declaracao',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Progress color helper ──────────────────────────────────────────────
  const getProgressColor = (count: number) => {
    if (count >= REQUIRED_TRAININGS) return 'bg-green-500';
    if (count >= 4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusLabel = (count: number) => {
    if (count >= REQUIRED_TRAININGS) return { text: 'Completo', className: 'bg-green-500/20 text-green-400 border-green-500/30' };
    if (count >= 4) return { text: 'Em progresso', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
    return { text: 'Pendente', className: 'bg-red-500/20 text-red-400 border-red-500/30' };
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
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
            onClick={handleGenerateDeclaration}
            disabled={isGenerating}
          >
            <FileCheck className="h-4 w-4 mr-2" />
            Solicitar Declaracao
          </Button>
        }
      />

      {/* Year selector */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="sm"
          className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
          onClick={() => setYear((y) => y - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-2">
          <Calendar className="h-4 w-4 text-cbt-orange" />
          <span className="text-white font-military font-bold tracking-wide">{year}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
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
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg">
            <EmptyState
              icon={<Target className="w-8 h-8 text-gray-500" />}
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
                  className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-cbt-orange" />
                      <span className="text-white font-military font-bold tracking-wide">
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
                      className="h-3 bg-gray-800"
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

                  <p className="text-sm font-tactical text-gray-400">
                    <span className="text-white font-semibold">{cal.count}</span> de{' '}
                    <span className="text-white font-semibold">{REQUIRED_TRAININGS}</span> treinos
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
          <h3 className="text-lg font-military font-bold text-white tracking-wide">
            Historico de Atividades
          </h3>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          {isLoadingActivities ? (
            <LoadingSpinner message="Carregando atividades..." />
          ) : activities.length === 0 ? (
            <EmptyState
              icon={<Crosshair className="w-8 h-8 text-gray-500" />}
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
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-800/30 transition-colors"
                  >
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        activity.type === 'COMPETITION'
                          ? 'bg-yellow-500/15 text-yellow-400'
                          : 'bg-cbt-orange/15 text-cbt-orange'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-tactical text-white font-medium">
                          {activity.caliber}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-tactical ${
                            activity.type === 'COMPETITION'
                              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                              : 'bg-cbt-orange/10 text-cbt-orange border-cbt-orange/30'
                          }`}
                        >
                          {activity.type === 'COMPETITION' ? 'Competicao' : 'Treino'}
                        </Badge>
                      </div>
                      {activity.description && (
                        <p className="text-xs font-tactical text-gray-500 truncate">
                          {activity.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-tactical text-gray-300">
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
    </div>
  );
};

export default HabitualityPage;
