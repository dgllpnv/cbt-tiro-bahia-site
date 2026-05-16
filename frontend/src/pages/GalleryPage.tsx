import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  X,
  Maximize2,
  ArrowLeft,
  Grid3x3,
} from 'lucide-react';
import { fetchPublicGallery, type PublicGalleryImage } from '@/services/publicNewsService';

// =====================================================
// GalleryPage — Pagina publica dedicada (/galeria).
// Mostra todas as fotos em masonry-style grid com lightbox.
// Header simplificado com "Voltar ao site" para nao ofuscar o conteudo.
// =====================================================

const GalleryPage = () => {
  const [images, setImages] = useState<PublicGalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchPublicGallery();
      if (!cancelled) {
        setImages(r.success ? r.data : []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Scroll to top on mount (vindo da home via Link, o navegador as vezes preserva scroll)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const lightboxNext = useCallback(() => {
    setLightboxIdx((i) => (i === null ? null : (i + 1) % images.length));
  }, [images.length]);
  const lightboxPrev = useCallback(() => {
    setLightboxIdx((i) => (i === null ? null : (i - 1 + images.length) % images.length));
  }, [images.length]);

  // Keyboard nav for lightbox
  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') lightboxNext();
      else if (e.key === 'ArrowLeft') lightboxPrev();
      else if (e.key === 'Escape') setLightboxIdx(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIdx, lightboxNext, lightboxPrev]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top bar fixo */}
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-sm border-b border-gray-800 tactical-shadow">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link
              to="/"
              className="flex items-center gap-2 text-white hover:text-cbt-orange transition-colors font-tactical font-semibold uppercase tracking-wide text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao site
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 hidden sm:flex items-center justify-center">
                <img
                  src="/branding/d5fad45c-e7f8-49a2-bb56-498d1ba70193.png"
                  alt="CBT"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="text-right">
                <h1 className="text-white font-military font-bold text-sm leading-none">CLUBE BAIANO DE TIRO</h1>
                <p className="text-cbt-orange text-[10px] font-tactical mt-0.5 uppercase tracking-wider">
                  Galeria
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative py-16 md:py-20 bg-gradient-to-b from-gray-900 via-black to-black overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent 0 80px, rgba(255,140,0,0.5) 80px 82px)',
          }}
        ></div>
        <div className="relative container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cbt-orange/10 border border-cbt-orange/30 mb-5">
            <Grid3x3 className="w-4 h-4 text-cbt-orange" />
            <span className="text-cbt-orange font-tactical text-xs uppercase tracking-widest font-bold">
              {loading ? 'Carregando...' : `${images.length} fotos`}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-military font-bold text-white mb-4 tracking-tight">
            NOSSA <span className="text-cbt-orange">GALERIA</span>
          </h2>
          <div className="w-24 h-1 bg-cbt-orange mx-auto mb-6"></div>
          <p className="text-lg md:text-xl text-gray-300 font-tactical max-w-3xl mx-auto">
            Anos de história, treinamentos, competições e momentos com a comunidade CBT
          </p>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="h-1 bg-gradient-to-r from-transparent via-cbt-orange to-transparent"></div>

      {/* Grid */}
      <main className="container mx-auto px-4 py-12 md:py-16">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-900/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-20 bg-gray-900/30 border border-gray-700 rounded-lg max-w-2xl mx-auto">
            <ImageIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 font-tactical">Galeria em construção. Volte em breve!</p>
            <Link
              to="/"
              className="inline-block mt-6 px-6 py-2 bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold uppercase tracking-wide rounded-md transition"
            >
              Voltar ao início
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {images.map((image, idx) => (
              <button
                key={image.id}
                onClick={() => setLightboxIdx(idx)}
                className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-gray-800 hover:ring-cbt-orange/60 transition-all duration-300 hover:-translate-y-0.5 tactical-shadow"
              >
                <img
                  src={image.imageUrl}
                  alt={image.caption || ''}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity"></div>

                {/* Hover icon */}
                <div className="absolute top-3 right-3 p-1.5 rounded-md bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-3.5 h-3.5 text-white" />
                </div>

                {/* Caption */}
                {image.caption && (
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white font-tactical text-xs md:text-sm font-semibold leading-tight line-clamp-2">
                      {image.caption}
                    </p>
                  </div>
                )}

                {/* Number tag */}
                <span className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white text-[10px] font-tactical font-bold">
                  {String(idx + 1).padStart(2, '0')}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Bottom CTA — voltar ao site */}
        {!loading && images.length > 0 && (
          <div className="text-center mt-16 pt-8 border-t border-gray-800">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 border border-cbt-orange text-cbt-orange hover:bg-cbt-orange hover:text-black font-tactical font-bold uppercase tracking-wide rounded-lg transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao site
            </Link>
          </div>
        )}
      </main>

      {/* LIGHTBOX MODAL */}
      {lightboxIdx !== null && images[lightboxIdx] && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 md:top-6 md:right-6 text-white hover:text-cbt-orange p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all z-10"
            aria-label="Fechar"
          >
            <X size={28} />
          </button>

          <div className="absolute top-4 left-4 md:top-6 md:left-6 text-white font-tactical text-sm bg-white/10 px-3 py-1.5 rounded-md backdrop-blur-sm">
            {String(lightboxIdx + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
          </div>

          <div
            className="relative max-w-7xl w-full h-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[lightboxIdx].imageUrl}
              alt={images[lightboxIdx].caption || 'Foto da galeria CBT'}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            {images[lightboxIdx].caption && (
              <p className="mt-4 text-center text-white font-military text-lg md:text-xl px-4">
                {images[lightboxIdx].caption}
              </p>
            )}
          </div>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxPrev();
                }}
                className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 text-white hover:text-cbt-orange p-3 md:p-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
                aria-label="Anterior"
              >
                <ChevronLeft size={36} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxNext();
                }}
                className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 text-white hover:text-cbt-orange p-3 md:p-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
                aria-label="Próxima"
              >
                <ChevronRight size={36} />
              </button>
            </>
          )}

          <div className="hidden md:block absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-500 font-tactical text-xs">
            ← → para navegar · ESC para fechar
          </div>
        </div>
      )}
    </div>
  );
};

export default GalleryPage;
