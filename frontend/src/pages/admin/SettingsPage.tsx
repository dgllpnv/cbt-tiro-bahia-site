import { useState, useEffect } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Crosshair,
  Loader2,
  ImagePlus,
  Building2,
} from 'lucide-react';
import ClubLegalSettings from '@/components/admin/ClubLegalSettings';
import api from '@/services/api';
import {
  categoryLabels,
  equipmentTypeLabels,
  equipmentConditionLabels,
} from '@/lib/constants';
import { getCategoryVisual } from '@/lib/categoryVisuals';
import { getCaliberColor } from '@/lib/ammunitionVisuals';
import { getIconEntry } from '@/lib/iconRegistry';
import { GiBullets } from 'react-icons/gi';
import IconPicker from '@/components/admin/IconPicker';

// ── Helpers ──────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  name: string;
  category: string;
  caliber?: string | null;
  unitPrice: number | string;
  costPrice?: number | string | null;
  unit?: string | null;
  iconKey?: string | null;
  iconColor?: string | null;
}

function ProductIcon({ product, size = 18 }: { product: ProductRow; size?: number }) {
  const visual = getCategoryVisual(product.category);
  const override = getIconEntry(product.iconKey);
  // Color resolution priority: explicit iconColor > caliber color (ammo) > category default
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

// ── Component ────────────────────────────────────────────────────────────

const SettingsPage = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'product' | 'equipment'>('product');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    type: 'product' | 'equipment';
    id: string;
    name: string;
  }>({ open: false, type: 'product', id: '', name: '' });
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const [productForm, setProductForm] = useState({
    name: '',
    category: 'AMMUNITION',
    caliber: '',
    unitPrice: '',
    costPrice: '',
    unit: 'un',
    iconKey: null as string | null,
    iconColor: null as string | null,
  });
  const [equipForm, setEquipForm] = useState({
    name: '',
    equipmentType: 'FIREARM',
    serialNumber: '',
    caliber: '',
    brand: '',
    model: '',
  });

  // Inline icon picker (per-product quick edit)
  const [inlinePicker, setInlinePicker] = useState<{
    open: boolean;
    productId: string | null;
    currentKey: string | null;
    currentColor: string | null;
    productName: string;
  }>({ open: false, productId: null, currentKey: null, currentColor: null, productName: '' });
  const [savingInlineIcon, setSavingInlineIcon] = useState(false);

  // Form dialog icon picker
  const [formPickerOpen, setFormPickerOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [p, e] = await Promise.all([
        api.get('/api/products', { params: { limit: 100, isActive: 'true' } }),
        api.get('/api/equipment', { params: { limit: 100, isActive: 'true' } }),
      ]);
      if (p.data.success) setProducts(p.data.data);
      if (e.data.success) setEquipment(e.data.data);
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar cadastros',
        description: err?.response?.data?.error || 'Não foi possível obter produtos ou equipamentos.',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNewProduct = () => {
    setEditingId(null);
    setProductForm({
      name: '',
      category: 'AMMUNITION',
      caliber: '',
      unitPrice: '',
      costPrice: '',
      unit: 'un',
      iconKey: null,
      iconColor: null,
    });
    setDialogType('product');
    setDialogOpen(true);
  };

  const openEditProduct = (p: any) => {
    setEditingId(p.id);
    setProductForm({
      name: p.name,
      category: p.category,
      caliber: p.caliber || '',
      unitPrice: String(p.unitPrice),
      costPrice: p.costPrice ? String(p.costPrice) : '',
      unit: p.unit || 'un',
      iconKey: p.iconKey ?? null,
      iconColor: p.iconColor ?? null,
    });
    setDialogType('product');
    setDialogOpen(true);
  };

  const openNewEquipment = () => {
    setEditingId(null);
    setEquipForm({
      name: '',
      equipmentType: 'FIREARM',
      serialNumber: '',
      caliber: '',
      brand: '',
      model: '',
    });
    setDialogType('equipment');
    setDialogOpen(true);
  };

  const openEditEquipment = (e: any) => {
    setEditingId(e.id);
    setEquipForm({
      name: e.name,
      equipmentType: e.equipmentType,
      serialNumber: e.serialNumber || '',
      caliber: e.caliber || '',
      brand: e.brand || '',
      model: e.model || '',
    });
    setDialogType('equipment');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (dialogType === 'product') {
        const payload = {
          ...productForm,
          unitPrice: parseFloat(productForm.unitPrice) || 0,
          costPrice: productForm.costPrice ? parseFloat(productForm.costPrice) : undefined,
          iconKey: productForm.iconKey ?? null,
          iconColor: productForm.iconColor ?? null,
        };
        if (editingId) {
          await api.put(`/api/products/${editingId}`, payload);
          toast({ title: 'Produto atualizado' });
        } else {
          await api.post('/api/products', payload);
          toast({ title: 'Produto criado' });
        }
      } else {
        if (editingId) {
          await api.put(`/api/equipment/${editingId}`, equipForm);
          toast({ title: 'Equipamento atualizado' });
        } else {
          await api.post('/api/equipment', equipForm);
          toast({ title: 'Equipamento criado' });
        }
      }
      setDialogOpen(false);
      setEditingId(null);
      fetchData();
    } catch (e: any) {
      toast({
        title: 'Erro',
        description: e.response?.data?.error || 'Falha na operação',
        variant: 'destructive',
      });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const endpoint =
        deleteConfirm.type === 'product'
          ? `/api/products/${deleteConfirm.id}`
          : `/api/equipment/${deleteConfirm.id}`;
      await api.delete(endpoint);
      toast({
        title: `${deleteConfirm.type === 'product' ? 'Produto' : 'Equipamento'} removido`,
      });
      setDeleteConfirm({ ...deleteConfirm, open: false });
      fetchData();
    } catch (e: any) {
      toast({
        title: 'Erro ao remover',
        description: e.response?.data?.error || 'Falha na operação',
        variant: 'destructive',
      });
    }
    setDeleting(false);
  };

  // Inline icon edit (no full dialog)
  const openInlinePicker = (p: any) => {
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
        title: selection.key
          ? 'Ícone atualizado'
          : 'Ícone removido (usando padrão da categoria)',
      });
      setInlinePicker((p) => ({ ...p, open: false }));
      fetchData();
    } catch (e: any) {
      toast({
        title: 'Erro ao atualizar ícone',
        description: e?.response?.data?.error || 'Tente novamente.',
        variant: 'destructive',
      });
    }
    setSavingInlineIcon(false);
  };

  if (loading)
    return (
      <div>
        <PageHeader title="Cadastros Gerais" />
        <LoadingSpinner />
      </div>
    );

  return (
    <div>
      <PageHeader title="Cadastros Gerais" description="Produtos, equipamentos e categorias" />
      <Tabs defaultValue="products">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger
            value="products"
            className="data-[state=active]:bg-cbt-orange data-[state=active]:text-primary-foreground font-tactical"
          >
            <Package size={16} className="mr-2" />
            Produtos ({products.length})
          </TabsTrigger>
          <TabsTrigger
            value="club"
            className="data-[state=active]:bg-cbt-orange data-[state=active]:text-primary-foreground font-tactical"
          >
            <Building2 size={16} className="mr-2" />
            Dados do Clube
          </TabsTrigger>
        </TabsList>

        {/* PRODUTOS */}
        <TabsContent value="products" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button
              onClick={openNewProduct}
              className="bg-cbt-orange text-primary-foreground font-tactical hover:bg-cbt-orange/90"
            >
              <Plus size={16} className="mr-2" />
              Novo Produto
            </Button>
          </div>
          {products.length === 0 ? (
            <EmptyState
              title="Nenhum produto cadastrado"
              description="Cadastre produtos para vendas e estoque"
            />
          ) : (
            <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-tactical w-14">Ícone</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Nome</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Categoria</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Calibre</TableHead>
                    <TableHead className="text-muted-foreground font-tactical">Preço</TableHead>
                    <TableHead className="text-muted-foreground font-tactical text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p: any) => (
                    <TableRow key={p.id} className="border-border hover:bg-muted/40">
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => openInlinePicker(p)}
                          title="Editar ícone"
                          className="group h-9 w-9 rounded-md bg-muted border border-border hover:border-cbt-orange hover:bg-cbt-orange/10 flex items-center justify-center transition-colors relative"
                        >
                          <ProductIcon product={p} size={20} />
                          <span className="absolute inset-0 rounded-md bg-cbt-orange/0 group-hover:bg-cbt-orange/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ImagePlus className="h-3.5 w-3.5 text-cbt-orange" />
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="text-foreground font-tactical">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground font-tactical">
                        {categoryLabels[p.category] || p.category}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-tactical">{p.caliber || '-'}</TableCell>
                      <TableCell className="text-cbt-orange font-tactical">
                        {formatCurrency(Number(p.unitPrice))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-cbt-orange"
                            title="Editar ícone"
                            onClick={() => openInlinePicker(p)}
                          >
                            <ImagePlus size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-cbt-orange"
                            title="Editar"
                            onClick={() => openEditProduct(p)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-400"
                            title="Remover"
                            onClick={() =>
                              setDeleteConfirm({
                                open: true,
                                type: 'product',
                                id: p.id,
                                name: p.name,
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* DADOS DO CLUBE (legal — para Declarações) */}
        <TabsContent value="club" className="mt-4">
          <ClubLegalSettings />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-military">
              {editingId
                ? dialogType === 'product'
                  ? 'Editar Produto'
                  : 'Editar Equipamento'
                : dialogType === 'product'
                  ? 'Novo Produto'
                  : 'Novo Equipamento'}
            </DialogTitle>
          </DialogHeader>
          {dialogType === 'product' ? (
            <div className="space-y-4">
              <Input
                placeholder="Nome"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                className="bg-muted border-input text-foreground font-tactical"
              />
              <select
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                className="w-full h-10 px-3 rounded-md bg-muted border border-input text-foreground font-tactical"
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Calibre"
                value={productForm.caliber}
                onChange={(e) => setProductForm({ ...productForm, caliber: e.target.value })}
                className="bg-muted border-input text-foreground font-tactical"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Preço venda"
                  value={productForm.unitPrice}
                  onChange={(e) => setProductForm({ ...productForm, unitPrice: e.target.value })}
                  className="bg-muted border-input text-foreground font-tactical"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Preço custo"
                  value={productForm.costPrice}
                  onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                  className="bg-muted border-input text-foreground font-tactical"
                />
              </div>

              {/* Icon picker trigger */}
              <div className="bg-muted/40 border border-border rounded-md p-3">
                <p className="text-xs font-tactical uppercase tracking-wider text-muted-foreground/80 mb-2">
                  Mini-ícone
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-md bg-muted border border-border flex items-center justify-center flex-shrink-0">
                    <ProductIcon
                      product={{
                        id: 'preview',
                        name: productForm.name,
                        category: productForm.category,
                        caliber: productForm.caliber,
                        unitPrice: 0,
                        iconKey: productForm.iconKey,
                        iconColor: productForm.iconColor,
                      }}
                      size={24}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    {productForm.iconKey || productForm.iconColor ? (
                      (() => {
                        const entry = getIconEntry(productForm.iconKey);
                        return (
                          <>
                            <p className="text-foreground font-tactical text-sm truncate">
                              {entry?.label ?? 'Cor personalizada'}
                            </p>
                            <p className="text-muted-foreground/80 font-tactical text-xs truncate">
                              {productForm.iconKey ?? '—'}
                              {productForm.iconColor && (
                                <>
                                  {' · '}
                                  <span style={{ color: productForm.iconColor }}>
                                    {productForm.iconColor}
                                  </span>
                                </>
                              )}
                            </p>
                          </>
                        );
                      })()
                    ) : (
                      <p className="text-muted-foreground/80 font-tactical text-xs">
                        Usando ícone padrão da categoria
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormPickerOpen(true)}
                    className="bg-muted border-border text-cbt-orange hover:bg-cbt-orange/10 hover:border-cbt-orange/40 font-tactical h-9"
                  >
                    <ImagePlus className="h-4 w-4 mr-1.5" />
                    Trocar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                placeholder="Nome"
                value={equipForm.name}
                onChange={(e) => setEquipForm({ ...equipForm, name: e.target.value })}
                className="bg-muted border-input text-foreground font-tactical"
              />
              <select
                value={equipForm.equipmentType}
                onChange={(e) => setEquipForm({ ...equipForm, equipmentType: e.target.value })}
                className="w-full h-10 px-3 rounded-md bg-muted border border-input text-foreground font-tactical"
              >
                {Object.entries(equipmentTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Input
                placeholder="N. Série"
                value={equipForm.serialNumber}
                onChange={(e) => setEquipForm({ ...equipForm, serialNumber: e.target.value })}
                className="bg-muted border-input text-foreground font-tactical"
              />
              <Input
                placeholder="Calibre"
                value={equipForm.caliber}
                onChange={(e) => setEquipForm({ ...equipForm, caliber: e.target.value })}
                className="bg-muted border-input text-foreground font-tactical"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Marca"
                  value={equipForm.brand}
                  onChange={(e) => setEquipForm({ ...equipForm, brand: e.target.value })}
                  className="bg-muted border-input text-foreground font-tactical"
                />
                <Input
                  placeholder="Modelo"
                  value={equipForm.model}
                  onChange={(e) => setEquipForm({ ...equipForm, model: e.target.value })}
                  className="bg-muted border-input text-foreground font-tactical"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="font-tactical">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-cbt-orange text-primary-foreground font-tactical hover:bg-cbt-orange/90"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Icon Picker (per-row) */}
      <IconPicker
        open={inlinePicker.open}
        onOpenChange={(open) => setInlinePicker((p) => ({ ...p, open }))}
        value={{ key: inlinePicker.currentKey, color: inlinePicker.currentColor }}
        onSelect={handleInlineIconSelect}
        title="Trocar ícone do produto"
        description={
          inlinePicker.productName
            ? `Ícone para: ${inlinePicker.productName}`
            : undefined
        }
      />

      {/* Form Icon Picker (during create/edit) */}
      <IconPicker
        open={formPickerOpen}
        onOpenChange={setFormPickerOpen}
        value={{ key: productForm.iconKey, color: productForm.iconColor }}
        onSelect={(sel) =>
          setProductForm((p) => ({ ...p, iconKey: sel.key, iconColor: sel.color }))
        }
        title="Escolher ícone do produto"
        description={`Ícone para: ${productForm.name || 'novo produto'}`}
      />

      {/* Saving overlay for inline icon save */}
      {savingInlineIcon && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-6 w-6 animate-spin text-cbt-orange" />
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        title={`Remover ${deleteConfirm.type === 'product' ? 'produto' : 'equipamento'}`}
        description={`Tem certeza que deseja remover "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`}
        variant="destructive"
        confirmLabel="Remover"
        onConfirm={handleDelete}
        isLoading={deleting}
      />
    </div>
  );
};

export default SettingsPage;
