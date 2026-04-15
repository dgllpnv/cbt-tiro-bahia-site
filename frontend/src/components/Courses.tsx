
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const Courses = () => {
  const courses = [
    {
      title: "Curso para Iniciantes",
      description: "Introdução ao manuseio, segurança e primeiros disparos",
      features: [
        "Fundamentos de segurança",
        "Manuseio básico de armas",
        "Postura e empunhadura",
        "Primeiros disparos supervisionados",
        "Teoria do tiro esportivo"
      ],
      duration: "8 horas",
      price: "A partir de R$ 350",
      highlight: true
    },
    {
      title: "Curso Intermediário",
      description: "Técnicas avançadas, recarga e movimentação",
      features: [
        "Técnicas avançadas de tiro",
        "Movimentação tática",
        "Recarga rápida",
        "Tiro em múltiplos alvos",
        "Competições básicas"
      ],
      duration: "12 horas",
      price: "A partir de R$ 550",
      highlight: false
    },
    {
      title: "Aulas Personalizadas",
      description: "Treinamentos individuais conforme objetivo do aluno",
      features: [
        "Horário flexível",
        "Foco específico nas necessidades",
        "Instrutor dedicado",
        "Progressão personalizada",
        "Acompanhamento individual"
      ],
      duration: "Flexível",
      price: "A partir de R$ 120/hora",
      highlight: false
    }
  ];

  return (
    <section id="cursos" className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-military font-bold text-white mb-4">
              NOSSOS <span className="text-cbt-orange">CURSOS</span>
            </h2>
            <div className="w-24 h-1 bg-cbt-orange mx-auto mb-8"></div>
            
            {/* Logo Image */}
            <div className="mb-8">
              <img 
                src="/lovable-uploads/abeee9cc-0cca-420a-8cbe-2e29255c493a.png" 
                alt="CBT Logo" 
                className="mx-auto w-32 h-32 opacity-80"
              />
            </div>
            
            <p className="text-xl text-gray-300 font-tactical max-w-3xl mx-auto">
              Programas estruturados para todos os níveis, do iniciante ao atirador avançado
            </p>
          </div>

          {/* Courses Grid */}
          <div className="grid md:grid-cols-3 gap-8">
            {courses.map((course, index) => (
              <Card 
                key={index} 
                className={`bg-gray-900/50 border-gray-700 hover:border-cbt-orange/50 transition-all duration-300 hover:transform hover:scale-105 tactical-shadow ${
                  course.highlight ? 'ring-2 ring-cbt-orange/50 relative' : ''
                }`}
              >
                {course.highlight && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-cbt-orange text-black px-4 py-1 rounded-full text-sm font-tactical font-bold uppercase">
                      Mais Procurado
                    </span>
                  </div>
                )}
                
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl font-military font-bold text-white mb-2">
                    {course.title}
                  </CardTitle>
                  <CardDescription className="text-gray-400 font-tactical">
                    {course.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {course.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center text-gray-300">
                        <div className="w-2 h-2 bg-cbt-orange rounded-full mr-3 flex-shrink-0"></div>
                        <span className="font-tactical text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400 font-tactical text-sm">Duração:</span>
                      <span className="text-white font-tactical font-semibold">{course.duration}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-tactical text-sm">Investimento:</span>
                      <span className="text-cbt-orange font-tactical font-bold">{course.price}</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter>
                  <Button 
                    className={`w-full font-tactical font-bold uppercase tracking-wide transition-all duration-300 hover:scale-105 ${
                      course.highlight 
                        ? 'bg-cbt-orange hover:bg-cbt-orange/90 text-black glow-orange' 
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                    onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    Quero me inscrever
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Additional Info */}
          <div className="text-center mt-12 p-6 bg-gray-800/30 rounded-lg border border-gray-700">
            <p className="text-gray-300 font-tactical mb-4">
              Todos os cursos incluem equipamentos de segurança e munição para as aulas práticas
            </p>
            <Button 
              variant="outline" 
              size="lg"
              className="border-cbt-orange text-cbt-orange hover:bg-cbt-orange hover:text-black font-tactical font-bold uppercase"
              onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Solicitar mais informações
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Courses;
