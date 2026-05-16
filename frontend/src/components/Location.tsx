
import { MapPin, Clock, Car } from 'lucide-react';

const Location = () => {
  return (
    <section id="localizacao" className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-military font-bold text-white mb-4">
              NOSSA <span className="text-cbt-orange">LOCALIZAÇÃO</span>
            </h2>
            <div className="w-24 h-1 bg-cbt-orange mx-auto mb-8"></div>
            <p className="text-xl text-gray-300 font-tactical max-w-3xl mx-auto">
              Estamos localizados em um ponto estratégico com fácil acesso. Venha nos visitar!
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Map */}
            <div className="order-2 lg:order-1">
              <div className="relative overflow-hidden rounded-lg tactical-shadow">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.234567890123!2d-38.3274!3d-12.8936!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x716fb7c0123456789%3A0x987654321abcdef0!2sVia%20Metropolitana%2C%201807%20-%20Capelão%2C%20Lauro%20de%20Freitas%20-%20BA%2C%2042000-000!5e0!3m2!1spt-BR!2sbr!4v1234567890123!5m2!1spt-BR!2sbr"
                  width="100%"
                  height="400"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="rounded-lg"
                ></iframe>
                <div className="absolute inset-0 border border-cbt-orange/30 rounded-lg pointer-events-none"></div>
              </div>
            </div>

            {/* Location Info */}
            <div className="order-1 lg:order-2 space-y-8">
              {/* Address */}
              <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 tactical-shadow">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-cbt-orange/20 rounded-full flex items-center justify-center">
                      <MapPin className="text-cbt-orange" size={24} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-military font-bold text-white mb-2">ENDEREÇO</h3>
                    <p className="text-gray-300 font-tactical leading-relaxed">
                      Via Metropolitana, 1807 - Capelão<br />
                      Lauro de Freitas - BA<br />
                      CEP: 42000-000
                    </p>
                  </div>
                </div>
              </div>

              {/* Hours */}
              <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 tactical-shadow">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-cbt-orange/20 rounded-full flex items-center justify-center">
                      <Clock className="text-cbt-orange" size={24} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-military font-bold text-white mb-3">HORÁRIO DE FUNCIONAMENTO</h3>
                    <div className="space-y-1.5 text-gray-300 font-tactical">
                      <p className="flex justify-between max-w-xs"><span className="text-gray-500">Segunda:</span> <span className="text-red-400">Fechado</span></p>
                      <p className="flex justify-between max-w-xs"><span className="text-gray-500">Terça a Sexta:</span> <span>9h-12h e 14h-17h</span></p>
                      <p className="flex justify-between max-w-xs"><span className="text-gray-500">Sábado:</span> <span>9h às 17h</span></p>
                      <p className="flex justify-between max-w-xs"><span className="text-gray-500">Domingo:</span> <span>9h às 12h</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Access */}
              <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 tactical-shadow">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-cbt-orange/20 rounded-full flex items-center justify-center">
                      <Car className="text-cbt-orange" size={24} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-military font-bold text-white mb-2">COMO CHEGAR</h3>
                    <ul className="space-y-2 text-gray-300 font-tactical">
                      <li>• Fácil acesso pela Via Metropolitana</li>
                      <li>• Estacionamento gratuito no local</li>
                      <li>• Próximo ao centro de Lauro de Freitas</li>
                      <li>• Transporte público disponível</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Contact Button */}
              <div className="text-center pt-4">
                <button
                  onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold uppercase tracking-wide px-8 py-4 rounded-lg glow-orange transition-all duration-300 hover:scale-105"
                >
                  Entre em contato
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Location;
