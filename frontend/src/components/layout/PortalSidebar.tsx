import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Home,
  ClipboardList,
  Users,
  UserCheck,
  DollarSign,
  Settings,
  Package,
  Crosshair,
  FileText,
  Newspaper,
  Calendar,
  History,
  User,
  CreditCard,
  IdCard,
  Target,
  FileCheck,
  X,
} from 'lucide-react';
import CbtLogo from '@/components/shared/CbtLogo';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  roles: ('admin' | 'associate')[];
}

const navItems: NavItem[] = [
  // Associate items
  { name: 'Inicio', href: '/portal', icon: <Home size={20} />, roles: ['associate'] },
  { name: 'Historico de Treinos', href: '/portal/historico', icon: <History size={20} />, roles: ['associate'] },
  { name: 'Meu Perfil', href: '/portal/perfil', icon: <User size={20} />, roles: ['associate'] },
  { name: 'Anuidade', href: '/portal/anuidade', icon: <CreditCard size={20} />, roles: ['associate'] },
  { name: 'Carteirinha', href: '/portal/carteirinha', icon: <IdCard size={20} />, roles: ['associate'] },
  { name: 'Habitualidade', href: '/portal/habitualidade', icon: <Target size={20} />, roles: ['associate'] },
  { name: 'Eventos', href: '/portal/eventos', icon: <Calendar size={20} />, roles: ['associate'] },
  { name: 'Documentos', href: '/portal/documentos', icon: <FileCheck size={20} />, roles: ['associate'] },

  // Admin items
  { name: 'Dashboard', href: '/admin', icon: <Home size={20} />, roles: ['admin'] },
  { name: 'Lancamentos', href: '/admin/lancamentos', icon: <ClipboardList size={20} />, roles: ['admin'] },
  { name: 'Associados', href: '/admin/associados', icon: <Users size={20} />, roles: ['admin'] },
  { name: 'Visitantes', href: '/admin/visitantes', icon: <UserCheck size={20} />, roles: ['admin'] },
  { name: 'Financeiro', href: '/admin/financeiro', icon: <DollarSign size={20} />, roles: ['admin'] },
  { name: 'Cadastros', href: '/admin/cadastros', icon: <Settings size={20} />, roles: ['admin'] },
  { name: 'Equipamentos', href: '/admin/equipamentos', icon: <Crosshair size={20} />, roles: ['admin'] },
  { name: 'Estoque', href: '/admin/estoque', icon: <Package size={20} />, roles: ['admin'] },
  { name: 'Logs', href: '/admin/logs', icon: <FileText size={20} />, roles: ['admin'] },
  { name: 'Noticias', href: '/admin/noticias', icon: <Newspaper size={20} />, roles: ['admin'] },
  { name: 'Eventos', href: '/admin/eventos', icon: <Calendar size={20} />, roles: ['admin'] },
];

interface PortalSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const PortalSidebar = ({ isOpen, onClose }: PortalSidebarProps) => {
  const { user } = useAuth();
  const location = useLocation();

  const filteredItems = navItems.filter((item) => user && item.roles.includes(user.role));

  const isActive = (href: string) => {
    if (href === '/portal' || href === '/admin') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
            <CbtLogo className="w-full h-full" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-military font-bold text-sm truncate">CBT</h2>
            <p className="text-cbt-orange text-xs font-tactical truncate">
              {user?.role === 'admin' ? 'ADMINISTRACAO' : 'PORTAL DO ASSOCIADO'}
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {filteredItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-tactical text-sm transition-all duration-200 ${
              isActive(item.href)
                ? 'bg-cbt-orange/10 text-cbt-orange border border-cbt-orange/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            {item.icon}
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* User info at bottom */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
            <User size={16} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-tactical truncate">{user?.fullName}</p>
            <p className="text-gray-500 text-xs font-tactical truncate">
              {user?.role === 'admin' ? 'Administrador' : `Associado ${user?.memberNumber}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-gray-900 border-r border-gray-800">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 w-72 bg-gray-900 border-r border-gray-800 z-50 lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
};

export default PortalSidebar;
