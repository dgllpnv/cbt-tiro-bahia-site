import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PortalLayout from "@/components/layout/PortalLayout";
import PublicLayout from "@/components/layout/PublicLayout";

// Public pages
import Index from "./pages/Index";
import GalleryPage from "./pages/GalleryPage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import PasswordSetupPage from "./pages/PasswordSetupPage";

// Associate portal pages
import PortalHomePage from "./pages/portal/PortalHomePage";
import TrainingHistoryPage from "./pages/portal/TrainingHistoryPage";
import ProfilePage from "./pages/portal/ProfilePage";
import AnnuityPage from "./pages/portal/AnnuityPage";
import MembershipCardPage from "./pages/portal/MembershipCardPage";
import HabitualityPage from "./pages/portal/HabitualityPage";
import EventsPage from "./pages/portal/EventsPage";
import DocumentsPage from "./pages/portal/DocumentsPage";

// Admin pages
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import TransactionsPage from "./pages/admin/TransactionsPage";
import MembersPage from "./pages/admin/MembersPage";
import FinancialPage from "./pages/admin/FinancialPage";
import ProductsPage from "./pages/admin/ProductsPage";
import AuditLogsPage from "./pages/admin/AuditLogsPage";
import NewsManagementPage from "./pages/admin/NewsManagementPage";
import EventsManagementPage from "./pages/admin/EventsManagementPage";
import MemberCreatePage from "./pages/admin/MemberCreatePage";
import MemberDetailPage from "./pages/admin/MemberDetailPage";
import VisitorsPage from "./pages/admin/VisitorsPage";
import VisitorCreatePage from "./pages/admin/VisitorCreatePage";
import VisitorDetailPage from "./pages/admin/VisitorDetailPage";
import EquipmentsPage from "./pages/admin/EquipmentsPage";
import EquipmentCreatePage from "./pages/admin/EquipmentCreatePage";
import EquipmentDetailPage from "./pages/admin/EquipmentDetailPage";
import ClubDataPage from "./pages/admin/ClubDataPage";
import ReportsPage from "./pages/admin/ReportsPage";
import CashierDailyPage from "./pages/admin/CashierDailyPage";
import GalleryManagementPage from "./pages/admin/GalleryManagementPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      themes={['light', 'dark']}
      storageKey="cbt-theme"
    >
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public — sempre dark via PublicLayout (identidade institucional) */}
              <Route path="/" element={<PublicLayout><Index /></PublicLayout>} />
              <Route path="/galeria" element={<PublicLayout><GalleryPage /></PublicLayout>} />
              <Route path="/login" element={<PublicLayout><LoginPage /></PublicLayout>} />
              {/* Tela forcada de primeiro acesso — protegida por auth, sem PortalLayout */}
              <Route
                path="/primeiro-acesso"
                element={
                  <ProtectedRoute>
                    <PasswordSetupPage />
                  </ProtectedRoute>
                }
              />

              {/* Associate Portal — path="/portal" ensures only /portal/* URLs match */}
            <Route
              path="/portal"
              element={
                <ProtectedRoute allowedRoles={['associate', 'admin']}>
                  <PortalLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<PortalHomePage />} />
              <Route path="historico" element={<TrainingHistoryPage />} />
              <Route path="perfil" element={<ProfilePage />} />
              <Route path="anuidade" element={<AnnuityPage />} />
              <Route path="carteirinha" element={<MembershipCardPage />} />
              <Route path="habitualidade" element={<HabitualityPage />} />
              <Route path="eventos" element={<EventsPage />} />
              <Route path="documentos" element={<DocumentsPage />} />
            </Route>

            {/* Admin Portal — admin e cashier acessam tudo, exceto /admin/financeiro (so admin). */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                  <PortalLayout />
                </ProtectedRoute>
              }
            >
              {/* Rotas admin-only: financeiro completo + auditoria/logs */}
              <Route path="financeiro" element={<ProtectedRoute allowedRoles={['admin']}><FinancialPage /></ProtectedRoute>} />
              <Route path="logs" element={<ProtectedRoute allowedRoles={['admin']}><AuditLogsPage /></ProtectedRoute>} />

              {/* Demais rotas acessiveis por admin e cashier */}
              <Route index element={<AdminDashboardPage />} />
              <Route path="caixa" element={<CashierDailyPage />} />
              <Route path="lancamentos" element={<TransactionsPage />} />
              <Route path="associados" element={<MembersPage />} />
              <Route path="associados/novo" element={<MemberCreatePage />} />
              <Route path="associados/:id" element={<MemberDetailPage />} />
              <Route path="visitantes" element={<VisitorsPage />} />
              <Route path="visitantes/novo" element={<VisitorCreatePage />} />
              <Route path="visitantes/:id" element={<VisitorDetailPage />} />
              <Route path="equipamentos" element={<EquipmentsPage />} />
              <Route path="equipamentos/novo" element={<EquipmentCreatePage />} />
              <Route path="equipamentos/:id" element={<EquipmentDetailPage />} />
              <Route path="relatorios" element={<ReportsPage />} />
              <Route path="produtos" element={<ProductsPage />} />
              {/* Compat: rotas antigas redirecionam */}
              <Route path="cadastros" element={<Navigate to="/admin/produtos" replace />} />
              <Route path="estoque" element={<Navigate to="/admin/produtos" replace />} />
              <Route path="dados-clube" element={<ClubDataPage />} />
              <Route path="noticias" element={<NewsManagementPage />} />
              <Route path="galeria" element={<GalleryManagementPage />} />
              <Route path="eventos" element={<EventsManagementPage />} />
            </Route>

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
