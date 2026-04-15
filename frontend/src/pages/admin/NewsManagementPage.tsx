import { useState, useEffect, useCallback } from 'react';
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

// ── Page ───────────────────────────────────────────────────────────────────

const NewsManagementPage = () => {
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────
  const [newsList, setNewsList] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog state
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

  // ── Fetch ──────────────────────────────────────────────────────────────
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
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // ── Form Handlers ─────────────────────────────────────────────────────
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
      toast({ title: 'Titulo obrigatorio', variant: 'destructive' });
      return;
    }
    if (!form.content.trim()) {
      toast({ title: 'Conteudo obrigatorio', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const payload: CreateNewsData = {
      title: form.title.trim(),
      content: form.content.trim(),
      summary: form.summary.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      isPinned: form.isPinned,
      isPublished: form.isPublished,
    };

    const result = editingId
      ? await updateNews(editingId, payload)
      : await createNews(payload);

    setIsSaving(false);

    if (result.success) {
      toast({ title: editingId ? 'Noticia atualizada com sucesso' : 'Noticia criada com sucesso' });
      setDialogOpen(false);
      fetchNews();
    } else {
      toast({
        title: editingId ? 'Erro ao atualizar noticia' : 'Erro ao criar noticia',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = (news: News) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir noticia',
      description: `Tem certeza que deseja excluir a noticia "${news.title}"? Esta acao nao pode ser desfeita.`,
      variant: 'destructive',
      onConfirm: async () => {
        setIsActionLoading(true);
        const result = await deleteNews(news.id);
        setIsActionLoading(false);

        if (result.success) {
          toast({ title: 'Noticia excluida com sucesso' });
          setConfirmDialog((prev) => ({ ...prev, open: false }));
          fetchNews();
        } else {
          toast({
            title: 'Erro ao excluir noticia',
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
        title="Gestao de Noticias"
        description="Criar e gerenciar noticias do clube"
        actions={
          <Button
            onClick={openCreateDialog}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Noticia
          </Button>
        }
      />

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Carregando noticias..." />
        ) : newsList.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="w-8 h-8 text-gray-500" />}
            title="Nenhuma noticia encontrada"
            description="Publique a primeira noticia do clube."
            action={
              <Button
                onClick={openCreateDialog}
                className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Noticia
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-gray-800">
            {newsList.map((news) => (
              <div
                key={news.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-gray-800/30 transition-colors"
              >
                {/* Thumbnail */}
                <div className="hidden sm:flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-md bg-gray-800 border border-gray-700 overflow-hidden">
                  {news.imageUrl ? (
                    <img
                      src={news.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.innerHTML =
                          '<div class="flex items-center justify-center h-full w-full"><svg class="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                      }}
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-gray-600" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {news.isPinned && (
                      <Pin className="h-3.5 w-3.5 text-cbt-orange flex-shrink-0" />
                    )}
                    <h3 className="text-white font-medium text-sm truncate">{news.title}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={
                        news.isPublished
                          ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20'
                      }
                    >
                      {news.isPublished ? (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          Publicada
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3 mr-1" />
                          Rascunho
                        </>
                      )}
                    </Badge>
                    <span className="text-xs text-gray-500 font-tactical">
                      {formatDate(news.createdAt)}
                    </span>
                    {news.author && (
                      <span className="text-xs text-gray-600 font-tactical">
                        por {news.author.fullName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-cbt-orange hover:bg-gray-700"
                    title="Editar"
                    onClick={() => openEditDialog(news)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-gray-700"
                    title="Excluir"
                    onClick={() => handleDelete(news)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit Dialog ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white font-military tracking-wide">
              {editingId ? 'Editar Noticia' : 'Nova Noticia'}
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-tactical text-sm">
              {editingId
                ? 'Atualize os dados da noticia abaixo.'
                : 'Preencha os campos para criar uma nova noticia.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label className="text-gray-300 font-tactical text-sm">Titulo *</Label>
              <Input
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Titulo da noticia"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange"
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label className="text-gray-300 font-tactical text-sm">Conteudo *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => updateField('content', e.target.value)}
                placeholder="Conteudo completo da noticia..."
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange min-h-[200px] resize-y"
              />
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <Label className="text-gray-300 font-tactical text-sm">Resumo (opcional)</Label>
              <Textarea
                value={form.summary}
                onChange={(e) => updateField('summary', e.target.value)}
                placeholder="Breve resumo para exibicao em cards..."
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange min-h-[80px] resize-y"
              />
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label className="text-gray-300 font-tactical text-sm">URL da Imagem (opcional)</Label>
              <Input
                value={form.imageUrl}
                onChange={(e) => updateField('imageUrl', e.target.value)}
                placeholder="https://exemplo.com/imagem.jpg"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-cbt-orange"
              />
              {form.imageUrl && (
                <div className="mt-2 h-32 rounded-md bg-gray-800 border border-gray-700 overflow-hidden">
                  <img
                    src={form.imageUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="flex flex-col sm:flex-row gap-6 pt-2">
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isPinned}
                  onCheckedChange={(checked) => updateField('isPinned', checked)}
                  className="data-[state=checked]:bg-cbt-orange"
                />
                <div>
                  <Label className="text-gray-300 font-tactical text-sm cursor-pointer">Fixar noticia</Label>
                  <p className="text-xs text-gray-500 font-tactical">Aparece no topo da lista</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isPublished}
                  onCheckedChange={(checked) => updateField('isPublished', checked)}
                  className="data-[state=checked]:bg-green-500"
                />
                <div>
                  <Label className="text-gray-300 font-tactical text-sm cursor-pointer">Publicar</Label>
                  <p className="text-xs text-gray-500 font-tactical">Visivel para todos os membros</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical min-w-[120px]"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                'Salvar Alteracoes'
              ) : (
                'Criar Noticia'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Dialog ──────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        isLoading={isActionLoading}
      />
    </div>
  );
};

export default NewsManagementPage;
