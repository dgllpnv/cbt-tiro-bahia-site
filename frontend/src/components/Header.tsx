
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, LogIn } from 'lucide-react';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const menuItems = [
    { name: 'Início', href: '#inicio' },
    { name: 'Sobre', href: '#sobre' },
    { name: 'Cursos', href: '#cursos' },
    { name: 'Notícias', href: '#noticias' },
    { name: 'Galeria', href: '#galeria' },
    { name: 'Parceiros', href: '#parceiros' },
    { name: 'Localização', href: '#localizacao' },
    { name: 'Contato', href: '#contato' }
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-black/95 backdrop-blur-sm tactical-shadow' : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 flex items-center justify-center">
              <img 
                src="/branding/d5fad45c-e7f8-49a2-bb56-498d1ba70193.png" 
                alt="CBT - Clube Baiano de Tiro" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-white font-military font-bold text-lg">CLUBE BAIANO DE TIRO</h1>
              <p className="text-cbt-orange text-xs font-tactical">EXCELÊNCIA EM TIRO ESPORTIVO</p>
            </div>
          </div>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center space-x-8">
            {menuItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-white hover:text-cbt-orange transition-colors duration-300 font-tactical font-semibold uppercase tracking-wide text-sm"
              >
                {item.name}
              </a>
            ))}
            <Link
              to="/login"
              className="flex items-center gap-2 bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold text-sm uppercase tracking-wide px-4 py-2 rounded-lg transition-all duration-300 glow-orange hover:scale-105"
            >
              <LogIn size={16} />
              Portal do Associado
            </Link>
          </nav>

          {/* Mobile Menu Button + Portal Link */}
          <div className="flex items-center gap-3 lg:hidden">
            <Link
              to="/login"
              className="flex items-center gap-1.5 bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold text-xs uppercase tracking-wide px-3 py-1.5 rounded-md transition-all duration-300"
            >
              <LogIn size={14} />
              Portal
            </Link>
            <button
              className="text-white hover:text-cbt-orange transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden bg-black/95 backdrop-blur-sm border-t border-gray-800">
            <nav className="py-4 space-y-2">
              {menuItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block px-4 py-2 text-white hover:text-cbt-orange hover:bg-gray-800/50 transition-colors duration-300 font-tactical font-semibold uppercase tracking-wide"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
