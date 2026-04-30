
import { useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

const Gallery = () => {
  const [currentImage, setCurrentImage] = useState(0);

  const images = [
    {
      src: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=600&fit=crop",
      alt: "Estrutura moderna do CBT",
      caption: "Instalações modernas e seguras"
    },
    {
      src: "https://images.unsplash.com/photo-1500673922987-e212871fec22?w=800&h=600&fit=crop",
      alt: "Treinamento em andamento",
      caption: "Instrução personalizada com foco na segurança"
    },
    {
      src: "https://images.unsplash.com/photo-1482881497185-d4a9ddbe4151?w=800&h=600&fit=crop",
      alt: "Área de tiro",
      caption: "Área de tiro profissional homologada"
    },
    {
      src: "https://images.unsplash.com/photo-1469041797191-50ace28483c3?w=800&h=600&fit=crop",
      alt: "Equipamentos",
      caption: "Equipamentos de última geração"
    }
  ];

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <section id="galeria" className="py-20 bg-gradient-to-b from-black to-gray-900">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-military font-bold text-white mb-4">
              NOSSA <span className="text-cbt-orange">GALERIA</span>
            </h2>
            <div className="w-24 h-1 bg-cbt-orange mx-auto mb-8"></div>
            <p className="text-xl text-gray-300 font-tactical max-w-3xl mx-auto">
              Conheça nossas instalações, equipamentos e veja nossos instrutores em ação
            </p>
          </div>

          {/* Main Gallery */}
          <div className="relative">
            {/* Main Image */}
            <div className="relative overflow-hidden rounded-lg tactical-shadow">
              <img
                src={images[currentImage].src}
                alt={images[currentImage].alt}
                className="w-full h-96 md:h-[500px] object-cover transition-all duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
              
              {/* Image Caption */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="text-xl md:text-2xl font-military font-bold text-white mb-2">
                  {images[currentImage].caption}
                </h3>
                <p className="text-gray-300 font-tactical">
                  {images[currentImage].alt}
                </p>
              </div>

              {/* Navigation Arrows */}
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-cbt-orange/80 text-white hover:text-black p-3 rounded-full transition-all duration-300 hover:scale-110"
              >
                <ArrowUp className="rotate-[-90deg]" size={24} />
              </button>
              
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-cbt-orange/80 text-white hover:text-black p-3 rounded-full transition-all duration-300 hover:scale-110"
              >
                <ArrowDown className="rotate-[-90deg]" size={24} />
              </button>
            </div>

            {/* Thumbnail Navigation */}
            <div className="flex justify-center space-x-4 mt-6">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImage(index)}
                  className={`w-20 h-16 rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                    index === currentImage 
                      ? 'border-cbt-orange scale-110' 
                      : 'border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Gallery Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 pt-8 border-t border-gray-700">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-military font-bold text-cbt-orange mb-2">50+</div>
              <div className="text-sm text-gray-300 font-tactical uppercase">Raias de tiro</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-military font-bold text-cbt-orange mb-2">1000+</div>
              <div className="text-sm text-gray-300 font-tactical uppercase">Alunos formados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-military font-bold text-cbt-orange mb-2">24h</div>
              <div className="text-sm text-gray-300 font-tactical uppercase">Segurança ativa</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-military font-bold text-cbt-orange mb-2">100%</div>
              <div className="text-sm text-gray-300 font-tactical uppercase">Homologado</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Gallery;
