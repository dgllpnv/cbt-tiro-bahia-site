import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  DoorOpen,
  DoorClosed,
  Target,
  Plus,
  Crosshair,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { formatDate, formatDateTime } from '@/lib/formatters';

interface VisitDetail {
  id: string;
  caliber: string;
  shotsFired: number;
}

interface Visit {
  id: string;
  checkInAt: string;
  checkOutAt?: string;
  bay?: string;
  purpose?: string;
  status: string;
  details?: VisitDetail[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ITEMS_PER_PAGE = 10;

const TrainingHistoryPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);

  // Add detail dialog state
  const [addDetailDialog, setAddDetailDialog] = useState<{
    open: boolean;
    visitId: string;
  }>({ open: false, visitId: '' });
  const [detailForm, setDetailForm] = useState({ caliber: '', shotsFired: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Fetch visits ───────────────────────────────────────────────────────
  const fetchVisits = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/visits', {
        params: { page, limit: ITEMS_PER_PAGE },
      });
      const data = res.data;

      if (Array.isArray(data)) {
        setVisits(data);
        setPagination({ page, limit: ITEMS_PER_PAGE, total: data.length, totalPages: 1 });
      } else {
        setVisits(data.visits || data.data || []);
        setPagination(
          data.pagination || data.meta || {
            page,
            limit: ITEMS_PER_PAGE,
            total: (data.visits || data.data || []).length,
            totalPages: 1,
          }
        );
      }
    } catch {
      setVisits([]);
      toast({
        title: 'Erro ao carregar historico',
        description: 'Nao foi possivel carregar o historico de visitas.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  // ── Add detail ─────────────────────────────────────────────────────────
  const handleOpenAddDetail = (visitId: string) => {
    setDetailForm({ caliber: '', shotsFired: '' });
    setAddDetailDialog({ open: true, visitId });
  };

  const handleSubmitDetail = async () => {
    if (!detailForm.caliber.trim()) {
      toast({ title: 'Informe o calibre', variant: 'destructive' });
      return;
    }
    const shots = parseInt(detailForm.shotsFired, 10);
    if (isNaN(shots) || shots < 1) {
      toast({ title: 'Informe a quantidade de disparos', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/api/visit-details/visit/${addDetailDialog.visitId}`, {
        caliber: detailForm.caliber.trim(),
        shotsFired: shots,
      });
      toast({ title: 'Registro adicionado com sucesso' });
      setAddDetailDialog({ open: false, visitId: '' });
      fetchVisits();
    } catch {
      toast({
        title: 'Erro ao adicionar registro',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Status helpers ─────────────────────────────────────────────────────
  const getStatusBadge = (visit: Visit) => {
    if (visit.checkOutAt) {
      return (
        <Badge variant="outline" className="text-[10px] font-tactical bg-green-500/10 text-green-400 border-green-500/30">
          <DoorClosed className="h-3 w-3 mr-1" />
          Checkout
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] font-tactical bg-cbt-orange/10 text-cbt-orange border-cbt-orange/30">
        <DoorOpen className="h-3 w-3 mr-1" />
        Check-in
      </Badge>
    );
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Historico de Treinos"
        description="Suas visitas e registros de tiro no clube"
      />

      <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Carregando historico..." />
        ) : visits.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-8 h-8 text-gray-500" />}
            title="Nenhuma visita registrada"
            description="Seu historico de treinos aparecera aqui apos o primeiro check-in."
          />
        ) : (
          <>
            {/* Visit list */}
            <div className="divide-y divide-gray-800">
              {visits.map((visit) => {
                const isExpanded = expandedVisit === visit.id;
                return (
                  <Collapsible
                    key={visit.id}
                    open={isExpanded}
                    onOpenChange={(open) => setExpandedVisit(open ? visit.id : null)}
                  >
                    {/* Visit header row */}
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-800/30 transition-colors text-left">
                        {/* Date */}
                        <div className="flex-shrink-0 text-center w-16">
                          <p className="text-sm font-tactical text-white font-medium">
                            {formatDate(visit.checkInAt)}
                          </p>
                        </div>

                        {/* Time */}
                        <div className="flex-shrink-0 w-28">
                          <p className="text-xs font-tactical text-gray-500 mb-0.5">Horario</p>
                          <p className="text-sm font-tactical text-gray-300">
                            {formatTime(visit.checkInAt)}
                            {' - '}
                            {visit.checkOutAt ? formatTime(visit.checkOutAt) : '--:--'}
                          </p>
                        </div>

                        {/* Bay */}
                        <div className="hidden sm:block flex-shrink-0 w-20">
                          <p className="text-xs font-tactical text-gray-500 mb-0.5">Baia</p>
                          <p className="text-sm font-tactical text-gray-300">{visit.bay || '—'}</p>
                        </div>

                        {/* Purpose */}
                        <div className="flex-1 min-w-0 hidden md:block">
                          <p className="text-xs font-tactical text-gray-500 mb-0.5">Proposito</p>
                          <p className="text-sm font-tactical text-gray-300 truncate">
                            {visit.purpose || '—'}
                          </p>
                        </div>

                        {/* Status */}
                        <div className="flex-shrink-0">{getStatusBadge(visit)}</div>

                        {/* Expand indicator */}
                        <ChevronDown
                          className={`h-4 w-4 text-gray-500 transition-transform flex-shrink-0 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </CollapsibleTrigger>

                    {/* Expanded details */}
                    <CollapsibleContent>
                      <div className="px-5 pb-4 bg-gray-800/20">
                        {/* Mobile-only info */}
                        <div className="flex sm:hidden gap-6 mb-3 pt-2">
                          <div>
                            <p className="text-xs font-tactical text-gray-500">Baia</p>
                            <p className="text-sm font-tactical text-gray-300">{visit.bay || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-tactical text-gray-500">Proposito</p>
                            <p className="text-sm font-tactical text-gray-300">{visit.purpose || '—'}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mb-3 pt-2 sm:pt-0">
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-cbt-orange" />
                            <span className="text-sm font-military text-white font-bold">
                              Registros de Tiro
                            </span>
                          </div>
                          <Button
                            size="sm"
                            className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical text-xs h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAddDetail(visit.id);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Adicionar Registro
                          </Button>
                        </div>

                        {visit.details && visit.details.length > 0 ? (
                          <div className="space-y-2">
                            {visit.details.map((detail) => (
                              <div
                                key={detail.id}
                                className="flex items-center gap-3 bg-gray-900/60 border border-gray-700/50 rounded-md px-4 py-2.5"
                              >
                                <Crosshair className="h-4 w-4 text-cbt-orange flex-shrink-0" />
                                <span className="text-sm font-tactical text-white font-medium">
                                  {detail.caliber}
                                </span>
                                <span className="text-xs font-tactical text-gray-500">—</span>
                                <span className="text-sm font-tactical text-gray-300">
                                  {detail.shotsFired} disparo{detail.shotsFired !== 1 ? 's' : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm font-tactical text-gray-500 text-center py-3">
                            Nenhum registro de tiro para esta visita.
                          </p>
                        )}

                        {/* Full datetime info */}
                        <div className="flex gap-6 mt-3 pt-3 border-t border-gray-700/30">
                          <div>
                            <p className="text-[10px] font-tactical text-gray-500 uppercase tracking-wider">
                              Check-in
                            </p>
                            <p className="text-xs font-tactical text-gray-400">
                              {formatDateTime(visit.checkInAt)}
                            </p>
                          </div>
                          {visit.checkOutAt && (
                            <div>
                              <p className="text-[10px] font-tactical text-gray-500 uppercase tracking-wider">
                                Checkout
                              </p>
                              <p className="text-xs font-tactical text-gray-400">
                                {formatDateTime(visit.checkOutAt)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                <p className="text-sm text-gray-400 font-tactical">
                  Mostrando {(page - 1) * ITEMS_PER_PAGE + 1} a{' '}
                  {Math.min(page * ITEMS_PER_PAGE, pagination.total)} de{' '}
                  {pagination.total} visitas
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-sm text-gray-400 font-tactical px-2">
                    {page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
                  >
                    Proximo
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Detail Dialog */}
      <Dialog
        open={addDetailDialog.open}
        onOpenChange={(open) => {
          if (!open) setAddDetailDialog({ open: false, visitId: '' });
        }}
      >
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-military text-lg tracking-wide text-white">
              Adicionar Registro de Tiro
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-tactical text-sm">
              Informe o calibre utilizado e a quantidade de disparos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="caliber" className="text-gray-300 font-tactical text-sm">
                Calibre
              </Label>
              <Input
                id="caliber"
                placeholder="Ex: 9mm Luger, .380 ACP, .38 SPL"
                value={detailForm.caliber}
                onChange={(e) => setDetailForm((f) => ({ ...f, caliber: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 font-tactical focus:border-cbt-orange focus:ring-cbt-orange/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shotsFired" className="text-gray-300 font-tactical text-sm">
                Quantidade de Disparos
              </Label>
              <Input
                id="shotsFired"
                type="number"
                min="1"
                placeholder="Ex: 50"
                value={detailForm.shotsFired}
                onChange={(e) => setDetailForm((f) => ({ ...f, shotsFired: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 font-tactical focus:border-cbt-orange focus:ring-cbt-orange/20"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
              onClick={() => setAddDetailDialog({ open: false, visitId: '' })}
            >
              Cancelar
            </Button>
            <Button
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
              onClick={handleSubmitDetail}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Registro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrainingHistoryPage;
