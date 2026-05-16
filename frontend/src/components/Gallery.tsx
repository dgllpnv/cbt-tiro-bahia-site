import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Image as ImageIcon, X, Maximize2, Grid3x3, ArrowRight } from 'lucide-react';
import { fetchPublicGallery, type PublicGalleryImage } from '@/services/publicNewsService';

// =====================================================
// Gallery — Secao destacada do site, separada visualmente das demais.
// Estrategia:
//  - Background full-bleed com gradiente dramatico e listras verticais
//    sutis (texturizacao militar).
//  - Carrossel principal grande (hero photo) + indicador de progresso.
//  - Mosaico completo (32 fotos) abaixo, clicavel.
//  - Lightbox modal em tela cheia para imersao na foto, com nav prev/next.
// Consome /api/public/gallery (gerenciada em /admin/galeria pelo admin).
// =====================================================

const Gallery = () => {
  const [images, setImages] = useState<PublicGalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
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

  const next = useCallback(
    () => setCurrentIdx((i) => (i + 1) % Math.max(images.length, 1)),
    [images.length],
  );
  const prev = useCallback(
    () => setCurrentIdx((i) => (i - 1 + images.length) % Math.max(images.length, 1)),
    [images.length],
  );

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

  // Auto-advance hero every 6s (pause when lightbox is open)
  useEffect(() => {
    if (images.length <= 1 || lightboxIdx !== null) return;
    const t = setInterval(next, 6000);
    return () => clearInterval(t);
  }, [images.length, next, lightboxIdx]);

  return (
    <section id="galeria" className="relative py-0 bg-black overflow-hidden">
      {/* Top accent strip */}
      <div className="h-1 bg-gradient-to-r from-transparent via-cbt-orange to-transparent"></div>

      {/* Vertical decorative stripes (subtle, tactical) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent 0 80px, rgba(255,140,0,0.5) 80px 82px)',
        }}
      ></div>

      <div className="relative py-24">
        <div className="container mx-auto px-4">
          {/* Section Header */}
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cbt-orange/10 border border-cbt-orange/30 mb-5">
              <Grid3x3 className="w-4 h-4 text-cbt-orange" />
              <span className="text-cbt-orange font-tactical text-xs uppercase tracking-widest font-bold">
                Galeria do clube
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-military font-bold text-white mb-4 tracking-tight">
              NOSSA <span className="text-cbt-orange">COMUNIDADE</span>
            </h2>
            <div className="w-24 h-1 bg-cbt-orange mx-auto mb-6"></div>
            <p className="text-xl text-gray-300 font-tactical max-w-3xl mx-auto">
              Anos de história construídos por atletas, instrutores e associados que fazem do CBT um clube de
              tradição
            </p>
          </div>

          {/* States */}
          {loading ? (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="h-[400px] md:h-[560px] bg-gray-900/50 border border-gray-700 rounded-lg animate-pulse" />
              <div className="h-14 w-64 mx-auto bg-gray-900/30 rounded-lg animate-pulse" />
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-16 bg-gray-900/50 border border-gray-700 rounded-lg max-w-2xl mx-auto">
              <ImageIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-tactical">Galeria em construção. Volte em breve!</p>
            </div>
          ) : (
            <>
              {/* HERO CAROUSEL — destaque */}
              <div className="relative max-w-6xl mx-auto mb-10">
                <div className="relative overflow-hidden rounded-xl tactical-shadow ring-1 ring-cbt-orange/20">
                  <button
                    onClick={() => setLightboxIdx(currentIdx)}
                    className="block w-full group cursor-zoom-in"
                    aria-label="Abrir em tela cheia"
                  >
                    <img
                      src={images[currentIdx].imageUrl}
                      alt={images[currentIdx].caption || 'Foto da galeria CBT'}
                      className="w-full h-[400px] md:h-[560px] object-cover transition-all duration-700 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>

                    {/* Zoom hint */}
                    <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm border border-white/10 rounded-md flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-3.5 h-3.5 text-white" />
                      <span className="text-white text-[11px] font-tactical font-bold uppercase tracking-wider">
                        Ampliar
                      </span>
                    </div>

                    {/* Caption */}
                    {images[currentIdx].caption && (
                      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-left pointer-events-none">
                        <p className="text-cbt-orange font-tactical text-xs uppercase tracking-widest mb-2">
                          {String(currentIdx + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
                        </p>
                        <h3 className="text-2xl md:text-3xl font-military font-bold text-white">
                          {images[currentIdx].caption}
                        </h3>
                      </div>
                    )}
                  </button>

                  {/* Nav arrows */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          prev();
                        }}
                        className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-cbt-orange text-white hover:text-black p-3 md:p-4 rounded-full backdrop-blur-sm transition-all duration-300 hover:scale-110 z-10"
                        aria-label="Foto anterior"
                      >
                        <ChevronLeft size={28} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          next();
                        }}
                        className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-cbt-orange text-white hover:text-black p-3 md:p-4 rounded-full backdrop-blur-sm transition-all duration-300 hover:scale-110 z-10"
                        aria-label="Próxima foto"
                      >
                        <ChevronRight size={28} />
                      </button>
                    </>
                  )}
                </div>

                {/* Progress dots (apenas se ate 12 imagens) */}
                {images.length > 1 && images.length <= 12 && (
                  <div className="flex justify-center gap-2 mt-5">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentIdx(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          idx === currentIdx
                            ? 'w-8 bg-cbt-orange'
                            : 'w-1.5 bg-gray-600 hover:bg-gray-400'
                        }`}
                        aria-label={`Ir para foto ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* CTA — Ver galeria completa em pagina dedicada */}
              <div className="text-center max-w-2xl mx-auto">
                <Link
                  to="/galeria"
                  className="group inline-flex items-center gap-3 px-8 py-4 bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold uppercase tracking-wider rounded-lg glow-orange transition-all duration-300 hover:scale-105"
                >
                  <Grid3x3 className="w-5 h-5" />
                  <span>Ver galeria completa</span>
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <p className="text-gray-500 font-tactical text-xs mt-4 uppercase tracking-widest">
                  {images.length} fotos da nossa comunidade
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom accent strip */}
      <div className="h-1 bg-gradient-to-r from-transparent via-cbt-orange to-transparent"></div>

      {/* LIGHTBOX MODAL */}
      {lightboxIdx !== null && images[lightboxIdx] && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxIdx(null)}
        >
          {/* Close */}
          <button
            onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 md:top-6 md:right-6 text-white hover:text-cbt-orange p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all z-10"
            aria-label="Fechar"
          >
            <X size={28} />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 md:top-6 md:left-6 text-white font-tactical text-sm bg-white/10 px-3 py-1.5 rounded-md backdrop-blur-sm">
            {String(lightboxIdx + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
          </div>

          {/* Image container */}
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

          {/* Prev */}
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

          {/* Keyboard hint (desktop) */}
          <div className="hidden md:block absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-500 font-tactical text-xs">
            ← → para navegar · ESC para fechar
          </div>
        </div>
      )}
    </section>
  );
};

export default Gallery;
