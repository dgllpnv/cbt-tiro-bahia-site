import { useState, useEffect } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { DollarSign, TrendingUp, TrendingDown, Plus, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { transactionTypeLabels, expenseCategoryLabels } from '@/lib/constants';

const FinancialPage = () => {
  const [summary, setSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: 'INVENTORY_PURCHASE', description: '', amount: '', vendor: '', expenseDate: new Date().toISOString().split('T')[0], notes: '' });
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, expRes, txRes] = await Promise.all([
        api.get('/api/financial/summary', { params: { period: 'month' } }),
        api.get('/api/financial/expenses', { params: { limit: 20 } }),
        api.get('/api/transactions', { params: { limit: 20 } }),
      ]);
      if (sumRes.data.success) setSummary(sumRes.data.data);
      if (expRes.data.success) setExpenses(expRes.data.data);
      if (txRes.data.success) setTransactions(txRes.data.data);
    } catch (e: any) {
      toast({
        title: 'Erro ao carregar financeiro',
        description: e?.response?.data?.error || 'Nao foi possivel obter os dados. Tente novamente.',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateExpense = async () => {
    setSaving(true);
    try {
      await api.post('/api/financial/expenses', { ...expenseForm, amount: parseFloat(expenseForm.amount) || 0 });
      toast({ title: 'Despesa registrada' });
      setExpenseDialog(false);
      setExpenseForm({ category: 'INVENTORY_PURCHASE', description: '', amount: '', vendor: '', expenseDate: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (e: any) { toast({ title: 'Erro', description: e.response?.data?.error, variant: 'destructive' }); }
    setSaving(false);
  };

  if (loading) return <div><PageHeader title="Financeiro" /><LoadingSpinner /></div>;

  return (
    <div>
      <PageHeader title="Financeiro" description="Relatorios financeiros e despesas" actions={
        <Button onClick={() => setExpenseDialog(true)} className="bg-cbt-orange text-black font-tactical hover:bg-cbt-orange/90"><Plus size={16} className="mr-2" />Nova Despesa</Button>
      } />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="text-green-400" size={20} /><span className="text-gray-400 font-tactical text-sm">Receita do Mes</span></div>
          <p className="text-2xl font-military font-bold text-green-400">{formatCurrency(summary?.revenue || 0)}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-2"><TrendingDown className="text-red-400" size={20} /><span className="text-gray-400 font-tactical text-sm">Despesas do Mes</span></div>
          <p className="text-2xl font-military font-bold text-red-400">{formatCurrency(summary?.expenses || 0)}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-2"><DollarSign className={(summary?.profit || 0) >= 0 ? 'text-cbt-orange' : 'text-red-400'} size={20} /><span className="text-gray-400 font-tactical text-sm">Lucro do Mes</span></div>
          <p className={`text-2xl font-military font-bold ${(summary?.profit || 0) >= 0 ? 'text-cbt-orange' : 'text-red-400'}`}>{formatCurrency(summary?.profit || 0)}</p>
        </div>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList className="bg-gray-800 border border-gray-700">
          <TabsTrigger value="transactions" className="data-[state=active]:bg-cbt-orange data-[state=active]:text-black font-tactical">Vendas ({transactions.length})</TabsTrigger>
          <TabsTrigger value="expenses" className="data-[state=active]:bg-cbt-orange data-[state=active]:text-black font-tactical">Despesas ({expenses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            <Table><TableHeader><TableRow className="border-gray-800 hover:bg-transparent">
              <TableHead className="text-gray-400 font-tactical">Data</TableHead>
              <TableHead className="text-gray-400 font-tactical">Tipo</TableHead>
              <TableHead className="text-gray-400 font-tactical">Membro</TableHead>
              <TableHead className="text-gray-400 font-tactical">Valor</TableHead>
              <TableHead className="text-gray-400 font-tactical">Pgto</TableHead>
            </TableRow></TableHeader>
            <TableBody>{transactions.map((t: any) => (
              <TableRow key={t.id} className="border-gray-800">
                <TableCell className="text-gray-400 font-tactical text-sm">{formatDate(t.transactionDate)}</TableCell>
                <TableCell className="text-gray-300 font-tactical text-sm">{transactionTypeLabels[t.type] || t.type}</TableCell>
                <TableCell className="text-white font-tactical text-sm">{t.member?.fullName}</TableCell>
                <TableCell className="text-green-400 font-tactical font-bold">{formatCurrency(Number(t.totalAmount))}</TableCell>
                <TableCell className="text-gray-400 font-tactical text-sm">{t.paymentMethod || '-'}</TableCell>
              </TableRow>
            ))}</TableBody></Table>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            <Table><TableHeader><TableRow className="border-gray-800 hover:bg-transparent">
              <TableHead className="text-gray-400 font-tactical">Data</TableHead>
              <TableHead className="text-gray-400 font-tactical">Categoria</TableHead>
              <TableHead className="text-gray-400 font-tactical">Descricao</TableHead>
              <TableHead className="text-gray-400 font-tactical">Valor</TableHead>
              <TableHead className="text-gray-400 font-tactical">Fornecedor</TableHead>
            </TableRow></TableHeader>
            <TableBody>{expenses.map((e: any) => (
              <TableRow key={e.id} className="border-gray-800">
                <TableCell className="text-gray-400 font-tactical text-sm">{formatDate(e.expenseDate)}</TableCell>
                <TableCell className="text-gray-300 font-tactical text-sm">{expenseCategoryLabels[e.category] || e.category}</TableCell>
                <TableCell className="text-white font-tactical text-sm">{e.description}</TableCell>
                <TableCell className="text-red-400 font-tactical font-bold">{formatCurrency(Number(e.amount))}</TableCell>
                <TableCell className="text-gray-400 font-tactical text-sm">{e.vendor || '-'}</TableCell>
              </TableRow>
            ))}</TableBody></Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader><DialogTitle className="font-military">Nova Despesa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <select value={expenseForm.category} onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})} className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-600 text-white font-tactical">
              <option value="INVENTORY_PURCHASE">Compra de Estoque</option><option value="MAINTENANCE">Manutenção</option><option value="UTILITIES">Utilidades</option><option value="STAFF">Pessoal</option><option value="INSURANCE">Seguro</option><option value="AMMUNITION_RESTOCK">Reposição de Munição</option><option value="EQUIPMENT_PURCHASE">Compra de Equipamento</option><option value="OTHER">Outro</option>
            </select>
            <Input placeholder="Descricao" value={expenseForm.description} onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})} className="bg-gray-800 border-gray-600 text-white font-tactical" />
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" step="0.01" placeholder="Valor (R$)" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} className="bg-gray-800 border-gray-600 text-white font-tactical" />
              <Input type="date" value={expenseForm.expenseDate} onChange={(e) => setExpenseForm({...expenseForm, expenseDate: e.target.value})} className="bg-gray-800 border-gray-600 text-white font-tactical" />
            </div>
            <Input placeholder="Fornecedor" value={expenseForm.vendor} onChange={(e) => setExpenseForm({...expenseForm, vendor: e.target.value})} className="bg-gray-800 border-gray-600 text-white font-tactical" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExpenseDialog(false)} className="font-tactical">Cancelar</Button>
            <Button onClick={handleCreateExpense} disabled={saving} className="bg-cbt-orange text-black font-tactical hover:bg-cbt-orange/90">{saving ? <Loader2 size={16} className="animate-spin" /> : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinancialPage;
