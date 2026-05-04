import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import PortalSidebar from './PortalSidebar';
import PortalHeader from './PortalHeader';

const PortalLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // CRITICAL: If admin is somehow on /portal, redirect to /admin
  // If associate is somehow on /admin, redirect to /portal
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const isOnAdmin = location.pathname.startsWith('/admin');
    const isOnPortal = location.pathname.startsWith('/portal');

    if (user.role === 'admin' && isOnPortal) {
      navigate('/admin', { replace: true });
    } else if (user.role === 'associate' && isOnAdmin) {
      navigate('/portal', { replace: true });
    }
  }, [user, isAuthenticated, location.pathname, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PortalSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <PortalHeader onMenuToggle={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PortalLayout;
