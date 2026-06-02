import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Mail, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// =====================================================
// Contact — Canais oficiais de contato do CBT.
// Atendimento exclusivamente via WhatsApp (numero (71) 3051-1111).
// Telefone fixo foi removido (decisao do clube: canais escritos sao
// rastreaveis e a equipe nao tem cobertura para atender ligacao).
// O formulario abaixo apenas exibe toast de confirmacao — para integracao
// real, seria necessario criar um endpoint POST /api/public/contact-message
// (decisao: mock por ora; canais diretos sao incentivados).
// =====================================================

const EMAIL = 'clubebaianodetiro@outlook.com';
const WHATSAPP_URL =
  'https://wa.me/557130511111?text=' +
  encodeURIComponent('Olá! Gostaria de saber mais sobre o CBT.');

const Contact = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.phone || !formData.message) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos do formulário.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Mensagem registrada!',
      description: 'Para resposta mais rápida, recomendamos contato direto pelo WhatsApp.',
    });

    setFormData({ name: '', email: '', phone: '', message: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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
              Tire suas dúvidas, agende uma visita ou se inscreva nos nossos cursos.
              <span className="block text-cbt-orange mt-2 text-base">
                A forma mais rápida de falar conosco é pelo WhatsApp.
              </span>
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card className="bg-gray-900/50 border-gray-700 tactical-shadow">
              <CardHeader>
                <CardTitle className="text-2xl font-military font-bold text-white">Envie sua mensagem</CardTitle>
                <CardDescription className="text-gray-400 font-tactical">
                  Preencha o formulário e entraremos em contato
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <Input
                    type="text"
                    name="name"
                    placeholder="Seu nome completo"
                    value={formData.name}
                    onChange={handleChange}
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 font-tactical focus:border-cbt-orange"
                    required
                  />
                  <Input
                    type="email"
                    name="email"
                    placeholder="Seu melhor e-mail"
                    value={formData.email}
                    onChange={handleChange}
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 font-tactical focus:border-cbt-orange"
                    required
                  />
                  <Input
                    type="tel"
                    name="phone"
                    placeholder="(71) 99999-9999"
                    value={formData.phone}
                    onChange={handleChange}
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 font-tactical focus:border-cbt-orange"
                    required
                  />
                  <Textarea
                    name="message"
                    placeholder="Conte-nos sobre seu interesse..."
                    value={formData.message}
                    onChange={handleChange}
                    rows={5}
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 font-tactical focus:border-cbt-orange resize-none"
                    required
                  />
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold uppercase tracking-wide glow-orange transition-all duration-300 hover:scale-105"
                  >
                    Enviar mensagem
                  </Button>
                </form>
                <p className="text-xs text-gray-500 font-tactical mt-4 text-center">
                  Ou fale conosco diretamente pelos canais ao lado para resposta imediata
                </p>
              </CardContent>
            </Card>

            {/* Contact Info — canais diretos */}
            <div className="space-y-5">
              {/* WhatsApp — destaque */}
              <Card className="bg-gradient-to-br from-green-900/40 to-gray-900/50 border-green-700/40 tactical-shadow">
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageCircle className="text-green-400" size={32} />
                    </div>
                    <h3 className="text-xl font-military font-bold text-white mb-2">WHATSAPP</h3>
                    <p className="text-gray-400 font-tactical text-sm mb-4">
                      Canal preferencial — resposta rápida durante o expediente
                    </p>
                    <Button
                      asChild
                      size="lg"
                      className="bg-green-600 hover:bg-green-700 text-white font-tactical font-bold uppercase tracking-wide transition-all duration-300 hover:scale-105"
                    >
                      <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="w-5 h-5 mr-2" />
                        Conversar agora
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Email */}
              <Card className="bg-gray-900/50 border-gray-700 tactical-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-cbt-orange/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Mail className="text-cbt-orange" size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-military font-bold text-white mb-1">E-MAIL</h3>
                      <a
                        href={`mailto:${EMAIL}`}
                        className="text-sm md:text-base font-tactical font-bold text-cbt-orange hover:text-cbt-orange/80 transition-colors break-all"
                      >
                        {EMAIL}
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Address */}
              <Card className="bg-gray-900/50 border-gray-700 tactical-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-14 h-14 bg-cbt-orange/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPin className="text-cbt-orange" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-military font-bold text-white mb-2">ENDEREÇO</h3>
                      <p className="text-gray-300 font-tactical text-sm">
                        Via Metropolitana, 1807 - Capelão
                        <br />
                        Lauro de Freitas - BA
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Floating WhatsApp Button */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg hover:scale-110 transition-all duration-300 flex items-center justify-center"
        aria-label="Conversar no WhatsApp"
      >
        <MessageCircle size={32} />
      </a>
    </section>
  );
};

export default Contact;
