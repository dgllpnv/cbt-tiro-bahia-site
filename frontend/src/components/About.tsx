
import { Target, Shield, Award } from 'lucide-react';

const About = () => {
  const highlights = [
    {
      icon: <Award className="w-8 h-8" />,
      title: "+10 anos de experiência",
      description: "Tradição e expertise no ensino de tiro esportivo"
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: "Instrutores credenciados",
      description: "Profissionais qualificados e certificados"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Estrutura segura e homologada",
      description: "Instalações modernas seguindo todas as normas"
    }
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
              O Clube Baiano de Tiro (CBT) é referência na Bahia em formação e treinamento com armas de fogo, 
              com uma equipe de instrutores altamente capacitados e estrutura moderna.
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
                  <div className="text-cbt-orange">
                    {item.icon}
                  </div>
                </div>
                <h3 className="text-xl font-military font-bold text-white mb-4">
                  {item.title}
                </h3>
                <p className="text-gray-400 font-tactical">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          {/* Mission Statement */}
          <div className="text-center bg-gradient-to-r from-gray-800/30 to-gray-900/30 p-8 rounded-lg border border-gray-700">
            <h3 className="text-2xl font-military font-bold text-cbt-orange mb-4">
              NOSSA MISSÃO
            </h3>
            <p className="text-lg text-gray-300 font-tactical max-w-4xl mx-auto leading-relaxed">
              Formar atiradores responsáveis e competentes, promovendo o tiro esportivo com os mais altos 
              padrões de segurança, ética e profissionalismo. No CBT, cada aluno recebe atenção 
              personalizada para desenvolver suas habilidades com confiança e precisão.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
