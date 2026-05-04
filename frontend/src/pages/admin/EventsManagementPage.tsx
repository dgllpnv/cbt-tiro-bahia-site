import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Trophy,
  Target,
  BookOpen,
  Wrench,
  Calendar as CalendarIcon,
  MapPin,
  Loader2,
  UserPlus,
  Save,
  Clock,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  LayoutGrid,
  X,
} from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO,
  differenceInDays,
  isAfter,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';
import { formatDate } from '@/lib/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

type EventTypeKey = 'TRAINING' | 'COMPETITION' | 'COURSE' | 'WORKSHOP';

interface EventParticipation {
  id: string;
  memberId: string;
  memberName?: string;
  caliberUsed?: string;
  placement?: number | null;
  score?: number | null;
  countsAsHabituality?: boolean;
}

interface EventItem {
  id: string;
  title: string;
  description?: string;
  eventType: EventTypeKey;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  maxParticipants?: number | null;
  isPublic?: boolean;
  participations?: EventParticipation[];
  participationsCount?: number;
}

interface EventFormState {
  title: string;
  description: string;
  eventType: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  maxParticipants: string;
  isPublic: boolean;
}

const emptyForm: EventFormState = {
  title: '',
  description: '',
  eventType: 'TRAINING',
  eventDate: '',
  startTime: '',
  endTime: '',
  location: '',
  maxParticipants: '',
  isPublic: true,
};

type ViewMode = 'calendar' | 'list';
type TypeFilter = 'ALL' | EventTypeKey;

// ── Type visuals ──────────────────────────────────────────────────────────────

const TYPE_VISUALS: Record<EventTypeKey, {
  label: string;
  hex: string;
  bg: string;
  border: string;
  text: string;
  pillBg: string;
  icon: React.ElementType;
}> = {
  TRAINING:    { label: 'Treino',     hex: '#3b82f6', bg: 'bg-blue-500/15',   border: 'border-blue-500/40',   text: 'text-blue-700 dark:text-blue-300',   pillBg: 'bg-blue-500/80',   icon: Target },
  COMPETITION: { label: 'Competição', hex: '#f97316', bg: 'bg-cbt-orange/15', border: 'border-cbt-orange/40', text: 'text-cbt-orange', pillBg: 'bg-cbt-orange/80', icon: Trophy },
  COURSE:      { label: 'Curso',      hex: '#22c55e', bg: 'bg-green-500/15',  border: 'border-green-500/40',  text: 'text-green-700 dark:text-green-300',  pillBg: 'bg-green-500/80',  icon: BookOpen },
  WORKSHOP:    { label: 'Workshop',   hex: '#a855f7', bg: 'bg-purple-500/15', border: 'border-purple-500/40', text: 'text-purple-700 dark:text-purple-300', pillBg: 'bg-purple-500/80', icon: Wrench },
};

const TYPE_KEYS: EventTypeKey[] = ['TRAINING', 'COMPETITION', 'COURSE', 'WORKSHOP'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEventTypeBadge(type: string) {
  return TYPE_VISUALS[type as EventTypeKey] ?? {
    label: type,
    hex: '#6b7280',
    bg: 'bg-muted-foreground/20',
    border: 'border-muted-foreground/40',
    text: 'text-muted-foreground',
    pillBg: 'bg-muted-foreground/40/80',
    icon: CalendarIcon,
  };
}

function timeOnly(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = parseISO(iso);
    return format(d, 'HH:mm');
  } catch {
    return '';
  }
}

function dateLabelLong(iso: string): string {
  try {
    const d = parseISO(iso);
    return format(d, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return formatDate(iso);
  }
}

function relativeUntil(iso: string): string {
  try {
    const d = startOfDay(parseISO(iso));
    const diff = differenceInDays(d, startOfDay(new Date()));
    if (diff < 0) return `há ${Math.abs(diff)} dia${Math.abs(diff) === 1 ? '' : 's'}`;
    if (diff === 0) return 'hoje';
    if (diff === 1) return 'amanhã';
    if (diff < 30) return `em ${diff} dias`;
    const months = Math.round(diff / 30);
    return `em ${months} ${months === 1 ? 'mês' : 'meses'}`;
  } catch {
    return '';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const EventsManagementPage = () => {
  const { toast } = useToast();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View
  const [view, setView] = useState<ViewMode>('calendar');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // Detail sheet
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);

  // Event form dialog
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: 'default' | 'destructive';
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    variant: 'default',
    onConfirm: () => {},
  });
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Participants dialog
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [participants, setParticipants] = useState<EventParticipation[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  const [newMemberId, setNewMemberId] = useState('');
  const [newCaliberUsed, setNewCaliberUsed] = useState('');
  const [newCountsAsHabituality, setNewCountsAsHabituality] = useState(true);
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);

  const [resultsMap, setResultsMap] = useState<Record<string, { placement: string; score: string }>>({});
  const [isSavingResults, setIsSavingResults] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/events', { params: { limit: 100 } });
      const data = res.data;
      const list: EventItem[] = Array.isArray(data) ? data : data.data || [];
      setEvents(list);
    } catch {
      toast({
        title: 'Erro ao carregar eventos',
        description: 'Não foi possível carregar a lista de eventos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ── Filtered events ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (typeFilter === 'ALL') return events;
    return events.filter((e) => e.eventType === typeFilter);
  }, [events, typeFilter]);

  // Counts per type (for chip badges)
  const typeCounts = useMemo(() => {
    const map: Record<string, number> = { ALL: events.length };
    for (const t of TYPE_KEYS) map[t] = events.filter((e) => e.eventType === t).length;
    return map;
  }, [events]);

  // Upcoming (next 5)
  const upcoming = useMemo(() => {
    const today = startOfDay(new Date());
    return [...filtered]
      .filter((e) => {
        try {
          return !isAfter(today, startOfDay(parseISO(e.eventDate)));
        } catch {
          return false;
        }
      })
      .sort((a, b) => parseISO(a.eventDate).getTime() - parseISO(b.eventDate).getTime())
      .slice(0, 4);
  }, [filtered]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [calendarMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of filtered) {
      try {
        const key = format(parseISO(e.eventDate), 'yyyy-MM-dd');
        const arr = map.get(key) ?? [];
        arr.push(e);
        map.set(key, arr);
      } catch {
        /* skip */
      }
    }
    return map;
  }, [filtered]);

  // Sorted full list (for list view)
  const sortedList = useMemo(() => {
    return [...filtered].sort(
      (a, b) => parseISO(a.eventDate).getTime() - parseISO(b.eventDate).getTime(),
    );
  }, [filtered]);

  // ── Form handlers ────────────────────────────────────────────────────────
  const updateField = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormDialogOpen(true);
  };

  const openEditDialog = (event: EventItem) => {
    setEditingId(event.id);
    setForm({
      title: event.title,
      description: event.description || '',
      eventType: event.eventType,
      eventDate: event.eventDate ? event.eventDate.split('T')[0] : '',
      startTime: event.startTime ? timeOnly(event.startTime) : '',
      endTime: event.endTime ? timeOnly(event.endTime) : '',
      location: event.location || '',
      maxParticipants: event.maxParticipants ? String(event.maxParticipants) : '',
      isPublic: event.isPublic ?? true,
    });
    setDetailEvent(null);
    setFormDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Título obrigatório', variant: 'destructive' });
      return;
    }
    if (!form.eventDate) {
      toast({ title: 'Data obrigatória', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      eventType: form.eventType,
      eventDate: form.eventDate,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      location: form.location.trim() || undefined,
      maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants) : undefined,
      isPublic: form.isPublic,
    };
    try {
      if (editingId) {
        await api.put(`/api/events/${editingId}`, payload);
        toast({ title: 'Evento atualizado com sucesso' });
      } else {
        await api.post('/api/events', payload);
        toast({ title: 'Evento criado com sucesso' });
      }
      setFormDialogOpen(false);
      fetchEvents();
    } catch {
      toast({
        title: editingId ? 'Erro ao atualizar evento' : 'Erro ao criar evento',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = (event: EventItem) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir evento',
      description: `Tem certeza que deseja excluir "${event.title}"? Esta ação não pode ser desfeita.`,
      variant: 'destructive',
      onConfirm: async () => {
        setIsActionLoading(true);
        try {
          await api.delete(`/api/events/${event.id}`);
          toast({ title: 'Evento excluído' });
          setConfirmDialog((p) => ({ ...p, open: false }));
          setDetailEvent(null);
          fetchEvents();
        } catch {
          toast({
            title: 'Erro ao excluir evento',
            description: 'Tente novamente mais tarde.',
            variant: 'destructive',
          });
        } finally {
          setIsActionLoading(false);
        }
      },
    });
  };

  // ── Participants management ──────────────────────────────────────────────
  const openParticipantsDialog = async (event: EventItem) => {
    setSelectedEvent(event);
    setParticipantsDialogOpen(true);
    setIsLoadingParticipants(true);
    setNewMemberId('');
    setNewCaliberUsed('');
    setNewCountsAsHabituality(true);

    try {
      const res = await api.get(`/api/events/${event.id}`);
      const data = res.data;
      const eventData = data.data || data;
      const parts: EventParticipation[] = eventData.participations || [];
      setParticipants(parts);
      const rMap: Record<string, { placement: string; score: string }> = {};
      parts.forEach((p) => {
        rMap[p.id] = {
          placement: p.placement != null ? String(p.placement) : '',
          score: p.score != null ? String(p.score) : '',
        };
      });
      setResultsMap(rMap);
    } catch {
      setParticipants([]);
      toast({ title: 'Erro ao carregar participantes', variant: 'destructive' });
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const handleAddParticipant = async () => {
    if (!selectedEvent || !newMemberId.trim()) {
      toast({ title: 'Informe o ID do membro', variant: 'destructive' });
      return;
    }
    setIsAddingParticipant(true);
    try {
      await api.post(`/api/events/${selectedEvent.id}/participants`, {
        memberId: newMemberId.trim(),
        caliberUsed: newCaliberUsed.trim() || undefined,
        countsAsHabituality: newCountsAsHabituality,
      });
      toast({ title: 'Participante adicionado' });
      setNewMemberId('');
      setNewCaliberUsed('');
      openParticipantsDialog(selectedEvent);
      fetchEvents();
    } catch {
      toast({
        title: 'Erro ao adicionar participante',
        description: 'Verifique o ID do membro e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsAddingParticipant(false);
    }
  };

  const handleSaveResults = async () => {
    if (!selectedEvent) return;
    setIsSavingResults(true);
    const results = participants.map((p) => ({
      participationId: p.id,
      placement: resultsMap[p.id]?.placement ? parseInt(resultsMap[p.id].placement) : null,
      score: resultsMap[p.id]?.score ? parseFloat(resultsMap[p.id].score) : null,
    }));
    try {
      await api.put(`/api/events/${selectedEvent.id}/results`, { results });
      toast({ title: 'Resultados salvos com sucesso' });
      fetchEvents();
    } catch {
      toast({
        title: 'Erro ao salvar resultados',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingResults(false);
    }
  };

  const updateResult = (participationId: string, field: 'placement' | 'score', value: string) => {
    setResultsMap((prev) => ({
      ...prev,
      [participationId]: { ...prev[participationId], [field]: value },
    }));
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Gestão de Eventos"
        description="Calendário, competições, cursos e workshops do clube"
        actions={
          <Button
            onClick={openCreateDialog}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        }
      />

      {/* ── Toolbar (view toggle + type filters) ─────────────────────────── */}
      <div className="bg-card/50 border border-border rounded-lg p-4 mb-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* View toggle */}
        <div className="inline-flex bg-muted border border-border rounded-md p-1 self-start">
          <button
            type="button"
            onClick={() => setView('calendar')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-tactical transition-colors ${
              view === 'calendar'
                ? 'bg-cbt-orange text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Calendário
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-tactical transition-colors ${
              view === 'list' ? 'bg-cbt-orange text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" />
            Lista
          </button>
        </div>

        {/* Type chips */}
        <div className="flex flex-wrap items-center gap-2">
          <TypeChip
            label="Todos"
            count={typeCounts.ALL}
            active={typeFilter === 'ALL'}
            onClick={() => setTypeFilter('ALL')}
          />
          {TYPE_KEYS.map((t) => {
            const v = TYPE_VISUALS[t];
            const Icon = v.icon;
            return (
              <TypeChip
                key={t}
                label={v.label}
                count={typeCounts[t]}
                active={typeFilter === t}
                onClick={() => setTypeFilter(t)}
                colorBg={v.bg}
                colorBorder={v.border}
                colorText={v.text}
                icon={Icon}
              />
            );
          })}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-card/50 border border-border rounded-lg">
          <LoadingSpinner message="Carregando eventos..." />
        </div>
      ) : events.length === 0 ? (
        <div className="bg-card/50 border border-border rounded-lg">
          <EmptyState
            icon={<CalendarIcon className="w-8 h-8 text-muted-foreground/80" />}
            title="Nenhum evento cadastrado"
            description="Crie o primeiro evento do clube para os associados."
            action={
              <Button
                onClick={openCreateDialog}
                className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Evento
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming row */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-military font-bold text-foreground tracking-wide mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-cbt-orange" />
                Próximos eventos
                <Badge className="bg-cbt-orange/15 text-cbt-orange border-cbt-orange/30 ml-1">
                  {upcoming.length}
                </Badge>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {upcoming.map((e) => (
                  <UpcomingCard key={e.id} event={e} onClick={() => setDetailEvent(e)} />
                ))}
              </div>
            </section>
          )}

          {/* Calendar OR List */}
          {view === 'calendar' ? (
            <CalendarView
              calendarDays={calendarDays}
              calendarMonth={calendarMonth}
              eventsByDay={eventsByDay}
              onPrev={() => setCalendarMonth((d) => subMonths(d, 1))}
              onNext={() => setCalendarMonth((d) => addMonths(d, 1))}
              onToday={() => setCalendarMonth(new Date())}
              onPickEvent={(e) => setDetailEvent(e)}
            />
          ) : (
            <ListView events={sortedList} onPick={(e) => setDetailEvent(e)} />
          )}
        </div>
      )}

      {/* ── Detail Sheet ────────────────────────────────────────────────── */}
      <Sheet open={!!detailEvent} onOpenChange={(open) => !open && setDetailEvent(null)}>
        <SheetContent className="bg-card border-l border-border text-foreground w-full sm:max-w-md overflow-y-auto">
          {detailEvent && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-tactical ${getEventTypeBadge(detailEvent.eventType).bg} ${getEventTypeBadge(detailEvent.eventType).border} ${getEventTypeBadge(detailEvent.eventType).text}`}
                  >
                    {(() => {
                      const Icon = getEventTypeBadge(detailEvent.eventType).icon;
                      return <Icon className="h-3 w-3" />;
                    })()}
                    {getEventTypeBadge(detailEvent.eventType).label}
                  </span>
                  <Badge className="bg-muted border-border text-muted-foreground text-[10px] font-tactical">
                    {relativeUntil(detailEvent.eventDate)}
                  </Badge>
                </div>
                <SheetTitle className="text-foreground font-military tracking-wide text-lg leading-tight text-left">
                  {detailEvent.title}
                </SheetTitle>
                <SheetDescription className="text-muted-foreground font-tactical text-sm text-left capitalize">
                  {dateLabelLong(detailEvent.eventDate)}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-4">
                {/* Quick facts */}
                <div className="grid grid-cols-2 gap-2 text-xs font-tactical">
                  <Fact icon={Clock} label="Horário">
                    {detailEvent.startTime
                      ? `${timeOnly(detailEvent.startTime)}${detailEvent.endTime ? ` – ${timeOnly(detailEvent.endTime)}` : ''}`
                      : '—'}
                  </Fact>
                  <Fact icon={MapPin} label="Local">
                    {detailEvent.location || '—'}
                  </Fact>
                  <Fact icon={Users} label="Participantes">
                    {detailEvent.participationsCount ?? detailEvent.participations?.length ?? 0}
                    {detailEvent.maxParticipants ? ` / ${detailEvent.maxParticipants}` : ''}
                  </Fact>
                  <Fact icon={CalendarIcon} label="Visibilidade">
                    {detailEvent.isPublic ? 'Pública' : 'Privada'}
                  </Fact>
                </div>

                {detailEvent.description && (
                  <div className="bg-muted/40 border border-border rounded-md p-3">
                    <p className="text-foreground/85 font-tactical text-sm leading-relaxed whitespace-pre-line">
                      {detailEvent.description}
                    </p>
                  </div>
                )}

                {detailEvent.maxParticipants && detailEvent.maxParticipants > 0 && (
                  <CapacityBar
                    current={detailEvent.participationsCount ?? detailEvent.participations?.length ?? 0}
                    max={detailEvent.maxParticipants}
                  />
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => openParticipantsDialog(detailEvent)}
                    className="bg-muted border-border text-foreground hover:bg-secondary hover:text-foreground font-tactical"
                  >
                    <Users className="h-4 w-4 mr-1.5" />
                    Participantes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openEditDialog(detailEvent)}
                    className="bg-muted border-border text-cbt-orange hover:bg-cbt-orange/10 hover:border-cbt-orange/40 font-tactical"
                  >
                    <Pencil className="h-4 w-4 mr-1.5" />
                    Editar
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => handleDelete(detailEvent)}
                  className="w-full text-red-700 dark:text-red-400 hover:text-red-700 dark:text-red-300 hover:bg-red-500/10 font-tactical"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Excluir evento
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Create / Edit Event Dialog ───────────────────────────────────── */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground font-military tracking-wide">
              {editingId ? 'Editar Evento' : 'Novo Evento'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-tactical text-sm">
              {editingId
                ? 'Atualize os dados do evento abaixo.'
                : 'Preencha os campos para criar um novo evento.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Título do evento"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Descrição do evento..."
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange min-h-[100px] resize-y"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground/85 font-tactical text-sm">Tipo *</Label>
                <Select value={form.eventType} onValueChange={(val) => updateField('eventType', val)}>
                  <SelectTrigger className="bg-muted border-border text-foreground focus:border-cbt-orange">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border">
                    <SelectItem value="TRAINING" className="text-foreground focus:bg-secondary">Treino</SelectItem>
                    <SelectItem value="COMPETITION" className="text-foreground focus:bg-secondary">Competição</SelectItem>
                    <SelectItem value="COURSE" className="text-foreground focus:bg-secondary">Curso</SelectItem>
                    <SelectItem value="WORKSHOP" className="text-foreground focus:bg-secondary">Workshop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/85 font-tactical text-sm">Data *</Label>
                <Input
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => updateField('eventDate', e.target.value)}
                  className="bg-muted border-border text-foreground focus:border-cbt-orange"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground/85 font-tactical text-sm">Hora início</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateField('startTime', e.target.value)}
                  className="bg-muted border-border text-foreground focus:border-cbt-orange"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/85 font-tactical text-sm">Hora fim</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => updateField('endTime', e.target.value)}
                  className="bg-muted border-border text-foreground focus:border-cbt-orange"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground/85 font-tactical text-sm">Local</Label>
                <Input
                  value={form.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="Local do evento"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/85 font-tactical text-sm">Máx. participantes</Label>
                <Input
                  type="number"
                  value={form.maxParticipants}
                  onChange={(e) => updateField('maxParticipants', e.target.value)}
                  placeholder="Sem limite"
                  min="0"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch
                checked={form.isPublic}
                onCheckedChange={(checked) => updateField('isPublic', checked)}
                className="data-[state=checked]:bg-cbt-orange"
              />
              <div>
                <Label className="text-foreground/85 font-tactical text-sm cursor-pointer">
                  Evento público
                </Label>
                <p className="text-xs text-muted-foreground/80 font-tactical">
                  Visível para todos os associados
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setFormDialogOpen(false)}
              disabled={isSaving}
              className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical min-w-[120px]"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                'Salvar alterações'
              ) : (
                'Criar evento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Participants Dialog ───────────────────────────────────────────── */}
      <Dialog open={participantsDialogOpen} onOpenChange={setParticipantsDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground font-military tracking-wide">
              Gerenciar Participantes
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-tactical text-sm">
              {selectedEvent?.title} — {selectedEvent?.eventDate ? formatDate(selectedEvent.eventDate) : ''}
            </DialogDescription>
          </DialogHeader>

          {isLoadingParticipants ? (
            <LoadingSpinner message="Carregando participantes..." />
          ) : (
            <div className="space-y-6 py-2">
              <div className="bg-muted/50 border border-border/50 rounded-lg p-4">
                <h4 className="text-sm font-military font-bold text-foreground tracking-wide mb-3 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-cbt-orange" />
                  Adicionar Participante
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground font-tactical text-xs">ID do membro *</Label>
                    <Input
                      value={newMemberId}
                      onChange={(e) => setNewMemberId(e.target.value)}
                      placeholder="ID ou número de sócio"
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground font-tactical text-xs">Calibre</Label>
                    <Input
                      value={newCaliberUsed}
                      onChange={(e) => setNewCaliberUsed(e.target.value)}
                      placeholder="Ex: .380, 9mm"
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange h-9 text-sm"
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex items-center gap-2 pb-1">
                      <Checkbox
                        checked={newCountsAsHabituality}
                        onCheckedChange={(checked) => setNewCountsAsHabituality(!!checked)}
                        className="border-input data-[state=checked]:bg-cbt-orange data-[state=checked]:border-cbt-orange"
                      />
                      <Label className="text-muted-foreground font-tactical text-xs cursor-pointer">
                        Habitualidade
                      </Label>
                    </div>
                    <Button
                      size="sm"
                      className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical h-9"
                      onClick={handleAddParticipant}
                      disabled={isAddingParticipant}
                    >
                      {isAddingParticipant ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Adicionar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-military font-bold text-foreground tracking-wide flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-cbt-orange" />
                    Participantes e Resultados
                  </h4>
                  {participants.length > 0 && (
                    <Button
                      size="sm"
                      className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical h-8"
                      onClick={handleSaveResults}
                      disabled={isSavingResults}
                    >
                      {isSavingResults ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Save className="h-3.5 w-3.5 mr-1" />
                      )}
                      Salvar resultados
                    </Button>
                  )}
                </div>

                {participants.length === 0 ? (
                  <div className="bg-muted/30 border border-border/50 rounded-lg">
                    <EmptyState
                      icon={<Users className="w-6 h-6 text-muted-foreground/80" />}
                      title="Nenhum participante"
                      description="Adicione participantes usando o formulário acima."
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-tactical text-muted-foreground/80 uppercase tracking-wide">
                      <div className="col-span-4">Participante</div>
                      <div className="col-span-2">Calibre</div>
                      <div className="col-span-3">Colocação</div>
                      <div className="col-span-3">Pontuação</div>
                    </div>
                    {participants.map((p) => (
                      <div
                        key={p.id}
                        className="grid grid-cols-12 gap-2 items-center px-3 py-2 bg-muted/50 rounded-md border border-border/30"
                      >
                        <div className="col-span-4">
                          <p className="text-sm font-tactical text-foreground truncate">
                            {p.memberName || p.memberId}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs font-tactical text-muted-foreground">
                            {p.caliberUsed || '---'}
                          </span>
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            min="1"
                            value={resultsMap[p.id]?.placement || ''}
                            onChange={(e) => updateResult(p.id, 'placement', e.target.value)}
                            placeholder="#"
                            className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60 focus:border-cbt-orange h-8 text-xs"
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            step="0.1"
                            value={resultsMap[p.id]?.score || ''}
                            onChange={(e) => updateResult(p.id, 'score', e.target.value)}
                            placeholder="Pts"
                            className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60 focus:border-cbt-orange h-8 text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setParticipantsDialogOpen(false)}
              className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((p) => ({ ...p, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        isLoading={isActionLoading}
      />
    </div>
  );
};

// ── Subcomponents ───────────────────────────────────────────────────────────

interface TypeChipProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  colorBg?: string;
  colorBorder?: string;
  colorText?: string;
  icon?: React.ElementType;
}

const TypeChip = ({
  label,
  count,
  active,
  onClick,
  colorBg,
  colorBorder,
  colorText,
  icon: Icon,
}: TypeChipProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-tactical transition-colors ${
      active
        ? `${colorBg ?? 'bg-cbt-orange/20'} ${colorBorder ?? 'border-cbt-orange/60'} ${colorText ?? 'text-cbt-orange'}`
        : 'bg-muted border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
    }`}
  >
    {Icon && <Icon className="h-3.5 w-3.5" />}
    {label}
    <span className={`text-[10px] ${active ? 'opacity-70' : 'opacity-50'}`}>
      {count}
    </span>
  </button>
);

interface UpcomingCardProps {
  event: EventItem;
  onClick: () => void;
}

const UpcomingCard = ({ event, onClick }: UpcomingCardProps) => {
  const visual = getEventTypeBadge(event.eventType);
  const Icon = visual.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-card/70 border border-border rounded-lg p-4 hover:border-cbt-orange/40 hover:ring-1 hover:ring-cbt-orange/20 transition-all"
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className={`h-1.5 flex-1 rounded-full ${visual.pillBg}`} style={{ background: visual.hex }} />
      </div>
      <div className="flex items-center gap-1 text-[10px] font-tactical uppercase tracking-wider text-muted-foreground/80 mb-1">
        <Icon className="h-3 w-3" style={{ color: visual.hex }} />
        <span style={{ color: visual.hex }}>{visual.label}</span>
        <span className="ml-auto text-cbt-orange font-bold normal-case">
          {relativeUntil(event.eventDate)}
        </span>
      </div>
      <p className="text-foreground font-tactical text-sm font-semibold leading-snug line-clamp-2">
        {event.title}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs font-tactical text-muted-foreground/80">
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" />
          {formatDate(event.eventDate)}
        </span>
        {event.startTime && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeOnly(event.startTime)}
          </span>
        )}
        {event.location && (
          <span className="inline-flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3" />
            {event.location}
          </span>
        )}
      </div>
    </button>
  );
};

interface CalendarViewProps {
  calendarDays: Date[];
  calendarMonth: Date;
  eventsByDay: Map<string, EventItem[]>;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onPickEvent: (e: EventItem) => void;
}

const CalendarView = ({
  calendarDays,
  calendarMonth,
  eventsByDay,
  onPrev,
  onNext,
  onToday,
  onPickEvent,
}: CalendarViewProps) => {
  const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  return (
    <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-foreground font-military tracking-wide text-base capitalize min-w-[180px] text-center">
            {format(calendarMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical h-8"
        >
          Hoje
        </Button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border bg-card/80">
        {weekdays.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-[10px] font-tactical uppercase tracking-wider text-muted-foreground/80 text-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {calendarDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, calendarMonth);
          const today = isToday(day);

          return (
            <div
              key={key}
              className={`min-h-[100px] border-r border-b border-border last:border-r-0 p-1.5 ${
                inMonth ? '' : 'bg-gray-950/50'
              } ${today ? 'bg-cbt-orange/5' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-military ${
                    today
                      ? 'text-cbt-orange font-bold'
                      : inMonth
                        ? 'text-foreground/85'
                        : 'text-muted-foreground/60'
                  }`}
                >
                  {today ? (
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-cbt-orange text-primary-foreground">
                      {format(day, 'd')}
                    </span>
                  ) : (
                    format(day, 'd')
                  )}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/80 font-tactical">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => {
                  const v = getEventTypeBadge(e.eventType);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onPickEvent(e)}
                      className="w-full text-left rounded-sm px-1.5 py-0.5 text-[10px] font-tactical text-foreground truncate hover:opacity-90 transition-opacity"
                      style={{ background: v.hex }}
                      title={`${e.title}${e.startTime ? ' · ' + timeOnly(e.startTime) : ''}`}
                    >
                      {e.startTime && (
                        <span className="opacity-80 mr-1">{timeOnly(e.startTime)}</span>
                      )}
                      {e.title}
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onPickEvent(dayEvents[3])}
                    className="w-full text-left text-[10px] font-tactical text-muted-foreground/80 hover:text-foreground/85 px-1.5"
                  >
                    +{dayEvents.length - 3} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ListViewProps {
  events: EventItem[];
  onPick: (e: EventItem) => void;
}

const ListView = ({ events, onPick }: ListViewProps) => {
  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of events) {
      try {
        const key = format(parseISO(e.eventDate), 'yyyy-MM');
        const arr = map.get(key) ?? [];
        arr.push(e);
        map.set(key, arr);
      } catch {
        /* skip */
      }
    }
    return map;
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="bg-card/50 border border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground/80 font-tactical text-sm">
          Nenhum evento corresponde aos filtros selecionados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {Array.from(grouped.entries()).map(([key, monthEvents]) => {
        const monthLabel = format(parseISO(key + '-01'), "MMMM 'de' yyyy", { locale: ptBR });
        return (
          <section key={key}>
            <h3 className="text-xs font-military font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 capitalize">
              {monthLabel}
            </h3>
            <div className="bg-card/50 border border-border rounded-lg overflow-hidden divide-y divide-gray-800">
              {monthEvents.map((e) => {
                const v = getEventTypeBadge(e.eventType);
                const Icon = v.icon;
                const day = format(parseISO(e.eventDate), 'd');
                const weekday = format(parseISO(e.eventDate), 'EEE', { locale: ptBR });
                const count = e.participationsCount ?? e.participations?.length ?? 0;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onPick(e)}
                    className="w-full grid grid-cols-[60px_1fr_auto] gap-3 items-center px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                  >
                    {/* Date block */}
                    <div className="flex flex-col items-center justify-center bg-muted/60 border border-border rounded-md py-1.5">
                      <span className="text-cbt-orange font-military text-lg leading-none font-bold">
                        {day}
                      </span>
                      <span className="text-muted-foreground/80 font-tactical text-[10px] uppercase">
                        {weekday}
                      </span>
                    </div>
                    {/* Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-tactical ${v.bg} ${v.border} ${v.text}`}
                        >
                          <Icon className="h-2.5 w-2.5" />
                          {v.label}
                        </span>
                        <span className="text-[10px] text-cbt-orange font-tactical">
                          {relativeUntil(e.eventDate)}
                        </span>
                      </div>
                      <p className="text-foreground font-tactical text-sm truncate">{e.title}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground/80 font-tactical">
                        {e.startTime && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeOnly(e.startTime)}
                            {e.endTime && <> – {timeOnly(e.endTime)}</>}
                          </span>
                        )}
                        {e.location && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                            <MapPin className="h-3 w-3" />
                            {e.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {count}
                          {e.maxParticipants ? ` / ${e.maxParticipants}` : ''}
                        </span>
                      </div>
                    </div>
                    {/* Capacity bar */}
                    {e.maxParticipants ? (
                      <div className="hidden lg:block w-32">
                        <CapacityBar
                          current={count}
                          max={e.maxParticipants}
                          compact
                        />
                      </div>
                    ) : (
                      <div className="hidden lg:block w-32" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

// ── Tiny utils ─────────────────────────────────────────────────────────────

const Fact = ({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="bg-muted/40 border border-border rounded-md p-2">
    <div className="flex items-center gap-1 text-muted-foreground/80 mb-0.5">
      <Icon className="h-3 w-3" />
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-foreground text-sm">{children}</p>
  </div>
);

const CapacityBar = ({
  current,
  max,
  compact,
}: {
  current: number;
  max: number;
  compact?: boolean;
}) => {
  const pct = Math.min(100, Math.round((current / Math.max(max, 1)) * 100));
  const color = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e';
  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      <div className={`flex items-center justify-between font-tactical ${compact ? 'text-[10px]' : 'text-xs'}`}>
        <span className="text-muted-foreground/80">Inscrições</span>
        <span className="text-foreground tabular-nums">{current}/{max}</span>
      </div>
      <div className={`bg-muted rounded-full overflow-hidden ${compact ? 'h-1' : 'h-1.5'}`}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
};

export default EventsManagementPage;
