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
                    src="/branding/cbt-logo.png"
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
                Desde 2016, formando atiradores com segurança, profissionalismo e excelência.
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
                  { name: 'Notícias', href: '#noticias' },
                  { name: 'Galeria', href: '#galeria' },
                  { name: 'Parceiros', href: '#parceiros' },
                  { name: 'Localização', href: '#localizacao' },
                  { name: 'Contato', href: '#contato' },
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
              <div className="space-y-3 text-sm">
                <p className="text-gray-400 font-tactical">
                  📍 Via Metropolitana, 1807 - Capelão
                  <br />
                  Lauro de Freitas - BA
                </p>
                <p className="text-gray-400 font-tactical">
                  💬{' '}
                  <a
                    href="https://wa.me/557130511111"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-cbt-orange transition-colors"
                  >
                    WhatsApp (71) 3051-1111
                  </a>
                </p>
                <p className="text-gray-400 font-tactical break-all">
                  ✉️{' '}
                  <a
                    href="mailto:clubebaianodetiro@outlook.com"
                    className="hover:text-cbt-orange transition-colors"
                  >
                    clubebaianodetiro@outlook.com
                  </a>
                </p>
                <p className="text-gray-400 font-tactical">
                  🕒 Ter-Sex 9h-12h e 14h-17h
                  <br />
                  Sáb 9h-17h · Dom 9h-12h
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-gray-800">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
              <p className="text-gray-500 font-tactical text-sm">
                © {currentYear} CBT - Clube Baiano de Tiro. Todos os direitos reservados.
              </p>
              <p className="text-gray-600 font-tactical text-xs">
                Fundado em 24 de setembro de 2016 por Angelo Matos
              </p>
            </div>
          </div>

          {/* SEO Keywords (hidden) */}
          <div className="sr-only">
            curso de tiro Salvador, clube de tiro Lauro de Freitas, aula de tiro iniciante BA, tiro esportivo
            Bahia, CBT Clube Baiano de Tiro, escola de tiro Salvador, instrutor de tiro credenciado, curso
            armamento Salvador
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
