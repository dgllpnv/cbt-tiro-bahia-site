
const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black py-12 border-t border-gray-800">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 flex items-center justify-center">
                  <img 
                    src="/branding/c4359ef2-4319-4738-8bd2-f0f84ababee1.png" 
                    alt="CBT - Clube Baiano de Tiro" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-white font-military font-bold text-lg">CLUBE BAIANO DE TIRO</h3>
                  <p className="text-cbt-orange text-xs font-tactical">EXCELÊNCIA EM TIRO ESPORTIVO</p>
                </div>
              </div>
              <p className="text-gray-400 font-tactical text-sm">
                Mais de 10 anos formando atiradores com segurança, 
                profissionalismo e excelência.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-military font-bold mb-4 uppercase">Links Rápidos</h4>
              <ul className="space-y-2">
                {[
                  { name: 'Início', href: '#inicio' },
                  { name: 'Sobre', href: '#sobre' },
                  { name: 'Cursos', href: '#cursos' },
                  { name: 'Galeria', href: '#galeria' },
                  { name: 'Localização', href: '#localizacao' },
                  { name: 'Contato', href: '#contato' }
                ].map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-gray-400 hover:text-cbt-orange transition-colors font-tactical text-sm"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="text-white font-military font-bold mb-4 uppercase">Contato</h4>
              <div className="space-y-3">
                <p className="text-gray-400 font-tactical text-sm">
                  📍 Via Metropolitana, 1807 - Capelão<br />
                  Lauro de Freitas - BA, 42000-000
                </p>
                <p className="text-gray-400 font-tactical text-sm">
                  📞 <a href="tel:+5571999999999" className="hover:text-cbt-orange transition-colors">
                    (71) 3051-1111
                  </a>
                </p>
                <p className="text-gray-400 font-tactical text-sm">
                  🕒 Seg-Sex: 08h-18h | Sáb: 08h-16h | Dom: 08h-14h
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-gray-800">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-gray-500 font-tactical text-sm">
                © {currentYear} CBT - Clube Baiano de Tiro. Todos os direitos reservados.
              </p>
              <div className="flex space-x-6">
                <a href="#" className="text-gray-500 hover:text-cbt-orange transition-colors font-tactical text-sm">
                  Política de Privacidade
                </a>
                <a href="#" className="text-gray-500 hover:text-cbt-orange transition-colors font-tactical text-sm">
                  Termos de Uso
                </a>
              </div>
            </div>
          </div>

          {/* SEO Keywords (hidden) */}
          <div className="sr-only">
            curso de tiro Salvador, clube de tiro Lauro de Freitas, aula de tiro iniciante BA, 
            tiro esportivo Bahia, CBT Clube Baiano de Tiro, escola de tiro Salvador, 
            instrutor de tiro credenciado, curso armamento Salvador
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
