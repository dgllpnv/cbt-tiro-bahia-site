import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Contact = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic form validation
    if (!formData.name || !formData.email || !formData.phone || !formData.message) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos do formulário.",
        variant: "destructive"
      });
      return;
    }

    // Simulate form submission
    toast({
      title: "Mensagem enviada!",
      description: "Entraremos em contato em breve. Obrigado pelo interesse!",
    });

    // Reset form
    setFormData({
      name: '',
      email: '',
      phone: '',
      message: ''
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const whatsappNumber = "5571999999999";
  const whatsappMessage = "Olá! Gostaria de saber mais sobre os cursos do CBT.";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <section id="contato" className="py-20 bg-gradient-to-b from-gray-900 to-black">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-military font-bold text-white mb-4">
              ENTRE EM <span className="text-cbt-orange">CONTATO</span>
            </h2>
            <div className="w-24 h-1 bg-cbt-orange mx-auto mb-8"></div>
            <p className="text-xl text-gray-300 font-tactical max-w-3xl mx-auto">
              Tire suas dúvidas e agende sua aula experimental. Estamos prontos para ajudar!
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card className="bg-gray-900/50 border-gray-700 tactical-shadow">
              <CardHeader>
                <CardTitle className="text-2xl font-military font-bold text-white">
                  Envie sua mensagem
                </CardTitle>
                <CardDescription className="text-gray-400 font-tactical">
                  Preencha o formulário abaixo e entraremos em contato
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Input
                      type="text"
                      name="name"
                      placeholder="Seu nome completo"
                      value={formData.name}
                      onChange={handleChange}
                      className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 font-tactical focus:border-cbt-orange"
                      required
                    />
                  </div>
                  
                  <div>
                    <Input
                      type="email"
                      name="email"
                      placeholder="Seu melhor e-mail"
                      value={formData.email}
                      onChange={handleChange}
                      className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 font-tactical focus:border-cbt-orange"
                      required
                    />
                  </div>
                  
                  <div>
                    <Input
                      type="tel"
                      name="phone"
                      placeholder="(71) 99999-9999"
                      value={formData.phone}
                      onChange={handleChange}
                      className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 font-tactical focus:border-cbt-orange"
                      required
                    />
                  </div>
                  
                  <div>
                    <Textarea
                      name="message"
                      placeholder="Conte-nos sobre seu interesse nos cursos ou tire suas dúvidas..."
                      value={formData.message}
                      onChange={handleChange}
                      rows={5}
                      className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 font-tactical focus:border-cbt-orange resize-none"
                      required
                    />
                  </div>
                  
                  <Button 
                    type="submit"
                    size="lg"
                    className="w-full bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold uppercase tracking-wide glow-orange transition-all duration-300 hover:scale-105"
                  >
                    Enviar mensagem
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <div className="space-y-8">
              {/* Phone Contact */}
              <Card className="bg-gray-900/50 border-gray-700 tactical-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-cbt-orange/20 rounded-full flex items-center justify-center">
                      <Phone className="text-cbt-orange" size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-military font-bold text-white mb-2">
                        TELEFONE DIRETO
                      </h3>
                      <a 
                        href="tel:+5571999999999"
                        className="text-2xl font-tactical font-bold text-cbt-orange hover:text-cbt-orange/80 transition-colors"
                      >
                        (71) 3051-1111
                      </a>
                      <p className="text-gray-400 font-tactical text-sm mt-1">
                        Atendimento de segunda a sábado
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* WhatsApp */}
              <Card className="bg-gray-900/50 border-gray-700 tactical-shadow">
                <CardContent className="p-6">
                  <div className="text-center">
                    <h3 className="text-xl font-military font-bold text-white mb-4">
                      FALE CONOSCO PELO WHATSAPP
                    </h3>
                    <Button
                      asChild
                      size="lg"
                      className="bg-green-600 hover:bg-green-700 text-white font-tactical font-bold uppercase tracking-wide transition-all duration-300 hover:scale-105"
                    >
                      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                        <img 
                          src="/branding/24656961-78c6-43d7-81ba-346221d29fea.png" 
                          alt="WhatsApp" 
                          className="w-5 h-5 mr-2"
                        />
                        Conversar no WhatsApp
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Info */}
              <Card className="bg-gray-900/50 border-gray-700 tactical-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-cbt-orange/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPin className="text-cbt-orange" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-military font-bold text-white mb-2">
                        ENDEREÇO COMPLETO
                      </h3>
                      <p className="text-gray-300 font-tactical mb-3">
                        Via Metropolitana, 1807 - Capelão<br />
                        Lauro de Freitas - BA, 42000-000
                      </p>
                      <p className="text-sm text-gray-400 font-tactical">
                        Estacionamento gratuito • Fácil acesso
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Emergency Note */}
              <div className="bg-cbt-orange/10 border border-cbt-orange/30 p-4 rounded-lg">
                <p className="text-cbt-orange font-tactical text-sm text-center">
                  <strong>Resposta garantida em até 2 horas!</strong><br />
                  Nosso time está sempre pronto para atender você.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating WhatsApp Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg hover:scale-110 transition-all duration-300"
        aria-label="Conversar no WhatsApp"
      >
        <img 
          src="/branding/24656961-78c6-43d7-81ba-346221d29fea.png" 
          alt="WhatsApp" 
          className="w-16 h-16"
        />
      </a>
    </section>
  );
};

export default Contact;
