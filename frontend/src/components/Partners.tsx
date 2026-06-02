import { Handshake, Shield, Code2, ArrowRight } from 'lucide-react';

// =====================================================
// Partners — Parceiros oficiais do CBT.
// Conteudo estatico (parceiros raramente mudam). Logos sao servidos como
// estaticos em /site/parceiros/. Conselho juridico tem layout de card
// distinto por ser pessoa fisica.
// =====================================================

interface Partner {
  name: string;
  description: string;
  image?: string;
  icon?: React.ReactNode;
  link?: string;
}

const partners: Partner[] = [
  {
    name: 'IDSC',
    description: 'Instituto de Desenvolvimento e Segurança — parceiro estratégico em treinamentos e cursos especializados',
    image: '/site/parceiros/idsc.jpg',
    link: 'http://idscbrasil.com.br/',
  },
  {
    name: 'CIAT',
    description: 'Centro de Instrução e Aperfeiçoamento Técnico — apoio técnico em treinamentos avançados',
    image: '/site/parceiros/parceiro_do_clube2.avif',
  },
  {
    name: 'Marcos Leal',
    description: 'Conselho jurídico — advogado especializado em legislação de armas e direito CAC',
    image: '/site/parceiros/marcos-leal.avif',
  },
];

const Partners = () => {
  return (
    <section id="parceiros" className="py-20 bg-gradient-to-b from-gray-900 to-black">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-cbt-orange/20 rounded-full mb-6">
              <Handshake className="w-8 h-8 text-cbt-orange" />
            </div>
            <h2 className="text-4xl md:text-5xl font-military font-bold text-white mb-4">
              NOSSOS <span className="text-cbt-orange">PARCEIROS</span>
            </h2>
            <div className="w-24 h-1 bg-cbt-orange mx-auto mb-8"></div>
            <p className="text-xl text-gray-300 font-tactical max-w-3xl mx-auto">
              Trabalhamos com instituições e profissionais de referência para entregar o melhor aos nossos
              associados
            </p>
          </div>

          {/* Partners Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {partners.map((p) => {
              const content = (
                <>
                  <div className="h-32 flex items-center justify-center bg-black/40 rounded-md mb-5 p-4">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                      />
                    ) : (
                      <div className="text-cbt-orange">{p.icon}</div>
                    )}
                  </div>
                  <h3 className="text-xl font-military font-bold text-white mb-3 text-center">{p.name}</h3>
                  <p className="text-gray-400 font-tactical text-sm text-center leading-relaxed">
                    {p.description}
                  </p>
                  {p.link && (
                    <p className="text-cbt-orange font-tactical text-xs text-center mt-4 uppercase tracking-wider">
                      Visitar site →
                    </p>
                  )}
                </>
              );

              return p.link ? (
                <a
                  key={p.name}
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-800/50 hover:bg-gray-800/80 border border-gray-700 hover:border-cbt-orange/60 rounded-lg p-6 transition-all duration-300 hover:-translate-y-1 tactical-shadow"
                >
                  {content}
                </a>
              ) : (
                <div
                  key={p.name}
                  className="bg-gray-800/50 border border-gray-700 hover:border-cbt-orange/60 rounded-lg p-6 transition-all duration-300 hover:-translate-y-1 tactical-shadow"
                >
                  {content}
                </div>
              );
            })}
          </div>

          {/* Trust line */}
          <div className="mt-12 flex items-center justify-center gap-3 text-gray-500 font-tactical text-sm">
            <Shield className="w-4 h-4 text-cbt-orange" />
            <span>Parcerias auditadas e em conformidade com a legislação brasileira</span>
          </div>

          {/* ── Tecnologia & Desenvolvimento ──────────────────────────────
              Patrocinadora de tecnologia: card destacado, maior que os
              parceiros do clube acima. Mantem a paleta tactical (dark +
              cbt-orange), com brackets de canto, accent lines no topo/fundo
              e glow externo sutil — chama atencao sem quebrar a identidade. */}
          <div className="mt-20 pt-2">
            {/* Divisor elegante */}
            <div className="mx-auto h-px max-w-2xl bg-gradient-to-r from-transparent via-cbt-orange/30 to-transparent" />

            {/* Overline */}
            <div className="flex items-center justify-center gap-2 mt-10 mb-8">
              <Code2 className="w-3.5 h-3.5 text-cbt-orange" />
              <span className="text-cbt-orange font-tactical text-[11px] uppercase tracking-[0.25em] font-bold">
                Desenvolvimento & Tecnologia
              </span>
              <Code2 className="w-3.5 h-3.5 text-cbt-orange" />
            </div>

            <a
              href="https://aurisolutions.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visitar site da Auri Solutions"
              className="group relative block max-w-4xl mx-auto"
            >
              {/* Glow externo (intensifica no hover) */}
              <div
                aria-hidden
                className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cbt-orange/0 via-cbt-orange/30 to-cbt-orange/0 opacity-40 blur-2xl group-hover:opacity-80 transition-opacity duration-500"
              />

              {/* Card principal */}
              <div className="relative bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-gray-800 group-hover:border-cbt-orange/60 rounded-2xl overflow-hidden transition-all duration-500 group-hover:-translate-y-1 tactical-shadow">
                {/* Accent line topo */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cbt-orange to-transparent opacity-70" />

                {/* Listras verticais (textura tactical, igual à Galeria) */}
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.04] pointer-events-none"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, transparent 0 60px, rgba(255,140,0,0.5) 60px 62px)',
                  }}
                />

                {/* Brackets de canto */}
                <div aria-hidden className="absolute top-3 left-3 w-5 h-5 border-t border-l border-cbt-orange/40" />
                <div aria-hidden className="absolute top-3 right-3 w-5 h-5 border-t border-r border-cbt-orange/40" />
                <div aria-hidden className="absolute bottom-3 left-3 w-5 h-5 border-b border-l border-cbt-orange/40" />
                <div aria-hidden className="absolute bottom-3 right-3 w-5 h-5 border-b border-r border-cbt-orange/40" />

                <div className="relative grid md:grid-cols-[auto,1fr] gap-8 md:gap-10 items-center p-8 md:p-10">
                  {/* Logo com glow */}
                  <div className="flex justify-center md:justify-start">
                    <div className="relative">
                      <div
                        aria-hidden
                        className="absolute inset-0 bg-cbt-orange/20 rounded-2xl blur-2xl group-hover:bg-cbt-orange/40 transition-colors duration-500"
                      />
                      <div className="relative w-32 h-32 md:w-40 md:h-40 flex items-center justify-center bg-black/60 border border-cbt-orange/20 group-hover:border-cbt-orange/50 rounded-2xl p-4 backdrop-blur-sm transition-colors duration-500">
                        <img
                          src="/site/parceiros/auri-solutions.png"
                          alt="Auri Solutions"
                          loading="lazy"
                          className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="text-center md:text-left">
                    <h3 className="text-3xl md:text-4xl font-military font-bold text-white tracking-tight leading-tight">
                      Auri <span className="text-cbt-orange">Solutions</span>
                    </h3>
                    <div className="w-16 h-0.5 bg-cbt-orange mx-auto md:mx-0 mt-3 mb-4" />
                    <p className="text-gray-300 font-tactical text-base md:text-lg leading-relaxed">
                      Software development & automation — tecnologia que sustenta a operação do CBT
                      e dos clubes que confiam na nossa engenharia.
                    </p>

                    {/* CTA */}
                    <div className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-cbt-orange/10 border border-cbt-orange/40 text-cbt-orange font-tactical text-sm font-bold uppercase tracking-wider group-hover:bg-cbt-orange group-hover:text-black group-hover:border-cbt-orange transition-all duration-300">
                      <span>Conheça nosso trabalho</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>

                {/* Accent line fundo */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cbt-orange to-transparent opacity-70" />
              </div>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Partners;
