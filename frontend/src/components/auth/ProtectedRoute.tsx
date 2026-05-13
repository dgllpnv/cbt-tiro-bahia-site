import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

/**
 * Resolve qual e a "home" do role atual — destino seguro quando o usuario
 * tenta acessar uma rota fora do seu escopo de permissao.
 */
function roleHome(role: UserRole | undefined): string {
  if (role === 'admin') return '/admin';
  if (role === 'cashier') return '/admin/caixa';
  return '/portal';
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-cbt-orange" />
          <p className="text-gray-400 font-tactical">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Sem allowedRoles = qualquer usuario autenticado pode acessar
  if (!allowedRoles || allowedRoles.length === 0) {
    return <>{children}</>;
  }

  // Verifica role contra a lista permitida; redireciona pra home do usuario se nao bate.
  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
