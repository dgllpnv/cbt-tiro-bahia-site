import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ImagePlus,
  Search,
  AlertTriangle,
  Package,
  DollarSign,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { GiBullets } from 'react-icons/gi';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import IconPicker from '@/components/admin/IconPicker';
import KpiCard from '@/components/admin/KpiCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { categoryLabels } from '@/lib/constants';
import { formatCurrency } from '@/lib/formatters';
import { getCategoryVisual, CATEGORY_KEYS } from '@/lib/categoryVisuals';
import { getCaliberColor } from '@/lib/ammunitionVisuals';
import { getIconEntry } from '@/lib/iconRegistry';

// ── Types ────────────────────────────────────────────────────────────────

interface ProductWithStock {
  id: string;
  productId: string;
  currentStock: number;
  minimumStock: number;
  product: {
    id: string;
    name: string;
    category: string;
    caliber?: string | null;
    unitPrice: number | string;
    costPrice?: number | string | null;
    unit?: string | null;
    iconKey?: string | null;
    iconColor?: string | null;
    sku?: string | null;
  };
}

// Derivado de CATEGORY_KEYS pra nao duplicar a lista. Adicionar nova
// categoria so precisa: Prisma enum + Zod backend + categoryVisuals/labels.
const CATEGORIES = [...CATEGORY_KEYS];

const QUICK_QTY = [10, 50, 100];

// ── Icone do produto ────────────────────────────────────────────────────

function ProductIcon({
  product,
  size = 18,
}: {
  product: ProductWithStock['product'];
  size?: number;
}) {
  const visual = getCategoryVisual(product.category);
  const override = getIconEntry(product.iconKey);
  const color =
    product.iconColor ??
    (product.category === 'AMMUNITION'
      ? getCaliberColor(product.caliber ?? '')
      : visual.color);
  if (override) {
    const Icon = override.Icon;
    return <Icon style={{ width: size, height: size, color }} />;
  }
  if (product.category === 'AMMUNITION') {
    return <GiBullets style={{ width: size, height: size, color }} />;
  }
  const Icon = visual.icon;
  return <Icon style={{ width: size, height: size, color }} />;
}

// ── Chip de categoria ───────────────────────────────────────────────────

function CategoryChip({
  category,
  label,
  active,
  onClick,
}: {
  category?: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const visual = category ? getCategoryVisual(category) : null;
  const Icon = visual?.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-tactical border transition-colors ${
        active
          ? 'bg-cbt-orange/15 text-cbt-orange border-cbt-orange/40'
          : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
      }`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </button>
  );
}

// ── Component principal ─────────────────────────────────────────────────

const ProductsPage = () => {
  const { toast } = useToast();
  const { isCashier } = useAuth();

  // Lista
  const [items, setItems] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showLowOnly, setShowLowOnly] = useState(false);

  // Dialog Novo/Editar produto (metadados + estoque inicial)
  const [editDialog, setEditDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'AMMUNITION',
    caliber: '',
    unitPrice: '',
    costPrice: '',
    unit: 'un',
    initialStock: '',
    minimumStock: '',
    iconKey: null as string | null,
    iconColor: null as string | null,
  });
  const [formPickerOpen, setFormPickerOpen] = useState(false);

  // Dialog ajuste de estoque
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [adjustItem, setAdjustItem] = useState<ProductWithStock | null>(null);
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>(
    'ADJUSTMENT_IN',
  );
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Inline icon picker
  const [inlinePicker, setInlinePicker] = useState<{
    open: boolean;
    productId: string | null;
    currentKey: string | null;
    currentColor: string | null;
    productName: string;
  }>({ open: false, productId: null, currentKey: null, currentColor: null, productName: '' });
  const [savingInlineIcon, setSavingInlineIcon] = useState(false);

  // Confirm de exclusão
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string;
    name: string;
  }>({ open: false, id: '', name: '' });
  const [deleting, setDeleting] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      // /api/stock retorna StockItem com product incluído — fonte unica de verdade.
      const res = await api.get('/api/stock', { params: { limit: 500 } });
      if (res.data.success) setItems(res.data.data);
    } catch (e: any) {
      setItems([]);
      toast({
        title: 'Erro ao carregar produtos',
        description: e?.response?.data?.error || 'Tente novamente.',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Derivados ──────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (categoryFilter && it.product?.category !== categoryFilter) return false;
      // SERVICE nao controla estoque, nunca entra no filtro "estoque baixo".
      if (showLowOnly && (it.product?.category === 'SERVICE' || !(it.currentStock <= it.minimumStock))) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!it.product?.name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, categoryFilter, showLowOnly, search]);

  const totalProducts = items.length;
  const lowCount = items.filter((i) => i.product?.category !== 'SERVICE' && i.currentStock <= i.minimumStock).length;
  const totalValue = items.reduce(
    (sum, i) => sum + i.currentStock * Number(i.product?.unitPrice ?? 0),
    0,
  );

  const usedCategories = useMemo(() => {
    const set = new Set(items.map((i) => i.product?.category).filter(Boolean));
    return CATEGORIES.filter((c) => set.has(c));
  }, [items]);

  // ── Novo / Editar produto ──────────────────────────────────────────────
  const openNewProduct = () => {
    setEditingId(null);
    setProductForm({
      name: '',
      category: 'AMMUNITION',
      caliber: '',
      unitPrice: '',
      costPrice: '',
      unit: 'un',
      initialStock: '',
      minimumStock: '',
      iconKey: null,
      iconColor: null,
    });
    setEditDialog(true);
  };

  const openEditProduct = (item: ProductWithStock) => {
    const p = item.product;
    setEditingId(p.id);
    setProductForm({
      name: p.name,
      category: p.category,
      caliber: p.caliber || '',
      unitPrice: String(p.unitPrice),
      costPrice: p.costPrice ? String(p.costPrice) : '',
      unit: p.unit || 'un',
      // Em edição, mostra o estoque atual mas a alteração de quantidade é via "Ajustar"
      initialStock: String(item.currentStock),
      minimumStock: String(item.minimumStock),
      iconKey: p.iconKey ?? null,
      iconColor: p.iconColor ?? null,
    });
    setEditDialog(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) {
      toast({ title: 'Nome obrigatorio', variant: 'destructive' });
      return;
    }
    const price = parseFloat(productForm.unitPrice || '0');
    if (Number.isNaN(price) || price < 0) {
      toast({ title: 'Preco unitario invalido', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: productForm.name.trim(),
        category: productForm.category,
        caliber: productForm.caliber.trim() || null,
        unitPrice: price,
        unit: productForm.unit || 'un',
        iconKey: productForm.iconKey,
        iconColor: productForm.iconColor,
      };
      if (productForm.costPrice) {
        payload.costPrice = parseFloat(productForm.costPrice);
      }
      // Estoque mínimo aplica em ambos (criar e editar — via /api/stock)
      const minStockNum = productForm.minimumStock ? parseInt(productForm.minimumStock, 10) : 0;

      if (editingId) {
        await api.put(`/api/products/${editingId}`, payload);
        // Atualiza o minimumStock via ajuste de StockItem se mudou.
        // Como /api/stock/adjust não muda mínimo, fazemos via PUT direto no produto
        // (o backend persiste minimumStock no StockItem do produto).
        // Para evitar requests desnecessárias, só envia se difere do atual.
        const current = items.find((it) => it.product.id === editingId);
        if (current && current.minimumStock !== minStockNum) {
          await api.patch(`/api/stock/${editingId}/minimum`, { minimumStock: minStockNum }).catch(() => {});
        }
        toast({ title: 'Produto atualizado' });
      } else {
        if (productForm.initialStock) {
          payload.initialStock = parseInt(productForm.initialStock, 10);
        }
        if (minStockNum > 0) {
          payload.minimumStock = minStockNum;
        }
        await api.post('/api/products', payload);
        toast({ title: 'Produto cadastrado', description: productForm.name });
      }
      setEditDialog(false);
      setEditingId(null);
      fetchData();
    } catch (e: any) {
      toast({
        title: editingId ? 'Erro ao atualizar produto' : 'Erro ao cadastrar produto',
        description: e?.response?.data?.error || 'Falha na operacao',
        variant: 'destructive',
      });
    }
    setSaving(false);
  };

  // ── Ajuste de estoque ──────────────────────────────────────────────────
  const openAdjust = (item: ProductWithStock, type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT') => {
    setAdjustItem(item);
    setAdjustType(type);
    setAdjustQty('');
    setAdjustNotes('');
    setAdjustDialog(true);
  };

  const adjustQtyNum = parseInt(adjustQty || '0', 10);
  const overWithdrawal =
    adjustType === 'ADJUSTMENT_OUT' && adjustItem && adjustQtyNum > adjustItem.currentStock;
  const adjustDisabled = !adjustQty || adjustQtyNum <= 0 || adjusting || !!overWithdrawal;

  const handleAdjust = async () => {
    if (!adjustItem || adjustDisabled) return;
    setAdjusting(true);
    try {
      const res = await api.post('/api/stock/adjust', {
        productId: adjustItem.productId,
        quantity: adjustQtyNum,
        type: adjustType,
        notes: adjustNotes || undefined,
      });
      if (res.data.success) {
        toast({ title: 'Estoque ajustado' });
        setAdjustDialog(false);
        fetchData();
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
    setAdjusting(false);
  };

  // ── Inline icon ────────────────────────────────────────────────────────
  const openInlinePicker = (p: ProductWithStock['product']) => {
    setInlinePicker({
      open: true,
      productId: p.id,
      currentKey: p.iconKey ?? null,
      currentColor: p.iconColor ?? null,
      productName: p.name,
    });
  };

  const handleInlineIconSelect = async (selection: { key: string | null; color: string | null }) => {
    if (!inlinePicker.productId) return;
    setSavingInlineIcon(true);
    try {
      await api.put(`/api/products/${inlinePicker.productId}`, {
        iconKey: selection.key,
        iconColor: selection.color,
      });
      toast({
        title: selection.key ? 'Icone atualizado' : 'Icone removido (usando padrao da categoria)',
      });
      setInlinePicker((p) => ({ ...p, open: false }));
      fetchData();
    } catch (e: any) {
      toast({
        title: 'Erro ao atualizar icone',
        description: e?.response?.data?.error || 'Tente novamente.',
        variant: 'destructive',
      });
    }
    setSavingInlineIcon(false);
  };

  // ── Excluir ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/products/${deleteConfirm.id}`);
      toast({ title: 'Produto removido' });
      setDeleteConfirm({ ...deleteConfirm, open: false });
      fetchData();
    } catch (e: any) {
      toast({
        title: 'Erro ao remover',
        description: e?.response?.data?.error || 'Falha na operacao',
        variant: 'destructive',
      });
    }
    setDeleting(false);
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <PageHeader title="Produtos" />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Catalogo unificado: cadastro, precos, estoque e ajustes em um so lugar"
        actions={
          <Button
            onClick={openNewProduct}
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
          label="Abaixo do minimo"
          value={String(lowCount)}
          accent={lowCount > 0 ? '#ef4444' : '#22c55e'}
        />
        {/* Valor em estoque: oculto para o caixa (nao deve ver valor financeiro) */}
        {!isCashier && (
          <KpiCard
            icon={DollarSign}
            label="Valor em estoque"
            value={formatCurrency(totalValue)}
            accent="#22c55e"
          />
        )}
      </div>

      {/* Filtros */}
      <div className="bg-card/50 border border-border rounded-lg p-4 mb-5 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/80" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto por nome..."
              className="pl-9"
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
              label="Todas"
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

      {/* Tabela */}
      {filteredItems.length === 0 ? (
        <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
          <EmptyState
            icon={<Package className="w-8 h-8 text-muted-foreground/80" />}
            title={items.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto nos filtros'}
            description={
              items.length === 0
                ? 'Cadastre o primeiro produto para iniciar vendas e estoque.'
                : 'Ajuste os filtros ou a busca.'
            }
          />
        </div>
      ) : (
        <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-tactical w-14">Icone</TableHead>
                <TableHead className="text-muted-foreground font-tactical">Nome</TableHead>
                <TableHead className="text-muted-foreground font-tactical">Categoria</TableHead>
                <TableHead className="text-muted-foreground font-tactical">Calibre</TableHead>
                <TableHead className="text-muted-foreground font-tactical text-right">Preco</TableHead>
                <TableHead className="text-muted-foreground font-tactical text-right">Estoque / Min</TableHead>
                <TableHead className="text-muted-foreground font-tactical text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const p = item.product;
                const isService = p.category === 'SERVICE';
                const isLow = !isService && item.currentStock <= item.minimumStock;
                return (
                  <TableRow key={item.id} className="border-border hover:bg-muted/40">
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => openInlinePicker(p)}
                        title="Editar icone"
                        className="group h-9 w-9 rounded-md bg-muted border border-border hover:border-cbt-orange hover:bg-cbt-orange/10 flex items-center justify-center transition-colors relative"
                      >
                        <ProductIcon product={p} size={20} />
                        <span className="absolute inset-0 rounded-md bg-cbt-orange/0 group-hover:bg-cbt-orange/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ImagePlus className="h-3.5 w-3.5 text-cbt-orange" />
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="text-foreground font-medium font-tactical">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground font-tactical text-sm">
                      {categoryLabels[p.category] || p.category}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-tactical text-sm">
                      {p.caliber || '-'}
                    </TableCell>
                    <TableCell className="text-cbt-orange font-tactical text-right">
                      {formatCurrency(Number(p.unitPrice))}
                    </TableCell>
                    <TableCell className="text-right font-tactical text-sm">
                      {isService ? (
                        <span className="text-muted-foreground/70 italic">Serviço</span>
                      ) : (
                        <>
                          <span
                            className={
                              isLow
                                ? 'text-yellow-700 dark:text-yellow-400 font-bold'
                                : 'text-foreground'
                            }
                          >
                            {item.currentStock}
                          </span>
                          <span className="text-muted-foreground/80"> / {item.minimumStock}</span>
                          {isLow && (
                            <AlertTriangle className="inline h-3.5 w-3.5 ml-1.5 text-yellow-700 dark:text-yellow-400" />
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {!isService && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-700 dark:text-green-400 hover:bg-green-500/10"
                              title="Entrada de estoque"
                              onClick={() => openAdjust(item, 'ADJUSTMENT_IN')}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-700 dark:text-red-400 hover:bg-red-500/10"
                              title="Saida de estoque"
                              onClick={() => openAdjust(item, 'ADJUSTMENT_OUT')}
                              disabled={item.currentStock === 0}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-cbt-orange"
                          title="Editar metadados"
                          onClick={() => openEditProduct(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-700 dark:hover:text-red-400"
                          title="Excluir produto"
                          onClick={() =>
                            setDeleteConfirm({ open: true, id: p.id, name: p.name })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog Novo / Editar produto */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-military tracking-wide">
              {editingId ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="font-tactical text-xs">Nome</Label>
              <Input
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="Ex: Municao 9mm Luger 50un"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-tactical text-xs">Categoria</Label>
                <select
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  className="w-full h-10 mt-1 px-3 rounded-md bg-muted border border-input text-foreground font-tactical text-sm"
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="font-tactical text-xs">Calibre</Label>
                <Input
                  value={productForm.caliber}
                  onChange={(e) => setProductForm({ ...productForm, caliber: e.target.value })}
                  placeholder="9mm, .380, .22..."
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="font-tactical text-xs">Preco venda *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.unitPrice}
                  onChange={(e) => setProductForm({ ...productForm, unitPrice: e.target.value })}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="font-tactical text-xs">Preco custo</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.costPrice}
                  onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="font-tactical text-xs">Unidade</Label>
                <Input
                  value={productForm.unit}
                  onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                  placeholder="un, cx, kg"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Serviços (day-use, limpeza…) nao controlam estoque */}
            {productForm.category !== 'SERVICE' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-tactical text-xs">
                    {editingId ? 'Estoque atual' : 'Estoque inicial'}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={productForm.initialStock}
                    onChange={(e) => setProductForm({ ...productForm, initialStock: e.target.value })}
                    placeholder="0"
                    className="mt-1"
                    disabled={!!editingId}
                  />
                  {editingId && (
                    <p className="text-[10px] font-tactical text-muted-foreground/70 mt-0.5">
                      Use os botoes de entrada/saida na linha para alterar.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="font-tactical text-xs">Estoque minimo (alerta)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={productForm.minimumStock}
                    onChange={(e) => setProductForm({ ...productForm, minimumStock: e.target.value })}
                    placeholder="0"
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Icon picker no form */}
            <div className="bg-muted/40 border border-border rounded-md p-3">
              <Label className="font-tactical text-xs uppercase tracking-wider text-muted-foreground/80">
                Icone
              </Label>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-card border border-border flex items-center justify-center">
                  <ProductIcon
                    product={{
                      id: '',
                      name: productForm.name,
                      category: productForm.category,
                      caliber: productForm.caliber,
                      unitPrice: 0,
                      iconKey: productForm.iconKey,
                      iconColor: productForm.iconColor,
                    }}
                    size={22}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormPickerOpen(true)}
                  className="font-tactical"
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {productForm.iconKey ? 'Alterar icone' : 'Escolher icone (opcional)'}
                </Button>
                {productForm.iconKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setProductForm({ ...productForm, iconKey: null, iconColor: null })}
                    className="text-muted-foreground hover:text-red-600"
                  >
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialog(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveProduct}
              disabled={saving || !productForm.name.trim()}
              className="bg-cbt-orange text-foreground hover:bg-cbt-orange/90 font-tactical"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form icon picker (escolha de icone dentro do dialog de novo/editar) */}
      <IconPicker
        open={formPickerOpen}
        onOpenChange={setFormPickerOpen}
        value={{ key: productForm.iconKey, color: productForm.iconColor }}
        onSelect={(sel) => {
          setProductForm({ ...productForm, iconKey: sel.key, iconColor: sel.color });
          setFormPickerOpen(false);
        }}
      />

      {/* Inline icon picker (linha da tabela) */}
      <IconPicker
        open={inlinePicker.open}
        onOpenChange={(open) => setInlinePicker((p) => ({ ...p, open }))}
        value={{ key: inlinePicker.currentKey, color: inlinePicker.currentColor }}
        onSelect={handleInlineIconSelect}
      />

      {/* Dialog ajuste de estoque */}
      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-military tracking-wide">
              {adjustType === 'ADJUSTMENT_IN' ? 'Entrada de estoque' : 'Saida de estoque'}
            </DialogTitle>
          </DialogHeader>

          {adjustItem && (
            <div className="space-y-4">
              <div className="bg-muted/40 border border-border rounded-md p-3">
                <p className="font-tactical text-sm font-bold text-foreground">
                  {adjustItem.product.name}
                </p>
                <p className="font-tactical text-xs text-muted-foreground mt-1">
                  Estoque atual:{' '}
                  <span className="font-bold text-foreground">{adjustItem.currentStock}</span>{' '}
                  {adjustItem.product.unit ?? 'un'}
                </p>
              </div>

              <div>
                <Label className="font-tactical text-xs">Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                  autoFocus
                />
                <div className="flex gap-1 mt-2">
                  {QUICK_QTY.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAdjustQty(String(q))}
                      className="font-tactical text-xs"
                    >
                      +{q}
                    </Button>
                  ))}
                </div>
                {overWithdrawal && (
                  <p className="text-xs font-tactical text-red-600 dark:text-red-400 mt-1">
                    Quantidade maior que o estoque disponivel ({adjustItem.currentStock}).
                  </p>
                )}
              </div>

              <div>
                <Label className="font-tactical text-xs">Observacao (opcional)</Label>
                <Input
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Ex: Reposicao de fornecedor, ajuste de inventario..."
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAdjustDialog(false)} disabled={adjusting}>
              Cancelar
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={adjustDisabled}
              className={
                adjustType === 'ADJUSTMENT_IN'
                  ? 'bg-green-600 hover:bg-green-700 text-white font-tactical'
                  : 'bg-red-600 hover:bg-red-700 text-white font-tactical'
              }
            >
              {adjusting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm de exclusão */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        title="Excluir produto"
        description={`Tem certeza que deseja excluir "${deleteConfirm.name}"? Esta acao nao pode ser desfeita.`}
        variant="destructive"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        isLoading={deleting}
      />
    </div>
  );
};

export default ProductsPage;
