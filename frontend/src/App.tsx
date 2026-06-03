import { lazy, Suspense } from "react";
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

// Paginas carregadas sob demanda (code-splitting): o site publico nao baixa
// o codigo do admin/portal (jspdf, recharts, @vladmandic/human, etc.).
// Public pages
const Index = lazy(() => import("./pages/Index"));
const GalleryPage = lazy(() => import("./pages/GalleryPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const PasswordSetupPage = lazy(() => import("./pages/PasswordSetupPage"));

// Associate portal pages
const PortalHomePage = lazy(() => import("./pages/portal/PortalHomePage"));
const TrainingHistoryPage = lazy(() => import("./pages/portal/TrainingHistoryPage"));
const ProfilePage = lazy(() => import("./pages/portal/ProfilePage"));
const AnnuityPage = lazy(() => import("./pages/portal/AnnuityPage"));
const MembershipCardPage = lazy(() => import("./pages/portal/MembershipCardPage"));
const HabitualityPage = lazy(() => import("./pages/portal/HabitualityPage"));
const EventsPage = lazy(() => import("./pages/portal/EventsPage"));
const DocumentsPage = lazy(() => import("./pages/portal/DocumentsPage"));

// Admin pages
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const TransactionsPage = lazy(() => import("./pages/admin/TransactionsPage"));
const MembersPage = lazy(() => import("./pages/admin/MembersPage"));
const FinancialPage = lazy(() => import("./pages/admin/FinancialPage"));
const ProductsPage = lazy(() => import("./pages/admin/ProductsPage"));
const AuditLogsPage = lazy(() => import("./pages/admin/AuditLogsPage"));
const NewsManagementPage = lazy(() => import("./pages/admin/NewsManagementPage"));
const EventsManagementPage = lazy(() => import("./pages/admin/EventsManagementPage"));
const MemberCreatePage = lazy(() => import("./pages/admin/MemberCreatePage"));
const MemberDetailPage = lazy(() => import("./pages/admin/MemberDetailPage"));
const VisitorsPage = lazy(() => import("./pages/admin/VisitorsPage"));
const VisitorCreatePage = lazy(() => import("./pages/admin/VisitorCreatePage"));
const VisitorDetailPage = lazy(() => import("./pages/admin/VisitorDetailPage"));
const EquipmentsPage = lazy(() => import("./pages/admin/EquipmentsPage"));
const EquipmentCreatePage = lazy(() => import("./pages/admin/EquipmentCreatePage"));
const EquipmentDetailPage = lazy(() => import("./pages/admin/EquipmentDetailPage"));
const ClubDataPage = lazy(() => import("./pages/admin/ClubDataPage"));
const ReportsPage = lazy(() => import("./pages/admin/ReportsPage"));
const CashierDailyPage = lazy(() => import("./pages/admin/CashierDailyPage"));
const GalleryManagementPage = lazy(() => import("./pages/admin/GalleryManagementPage"));
const HabitualityManualPage = lazy(() => import("./pages/admin/HabitualityManualPage"));
const ExportPage = lazy(() => import("./pages/admin/ExportPage"));

const queryClient = new QueryClient();

// Fallback enquanto o chunk da pagina carrega (dependency-free)
const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 rounded-full border-2 border-cbt-orange border-t-transparent animate-spin" />
  </div>
);

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
            <Suspense fallback={<PageFallback />}>
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
              <Route path="exportacao" element={<ProtectedRoute allowedRoles={['admin']}><ExportPage /></ProtectedRoute>} />

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
              {/* Habitualidade Manual — admin-only (poder retroativo) */}
              <Route
                path="habitualidade-manual"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <HabitualityManualPage />
                  </ProtectedRoute>
                }
              />
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
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
