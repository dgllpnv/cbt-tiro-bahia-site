import { useEffect, useState } from 'react';
import { Calendar, Pin, Newspaper, X, ArrowRight, User as UserIcon, Clock3 } from 'lucide-react';
import { fetchPublicNews, type PublicNews } from '@/services/publicNewsService';

// =====================================================
// News — Bloco de notícias na home (consome /api/public/news).
// Lista as 3 mais recentes (pinned primeiro). Click no card abre modal
// full-screen com leitura completa: hero (imagem ou gradiente), titulo,
// meta (data + autor + selo destaque), conteudo paragrafado.
// Se nao houver noticias publicadas, a secao se oculta automaticamente.
// =====================================================

function formatBr(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function preview(content: string, max = 160): string {
  const txt = content.replace(/\s+/g, ' ').trim();
  if (txt.length <= max) return txt;
  return txt.slice(0, max).trimEnd() + '…';
}

// Estima tempo de leitura — 200 palavras/minuto e o referencial padrao de
// jornalismo digital. Util para o leitor decidir abrir agora ou depois.
function readingTime(content: string): string {
  const words = content.trim().split(/\s+/).length;
  const min = Math.max(1, Math.round(words / 200));
  return `${min} min de leitura`;
}

const News = () => {
  const [items, setItems] = useState<PublicNews[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [openNews, setOpenNews] = useState<PublicNews | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchPublicNews(3);
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
    if (!openNews) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenNews(null);
    };
    window.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [openNews]);

  // Esconde a secao se nao houver noticias publicadas
  if (!loading && (!items || items.length === 0)) return null;

  return (
    <section id="noticias" className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-military font-bold text-white mb-4">
              ÚLTIMAS <span className="text-cbt-orange">NOTÍCIAS</span>
            </h2>
            <div className="w-24 h-1 bg-cbt-orange mx-auto mb-8"></div>
            <p className="text-xl text-gray-300 font-tactical max-w-3xl mx-auto">
              Acompanhe novidades, eventos e comunicados do Clube Baiano de Tiro
            </p>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-80 bg-gray-900/50 border border-gray-700 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {items!.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setOpenNews(n)}
                  className="group text-left bg-gray-900/50 border border-gray-700 hover:border-cbt-orange/60 rounded-lg overflow-hidden tactical-shadow transition-all duration-300 hover:-translate-y-1 flex flex-col cursor-pointer focus:outline-none focus:ring-2 focus:ring-cbt-orange/60"
                  aria-label={`Ler notícia: ${n.title}`}
                >
                  {/* Image */}
                  <div className="relative h-48 bg-gray-800 overflow-hidden flex items-center justify-center">
                    {n.imageUrl ? (
                      <img
                        src={n.imageUrl}
                        alt={n.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-cbt-orange/20 to-gray-800">
                        <Newspaper className="w-12 h-12 text-cbt-orange/50" />
                      </div>
                    )}
                    {n.isPinned && (
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-cbt-orange text-black text-[10px] font-tactical font-bold uppercase">
                        <Pin className="w-3 h-3" />
                        Destaque
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 text-xs font-tactical text-gray-500 mb-3">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatBr(n.publishedAt)}</span>
                      {n.author?.fullName && (
                        <>
                          <span>•</span>
                          <span>{n.author.fullName.split(' ')[0]}</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-lg font-military font-bold text-white mb-2 line-clamp-2 group-hover:text-cbt-orange transition-colors">
                      {n.title}
                    </h3>
                    <p className="text-gray-400 font-tactical text-sm leading-relaxed line-clamp-4 flex-1">
                      {n.summary || preview(n.content)}
                    </p>
                    {/* Read more cue */}
                    <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
                      <span className="text-cbt-orange font-tactical text-xs uppercase tracking-wider font-bold flex items-center gap-1.5">
                        Ler matéria completa
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                      </span>
                      <span className="text-gray-600 font-tactical text-[10px] flex items-center gap-1">
                        <Clock3 className="w-3 h-3" />
                        {readingTime(n.content)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Article Modal (leitura completa) ───────────────────────────── */}
      {openNews && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-start md:items-center justify-center p-0 md:p-4 animate-fade-in overflow-y-auto"
          onClick={() => setOpenNews(null)}
        >
          <article
            className="relative w-full max-w-3xl bg-gray-900 md:rounded-xl border-0 md:border md:border-cbt-orange/30 shadow-2xl my-0 md:my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button — flutuante por cima do hero */}
            <button
              onClick={() => setOpenNews(null)}
              className="absolute top-3 right-3 md:top-4 md:right-4 z-10 text-white hover:text-cbt-orange p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm transition-all"
              aria-label="Fechar matéria"
            >
              <X size={24} />
            </button>

            {/* Hero — imagem ou gradiente CBT */}
            <div className="relative h-56 md:h-72 bg-gray-800 overflow-hidden md:rounded-t-xl">
              {openNews.imageUrl ? (
                <img
                  src={openNews.imageUrl}
                  alt={openNews.title}
                  className="w-full h-full object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-cbt-orange/30 via-gray-800 to-black">
                  <Newspaper className="w-20 h-20 text-cbt-orange/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>

              {openNews.isPinned && (
                <span className="absolute top-3 left-3 md:top-4 md:left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-cbt-orange text-black text-[11px] font-tactical font-bold uppercase tracking-wider shadow-lg">
                  <Pin className="w-3 h-3" />
                  Destaque
                </span>
              )}
            </div>

            {/* Body */}
            <div className="px-5 md:px-10 pt-6 pb-8 md:pb-10">
              {/* Meta */}
              <div className="flex items-center gap-3 md:gap-4 text-xs font-tactical text-gray-500 mb-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cbt-orange" />
                  {formatBr(openNews.publishedAt)}
                </span>
                {openNews.author?.fullName && (
                  <span className="flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-cbt-orange" />
                    {openNews.author.fullName}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock3 className="w-3.5 h-3.5 text-cbt-orange" />
                  {readingTime(openNews.content)}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-2xl md:text-4xl font-military font-bold text-white leading-tight mb-4">
                {openNews.title}
              </h1>

              {/* Summary as lead paragraph (italic + accent) */}
              {openNews.summary && (
                <p className="text-gray-300 font-tactical text-base md:text-lg leading-relaxed mb-6 pl-4 border-l-4 border-cbt-orange/70 italic">
                  {openNews.summary}
                </p>
              )}

              {/* Content — split em paragrafos por linhas em branco */}
              <div className="space-y-4 text-gray-200 font-tactical text-base leading-relaxed">
                {openNews.content
                  .split(/\n\s*\n/)
                  .map((para, i) => para.trim())
                  .filter(Boolean)
                  .map((para, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {para}
                    </p>
                  ))}
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className="text-gray-500 font-tactical text-xs">
                  Publicado em {formatBr(openNews.publishedAt)}
                  {openNews.author?.fullName && ` por ${openNews.author.fullName}`}
                </p>
                <button
                  onClick={() => setOpenNews(null)}
                  className="self-start sm:self-auto px-5 py-2 bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold uppercase tracking-wide text-xs rounded-md transition-all hover:scale-105"
                >
                  Fechar matéria
                </button>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  );
};

export default News;
