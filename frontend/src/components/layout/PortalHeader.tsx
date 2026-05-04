import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Menu, LogOut, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/shared/ThemeToggle';

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
    <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: Mobile menu + breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu size={22} />
          </button>
          <span className="text-muted-foreground font-tactical text-sm hidden sm:block">
            {user?.role === 'admin' ? 'Administracao' : 'Portal do Associado'}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground font-tactical text-xs gap-1.5"
          >
            <Globe size={14} />
            <span className="hidden sm:inline">Site</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-red-500 dark:hover:text-red-400 font-tactical text-xs gap-1.5"
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
