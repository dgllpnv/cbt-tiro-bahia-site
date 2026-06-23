import { useEffect, useState } from 'react';
import { Calendar, MapPin, Clock3, CalendarDays, X, Users, ArrowRight } from 'lucide-react';
import { fetchPublicEvents, type PublicEvent } from '@/services/publicNewsService';

// =====================================================
// Events — Agenda de eventos na home (consome /api/public/events).
// Lista os proximos eventos publicos. Se nao houver, a secao se oculta.
// =====================================================

const EVENT_TYPE_LABELS: Record<string, string> = {
  TRAINING: 'Treino',
  COMPETITION: 'Competição',
  COURSE: 'Curso',
  WORKSHOP: 'Workshop',
};

function formatEventDate(iso: string): string {
  try {
    // eventDate e gravado como meia-noite UTC do dia escolhido — formatar em UTC
    // evita o "dia anterior" no fuso da Bahia.
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

function formatTimeRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bahia',
    });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

// Prazo de inscricao e um timestamp completo (nao @db.Date) — formatar em
// America/Bahia evita o deslocamento de fuso.
function formatDeadline(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bahia',
    });
  } catch {
    return iso;
  }
}

const Events = () => {
  const [items, setItems] = useState<PublicEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [openEvent, setOpenEvent] = useState<PublicEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchPublicEvents(8);
      if (!cancelled) {
        setItems(r.success ? r.data : []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ESC fecha modal + body scroll lock enquanto aberto
  useEffect(() => {
    if (!openEvent) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenEvent(null);
    };
    window.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [openEvent]);

  // Esconde a secao se nao houver eventos futuros publicados
  if (!loading && (!items || items.length === 0)) return null;

  return (
    <section id="eventos" className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cbt-orange/10 border border-cbt-orange/30 mb-5">
              <CalendarDays className="w-4 h-4 text-cbt-orange" />
              <span className="text-cbt-orange font-tactical text-xs uppercase tracking-widest font-bold">
                Agenda do clube
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-military font-bold text-white mb-4">
              PRÓXIMOS <span className="text-cbt-orange">EVENTOS</span>
            </h2>
            <div className="w-24 h-1 bg-cbt-orange mx-auto mb-8"></div>
            <p className="text-xl text-gray-300 font-tactical max-w-3xl mx-auto">
              Treinos, competições e cursos abertos à nossa comunidade
            </p>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-56 bg-gray-900/50 border border-gray-700 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items!.map((ev) => {
                const timeRange = formatTimeRange(ev.startTime, ev.endTime);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setOpenEvent(ev)}
                    className="group text-left bg-gray-900/50 border border-gray-700 hover:border-cbt-orange/60 rounded-lg overflow-hidden tactical-shadow transition-all duration-300 hover:-translate-y-1 flex flex-col cursor-pointer focus:outline-none focus:ring-2 focus:ring-cbt-orange/60"
                    aria-label={`Ver detalhes do evento: ${ev.title}`}
                  >
                    {/* Image / banner */}
                    <div className="relative h-40 bg-gray-800 overflow-hidden flex items-center justify-center">
                      {ev.imageUrl ? (
                        <img
                          src={ev.imageUrl}
                          alt={ev.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-cbt-orange/20 to-gray-800">
                          <CalendarDays className="w-12 h-12 text-cbt-orange/50" />
                        </div>
                      )}
                      <span className="absolute top-3 left-3 inline-flex items-center px-2 py-1 rounded-md bg-cbt-orange text-black text-[10px] font-tactical font-bold uppercase">
                        {EVENT_TYPE_LABELS[ev.eventType] || ev.eventType}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-center gap-2 text-xs font-tactical text-gray-400 mb-2">
                        <Calendar className="w-3.5 h-3.5 text-cbt-orange" />
                        <span>{formatEventDate(ev.eventDate)}</span>
                      </div>
                      {timeRange && (
                        <div className="flex items-center gap-2 text-xs font-tactical text-gray-500 mb-2">
                          <Clock3 className="w-3.5 h-3.5" />
                          <span>{timeRange}</span>
                        </div>
                      )}
                      <h3 className="text-lg font-military font-bold text-white mb-2 line-clamp-2 group-hover:text-cbt-orange transition-colors">
                        {ev.title}
                      </h3>
                      {ev.description && (
                        <p className="text-gray-400 font-tactical text-sm leading-relaxed line-clamp-3 flex-1">
                          {ev.description}
                        </p>
                      )}
                      {ev.location && (
                        <div className="mt-4 flex items-center gap-2 text-xs font-tactical text-gray-500">
                          <MapPin className="w-3.5 h-3.5 text-cbt-orange" />
                          <span className="line-clamp-1">{ev.location}</span>
                        </div>
                      )}
                      {/* Ver detalhes */}
                      <div className="mt-4 pt-3 border-t border-gray-800">
                        <span className="text-cbt-orange font-tactical text-xs uppercase tracking-wider font-bold flex items-center gap-1.5">
                          Ver detalhes
                          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Event Modal (detalhes completos) ───────────────────────────── */}
      {openEvent && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-start md:items-center justify-center p-0 md:p-4 animate-fade-in overflow-y-auto"
          onClick={() => setOpenEvent(null)}
        >
          <article
            className="relative w-full max-w-3xl bg-gray-900 md:rounded-xl border-0 md:border md:border-cbt-orange/30 shadow-2xl my-0 md:my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button — flutuante por cima do hero */}
            <button
              onClick={() => setOpenEvent(null)}
              className="absolute top-3 right-3 md:top-4 md:right-4 z-10 text-white hover:text-cbt-orange p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm transition-all"
              aria-label="Fechar evento"
            >
              <X size={24} />
            </button>

            {/* Hero — imagem ou gradiente CBT */}
            <div className="relative h-56 md:h-72 bg-gray-800 overflow-hidden md:rounded-t-xl">
              {openEvent.imageUrl ? (
                <img
                  src={openEvent.imageUrl}
                  alt={openEvent.title}
                  className="w-full h-full object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-cbt-orange/30 via-gray-800 to-black">
                  <CalendarDays className="w-20 h-20 text-cbt-orange/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>

              <span className="absolute top-3 left-3 md:top-4 md:left-4 inline-flex items-center px-3 py-1 rounded-md bg-cbt-orange text-black text-[11px] font-tactical font-bold uppercase tracking-wider shadow-lg">
                {EVENT_TYPE_LABELS[openEvent.eventType] || openEvent.eventType}
              </span>
            </div>

            {/* Body */}
            <div className="px-5 md:px-10 pt-6 pb-8 md:pb-10">
              {/* Meta */}
              <div className="flex items-center gap-3 md:gap-4 text-xs font-tactical text-gray-500 mb-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cbt-orange" />
                  {formatEventDate(openEvent.eventDate)}
                </span>
                {formatTimeRange(openEvent.startTime, openEvent.endTime) && (
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="w-3.5 h-3.5 text-cbt-orange" />
                    {formatTimeRange(openEvent.startTime, openEvent.endTime)}
                  </span>
                )}
                {openEvent.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-cbt-orange" />
                    {openEvent.location}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl md:text-4xl font-military font-bold text-white leading-tight mb-4">
                {openEvent.title}
              </h1>

              {/* Description — split em paragrafos por linhas em branco */}
              {openEvent.description ? (
                <div className="space-y-4 text-gray-200 font-tactical text-base leading-relaxed">
                  {openEvent.description
                    .split(/\n\s*\n/)
                    .map((para) => para.trim())
                    .filter(Boolean)
                    .map((para, i) => (
                      <p key={i} className="whitespace-pre-line">
                        {para}
                      </p>
                    ))}
                </div>
              ) : (
                <p className="text-gray-400 font-tactical text-base italic">
                  Sem descrição detalhada para este evento.
                </p>
              )}

              {/* Informações adicionais */}
              {(openEvent.maxParticipants || openEvent.registrationDeadline) && (
                <div className="mt-6 grid sm:grid-cols-2 gap-3">
                  {openEvent.maxParticipants && (
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-gray-800/60 border border-gray-700">
                      <Users className="w-4 h-4 text-cbt-orange shrink-0" />
                      <span className="text-sm font-tactical text-gray-200">
                        <span className="text-gray-400">Vagas:</span> {openEvent.maxParticipants}
                      </span>
                    </div>
                  )}
                  {openEvent.registrationDeadline && (
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-gray-800/60 border border-gray-700">
                      <Clock3 className="w-4 h-4 text-cbt-orange shrink-0" />
                      <span className="text-sm font-tactical text-gray-200">
                        <span className="text-gray-400">Inscrições até:</span>{' '}
                        {formatDeadline(openEvent.registrationDeadline)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className="text-gray-500 font-tactical text-xs flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cbt-orange" />
                  {formatEventDate(openEvent.eventDate)}
                </p>
                <button
                  onClick={() => setOpenEvent(null)}
                  className="self-start sm:self-auto px-5 py-2 bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold uppercase tracking-wide text-xs rounded-md transition-all hover:scale-105"
                >
                  Fechar
                </button>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  );
};

export default Events;
