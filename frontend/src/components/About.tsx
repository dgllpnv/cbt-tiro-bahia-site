import { Target, Shield, Award, Calendar, Eye, Heart } from 'lucide-react';

const About = () => {
  const highlights = [
    {
      icon: <Calendar className="w-8 h-8" />,
      title: 'Fundado em 2016',
      description: 'Tradição construída por Angelo Matos com foco em segurança e excelência',
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: 'Instrutores credenciados',
      description: 'Profissionais qualificados em diferentes modalidades de tiro',
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Estrutura completa e segura',
      description: 'Instalações modernas para tiro esportivo, prático, tático e defensivo',
    },
  ];

  const pillars = [
    { icon: <Heart className="w-5 h-5" />, label: 'Moral' },
    { icon: <Award className="w-5 h-5" />, label: 'Ética' },
    { icon: <Shield className="w-5 h-5" />, label: 'Integridade' },
    { icon: <Target className="w-5 h-5" />, label: 'Respeito' },
  ];

  return (
    <section id="sobre" className="py-20 bg-gradient-to-b from-gray-900 to-black">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-military font-bold text-white mb-4">
              SOBRE O <span className="text-cbt-orange">CLUBE</span>
            </h2>
            <div className="w-24 h-1 bg-cbt-orange mx-auto mb-8"></div>
            <p className="text-xl text-gray-300 font-tactical max-w-3xl mx-auto leading-relaxed">
              Fundado em <span className="text-cbt-orange font-semibold">24 de setembro de 2016</span> por Angelo Matos,
              o Clube Baiano de Tiro nasceu para oportunizar a prática segura do tiro esportivo na Bahia, atendendo
              praticantes de todos os níveis em um ambiente acolhedor e profissional.
            </p>
          </div>

          {/* Highlights Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {highlights.map((item, index) => (
              <div
                key={index}
                className="text-center p-8 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-cbt-orange/50 transition-all duration-300 hover:transform hover:scale-105 tactical-shadow"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-cbt-orange/20 rounded-full mb-6">
                  <div className="text-cbt-orange">{item.icon}</div>
                </div>
                <h3 className="text-xl font-military font-bold text-white mb-4">{item.title}</h3>
                <p className="text-gray-400 font-tactical">{item.description}</p>
              </div>
            ))}
          </div>

          {/* Mission / Vision */}
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 p-8 rounded-lg border border-gray-700 tactical-shadow">
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-6 h-6 text-cbt-orange" />
                <h3 className="text-xl font-military font-bold text-cbt-orange">NOSSA MISSÃO</h3>
              </div>
              <p className="text-gray-300 font-tactical leading-relaxed">
                Disponibilizar produtos e serviços de qualidade relacionados ao tiro, divulgando a prática como
                modalidade esportiva segura, completa e antiestresse.
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 p-8 rounded-lg border border-gray-700 tactical-shadow">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="w-6 h-6 text-cbt-orange" />
                <h3 className="text-xl font-military font-bold text-cbt-orange">NOSSA VISÃO</h3>
              </div>
              <p className="text-gray-300 font-tactical leading-relaxed">
                Ser referência entre os melhores clubes e academias de tiro do Brasil, com ênfase em moral, ética,
                respeito, conforto e segurança.
              </p>
            </div>
          </div>

          {/* Values pillars */}
          <div className="bg-cbt-orange/5 border border-cbt-orange/20 rounded-lg p-6">
            <h3 className="text-center text-lg font-military font-bold text-cbt-orange mb-5 tracking-wide">
              NOSSOS VALORES
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {pillars.map((p) => (
                <div
                  key={p.label}
                  className="flex flex-col items-center gap-2 p-4 rounded-md bg-black/30 border border-gray-700/60"
                >
                  <div className="text-cbt-orange">{p.icon}</div>
                  <span className="text-white font-tactical font-semibold uppercase tracking-wide text-sm">
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Legislation note */}
          <div className="mt-10 text-center">
            <p className="text-gray-500 font-tactical text-xs uppercase tracking-wider">
              Operação em conformidade com a Lei 10.826, Portarias 51 e 28 do COLOG e normativos SIGMA / SINARM
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
