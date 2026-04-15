import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Trophy,
  Target,
  BookOpen,
  Wrench,
  Calendar,
  MapPin,
  Loader2,
  UserPlus,
  Save,
} from 'lucide-react';

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

import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';
import { formatDate } from '@/lib/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventParticipation {
  id: string;
  memberId: string;
  memberName?: string;
  caliberUsed?: string;
  placement?: number | null;
  score?: number | null;
  countsAsHabituality?: boolean;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const getEventTypeBadge = (type: string) => {
  const map: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    TRAINING: { label: 'Treino', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Target },
    COMPETITION: { label: 'Competicao', className: 'bg-cbt-orange/15 text-cbt-orange border-cbt-orange/30', icon: Trophy },
    COURSE: { label: 'Curso', className: 'bg-green-500/15 text-green-400 border-green-500/30', icon: BookOpen },
    WORKSHOP: { label: 'Workshop', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30', icon: Wrench },
  };
  return map[type] || { label: type, className: 'bg-gray-500/15 text-gray-400 border-gray-500/30', icon: Calendar };
};

// ── Component ─────────────────────────────────────────────────────────────────

const EventsManagementPage = () => {
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<EventParticipation[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  // Add participant form
  const [newMemberId, setNewMemberId] = useState('');
  const [newCaliberUsed, setNewCaliberUsed] = useState('');
  const [newCountsAsHabituality, setNewCountsAsHabituality] = useState(true);
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);

  // Results
  const [resultsMap, setResultsMap] = useState<Record<string, { placement: string; score: string }>>({});
  const [isSavingResults, setIsSavingResults] = useState(false);

  // ── Fetch events ───────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/events', { params: { limit: 100 } });
      const data = res.data;
      setEvents(Array.isArray(data) ? data : data.data || []);
    } catch {
      toast({
        title: 'Erro ao carregar eventos',
        description: 'Nao foi possivel carregar a lista de eventos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ── Form helpers ───────────────────────────────────────────────────────────
  const updateField = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormDialogOpen(true);
  };

  const openEditDialog = (event: Event) => {
    setEditingId(event.id);
    setForm({
      title: event.title,
      description: event.description || '',
      eventType: event.eventType,
      eventDate: event.eventDate ? event.eventDate.split('T')[0] : '',
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      location: event.location || '',
      maxParticipants: event.maxParticipants ? String(event.maxParticipants) : '',
      isPublic: event.isPublic ?? true,
    });
    setFormDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Titulo obrigatorio', variant: 'destructive' });
      return;
    }
    if (!form.eventDate) {
      toast({ title: 'Data obrigatoria', variant: 'destructive' });
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

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = (event: Event) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir evento',
      description: `Tem certeza que deseja excluir o evento "${event.title}"? Esta acao nao pode ser desfeita.`,
      variant: 'destructive',
      onConfirm: async () => {
        setIsActionLoading(true);
        try {
          await api.delete(`/api/events/${event.id}`);
          toast({ title: 'Evento excluido com sucesso' });
          setConfirmDialog((prev) => ({ ...prev, open: false }));
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

  // ── Participants management ────────────────────────────────────────────────
  const openParticipantsDialog = async (event: Event) => {
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

      // Initialize results map
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
      toast({
        title: 'Erro ao carregar participantes',
        variant: 'destructive',
      });
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
      // Refresh participants
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

  // ── Save results ───────────────────────────────────────────────────────────
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
      [participationId]: {
        ...prev[participationId],
        [field]: value,
      },
    }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Gestao de Eventos"
        description="Criar e gerenciar eventos e competicoes"
        actions={
          <Button
            onClick={openCreateDialog}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        }
      />

      {/* ── Events list ──────────────────────────────────────────────────── */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Carregando eventos..." />
        ) : events.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-8 h-8 text-gray-500" />}
            title="Nenhum evento encontrado"
            description="Crie o primeiro evento do clube."
            action={
              <Button
                onClick={openCreateDialog}
                className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Evento
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-gray-800">
            {events.map((event) => {
              const typeBadge = getEventTypeBadge(event.eventType);
              const TypeIcon = typeBadge.icon;
              const participantsCount = event.participationsCount ?? event.participations?.length ?? 0;

              return (
                <div
                  key={event.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-gray-800/30 transition-colors"
                >
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium text-sm truncate">{event.title}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] font-tactical ${typeBadge.className}`}>
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {typeBadge.label}
                      </Badge>
                      <span className="text-xs text-gray-500 font-tactical flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(event.eventDate)}
                      </span>
                      {event.location && (
                        <span className="text-xs text-gray-500 font-tactical flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 font-tactical flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {participantsCount}
                        {event.maxParticipants ? ` / ${event.maxParticipants}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-cbt-orange hover:bg-gray-700"
                      title="Gerenciar Participantes"
                      onClick={() => openParticipantsDialog(event)}
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-cbt-orange hover:bg-gray-700"
                      title="Editar"
                      onClick={() => openEditDialog(event)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-gray-700"
                      title="Excluir"
                      onClick={() => handleDelete(event)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit Event Dialog ───────────────────────────────────── */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white font-military tracking-wide">
              {editingId ? 'Editar Evento' : 'Novo Evento'}
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-tactical text-sm">
              {editingId
                ? 'Atualize os dados do evento abaixo.'
                : 'Preencha os campos para criar um novo evento.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label className="text-gray-300 font-tactical text-sm">Titulo *</Label>
              <Input
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Titulo do evento"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-gray-300 font-tactical text-sm">Descricao</Label>
              <Textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Descricao do evento..."
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange min-h-[100px] resize-y"
              />
            </div>

            {/* Event type + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300 font-tactical text-sm">Tipo de Evento *</Label>
                <Select value={form.eventType} onValueChange={(val) => updateField('eventType', val)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:border-cbt-orange">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="TRAINING" className="text-white focus:bg-gray-700 focus:text-white">Treino</SelectItem>
                    <SelectItem value="COMPETITION" className="text-white focus:bg-gray-700 focus:text-white">Competicao</SelectItem>
                    <SelectItem value="COURSE" className="text-white focus:bg-gray-700 focus:text-white">Curso</SelectItem>
                    <SelectItem value="WORKSHOP" className="text-white focus:bg-gray-700 focus:text-white">Workshop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 font-tactical text-sm">Data *</Label>
                <Input
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => updateField('eventDate', e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white focus:border-cbt-orange"
                />
              </div>
            </div>

            {/* Start/End time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300 font-tactical text-sm">Hora Inicio</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateField('startTime', e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white focus:border-cbt-orange"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 font-tactical text-sm">Hora Fim</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => updateField('endTime', e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white focus:border-cbt-orange"
                />
              </div>
            </div>

            {/* Location + Max participants */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300 font-tactical text-sm">Local</Label>
                <Input
                  value={form.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="Local do evento"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 font-tactical text-sm">Max. Participantes</Label>
                <Input
                  type="number"
                  value={form.maxParticipants}
                  onChange={(e) => updateField('maxParticipants', e.target.value)}
                  placeholder="Sem limite"
                  min="1"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange"
                />
              </div>
            </div>

            {/* Public switch */}
            <div className="flex items-center gap-3 pt-2">
              <Switch
                checked={form.isPublic}
                onCheckedChange={(checked) => updateField('isPublic', checked)}
                className="data-[state=checked]:bg-cbt-orange"
              />
              <div>
                <Label className="text-gray-300 font-tactical text-sm cursor-pointer">Evento publico</Label>
                <p className="text-xs text-gray-500 font-tactical">Visivel para todos os associados</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setFormDialogOpen(false)}
              disabled={isSaving}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical min-w-[120px]"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                'Salvar Alteracoes'
              ) : (
                'Criar Evento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Participants Dialog ───────────────────────────────────────────── */}
      <Dialog open={participantsDialogOpen} onOpenChange={setParticipantsDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white font-military tracking-wide">
              Gerenciar Participantes
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-tactical text-sm">
              {selectedEvent?.title} — {selectedEvent?.eventDate ? formatDate(selectedEvent.eventDate) : ''}
            </DialogDescription>
          </DialogHeader>

          {isLoadingParticipants ? (
            <LoadingSpinner message="Carregando participantes..." />
          ) : (
            <div className="space-y-6 py-2">
              {/* ── Add participant form ─────────────────────────────────── */}
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                <h4 className="text-sm font-military font-bold text-white tracking-wide mb-3 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-cbt-orange" />
                  Adicionar Participante
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-gray-400 font-tactical text-xs">ID do Membro *</Label>
                    <Input
                      value={newMemberId}
                      onChange={(e) => setNewMemberId(e.target.value)}
                      placeholder="ID ou numero de socio"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-gray-400 font-tactical text-xs">Calibre Utilizado</Label>
                    <Input
                      value={newCaliberUsed}
                      onChange={(e) => setNewCaliberUsed(e.target.value)}
                      placeholder="Ex: .380, 9mm"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange h-9 text-sm"
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex items-center gap-2 pb-1">
                      <Checkbox
                        checked={newCountsAsHabituality}
                        onCheckedChange={(checked) => setNewCountsAsHabituality(!!checked)}
                        className="border-gray-600 data-[state=checked]:bg-cbt-orange data-[state=checked]:border-cbt-orange"
                      />
                      <Label className="text-gray-400 font-tactical text-xs cursor-pointer">Habitualidade</Label>
                    </div>
                    <Button
                      size="sm"
                      className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical h-9"
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

              {/* ── Participants list + results ──────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-military font-bold text-white tracking-wide flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-cbt-orange" />
                    Participantes e Resultados
                  </h4>
                  {participants.length > 0 && (
                    <Button
                      size="sm"
                      className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical h-8"
                      onClick={handleSaveResults}
                      disabled={isSavingResults}
                    >
                      {isSavingResults ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Save className="h-3.5 w-3.5 mr-1" />
                      )}
                      Salvar Resultados
                    </Button>
                  )}
                </div>

                {participants.length === 0 ? (
                  <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg">
                    <EmptyState
                      icon={<Users className="w-6 h-6 text-gray-500" />}
                      title="Nenhum participante"
                      description="Adicione participantes usando o formulario acima."
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-tactical text-gray-500 uppercase tracking-wide">
                      <div className="col-span-4">Participante</div>
                      <div className="col-span-2">Calibre</div>
                      <div className="col-span-3">Colocacao</div>
                      <div className="col-span-3">Pontuacao</div>
                    </div>

                    {participants.map((p) => (
                      <div
                        key={p.id}
                        className="grid grid-cols-12 gap-2 items-center px-3 py-2 bg-gray-800/50 rounded-md border border-gray-700/30"
                      >
                        <div className="col-span-4">
                          <p className="text-sm font-tactical text-white truncate">
                            {p.memberName || p.memberId}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs font-tactical text-gray-400">
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
                            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 focus:border-cbt-orange h-8 text-xs"
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            step="0.1"
                            value={resultsMap[p.id]?.score || ''}
                            onChange={(e) => updateResult(p.id, 'score', e.target.value)}
                            placeholder="Pts"
                            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 focus:border-cbt-orange h-8 text-xs"
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
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Dialog ───────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        isLoading={isActionLoading}
      />
    </div>
  );
};

export default EventsManagementPage;
