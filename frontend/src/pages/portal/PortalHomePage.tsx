import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  Crosshair,
  Eye,
  Newspaper,
  CreditCard,
  Activity,
  FileText,
  Clock,
  ChevronRight,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import CbtLogo from '@/components/shared/CbtLogo';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { formatDate } from '@/lib/formatters';

interface DashboardData {
  annuityValidUntil: string | null;
  visitsThisYear: number;
  shotsRegistered: number;
}

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
}

const PortalHomePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  const firstName = user?.fullName?.split(' ')[0] || 'Associado';

  // ── Annuity helpers ────────────────────────────────────────────────────
  const getDaysRemaining = useCallback(() => {
    if (!dashboard?.annuityValidUntil) return -1;
    const now = new Date();
    const valid = new Date(dashboard.annuityValidUntil);
    return Math.ceil((valid.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, [dashboard]);

  const getAnnuityColor = () => {
    const days = getDaysRemaining();
    if (days < 0) return 'text-red-700 dark:text-red-400 border-red-500/40 bg-red-500/10';
    if (days < 30) return 'text-red-700 dark:text-red-400 border-red-500/40 bg-red-500/10';
    if (days <= 60) return 'text-yellow-700 dark:text-yellow-400 border-yellow-500/40 bg-yellow-500/10';
    return 'text-green-700 dark:text-green-400 border-green-500/40 bg-green-500/10';
  };

  const getAnnuityLabel = () => {
    const days = getDaysRemaining();
    if (days < 0) return 'Vencida';
    if (days === 0) return 'Vence hoje';
    return `${days} dias restantes`;
  };

  // ── Fetch data ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [dashRes, newsRes] = await Promise.allSettled([
          api.get('/api/dashboard/associate'),
          api.get('/api/news', { params: { limit: 5 } }),
        ]);

        if (dashRes.status === 'fulfilled') {
          // Backend retorna { success: true, data: { annuityStatus, myVisits, totalShots, ... } }
          // Mapeia para o shape esperado pelo frontend.
          const body = dashRes.value.data;
          const payload = body?.data ?? body;
          setDashboard({
            annuityValidUntil:
              payload?.annuityStatus?.validUntil ??
              payload?.annuityValidUntil ??
              user?.annuityValidUntil ??
              null,
            visitsThisYear: payload?.myVisits ?? payload?.visitsThisYear ?? 0,
            shotsRegistered: payload?.totalShots ?? payload?.shotsRegistered ?? 0,
          });
        } else {
          // Fallback from user data
          setDashboard({
            annuityValidUntil: user?.annuityValidUntil || null,
            visitsThisYear: 0,
            shotsRegistered: 0,
          });
        }

        if (newsRes.status === 'fulfilled') {
          const newsData = newsRes.value.data;
          setNews(Array.isArray(newsData) ? newsData : newsData.data || []);
        }
      } catch {
        toast({
          title: 'Erro ao carregar dados',
          description: 'Alguns dados podem estar indisponiveis.',
          variant: 'destructive',
        });
        setDashboard({
          annuityValidUntil: user?.annuityValidUntil || null,
          visitsThisYear: 0,
          shotsRegistered: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // ── Quick actions config ───────────────────────────────────────────────
  const quickActions = [
    { label: 'Historico de Treinos', icon: Clock, to: '/portal/historico' },
    { label: 'Carteirinha Digital', icon: CreditCard, to: '/portal/carteirinha' },
    { label: 'Habitualidade', icon: Activity, to: '/portal/habitualidade' },
    { label: 'Documentos', icon: FileText, to: '/portal/documentos' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div>
        <PageHeader title="Inicio" description="Painel do associado" />
        <LoadingSpinner message="Carregando painel..." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Inicio" description="Painel do associado" />

      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-card via-card/80 to-cbt-orange/10 border border-border rounded-lg p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex h-16 w-16 items-center justify-center flex-shrink-0">
            <CbtLogo className="h-full w-full" />
          </div>
          <div>
            <h2 className="text-xl font-military font-bold text-foreground tracking-wide">
              Bem-vindo, {firstName}!
            </h2>
            <p className="text-muted-foreground font-tactical text-sm mt-0.5">
              Clube Baiano de Tiro — Area do Associado
            </p>
          </div>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Anuidade */}
        <div className={`border rounded-lg p-5 transition-colors ${getAnnuityColor()}`}>
          <div className="flex items-center gap-3 mb-3">
            <CalendarCheck className="h-5 w-5" />
            <span className="font-tactical text-sm font-semibold uppercase tracking-wide">Anuidade</span>
          </div>
          <p className="text-2xl font-military font-bold">
            {dashboard?.annuityValidUntil ? formatDate(dashboard.annuityValidUntil) : '—'}
          </p>
          <p className="text-xs font-tactical mt-1 opacity-80">{getAnnuityLabel()}</p>
        </div>

        {/* Visitas */}
        <div className="border border-border/50 bg-card/50 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <Eye className="h-5 w-5 text-cbt-orange" />
            <span className="text-muted-foreground font-tactical text-sm font-semibold uppercase tracking-wide">
              Visitas
            </span>
          </div>
          <p className="text-2xl font-military font-bold text-foreground">
            {dashboard?.visitsThisYear ?? 0}
          </p>
          <p className="text-xs font-tactical text-muted-foreground/80 mt-1">visitas este ano</p>
        </div>

        {/* Disparos */}
        <div className="border border-border/50 bg-card/50 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <Crosshair className="h-5 w-5 text-cbt-orange" />
            <span className="text-muted-foreground font-tactical text-sm font-semibold uppercase tracking-wide">
              Disparos
            </span>
          </div>
          <p className="text-2xl font-military font-bold text-foreground">
            {dashboard?.shotsRegistered ?? 0}
          </p>
          <p className="text-xs font-tactical text-muted-foreground/80 mt-1">disparos registrados</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {quickActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group flex flex-col items-center gap-2 bg-card/50 border border-border hover:border-cbt-orange/40 rounded-lg p-4 transition-all hover:bg-muted/60"
          >
            <action.icon className="h-6 w-6 text-muted-foreground group-hover:text-cbt-orange transition-colors" />
            <span className="text-xs font-tactical text-foreground/85 group-hover:text-foreground text-center transition-colors">
              {action.label}
            </span>
          </Link>
        ))}
      </div>

      {/* News feed */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="h-5 w-5 text-cbt-orange" />
          <h3 className="text-lg font-military font-bold text-foreground tracking-wide">
            Ultimas Noticias
          </h3>
        </div>

        {news.length === 0 ? (
          <div className="bg-card/50 border border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground/80 font-tactical text-sm">Nenhuma noticia disponivel no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {news.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedNews(item)}
                className="bg-card/50 border border-border hover:border-cbt-orange/30 rounded-lg overflow-hidden text-left transition-all hover:bg-muted/40 group"
              >
                {item.imageUrl && (
                  <div className="h-36 w-full overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-4">
                  <p className="text-xs font-tactical text-muted-foreground/80 mb-1">
                    {formatDate(item.createdAt)}
                  </p>
                  <h4 className="text-sm font-military font-bold text-foreground mb-1 line-clamp-2 group-hover:text-cbt-orange transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-xs font-tactical text-muted-foreground line-clamp-2">{item.summary}</p>
                  <span className="inline-flex items-center text-xs text-cbt-orange font-tactical mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    Ler mais <ChevronRight className="h-3 w-3 ml-0.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* News detail dialog */}
      <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-military text-lg tracking-wide text-foreground">
              {selectedNews?.title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-tactical text-xs">
              {selectedNews?.createdAt ? formatDate(selectedNews.createdAt) : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedNews?.imageUrl && (
            <div className="rounded-md overflow-hidden my-2">
              <img
                src={selectedNews.imageUrl}
                alt={selectedNews.title}
                className="w-full h-48 object-cover"
              />
            </div>
          )}
          <div className="text-sm font-tactical text-foreground/85 leading-relaxed whitespace-pre-line">
            {selectedNews?.content || selectedNews?.summary}
          </div>
          <div className="flex justify-end mt-2">
            <Button
              variant="outline"
              className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
              onClick={() => setSelectedNews(null)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalHomePage;
