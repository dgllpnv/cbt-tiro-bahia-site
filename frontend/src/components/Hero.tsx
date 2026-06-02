import { useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { registerSiteView, getSiteStats } from '@/services/publicStatsService';

// Sessao do navegador serve como dedup leve: 1 view por aba/tab.
// Sem isso, F5 spamaria o contador. localStorage seria por device.
const VIEW_SESSION_KEY = 'cbt_view_counted';

const Hero = () => {
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const alreadyCounted = sessionStorage.getItem(VIEW_SESSION_KEY) === '1';
      const result = alreadyCounted ? await getSiteStats() : await registerSiteView();
      if (!cancelled && result.success) {
        setVisitorCount(result.data.totalViews);
        if (!alreadyCounted) sessionStorage.setItem(VIEW_SESSION_KEY, '1');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="inicio" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background with metal texture */}
      <div className="absolute inset-0 metal-texture"></div>
      
      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70"></div>
      
      {/* Decorative elements */}
      <div className="absolute top-32 right-10 w-32 h-32 border border-cbt-orange/30 rounded-full animate-pulse"></div>
      <div className="absolute bottom-20 left-10 w-24 h-24 border border-cbt-orange/20 rounded-full animate-pulse delay-1000"></div>
      
      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-4 animate-fade-in">
        <div className="mb-8">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-military font-bold text-white mb-4 tracking-tight">
            BEM-VINDO AO
            <span className="block text-cbt-orange mt-2">CBT</span>
          </h1>
          
          {/* Logo grande - aumentado consideravelmente */}
          <div className="flex justify-center mb-6">
            <img
              src="/branding/cbt-logo.png"
              alt="CBT - Clube Baiano de Tiro"
              className="w-80 h-80 md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] object-contain"
            />
          </div>
          
          <div className="w-24 h-1 bg-cbt-orange mx-auto mb-6"></div>
          <p className="text-xl md:text-2xl text-gray-300 font-tactical mb-2">
            Preparando você para o tiro esportivo, prático, tático e defensivo
          </p>
          <p className="text-lg text-gray-400 font-tactical max-w-2xl mx-auto">
            Desde 2016 formando atiradores com excelência, segurança e profissionalismo
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button 
            size="lg"
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold uppercase tracking-wide px-8 py-4 text-lg glow-orange transition-all duration-300 hover:scale-105"
            onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Agende sua aula experimental
          </Button>
          
          <Button 
            variant="outline"
            size="lg"
            className="border-white text-white hover:bg-white hover:text-black font-tactical font-bold uppercase tracking-wide px-8 py-4 text-lg transition-all duration-300 hover:scale-105"
            onClick={() => document.getElementById('cursos')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Conheça nossos cursos
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 pt-8 border-t border-gray-700">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-military font-bold text-cbt-orange mb-2">2016</div>
            <div className="text-sm md:text-base text-gray-300 font-tactical uppercase tracking-wide">Desde nossa fundação</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-military font-bold text-cbt-orange mb-2">100%</div>
            <div className="text-sm md:text-base text-gray-300 font-tactical uppercase tracking-wide">Instrutores credenciados</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-military font-bold text-cbt-orange mb-2">4</div>
            <div className="text-sm md:text-base text-gray-300 font-tactical uppercase tracking-wide">Modalidades de tiro</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-military font-bold text-cbt-orange mb-2 tabular-nums">
              {visitorCount == null ? '—' : visitorCount.toLocaleString('pt-BR')}
            </div>
            <div className="text-sm md:text-base text-gray-300 font-tactical uppercase tracking-wide">Visitantes do site</div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <ArrowDown className="text-cbt-orange" size={32} />
      </div>
    </section>
  );
};

export default Hero;
