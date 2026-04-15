import { useState, useEffect } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Pencil, Trash2, Package, Crosshair, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { categoryLabels, equipmentTypeLabels, equipmentConditionLabels } from '@/lib/constants';

const SettingsPage = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'product' | 'equipment'>('product');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: 'product' | 'equipment'; id: string; name: string }>({ open: false, type: 'product', id: '', name: '' });
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const [productForm, setProductForm] = useState({ name: '', category: 'AMMUNITION', caliber: '', unitPrice: '', costPrice: '', unit: 'un' });
  const [equipForm, setEquipForm] = useState({ name: '', equipmentType: 'FIREARM', serialNumber: '', caliber: '', brand: '', model: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [p, e] = await Promise.all([
        api.get('/api/products', { params: { limit: 100, isActive: 'true' } }),
        api.get('/api/equipment', { params: { limit: 100, isActive: 'true' } }),
      ]);
      if (p.data.success) setProducts(p.data.data);
      if (e.data.success) setEquipment(e.data.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openNewProduct = () => {
    setEditingId(null);
    setProductForm({ name: '', category: 'AMMUNITION', caliber: '', unitPrice: '', costPrice: '', unit: 'un' });
    setDialogType('product');
    setDialogOpen(true);
  };

  const openEditProduct = (p: any) => {
    setEditingId(p.id);
    setProductForm({ name: p.name, category: p.category, caliber: p.caliber || '', unitPrice: String(p.unitPrice), costPrice: p.costPrice ? String(p.costPrice) : '', unit: p.unit || 'un' });
    setDialogType('product');
    setDialogOpen(true);
  };

  const openNewEquipment = () => {
    setEditingId(null);
    setEquipForm({ name: '', equipmentType: 'FIREARM', serialNumber: '', caliber: '', brand: '', model: '' });
    setDialogType('equipment');
    setDialogOpen(true);
  };

  const openEditEquipment = (e: any) => {
    setEditingId(e.id);
    setEquipForm({ name: e.name, equipmentType: e.equipmentType, serialNumber: e.serialNumber || '', caliber: e.caliber || '', brand: e.brand || '', model: e.model || '' });
    setDialogType('equipment');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (dialogType === 'product') {
        const payload = { ...productForm, unitPrice: parseFloat(productForm.unitPrice) || 0, costPrice: productForm.costPrice ? parseFloat(productForm.costPrice) : undefined };
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
      toast({ title: 'Erro', description: e.response?.data?.error || 'Falha na operacao', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const endpoint = deleteConfirm.type === 'product' ? `/api/products/${deleteConfirm.id}` : `/api/equipment/${deleteConfirm.id}`;
      await api.delete(endpoint);
      toast({ title: `${deleteConfirm.type === 'product' ? 'Produto' : 'Equipamento'} removido` });
      setDeleteConfirm({ ...deleteConfirm, open: false });
      fetchData();
    } catch (e: any) {
      toast({ title: 'Erro ao remover', description: e.response?.data?.error || 'Falha na operacao', variant: 'destructive' });
    }
    setDeleting(false);
  };

  if (loading) return <div><PageHeader title="Cadastros Gerais" /><LoadingSpinner /></div>;

  return (
    <div>
      <PageHeader title="Cadastros Gerais" description="Produtos, equipamentos e categorias" />
      <Tabs defaultValue="products">
        <TabsList className="bg-gray-800 border border-gray-700">
          <TabsTrigger value="products" className="data-[state=active]:bg-cbt-orange data-[state=active]:text-black font-tactical"><Package size={16} className="mr-2" />Produtos ({products.length})</TabsTrigger>
          <TabsTrigger value="equipment" className="data-[state=active]:bg-cbt-orange data-[state=active]:text-black font-tactical"><Crosshair size={16} className="mr-2" />Equipamentos ({equipment.length})</TabsTrigger>
        </TabsList>

        {/* PRODUTOS */}
        <TabsContent value="products" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={openNewProduct} className="bg-cbt-orange text-black font-tactical hover:bg-cbt-orange/90"><Plus size={16} className="mr-2" />Novo Produto</Button>
          </div>
          {products.length === 0 ? <EmptyState title="Nenhum produto cadastrado" description="Cadastre produtos para vendas e estoque" /> : (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
              <Table>
                <TableHeader><TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400 font-tactical">Nome</TableHead>
                  <TableHead className="text-gray-400 font-tactical">Categoria</TableHead>
                  <TableHead className="text-gray-400 font-tactical">Calibre</TableHead>
                  <TableHead className="text-gray-400 font-tactical">Preco</TableHead>
                  <TableHead className="text-gray-400 font-tactical text-right">Acoes</TableHead>
                </TableRow></TableHeader>
                <TableBody>{products.map((p: any) => (
                  <TableRow key={p.id} className="border-gray-800">
                    <TableCell className="text-white font-tactical">{p.name}</TableCell>
                    <TableCell className="text-gray-400 font-tactical">{categoryLabels[p.category] || p.category}</TableCell>
                    <TableCell className="text-gray-400 font-tactical">{p.caliber || '-'}</TableCell>
                    <TableCell className="text-cbt-orange font-tactical">{formatCurrency(Number(p.unitPrice))}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-cbt-orange" title="Editar" onClick={() => openEditProduct(p)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-400" title="Remover" onClick={() => setDeleteConfirm({ open: true, type: 'product', id: p.id, name: p.name })}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* EQUIPAMENTOS */}
        <TabsContent value="equipment" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={openNewEquipment} className="bg-cbt-orange text-black font-tactical hover:bg-cbt-orange/90"><Plus size={16} className="mr-2" />Novo Equipamento</Button>
          </div>
          {equipment.length === 0 ? <EmptyState title="Nenhum equipamento cadastrado" description="Cadastre equipamentos para emprestimo" /> : (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
              <Table>
                <TableHeader><TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400 font-tactical">Nome</TableHead>
                  <TableHead className="text-gray-400 font-tactical">Tipo</TableHead>
                  <TableHead className="text-gray-400 font-tactical">N. Serie</TableHead>
                  <TableHead className="text-gray-400 font-tactical">Condicao</TableHead>
                  <TableHead className="text-gray-400 font-tactical">Disponivel</TableHead>
                  <TableHead className="text-gray-400 font-tactical text-right">Acoes</TableHead>
                </TableRow></TableHeader>
                <TableBody>{equipment.map((e: any) => (
                  <TableRow key={e.id} className="border-gray-800">
                    <TableCell className="text-white font-tactical">{e.name}</TableCell>
                    <TableCell className="text-gray-400 font-tactical">{equipmentTypeLabels[e.equipmentType] || e.equipmentType}</TableCell>
                    <TableCell className="text-gray-400 font-tactical">{e.serialNumber || '-'}</TableCell>
                    <TableCell className="text-gray-400 font-tactical">{equipmentConditionLabels[e.condition] || e.condition}</TableCell>
                    <TableCell className={`font-tactical ${e.isAvailable ? 'text-green-400' : 'text-red-400'}`}>{e.isAvailable ? 'Sim' : 'Nao'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-cbt-orange" title="Editar" onClick={() => openEditEquipment(e)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-400" title="Remover" onClick={() => setDeleteConfirm({ open: true, type: 'equipment', id: e.id, name: e.name })}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="font-military">
              {editingId ? (dialogType === 'product' ? 'Editar Produto' : 'Editar Equipamento') : (dialogType === 'product' ? 'Novo Produto' : 'Novo Equipamento')}
            </DialogTitle>
          </DialogHeader>
          {dialogType === 'product' ? (
            <div className="space-y-4">
              <Input placeholder="Nome" value={productForm.name} onChange={(e) => setProductForm({...productForm, name: e.target.value})} className="bg-gray-800 border-gray-600 text-white font-tactical" />
              <select value={productForm.category} onChange={(e) => setProductForm({...productForm, category: e.target.value})} className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-600 text-white font-tactical">
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <Input placeholder="Calibre" value={productForm.caliber} onChange={(e) => setProductForm({...productForm, caliber: e.target.value})} className="bg-gray-800 border-gray-600 text-white font-tactical" />
              <div className="grid grid-cols-2 gap-4">
                <Input type="number" step="0.01" placeholder="Preco venda" value={productForm.unitPrice} onChange={(e) => setProductForm({...productForm, unitPrice: e.target.value})} className="bg-gray-800 border-gray-600 text-white font-tactical" />
                <Input type="number" step="0.01" placeholder="Preco custo" value={productForm.costPrice} onChange={(e) => setProductForm({...productForm, costPrice: e.target.value})} className="bg-gray-800 border-gray-600 text-white font-tactical" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Input placeholder="Nome" value={equipForm.name} onChange={(e) => setEquipForm({...equipForm, name: e.target.value})} className="bg-gray-800 border-gray-600 text-white font-tactical" />
              <select value={equipForm.equipmentType} onChange={(e) => setEquipForm({...equipForm, equipmentType: e.target.value})} className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-600 text-white font-tactical">
                {Object.entries(equipmentTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <Input placeholder="N. Serie" value={equipForm.serialNumber} onChange={(e) => setEquipForm({...equipForm, serialNumber: e.target.value})} className="bg-gray-800 border-gray-600 text-white font-tactical" />
              <Input placeholder="Calibre" value={equipForm.caliber} onChange={(e) => setEquipForm({...equipForm, caliber: e.target.value})} className="bg-gray-800 border-gray-600 text-white font-tactical" />
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="Marca" value={equipForm.brand} onChange={(e) => setEquipForm({...equipForm, brand: e.target.value})} className="bg-gray-800 border-gray-600 text-white font-tactical" />
                <Input placeholder="Modelo" value={equipForm.model} onChange={(e) => setEquipForm({...equipForm, model: e.target.value})} className="bg-gray-800 border-gray-600 text-white font-tactical" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="font-tactical">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-cbt-orange text-black font-tactical hover:bg-cbt-orange/90">{saving ? <Loader2 size={16} className="animate-spin" /> : (editingId ? 'Salvar' : 'Criar')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        title={`Remover ${deleteConfirm.type === 'product' ? 'produto' : 'equipamento'}`}
        description={`Tem certeza que deseja remover "${deleteConfirm.name}"? Esta acao nao pode ser desfeita.`}
        variant="destructive"
        confirmLabel="Remover"
        onConfirm={handleDelete}
        isLoading={deleting}
      />
    </div>
  );
};

export default SettingsPage;
