import { useEffect, useState } from 'react';
import { Calendar, MapPin, Clock3, CalendarDays } from 'lucide-react';
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

const Events = () => {
  const [items, setItems] = useState<PublicEvent[] | null>(null);
  const [loading, setLoading] = useState(true);

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
                  <div
                    key={ev.id}
                    className="bg-gray-900/50 border border-gray-700 hover:border-cbt-orange/60 rounded-lg overflow-hidden tactical-shadow transition-all duration-300 hover:-translate-y-1 flex flex-col"
                  >
                    {/* Image / banner */}
                    <div className="relative h-40 bg-gray-800 overflow-hidden flex items-center justify-center">
                      {ev.imageUrl ? (
                        <img
                          src={ev.imageUrl}
                          alt={ev.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
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
                      <h3 className="text-lg font-military font-bold text-white mb-2 line-clamp-2">
                        {ev.title}
                      </h3>
                      {ev.description && (
                        <p className="text-gray-400 font-tactical text-sm leading-relaxed line-clamp-3 flex-1">
                          {ev.description}
                        </p>
                      )}
                      {ev.location && (
                        <div className="mt-4 pt-3 border-t border-gray-800 flex items-center gap-2 text-xs font-tactical text-gray-500">
                          <MapPin className="w-3.5 h-3.5 text-cbt-orange" />
                          <span className="line-clamp-1">{ev.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Events;
