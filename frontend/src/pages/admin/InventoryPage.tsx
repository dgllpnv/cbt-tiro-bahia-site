import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  Loader2,
  Package,
  Plus,
  Search,
  DollarSign,
} from 'lucide-react';
import api from '@/services/api';
import { categoryLabels } from '@/lib/constants';
import { formatCurrency } from '@/lib/formatters';
import { getCategoryVisual } from '@/lib/categoryVisuals';
import { getCaliberColor } from '@/lib/ammunitionVisuals';
import { getIconEntry } from '@/lib/iconRegistry';
import { GiBullets } from 'react-icons/gi';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface StockItem {
  id: string;
  productId: string;
  currentStock: number;
  minimumStock: number;
  product: {
    id: string;
    name: string;
    category: string;
    caliber?: string | null;
    unit?: string;
    unitPrice?: number | string;
    imageUrl?: string | null;
    iconKey?: string | null;
    iconColor?: string | null;
  };
}

const CATEGORIES = ['AMMUNITION', 'TARGET', 'ACCESSORY', 'SAFETY_EQUIPMENT', 'RENTAL_ITEM', 'COURSE', 'OTHER'];

const QUICK_QTY = [10, 50, 100];

// ── Component ───────────────────────────────────────────────────────────────

const InventoryPage = () => {
  const { toast } = useToast();

  // List state
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showLowOnly, setShowLowOnly] = useState(false);

  // Adjust dialog
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>('ADJUSTMENT_IN');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // New product dialog
  const [createDialog, setCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'AMMUNITION',
    unitPrice: '',
    initialStock: '',
    minimumStock: '',
    unit: 'un',
  });

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/stock', { params: { limit: 200 } });
      if (res.data.success) setItems(res.data.data);
    } catch (e: any) {
      setItems([]);
      toast({
        title: 'Erro ao carregar estoque',
        description: e?.response?.data?.error || 'Nao foi possivel obter o inventario.',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStock();
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (categoryFilter && it.product?.category !== categoryFilter) return false;
      if (showLowOnly && !(it.currentStock <= it.minimumStock)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!it.product?.name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, categoryFilter, showLowOnly, search]);

  const totalProducts = items.length;
  const lowCount = items.filter((i) => i.currentStock <= i.minimumStock).length;
  const totalValue = items.reduce(
    (sum, i) => sum + i.currentStock * Number(i.product?.unitPrice ?? 0),
    0,
  );

  const usedCategories = useMemo(() => {
    const set = new Set(items.map((i) => i.product?.category).filter(Boolean));
    return CATEGORIES.filter((c) => set.has(c));
  }, [items]);

  // ── Adjust handlers ─────────────────────────────────────────────────────
  const openAdjust = (item: StockItem, type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT') => {
    setSelectedItem(item);
    setAdjustType(type);
    setAdjustQty('');
    setAdjustNotes('');
    setAdjustDialog(true);
  };

  const adjustQtyNum = parseInt(adjustQty || '0', 10);
  const overWithdrawal =
    adjustType === 'ADJUSTMENT_OUT' && selectedItem && adjustQtyNum > selectedItem.currentStock;
  const adjustDisabled = !adjustQty || adjustQtyNum <= 0 || saving || !!overWithdrawal;

  const handleAdjust = async () => {
    if (!selectedItem || adjustDisabled) return;
    setSaving(true);
    try {
      const res = await api.post('/api/stock/adjust', {
        productId: selectedItem.productId,
        quantity: adjustQtyNum,
        type: adjustType,
        notes: adjustNotes || undefined,
      });
      if (res.data.success) {
        toast({ title: 'Estoque ajustado' });
        setAdjustDialog(false);
        fetchStock();
      } else {
        toast({ title: 'Erro', description: res.data.error, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({
        title: 'Erro ao ajustar estoque',
        description: e?.response?.data?.error || 'Tente novamente.',
        variant: 'destructive',
      });
    }
    setSaving(false);
  };

  // ── Create product handler ──────────────────────────────────────────────
  const resetNewProduct = () => {
    setNewProduct({ name: '', category: 'AMMUNITION', unitPrice: '', initialStock: '', minimumStock: '', unit: 'un' });
  };

  const handleCreateProduct = async () => {
    if (!newProduct.name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    const price = parseFloat(newProduct.unitPrice || '0');
    if (Number.isNaN(price) || price < 0) {
      toast({ title: 'Preço unitário inválido', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const payload: any = {
        name: newProduct.name.trim(),
        category: newProduct.category,
        unitPrice: price,
        unit: newProduct.unit || 'un',
      };
      if (newProduct.initialStock) payload.initialStock = parseInt(newProduct.initialStock, 10);
      if (newProduct.minimumStock) payload.minimumStock = parseInt(newProduct.minimumStock, 10);

      const res = await api.post('/api/products', payload);
      if (res.data.success) {
        toast({ title: 'Produto cadastrado', description: newProduct.name });
        setCreateDialog(false);
        resetNewProduct();
        fetchStock();
      } else {
        toast({ title: 'Erro ao cadastrar', description: res.data.error, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({
        title: 'Erro ao cadastrar produto',
        description: e?.response?.data?.error || 'Tente novamente.',
        variant: 'destructive',
      });
    }
    setCreating(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <PageHeader title="Estoque" />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Estoque"
        description="Gestao e controle de estoque"
        actions={
          <Button
            onClick={() => setCreateDialog(true)}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <KpiCard icon={Package} label="Produtos" value={String(totalProducts)} accent="#3b82f6" />
        <KpiCard
          icon={AlertTriangle}
          label="Abaixo do mínimo"
          value={String(lowCount)}
          accent={lowCount > 0 ? '#ef4444' : '#22c55e'}
        />
        <KpiCard icon={DollarSign} label="Valor em estoque" value={formatCurrency(totalValue)} accent="#22c55e" />
      </div>

      {/* Filters */}
      <div className="bg-card/50 border border-border rounded-lg p-4 mb-5 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/80" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto por nome..."
              className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground/80 font-tactical"
            />
          </div>
          <Button
            type="button"
            variant={showLowOnly ? 'default' : 'outline'}
            onClick={() => setShowLowOnly((v) => !v)}
            className={
              showLowOnly
                ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/30 font-tactical'
                : 'bg-muted border-border text-foreground/85 hover:bg-secondary font-tactical'
            }
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Apenas estoque baixo
          </Button>
        </div>

        {usedCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <CategoryChip
              label="Todos"
              active={categoryFilter === null}
              onClick={() => setCategoryFilter(null)}
            />
            {usedCategories.map((c) => (
              <CategoryChip
                key={c}
                category={c}
                label={categoryLabels[c] || c}
                active={categoryFilter === c}
                onClick={() => setCategoryFilter(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <div className="bg-card/50 border border-border rounded-lg">
          <EmptyState
            icon={<Package className="w-8 h-8 text-muted-foreground/80" />}
            title={items.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum item com esses filtros'}
            description={
              items.length === 0
                ? 'Use "Novo Produto" para começar a alimentar o estoque.'
                : 'Ajuste a busca ou os filtros acima.'
            }
          />
        </div>
      ) : (
        <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[44px_1fr_140px_120px_100px_88px] gap-3 px-3 py-2 border-b border-border bg-card/80 text-xs font-tactical uppercase tracking-wider text-muted-foreground/80">
            <div></div>
            <div>Produto</div>
            <div>Categoria</div>
            <div>Estoque</div>
            <div className="text-right">Preço</div>
            <div className="text-right">Ações</div>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-gray-800">
            {filteredItems.map((item) => {
              const visual = getCategoryVisual(item.product?.category);
              const overrideEntry = getIconEntry(item.product?.iconKey);
              const Icon = overrideEntry?.Icon ?? visual.icon;
              const isAmmo = item.product?.category === 'AMMUNITION';
              // Color resolution: explicit iconColor > caliber color (ammo) > category default
              const iconColor =
                item.product?.iconColor ??
                (isAmmo ? getCaliberColor(item.product?.caliber ?? '') : visual.color);

              const isEmpty = item.currentStock === 0;
              const isLow = item.currentStock <= item.minimumStock && !isEmpty;
              const stockChip = isEmpty
                ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40'
                : isLow
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                  : 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/40';
              const stockLabel = isEmpty ? 'Esgotado' : isLow ? 'Baixo' : 'OK';

              return (
                <li
                  key={item.id}
                  className={`grid grid-cols-[44px_1fr_140px_120px_100px_88px] gap-3 items-center px-3 py-2 hover:bg-muted/40 transition-colors ${
                    isEmpty ? 'opacity-60' : ''
                  }`}
                >
                  {/* Mini icon — override key/color, fallback ammo+caliber, fallback category */}
                  <div
                    className={`h-9 w-9 rounded-md flex items-center justify-center ${visual.bg}`}
                  >
                    {overrideEntry ? (
                      <Icon className="h-5 w-5" style={{ color: iconColor }} />
                    ) : isAmmo ? (
                      <GiBullets className="h-5 w-5" style={{ color: iconColor }} />
                    ) : (
                      <Icon className="h-5 w-5" style={{ color: iconColor }} />
                    )}
                  </div>

                  {/* Name + caliber */}
                  <div className="min-w-0">
                    <p className="text-foreground font-tactical text-sm truncate">{item.product?.name}</p>
                    {item.product?.caliber && (
                      <p className="text-muted-foreground/80 font-tactical text-xs truncate">
                        {item.product.caliber}
                      </p>
                    )}
                  </div>

                  {/* Category chip */}
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-tactical ${visual.bg} ${visual.border} ${visual.text}`}
                    >
                      <Icon className="h-3 w-3" />
                      {categoryLabels[item.product?.category] || item.product?.category}
                    </span>
                  </div>

                  {/* Stock badge */}
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-tactical tabular-nums ${stockChip}`}
                    >
                      <span className="font-bold">{item.currentStock}</span>
                      {item.product?.unit ?? ''}
                      <span className="text-[10px] opacity-80">· {stockLabel}</span>
                    </span>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    {item.product?.unitPrice !== undefined && (
                      <span className="text-cbt-orange font-tactical text-sm font-semibold tabular-nums">
                        {formatCurrency(Number(item.product.unitPrice))}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openAdjust(item, 'ADJUSTMENT_IN')}
                      className="h-8 w-8 text-green-700 dark:text-green-400 hover:bg-green-500/10"
                      title="Entrada"
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openAdjust(item, 'ADJUSTMENT_OUT')}
                      disabled={isEmpty}
                      className="h-8 w-8 text-red-700 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                      title="Saída"
                    >
                      <ArrowDownCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Adjust dialog */}
      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-military">
              {adjustType === 'ADJUSTMENT_IN' ? 'Entrada' : 'Saída'} — {selectedItem?.product?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-tactical text-sm">
              Estoque atual: <span className="text-foreground font-bold">{selectedItem?.currentStock}</span>{' '}
              {selectedItem?.product?.unit}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Quantidade *</Label>
              <Input
                type="number"
                min="1"
                placeholder="Quantidade"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="bg-muted border-input text-foreground font-tactical"
                autoFocus
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {QUICK_QTY.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAdjustQty(String(q))}
                    className="px-3 py-1.5 text-xs font-tactical bg-muted border border-border rounded-md text-foreground/85 hover:border-cbt-orange hover:text-foreground transition-colors"
                  >
                    {adjustType === 'ADJUSTMENT_IN' ? '+' : '−'}
                    {q}
                  </button>
                ))}
              </div>
              {overWithdrawal && (
                <p className="text-xs font-tactical text-red-700 dark:text-red-400 mt-1">
                  Estoque insuficiente. Disponível: {selectedItem?.currentStock}.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Motivo (opcional)</Label>
              <Input
                placeholder="Ex: compra, venda, perda, ajuste de inventário"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                className="bg-muted border-input text-foreground font-tactical"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustDialog(false)} className="font-tactical">
              Cancelar
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={adjustDisabled}
              className={`font-tactical text-foreground ${
                adjustType === 'ADJUSTMENT_IN'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New product dialog */}
      <Dialog
        open={createDialog}
        onOpenChange={(open) => {
          setCreateDialog(open);
          if (!open) resetNewProduct();
        }}
      >
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-military flex items-center gap-2">
              <Plus className="h-5 w-5 text-cbt-orange" />
              Novo Produto
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-tactical text-sm">
              Cadastro rápido — o item já é criado com estoque inicial.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Nome *</Label>
              <Input
                placeholder="Ex: Munição 9mm Luger (50un)"
                value={newProduct.name}
                onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                className="bg-muted border-input text-foreground font-tactical"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground/85 font-tactical text-sm">Categoria *</Label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value }))}
                  className="w-full h-10 rounded-md bg-muted border border-input text-foreground px-3 text-sm font-tactical focus:outline-none focus:border-cbt-orange"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabels[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/85 font-tactical text-sm">Unidade</Label>
                <Input
                  placeholder="un, cx, kg..."
                  value={newProduct.unit}
                  onChange={(e) => setNewProduct((p) => ({ ...p, unit: e.target.value }))}
                  className="bg-muted border-input text-foreground font-tactical"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground/85 font-tactical text-sm">Preço unitário *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={newProduct.unitPrice}
                  onChange={(e) => setNewProduct((p) => ({ ...p, unitPrice: e.target.value }))}
                  className="bg-muted border-input text-foreground font-tactical"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/85 font-tactical text-sm">Estoque inicial</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newProduct.initialStock}
                  onChange={(e) => setNewProduct((p) => ({ ...p, initialStock: e.target.value }))}
                  className="bg-muted border-input text-foreground font-tactical"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/85 font-tactical text-sm">Estoque mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newProduct.minimumStock}
                  onChange={(e) => setNewProduct((p) => ({ ...p, minimumStock: e.target.value }))}
                  className="bg-muted border-input text-foreground font-tactical"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateDialog(false)} className="font-tactical">
              Cancelar
            </Button>
            <Button
              onClick={handleCreateProduct}
              disabled={creating || !newProduct.name.trim() || !newProduct.unitPrice}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Subcomponents ─────────────────────────────────────────────────────────

const KpiCard = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  accent: string;
}) => (
  <div className="bg-card/50 border border-border rounded-lg p-4 flex items-center justify-between">
    <div>
      <p className="text-xs font-tactical uppercase tracking-wider text-muted-foreground/80">{label}</p>
      <p className="text-2xl font-military font-bold text-foreground tracking-wide mt-1">{value}</p>
    </div>
    <div className="p-2.5 rounded-lg" style={{ background: `${accent}20` }}>
      <Icon className="h-5 w-5" style={{ color: accent }} />
    </div>
  </div>
);

const CategoryChip = ({
  label,
  category,
  active,
  onClick,
}: {
  label: string;
  category?: string;
  active: boolean;
  onClick: () => void;
}) => {
  const visual = category ? getCategoryVisual(category) : null;
  const Icon = visual?.icon;
  const activeCls = visual
    ? `${visual.bg} ${visual.border} ${visual.text}`
    : 'bg-cbt-orange/20 border-cbt-orange/60 text-cbt-orange';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-tactical border transition-colors ${
        active
          ? activeCls
          : 'bg-muted border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
};

export default InventoryPage;
