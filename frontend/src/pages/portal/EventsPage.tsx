import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  Trophy,
  Target,
  BookOpen,
  Wrench,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { formatDate } from '@/lib/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventParticipation {
  id: string;
  memberId: string;
  memberName?: string;
  caliberUsed?: string;
  placement?: number;
  score?: number;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  eventType: 'TRAINING' | 'COMPETITION' | 'COURSE' | 'WORKSHOP';
  eventDate: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  maxParticipants?: number;
  isPublic?: boolean;
  participations?: EventParticipation[];
  participationsCount?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const getEventTypeBadge = (type: string) => {
  const map: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    TRAINING: { label: 'Treino', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30', icon: Target },
    COMPETITION: { label: 'Competicao', className: 'bg-cbt-orange/15 text-cbt-orange border-cbt-orange/30', icon: Trophy },
    COURSE: { label: 'Curso', className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30', icon: BookOpen },
    WORKSHOP: { label: 'Workshop', className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30', icon: Wrench },
  };
  return map[type] || { label: type, className: 'bg-muted-foreground/20 text-muted-foreground border-muted-foreground/40', icon: Calendar };
};

// ── Component ─────────────────────────────────────────────────────────────────

const EventsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [isLoadingUpcoming, setIsLoadingUpcoming] = useState(true);
  const [isLoadingPast, setIsLoadingPast] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  // ── Fetch upcoming events ──────────────────────────────────────────────────
  const fetchUpcoming = useCallback(async () => {
    setIsLoadingUpcoming(true);
    try {
      const res = await api.get('/api/events', { params: { upcoming: true, limit: 20 } });
      const data = res.data;
      const events = Array.isArray(data) ? data : data.data || [];
      setUpcomingEvents(events);
    } catch {
      setUpcomingEvents([]);
      toast({
        title: 'Erro ao carregar eventos',
        description: 'Nao foi possivel carregar os proximos eventos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingUpcoming(false);
    }
  }, []);

  // ── Fetch past events ──────────────────────────────────────────────────────
  const fetchPast = useCallback(async () => {
    setIsLoadingPast(true);
    try {
      const res = await api.get('/api/events', { params: { limit: 20 } });
      const data = res.data;
      const allEvents: Event[] = Array.isArray(data) ? data : data.data || [];
      const now = new Date();
      setPastEvents(allEvents.filter((e) => new Date(e.eventDate) < now));
    } catch {
      setPastEvents([]);
    } finally {
      setIsLoadingPast(false);
    }
  }, []);

  useEffect(() => {
    fetchUpcoming();
    fetchPast();
  }, [fetchUpcoming, fetchPast]);

  // ── Toggle results expand ──────────────────────────────────────────────────
  const toggleResults = (eventId: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  // ── Event card component ───────────────────────────────────────────────────
  const EventCard = ({ event, showResults = false }: { event: Event; showResults?: boolean }) => {
    const typeBadge = getEventTypeBadge(event.eventType);
    const TypeIcon = typeBadge.icon;
    const participantsCount = event.participationsCount ?? event.participations?.length ?? 0;
    const isExpanded = expandedResults.has(event.id);
    const participations = event.participations || [];

    return (
      <div className="bg-card/50 border border-border rounded-lg hover:border-border transition-colors overflow-hidden">
        <button
          className="w-full p-5 text-left"
          onClick={() => setSelectedEvent(event)}
        >
          <div className="flex items-start justify-between mb-3">
            <Badge variant="outline" className={`text-[10px] font-tactical ${typeBadge.className}`}>
              <TypeIcon className="h-3 w-3 mr-1" />
              {typeBadge.label}
            </Badge>
            <span className="text-xs font-tactical text-muted-foreground/80">
              {formatDate(event.eventDate)}
            </span>
          </div>
          <h4 className="text-sm font-military font-bold text-foreground mb-2 line-clamp-2">
            {event.title}
          </h4>
          <div className="flex flex-wrap items-center gap-3 text-xs font-tactical text-muted-foreground">
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {participantsCount}
              {event.maxParticipants ? ` / ${event.maxParticipants}` : ''} participantes
            </span>
          </div>
        </button>

        {/* Results section for past events */}
        {showResults && participations.length > 0 && (
          <div className="border-t border-border">
            <button
              className="w-full flex items-center justify-between px-5 py-3 text-xs font-tactical text-cbt-orange hover:bg-muted/30 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                toggleResults(event.id);
              }}
            >
              <span className="flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5" />
                Resultados ({participations.length})
              </span>
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {isExpanded && (
              <div className="px-5 pb-4 space-y-2">
                {participations
                  .sort((a, b) => (a.placement || 999) - (b.placement || 999))
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {p.placement && (
                          <span className={`font-military font-bold ${
                            p.placement === 1
                              ? 'text-yellow-700 dark:text-yellow-400'
                              : p.placement === 2
                              ? 'text-foreground/85'
                              : p.placement === 3
                              ? 'text-amber-600'
                              : 'text-muted-foreground'
                          }`}>
                            #{p.placement}
                          </span>
                        )}
                        <span className="font-tactical text-foreground">
                          {p.memberName || 'Participante'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground font-tactical">
                        {p.caliberUsed && <span>{p.caliberUsed}</span>}
                        {p.score != null && (
                          <span className="text-cbt-orange font-semibold">{p.score} pts</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Eventos e Competicoes" description="Calendario de eventos do clube" />

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="bg-muted border border-border mb-6">
          <TabsTrigger
            value="upcoming"
            className="font-tactical text-sm data-[state=active]:bg-cbt-orange data-[state=active]:text-foreground"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Proximos
          </TabsTrigger>
          <TabsTrigger
            value="past"
            className="font-tactical text-sm data-[state=active]:bg-cbt-orange data-[state=active]:text-foreground"
          >
            <Trophy className="h-4 w-4 mr-2" />
            Passados
          </TabsTrigger>
        </TabsList>

        {/* ── Upcoming tab ────────────────────────────────────────────────── */}
        <TabsContent value="upcoming">
          {isLoadingUpcoming ? (
            <LoadingSpinner message="Carregando proximos eventos..." />
          ) : upcomingEvents.length === 0 ? (
            <div className="bg-card/50 border border-border rounded-lg">
              <EmptyState
                icon={<Calendar className="w-8 h-8 text-muted-foreground/80" />}
                title="Nenhum evento proximo"
                description="Nao ha eventos programados no momento."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Past tab ────────────────────────────────────────────────────── */}
        <TabsContent value="past">
          {isLoadingPast ? (
            <LoadingSpinner message="Carregando eventos passados..." />
          ) : pastEvents.length === 0 ? (
            <div className="bg-card/50 border border-border rounded-lg">
              <EmptyState
                icon={<Trophy className="w-8 h-8 text-muted-foreground/80" />}
                title="Nenhum evento passado"
                description="Nenhum evento anterior encontrado."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pastEvents.map((event) => (
                <EventCard key={event.id} event={event} showResults />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Event detail dialog ──────────────────────────────────────────── */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-military text-lg tracking-wide text-foreground">
              {selectedEvent?.title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-tactical text-xs">
              {selectedEvent?.eventDate ? formatDate(selectedEvent.eventDate) : ''}
              {selectedEvent?.location ? ` — ${selectedEvent.location}` : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4">
              {/* Event type & date */}
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const badge = getEventTypeBadge(selectedEvent.eventType);
                  const Icon = badge.icon;
                  return (
                    <Badge variant="outline" className={`text-xs font-tactical ${badge.className}`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {badge.label}
                    </Badge>
                  );
                })()}
                {selectedEvent.isPublic && (
                  <Badge variant="outline" className="bg-muted/50 text-foreground/85 border-border text-xs font-tactical">
                    Publico
                  </Badge>
                )}
              </div>

              {/* Description */}
              {selectedEvent.description && (
                <div className="text-sm font-tactical text-foreground/85 leading-relaxed whitespace-pre-line">
                  {selectedEvent.description}
                </div>
              )}

              {/* Details */}
              <div className="grid grid-cols-2 gap-3">
                {selectedEvent.location && (
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-[10px] font-tactical text-muted-foreground/80 uppercase mb-1">Local</p>
                    <p className="text-sm font-tactical text-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-cbt-orange" />
                      {selectedEvent.location}
                    </p>
                  </div>
                )}
                {selectedEvent.startTime && (
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-[10px] font-tactical text-muted-foreground/80 uppercase mb-1">Horario</p>
                    <p className="text-sm font-tactical text-foreground">
                      {selectedEvent.startTime}
                      {selectedEvent.endTime ? ` - ${selectedEvent.endTime}` : ''}
                    </p>
                  </div>
                )}
                <div className="bg-muted/50 rounded-md p-3">
                  <p className="text-[10px] font-tactical text-muted-foreground/80 uppercase mb-1">Participantes</p>
                  <p className="text-sm font-tactical text-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-cbt-orange" />
                    {selectedEvent.participationsCount ?? selectedEvent.participations?.length ?? 0}
                    {selectedEvent.maxParticipants ? ` / ${selectedEvent.maxParticipants}` : ''}
                  </p>
                </div>
              </div>

              {/* Participants list */}
              {selectedEvent.participations && selectedEvent.participations.length > 0 && (
                <div>
                  <h4 className="text-sm font-military font-bold text-foreground tracking-wide mb-3">
                    Lista de Participantes
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedEvent.participations
                      .sort((a, b) => (a.placement || 999) - (b.placement || 999))
                      .map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md text-xs"
                        >
                          <div className="flex items-center gap-2">
                            {p.placement && (
                              <span className={`font-military font-bold ${
                                p.placement === 1
                                  ? 'text-yellow-700 dark:text-yellow-400'
                                  : p.placement === 2
                                  ? 'text-foreground/85'
                                  : p.placement === 3
                                  ? 'text-amber-600'
                                  : 'text-muted-foreground'
                              }`}>
                                #{p.placement}
                              </span>
                            )}
                            <span className="font-tactical text-foreground">
                              {p.memberName || 'Participante'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground font-tactical">
                            {p.caliberUsed && <span>{p.caliberUsed}</span>}
                            {p.score != null && (
                              <span className="text-cbt-orange font-semibold">{p.score} pts</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end mt-2">
            <Button
              variant="outline"
              className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
              onClick={() => setSelectedEvent(null)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventsPage;
