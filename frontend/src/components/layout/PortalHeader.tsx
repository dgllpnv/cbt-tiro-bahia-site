import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Menu, LogOut, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PortalHeaderProps {
  onMenuToggle: () => void;
}

const PortalHeader = ({ onMenuToggle }: PortalHeaderProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: Mobile menu + breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden text-gray-400 hover:text-white transition-colors"
          >
            <Menu size={22} />
          </button>
          <span className="text-gray-500 font-tactical text-sm hidden sm:block">
            {user?.role === 'admin' ? 'Administracao' : 'Portal do Associado'}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white font-tactical text-xs gap-1.5"
          >
            <Globe size={14} />
            <span className="hidden sm:inline">Site</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-gray-400 hover:text-red-400 font-tactical text-xs gap-1.5"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default PortalHeader;
