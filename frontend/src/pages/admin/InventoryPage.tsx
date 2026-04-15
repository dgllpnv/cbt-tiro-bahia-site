import { useState, useEffect } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, ArrowUpCircle, ArrowDownCircle, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { categoryLabels } from '@/lib/constants';

const InventoryPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>('ADJUSTMENT_IN');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/stock', { params: { limit: 200 } });
      if (res.data.success) setItems(res.data.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchStock(); }, []);

  const handleAdjust = async () => {
    if (!selectedItem || !adjustQty) return;
    setSaving(true);
    try {
      const res = await api.post('/api/stock/adjust', { productId: selectedItem.productId, quantity: parseInt(adjustQty), type: adjustType, notes: adjustNotes });
      if (res.data.success) { toast({ title: 'Estoque ajustado' }); setAdjustDialog(false); setAdjustQty(''); setAdjustNotes(''); fetchStock(); }
    } catch (e: any) { toast({ title: 'Erro', description: e.response?.data?.error, variant: 'destructive' }); }
    setSaving(false);
  };

  const lowCount = items.filter((i: any) => i.currentStock <= i.minimumStock).length;
  if (loading) return <div><PageHeader title="Estoque" /><LoadingSpinner /></div>;

  return (
    <div>
      <PageHeader title="Estoque" description="Gestao e controle de estoque" />
      {lowCount > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="text-yellow-500" size={20} />
          <span className="text-yellow-400 font-tactical text-sm">{lowCount} item(ns) abaixo do minimo</span>
        </div>
      )}
      {items.length === 0 ? <EmptyState title="Nenhum item" description="Cadastre produtos primeiro" /> : (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          <Table><TableHeader><TableRow className="border-gray-800 hover:bg-transparent">
            <TableHead className="text-gray-400 font-tactical">Produto</TableHead>
            <TableHead className="text-gray-400 font-tactical">Categoria</TableHead>
            <TableHead className="text-gray-400 font-tactical">Estoque</TableHead>
            <TableHead className="text-gray-400 font-tactical">Minimo</TableHead>
            <TableHead className="text-gray-400 font-tactical">Nivel</TableHead>
            <TableHead className="text-gray-400 font-tactical">Acoes</TableHead>
          </TableRow></TableHeader>
          <TableBody>{items.map((item: any) => {
            const isLow = item.currentStock <= item.minimumStock;
            const pct = item.minimumStock > 0 ? Math.min(100, (item.currentStock / (item.minimumStock * 3)) * 100) : 50;
            return (
              <TableRow key={item.id} className={`border-gray-800 ${isLow ? 'bg-red-900/10' : ''}`}>
                <TableCell className="text-white font-tactical">{item.product?.name}</TableCell>
                <TableCell className="text-gray-400 font-tactical text-sm">{categoryLabels[item.product?.category] || item.product?.category}</TableCell>
                <TableCell className={`font-tactical font-bold ${isLow ? 'text-red-400' : 'text-white'}`}>{item.currentStock} {item.product?.unit}</TableCell>
                <TableCell className="text-gray-500 font-tactical">{item.minimumStock}</TableCell>
                <TableCell className="w-32"><Progress value={pct} className="h-2" /></TableCell>
                <TableCell><div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(item); setAdjustType('ADJUSTMENT_IN'); setAdjustDialog(true); }} className="text-green-400" title="Entrada"><ArrowUpCircle size={16} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(item); setAdjustType('ADJUSTMENT_OUT'); setAdjustDialog(true); }} className="text-red-400" title="Saida"><ArrowDownCircle size={16} /></Button>
                </div></TableCell>
              </TableRow>
            );
          })}</TableBody></Table>
        </div>
      )}

      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader><DialogTitle className="font-military">{adjustType === 'ADJUSTMENT_IN' ? 'Entrada' : 'Saida'} — {selectedItem?.product?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-400 font-tactical text-sm">Estoque atual: <span className="text-white font-bold">{selectedItem?.currentStock}</span></p>
            <Input type="number" min="1" placeholder="Quantidade" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} className="bg-gray-800 border-gray-600 text-white font-tactical" />
            <Input placeholder="Motivo" value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} className="bg-gray-800 border-gray-600 text-white font-tactical" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustDialog(false)} className="font-tactical">Cancelar</Button>
            <Button onClick={handleAdjust} disabled={saving || !adjustQty} className={`font-tactical ${adjustType === 'ADJUSTMENT_IN' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white`}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryPage;
