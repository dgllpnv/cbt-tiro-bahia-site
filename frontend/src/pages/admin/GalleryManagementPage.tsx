import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Upload,
  ArrowUp,
  ArrowDown,
  Pencil,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  listGallery,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
  type GalleryImage,
} from '@/services/galleryService';

const MAX_IMAGES = 100;

interface FormState {
  imageUrl: string;
  caption: string;
  isPublished: boolean;
}

const emptyForm: FormState = {
  imageUrl: '',
  caption: '',
  isPublished: true,
};

const GalleryManagementPage = () => {
  const { toast } = useToast();

  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [max, setMax] = useState(MAX_IMAGES);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchImages = useCallback(async () => {
    setIsLoading(true);
    const r = await listGallery();
    if (r.success) {
      setImages(r.data);
      setMax(r.max);
    } else {
      toast({ title: 'Erro ao carregar galeria', description: r.error, variant: 'destructive' });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const counts = useMemo(
    () => ({
      total: images.length,
      published: images.filter((i) => i.isPublished).length,
    }),
    [images],
  );

  const limitReached = counts.total >= max;
  const limitWarn = counts.total >= max * 0.9;

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
  };

  const openCreate = () => {
    if (limitReached) {
      toast({
        title: 'Limite atingido',
        description: `Maximo de ${max} imagens. Remova alguma antes de adicionar nova.`,
        variant: 'destructive',
      });
      return;
    }
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (img: GalleryImage) => {
    setEditingId(img.id);
    setForm({
      imageUrl: img.imageUrl,
      caption: img.caption || '',
      isPublished: img.isPublished,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.imageUrl.trim()) {
      toast({ title: 'Imagem obrigatoria', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const payload = {
      imageUrl: form.imageUrl,
      caption: form.caption.trim() || undefined,
      isPublished: form.isPublished,
    };
    const r = editingId ? await updateGalleryImage(editingId, payload) : await createGalleryImage(payload);
    setIsSaving(false);
    if (r.success) {
      toast({ title: editingId ? 'Imagem atualizada' : 'Imagem adicionada' });
      setDialogOpen(false);
      fetchImages();
    } else {
      toast({
        title: editingId ? 'Erro ao atualizar' : 'Erro ao adicionar',
        description: r.error,
        variant: 'destructive',
      });
    }
  };

  const togglePublish = async (img: GalleryImage) => {
    const r = await updateGalleryImage(img.id, { isPublished: !img.isPublished });
    if (r.success) fetchImages();
    else toast({ title: 'Erro', description: r.error, variant: 'destructive' });
  };

  const move = async (img: GalleryImage, direction: 'up' | 'down') => {
    const sorted = [...images].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex((i) => i.id === img.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    // Swap displayOrders
    await Promise.all([
      updateGalleryImage(img.id, { displayOrder: other.displayOrder }),
      updateGalleryImage(other.id, { displayOrder: img.displayOrder }),
    ]);
    fetchImages();
  };

  const handleDelete = (img: GalleryImage) => {
    setConfirmDialog({
      open: true,
      title: 'Remover imagem',
      description: `Remover esta imagem da galeria publica? Esta acao nao pode ser desfeita.`,
      onConfirm: async () => {
        setIsActionLoading(true);
        const r = await deleteGalleryImage(img.id);
        setIsActionLoading(false);
        if (r.success) {
          toast({ title: 'Imagem removida' });
          setConfirmDialog((p) => ({ ...p, open: false }));
          fetchImages();
        } else {
          toast({ title: 'Erro ao remover', description: r.error, variant: 'destructive' });
        }
      },
    });
  };

  const handleFile = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast({ title: 'Formato invalido', description: 'Use PNG, JPG ou WebP.', variant: 'destructive' });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Tamanho maximo: 3 MB.', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateField('imageUrl', String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <PageHeader
        title="Galeria do Site"
        description="Imagens exibidas publicamente na home (secao Galeria)"
        actions={
          <Button
            onClick={openCreate}
            disabled={limitReached}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar imagem
          </Button>
        }
      />

      {/* Counter bar */}
      <div className="bg-card/50 border border-border rounded-lg p-4 mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge
            className={`font-tactical ${
              limitReached
                ? 'bg-red-500/20 text-red-600 dark:text-red-300 border-red-500/40'
                : limitWarn
                  ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/40'
                  : 'bg-cbt-orange/15 text-cbt-orange border-cbt-orange/30'
            }`}
          >
            {counts.total} / {max}
          </Badge>
          <span className="text-muted-foreground font-tactical text-sm">
            {counts.published} publicada{counts.published !== 1 ? 's' : ''} no site
          </span>
        </div>
        {limitReached && (
          <span className="text-red-600 dark:text-red-300 font-tactical text-sm">
            Limite atingido — remova alguma imagem antes de adicionar nova.
          </span>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="bg-card/50 border border-border rounded-lg">
          <LoadingSpinner message="Carregando galeria..." />
        </div>
      ) : images.length === 0 ? (
        <div className="bg-card/50 border border-border rounded-lg">
          <EmptyState
            icon={<ImageIcon className="w-8 h-8 text-muted-foreground/80" />}
            title="Galeria vazia"
            description="Adicione fotos para exibir na home do site."
            action={
              <Button
                onClick={openCreate}
                className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira imagem
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...images]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((img, idx, arr) => (
              <article
                key={img.id}
                className="bg-card/70 border border-border rounded-lg overflow-hidden group hover:border-cbt-orange/60 transition-colors"
              >
                <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                  <img
                    src={img.imageUrl}
                    alt={img.caption || 'Imagem da galeria'}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                  />
                  {!img.isPublished && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-yellow-500/90 text-black text-[10px] font-tactical font-bold uppercase">
                      Oculta
                    </span>
                  )}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-tactical font-bold">
                    #{idx + 1}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-foreground font-tactical text-xs line-clamp-2 min-h-[2rem]">
                    {img.caption || <span className="text-muted-foreground/70">Sem legenda</span>}
                  </p>
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(img, 'up')}
                      disabled={idx === 0}
                      title="Mover para cima"
                      className="h-7 w-7 text-muted-foreground hover:text-cbt-orange disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(img, 'down')}
                      disabled={idx === arr.length - 1}
                      title="Mover para baixo"
                      className="h-7 w-7 text-muted-foreground hover:text-cbt-orange disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => togglePublish(img)}
                      title={img.isPublished ? 'Ocultar do site' : 'Publicar no site'}
                      className={`h-7 w-7 ${img.isPublished ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'} hover:text-green-700 dark:hover:text-green-400`}
                    >
                      {img.isPublished ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(img)}
                      title="Editar legenda"
                      className="h-7 w-7 text-muted-foreground hover:text-cbt-orange"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(img)}
                      title="Remover"
                      className="h-7 w-7 text-muted-foreground hover:text-red-600 ml-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground font-military tracking-wide">
              {editingId ? 'Editar imagem' : 'Nova imagem'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-tactical text-sm">
              {editingId
                ? 'Atualize a legenda ou visibilidade da imagem.'
                : 'Adicione uma nova imagem a galeria publica do site.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Imagem *</Label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                id="gallery-upload"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              {form.imageUrl ? (
                <div className="space-y-2">
                  <div className="aspect-[4/3] rounded-md bg-muted border border-border overflow-hidden">
                    <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  {!editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('gallery-upload')?.click()}
                      className="bg-muted border-border text-foreground/85 hover:bg-secondary font-tactical"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      Trocar imagem
                    </Button>
                  )}
                </div>
              ) : (
                <label
                  htmlFor="gallery-upload"
                  className="flex flex-col items-center justify-center gap-2 aspect-[4/3] rounded-md bg-muted/50 border border-dashed border-border cursor-pointer hover:bg-muted hover:border-cbt-orange/40 transition-colors"
                >
                  <Upload className="h-7 w-7 text-muted-foreground/80" />
                  <p className="text-xs font-tactical text-muted-foreground text-center px-3">
                    Clique para enviar (PNG, JPG ou WebP, ate 3 MB)
                  </p>
                </label>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Legenda (opcional)</Label>
              <Input
                value={form.caption}
                onChange={(e) => updateField('caption', e.target.value)}
                placeholder="Ex: Alunos em treinamento"
                maxLength={200}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch
                checked={form.isPublished}
                onCheckedChange={(c) => updateField('isPublished', c)}
                className="data-[state=checked]:bg-green-500"
              />
              <div>
                <Label className="text-foreground/85 font-tactical text-sm cursor-pointer">
                  Publicar no site
                </Label>
                <p className="text-xs text-muted-foreground/80 font-tactical">
                  Quando desligado, fica oculta da galeria publica
                </p>
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
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((p) => ({ ...p, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant="destructive"
        onConfirm={confirmDialog.onConfirm}
        isLoading={isActionLoading}
      />
    </div>
  );
};

export default GalleryManagementPage;
