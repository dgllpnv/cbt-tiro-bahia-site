import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Pin,
  Eye,
  EyeOff,
  Newspaper,
  ImageIcon,
  Loader2,
  Search,
  Star,
  Calendar,
  ChevronDown,
  ChevronUp,
  Upload,
  RefreshCw,
  X,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import {
  listNews,
  createNews,
  updateNews,
  deleteNews,
  type News,
  type CreateNewsData,
} from '@/services/newsService';

// ── Form State ─────────────────────────────────────────────────────────────

interface NewsFormState {
  title: string;
  content: string;
  summary: string;
  imageUrl: string;
  isPinned: boolean;
  isPublished: boolean;
}

const emptyForm: NewsFormState = {
  title: '',
  content: '',
  summary: '',
  imageUrl: '',
  isPinned: false,
  isPublished: false,
};

type StatusFilter = 'all' | 'published' | 'draft';

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin}min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `há ${diffD} dias`;
  const diffMo = Math.round(diffD / 30);
  if (diffMo < 12) return `há ${diffMo} ${diffMo === 1 ? 'mês' : 'meses'}`;
  const diffY = Math.round(diffMo / 12);
  return `há ${diffY} ${diffY === 1 ? 'ano' : 'anos'}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function plainTextPreview(content: string, max = 140): string {
  const t = content.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + '…';
}

// ── Page ───────────────────────────────────────────────────────────────────

const NewsManagementPage = () => {
  const { toast } = useToast();

  const [newsList, setNewsList] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [destaquesOpen, setDestaquesOpen] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewsFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: 'default' | 'destructive';
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    variant: 'default',
    onConfirm: () => {},
  });
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    const result = await listNews({ limit: 100 });
    if (result.success && result.data) {
      setNewsList(result.data);
    } else {
      toast({
        title: 'Erro ao carregar noticias',
        description: result.error,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const counts = useMemo(
    () => ({
      all: newsList.length,
      published: newsList.filter((n) => n.isPublished).length,
      draft: newsList.filter((n) => !n.isPublished).length,
    }),
    [newsList],
  );

  const filtered = useMemo(() => {
    let list = newsList;
    if (statusFilter === 'published') list = list.filter((n) => n.isPublished);
    if (statusFilter === 'draft') list = list.filter((n) => !n.isPublished);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.summary ?? '').toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q),
      );
    }
    return list;
  }, [newsList, statusFilter, search]);

  const featured = useMemo(
    () => filtered.filter((n) => n.isPinned).slice(0, 3),
    [filtered],
  );
  const others = useMemo(
    () => filtered.filter((n) => !n.isPinned),
    [filtered],
  );

  // IDs das 3 noticias que aparecem na home agora. Espelha a regra do
  // backend GET /api/public/news: published, ordenadas por isPinned desc
  // + publishedAt desc, take 3. Recalcula sobre TODA a lista (nao filtrada),
  // para que o badge seja consistente independente de filtros aplicados.
  const HOME_LIMIT = 3;
  const homeVisibleIds = useMemo(() => {
    const sorted = [...newsList]
      .filter((n) => n.isPublished)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      })
      .slice(0, HOME_LIMIT);
    return new Set(sorted.map((n) => n.id));
  }, [newsList]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const updateField = <K extends keyof NewsFormState>(key: K, value: NewsFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (news: News) => {
    setEditingId(news.id);
    setForm({
      title: news.title,
      content: news.content,
      summary: news.summary || '',
      imageUrl: news.imageUrl || '',
      isPinned: news.isPinned,
      isPublished: news.isPublished,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Título obrigatório', variant: 'destructive' });
      return;
    }
    if (!form.content.trim()) {
      toast({ title: 'Conteúdo obrigatório', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    // imageUrl: enviar string vazia em vez de undefined garante que o backend
    // receba o campo no payload (axios omite undefined do JSON). O handler do
    // backend converte '' em null, o que limpa a coluna na edicao.
    const payload: CreateNewsData = {
      title: form.title.trim(),
      content: form.content.trim(),
      summary: form.summary.trim() || undefined,
      imageUrl: form.imageUrl.trim(),
      isPinned: form.isPinned,
      isPublished: form.isPublished,
    };

    const result = editingId
      ? await updateNews(editingId, payload)
      : await createNews(payload);

    setIsSaving(false);

    if (result.success) {
      toast({
        title: editingId ? 'Notícia atualizada com sucesso' : 'Notícia criada com sucesso',
      });
      setDialogOpen(false);
      fetchNews();
    } else {
      toast({
        title: editingId ? 'Erro ao atualizar' : 'Erro ao criar',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const togglePinned = async (n: News) => {
    const result = await updateNews(n.id, { isPinned: !n.isPinned });
    if (result.success) {
      toast({ title: n.isPinned ? 'Notícia desafixada' : 'Notícia fixada' });
      fetchNews();
    } else {
      toast({ title: 'Erro ao alterar', description: result.error, variant: 'destructive' });
    }
  };

  const togglePublished = async (n: News) => {
    const result = await updateNews(n.id, { isPublished: !n.isPublished });
    if (result.success) {
      toast({ title: n.isPublished ? 'Movido para rascunhos' : 'Notícia publicada' });
      fetchNews();
    } else {
      toast({ title: 'Erro ao alterar', description: result.error, variant: 'destructive' });
    }
  };

  const handleDelete = (news: News) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir notícia',
      description: `Tem certeza que deseja excluir "${news.title}"? Esta ação não pode ser desfeita.`,
      variant: 'destructive',
      onConfirm: async () => {
        setIsActionLoading(true);
        const result = await deleteNews(news.id);
        setIsActionLoading(false);
        if (result.success) {
          toast({ title: 'Notícia excluída' });
          setConfirmDialog((p) => ({ ...p, open: false }));
          fetchNews();
        } else {
          toast({
            title: 'Erro ao excluir',
            description: result.error,
            variant: 'destructive',
          });
        }
      },
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Gestão de Notícias"
        description="Criar, editar e organizar notícias do clube"
        actions={
          <Button
            onClick={openCreateDialog}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Notícia
          </Button>
        }
      />

      {/* ── Regras de exibicao na home ─────────────────────────────────── */}
      <div className="bg-cbt-orange/5 border border-cbt-orange/30 rounded-lg p-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-cbt-orange/15 flex items-center justify-center flex-shrink-0">
            <Star className="h-4 w-4 text-cbt-orange" />
          </div>
          <div className="flex-1 text-sm font-tactical text-foreground/85">
            <p className="font-bold text-foreground mb-1">
              Como controlar o que aparece na home do site
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                • A home mostra as <strong className="text-foreground">{HOME_LIMIT} notícias mais recentes publicadas</strong> — fixadas (<Pin className="inline h-3 w-3 text-cbt-orange" />) entram primeiro
              </li>
              <li>
                • Para que uma notícia apareça, ela precisa estar <strong className="text-foreground">Publicada</strong> (ícone <Eye className="inline h-3 w-3 text-green-600 dark:text-green-400" />). Rascunhos ficam ocultos
              </li>
              <li>
                • Notícias com o selo <Badge className="inline-flex bg-cbt-orange/15 text-cbt-orange border-cbt-orange/30 text-[10px] mx-1 font-tactical h-4 px-1.5">🌐 NA HOME</Badge> são as que estão aparecendo agora no site público
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Filters bar ───────────────────────────────────────────────────── */}
      <div className="bg-card/50 border border-border rounded-lg p-4 mb-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          className="flex-shrink-0"
        >
          <TabsList className="bg-muted/70 border border-border p-1">
            <TabsTrigger
              value="all"
              className="font-tactical data-[state=active]:bg-cbt-orange data-[state=active]:text-primary-foreground text-muted-foreground"
            >
              Todas
              <Badge variant="outline" className="ml-2 bg-muted/50 border-border text-[10px]">
                {counts.all}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="published"
              className="font-tactical data-[state=active]:bg-cbt-orange data-[state=active]:text-primary-foreground text-muted-foreground"
            >
              Publicadas
              <Badge variant="outline" className="ml-2 bg-muted/50 border-border text-[10px]">
                {counts.published}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="draft"
              className="font-tactical data-[state=active]:bg-cbt-orange data-[state=active]:text-primary-foreground text-muted-foreground"
            >
              Rascunhos
              <Badge variant="outline" className="ml-2 bg-muted/50 border-border text-[10px]">
                {counts.draft}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/80 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, resumo ou conteúdo..."
            className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground/80 font-tactical"
          />
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-card/50 border border-border rounded-lg">
          <LoadingSpinner message="Carregando notícias..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card/50 border border-border rounded-lg">
          <EmptyState
            icon={<Newspaper className="w-8 h-8 text-muted-foreground/80" />}
            title={newsList.length === 0 ? 'Nenhuma notícia ainda' : 'Nenhum resultado'}
            description={
              newsList.length === 0
                ? 'Publique a primeira notícia do clube para os associados.'
                : 'Ajuste os filtros ou a busca acima.'
            }
            action={
              newsList.length === 0 ? (
                <Button
                  onClick={openCreateDialog}
                  className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Notícia
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Featured / Pinned ─────────────────────────────────────── */}
          {featured.length > 0 && statusFilter !== 'draft' && (
            <section>
              <button
                type="button"
                onClick={() => setDestaquesOpen((o) => !o)}
                className="w-full flex items-center justify-between mb-3"
              >
                <h2 className="text-sm font-military font-bold text-foreground tracking-wide flex items-center gap-2">
                  <Star className="h-4 w-4 text-cbt-orange" />
                  Destaques
                  <Badge className="bg-cbt-orange/15 text-cbt-orange border-cbt-orange/30 ml-1">
                    {featured.length}
                  </Badge>
                </h2>
                {destaquesOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground/80" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground/80" />
                )}
              </button>
              {destaquesOpen && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {featured.map((n) => (
                    <FeaturedCard
                      key={n.id}
                      news={n}
                      onHome={homeVisibleIds.has(n.id)}
                      onEdit={() => openEditDialog(n)}
                      onTogglePin={() => togglePinned(n)}
                      onDelete={() => handleDelete(n)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Others ─────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-sm font-military font-bold text-foreground tracking-wide mb-3 flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-muted-foreground/80" />
              Todas as notícias
              <Badge variant="outline" className="bg-muted border-border text-muted-foreground ml-1">
                {others.length}
              </Badge>
            </h2>
            <div className="bg-card/50 border border-border rounded-lg overflow-hidden divide-y divide-gray-800">
              {others.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground/80 font-tactical text-sm">
                  Nenhuma notícia além dos destaques nesta visualização.
                </div>
              ) : (
                others.map((n) => (
                  <NewsRow
                    key={n.id}
                    news={n}
                    onHome={homeVisibleIds.has(n.id)}
                    onEdit={() => openEditDialog(n)}
                    onTogglePin={() => togglePinned(n)}
                    onTogglePublish={() => togglePublished(n)}
                    onDelete={() => handleDelete(n)}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* ── Create / Edit Dialog ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground font-military tracking-wide">
              {editingId ? 'Editar Notícia' : 'Nova Notícia'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-tactical text-sm">
              {editingId
                ? 'Atualize os dados da notícia abaixo.'
                : 'Preencha os campos para publicar uma nova notícia.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Título da notícia"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Conteúdo *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => updateField('content', e.target.value)}
                placeholder="Conteúdo completo da notícia..."
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange min-h-[200px] resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Resumo (opcional)</Label>
              <Textarea
                value={form.summary}
                onChange={(e) => updateField('summary', e.target.value)}
                placeholder="Breve resumo para exibição em cards..."
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange min-h-[80px] resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Imagem (opcional)</Label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                id="news-image-upload"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!['image/png', 'image/jpeg'].includes(file.type)) {
                    toast({
                      variant: 'destructive',
                      title: 'Formato inválido',
                      description: 'Use PNG ou JPG.',
                    });
                    e.target.value = '';
                    return;
                  }
                  if (file.size > 2 * 1024 * 1024) {
                    toast({
                      variant: 'destructive',
                      title: 'Arquivo muito grande',
                      description: 'Tamanho máximo: 2 MB.',
                    });
                    e.target.value = '';
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => updateField('imageUrl', String(reader.result));
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
              {form.imageUrl ? (
                <div className="space-y-2">
                  <div className="h-32 rounded-md bg-muted border border-border overflow-hidden">
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('news-image-upload')?.click()}
                      className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Trocar imagem
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateField('imageUrl', '')}
                      className="bg-muted border-border text-foreground/85 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-700 dark:text-red-300 font-tactical"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="news-image-upload"
                  className="flex flex-col items-center justify-center gap-2 h-32 rounded-md bg-muted/50 border border-dashed border-border cursor-pointer hover:bg-muted hover:border-cbt-orange/40 transition-colors"
                >
                  <Upload className="h-6 w-6 text-muted-foreground/80" />
                  <p className="text-xs font-tactical text-muted-foreground">
                    Clique para enviar uma imagem (PNG ou JPG, até 2 MB)
                  </p>
                </label>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-6 pt-2">
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isPinned}
                  onCheckedChange={(checked) => updateField('isPinned', checked)}
                  className="data-[state=checked]:bg-cbt-orange"
                />
                <div>
                  <Label className="text-foreground/85 font-tactical text-sm cursor-pointer">
                    Fixar como destaque
                  </Label>
                  <p className="text-xs text-muted-foreground/80 font-tactical">
                    Aparece no topo da página
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isPublished}
                  onCheckedChange={(checked) => updateField('isPublished', checked)}
                  className="data-[state=checked]:bg-green-500"
                />
                <div>
                  <Label className="text-foreground/85 font-tactical text-sm cursor-pointer">
                    Publicar
                  </Label>
                  <p className="text-xs text-muted-foreground/80 font-tactical">
                    Visível para todos os membros
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
              className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical min-w-[120px]"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                'Salvar alterações'
              ) : (
                'Publicar notícia'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((p) => ({ ...p, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        isLoading={isActionLoading}
      />
    </div>
  );
};

// ── Featured Card ──────────────────────────────────────────────────────────

interface FeaturedCardProps {
  news: News;
  onHome: boolean;
  onEdit: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

const FeaturedCard = ({ news, onHome, onEdit, onTogglePin, onDelete }: FeaturedCardProps) => (
  <article className="bg-card/70 border border-cbt-orange/30 rounded-lg overflow-hidden flex flex-col group hover:border-cbt-orange/60 transition-colors">
    <div className="relative h-32 bg-muted flex items-center justify-center overflow-hidden">
      {news.imageUrl ? (
        <img
          src={news.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-cbt-orange/20 to-gray-800">
          <Newspaper className="h-10 w-10 text-cbt-orange/40" />
        </div>
      )}
      <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-cbt-orange/90 text-primary-foreground text-xs font-tactical font-bold uppercase">
        <Pin className="h-3 w-3" />
        Destaque
      </span>
      {onHome && (
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-600/90 text-white text-[10px] font-tactical font-bold uppercase tracking-wide">
          🌐 Na home
        </span>
      )}
      {!news.isPublished && (
        <span className="absolute top-2 right-2 px-2 py-1 rounded-md bg-yellow-500/90 text-primary-foreground text-[10px] font-tactical font-bold uppercase">
          Rascunho
        </span>
      )}
    </div>
    <div className="p-4 flex flex-col gap-2 flex-1">
      <h3 className="text-foreground font-tactical font-semibold text-sm leading-snug line-clamp-2">
        {news.title}
      </h3>
      <p className="text-muted-foreground font-tactical text-xs line-clamp-3 flex-1">
        {news.summary || plainTextPreview(news.content, 160)}
      </p>
      <div className="flex items-center justify-between text-[11px] font-tactical text-muted-foreground/80 pt-1 border-t border-border">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(news.publishedAt)}
        </span>
        {news.author && <span>por {news.author.fullName.split(' ')[0]}</span>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-8 px-2 text-muted-foreground hover:text-cbt-orange hover:bg-secondary font-tactical text-xs"
        >
          <Pencil className="h-3.5 w-3.5 mr-1" />
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onTogglePin}
          className="h-8 px-2 text-muted-foreground hover:text-cbt-orange hover:bg-secondary font-tactical text-xs"
        >
          <Pin className="h-3.5 w-3.5 mr-1" />
          Desafixar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-8 px-2 text-muted-foreground hover:text-red-700 dark:text-red-400 hover:bg-secondary font-tactical text-xs ml-auto"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  </article>
);

// ── Compact News Row ───────────────────────────────────────────────────────

interface NewsRowProps {
  news: News;
  onHome: boolean;
  onEdit: () => void;
  onTogglePin: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}

const NewsRow = ({ news, onHome, onEdit, onTogglePin, onTogglePublish, onDelete }: NewsRowProps) => (
  <div
    className={`group flex items-center gap-4 px-4 py-3 transition-colors ${
      onHome ? 'bg-green-500/[0.04] hover:bg-green-500/[0.08]' : 'hover:bg-muted/40'
    }`}
  >
    {/* Thumbnail */}
    <div className="hidden sm:flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md bg-muted border border-border overflow-hidden">
      {news.imageUrl ? (
        <img
          src={news.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
        />
      ) : (
        <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
      )}
    </div>

    {/* Title + meta */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        {news.isPinned && <Pin className="h-3.5 w-3.5 text-cbt-orange flex-shrink-0" />}
        <h3 className="text-foreground font-tactical text-sm truncate">{news.title}</h3>
        {onHome && (
          <Badge className="bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30 text-[10px] font-tactical h-5">
            🌐 Na home
          </Badge>
        )}
        {!news.isPublished && (
          <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 text-[10px] font-tactical h-5">
            <EyeOff className="h-2.5 w-2.5 mr-1" />
            Rascunho
          </Badge>
        )}
      </div>
      <p className="text-muted-foreground/80 font-tactical text-xs line-clamp-1 max-w-2xl">
        {news.summary || plainTextPreview(news.content, 120)}
      </p>
      <div className="flex items-center gap-3 mt-1 text-[11px] font-tactical text-muted-foreground/60">
        {news.author && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-4 w-4 rounded-full bg-cbt-orange/20 text-cbt-orange flex items-center justify-center text-[8px] font-bold">
              {getInitials(news.author.fullName)}
            </span>
            {news.author.fullName.split(' ')[0]}
          </span>
        )}
        <span>•</span>
        <span title={formatDate(news.publishedAt)}>{relativeTime(news.publishedAt)}</span>
      </div>
    </div>

    {/* Hover actions (desktop) + always visible (mobile) */}
    <div className="flex items-center gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
      <Button
        variant="ghost"
        size="icon"
        onClick={onTogglePin}
        title={news.isPinned ? 'Desafixar' : 'Fixar como destaque'}
        className={`h-8 w-8 ${news.isPinned ? 'text-cbt-orange' : 'text-muted-foreground'} hover:text-cbt-orange hover:bg-secondary`}
      >
        <Pin className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onTogglePublish}
        title={news.isPublished ? 'Despublicar' : 'Publicar'}
        className={`h-8 w-8 ${news.isPublished ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'} hover:text-green-700 dark:text-green-400 hover:bg-secondary`}
      >
        {news.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onEdit}
        title="Editar"
        className="h-8 w-8 text-muted-foreground hover:text-cbt-orange hover:bg-secondary"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        title="Excluir"
        className="h-8 w-8 text-muted-foreground hover:text-red-700 dark:text-red-400 hover:bg-secondary"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

export default NewsManagementPage;
