import { useState, useEffect } from 'react';
import { Loader2, Plus, ShoppingCart, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ProductSearch from '@/components/shared/ProductSearch';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import {
  addDraftItem,
  createOrGetDraft,
  removeDraftItem,
  type Transaction,
} from '@/services/transactionsService';

interface OpenTabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  visitId: string;
  memberName: string;
}

interface NewItemForm {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const emptyItem: NewItemForm = {
  productId: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
};

const OpenTabDialog = ({
  open,
  onOpenChange,
  memberId,
  visitId,
  memberName,
}: OpenTabDialogProps) => {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [form, setForm] = useState<NewItemForm>(emptyItem);

  // Carrega/cria a comanda DRAFT ao abrir o dialog. As deps sao apenas primitivas
  // (open, memberId, visitId) — evita loop quando o pai recria callbacks a cada render.
  useEffect(() => {
    if (!open) {
      setDraft(null);
      setForm(emptyItem);
      return;
    }
    if (!visitId) return;

    let cancelled = false;
    setLoading(true);
    createOrGetDraft(memberId, visitId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.success) {
        setDraft(res.data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao abrir comanda',
          description: res.error,
        });
      }
    });
    return () => {
      cancelled = true;
    };
    // toast vem do useToast e e estavel; intencionalmente fora das deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, memberId, visitId]);

  const subtotal =
    draft?.items.reduce((sum, it) => sum + Number(it.subtotal ?? it.quantity * it.unitPrice), 0) ?? 0;

  const handleAdd = async () => {
    if (!draft) return;
    if (!form.description.trim()) {
      toast({ variant: 'destructive', title: 'Descricao obrigatoria' });
      return;
    }
    if (form.quantity <= 0 || form.unitPrice < 0) {
      toast({ variant: 'destructive', title: 'Quantidade ou preco invalidos' });
      return;
    }

    setAdding(true);
    const res = await addDraftItem(draft.id, {
      productId: form.productId || null,
      description: form.description.trim(),
      quantity: form.quantity,
      unitPrice: form.unitPrice,
    });
    setAdding(false);

    if (res.success) {
      setDraft(res.data);
      setForm(emptyItem);
      toast({ title: `Item adicionado: ${form.description.trim()}` });
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao adicionar item',
        description: res.error,
      });
    }
  };

  const handleRemove = async (itemId: string) => {
    if (!draft) return;
    setRemovingItemId(itemId);
    const res = await removeDraftItem(draft.id, itemId);
    setRemovingItemId(null);
    if (res.success) {
      setDraft(res.data);
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover item',
        description: res.error,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground font-military tracking-wide flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-green-400" />
            Comanda — {memberName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-tactical text-sm">
            Adicione os itens consumidos. A conta sera lancada apenas ao fechar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-cbt-orange animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Lista de itens ja adicionados */}
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-xs uppercase tracking-wider">
                Itens em aberto ({draft?.items.length ?? 0})
              </Label>
              {!draft?.items.length ? (
                <div className="py-6 px-4 bg-muted/40 border border-dashed border-border rounded-md text-center">
                  <p className="text-muted-foreground/80 font-tactical text-sm">
                    Nenhum item adicionado ainda. Use o formulario abaixo.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {draft.items.map((it) => {
                    const itSubtotal = Number(it.subtotal ?? it.quantity * it.unitPrice);
                    return (
                      <div
                        key={it.id}
                        className="flex items-center gap-3 px-3 py-2 bg-muted/60 border border-border rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground font-tactical text-sm truncate">{it.description}</p>
                          <p className="text-muted-foreground/80 font-tactical text-xs">
                            {it.quantity} × {formatCurrency(Number(it.unitPrice))}
                          </p>
                        </div>
                        <p className="text-cbt-orange font-tactical text-sm font-semibold">
                          {formatCurrency(itSubtotal)}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(it.id)}
                          disabled={removingItemId === it.id}
                          className="h-7 w-7 text-muted-foreground/80 hover:text-red-400 hover:bg-red-500/10"
                        >
                          {removingItemId === it.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              {draft && draft.items.length > 0 && (
                <div className="flex justify-end gap-3 pt-2 border-t border-border">
                  <span className="text-muted-foreground font-tactical text-xs uppercase tracking-wider">
                    Subtotal
                  </span>
                  <span className="text-foreground font-military text-base">{formatCurrency(subtotal)}</span>
                </div>
              )}
            </div>

            {/* Form para adicionar item */}
            <div className="p-3 bg-muted/50 border border-border rounded-lg space-y-3">
              <Label className="text-foreground/85 font-tactical text-xs uppercase tracking-wider">
                Adicionar item
              </Label>
              <ProductSearch
                value={form.productId}
                onChange={(productId, product) => {
                  setForm((prev) => ({
                    ...prev,
                    productId,
                    description: product?.name ?? prev.description,
                    unitPrice: product ? Number(product.unitPrice) : prev.unitPrice,
                  }));
                }}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-3">
                  <Label className="text-muted-foreground font-tactical text-xs">Descricao *</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Ex.: Alvo de papel A4"
                    className="bg-card border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange h-9"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground font-tactical text-xs">Qtde *</Label>
                  <NumberStepper
                    value={form.quantity}
                    onChange={(v) => setForm((prev) => ({ ...prev, quantity: Math.max(1, Math.round(v)) }))}
                    min={1}
                    step={1}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-muted-foreground font-tactical text-xs">Preco unitario</Label>
                  <NumberStepper
                    value={form.unitPrice}
                    onChange={(v) => setForm((prev) => ({ ...prev, unitPrice: Math.max(0, v) }))}
                    min={0}
                    step={0.5}
                    decimals={2}
                    prefix="R$"
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={handleAdd}
                disabled={adding}
                className="w-full bg-green-600 hover:bg-green-700 text-foreground font-tactical h-9"
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar a comanda
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
          >
            Concluir adicoes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OpenTabDialog;
