import { Handshake, Scale, Shield } from 'lucide-react';

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
    name: 'IDS Brasil',
    description: 'Instituto de Desenvolvimento e Segurança — parceiro estratégico em treinamentos e cursos especializados',
    image: '/site/parceiros/parceiro_do_clube1.avif',
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
    icon: <Scale className="w-12 h-12" />,
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
        </div>
      </div>
    </section>
  );
};

export default Partners;
