import { useState, useEffect, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, UserCheck, Trash2 } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

import { useToast } from '@/hooks/use-toast';
import {
  getVisitorById,
  updateVisitor,
  deleteVisitor,
  type Visitor,
  type UpdateVisitorData,
} from '@/services/visitorsService';
import api from '@/services/api';
import { formatCpf, formatPhone, formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import { transactionTypeLabels } from '@/lib/constants';
import ConvertVisitorDialog from '@/components/admin/ConvertVisitorDialog';

function applyCpfMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function stripCpfMask(value: string): string {
  return value.replace(/\D/g, '');
}

const inputClasses =
  'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-cbt-orange focus:ring-cbt-orange/20';

const labelClasses = 'block text-sm font-tactical text-gray-300 mb-1';

interface FormState {
  fullName: string;
  cpf: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

const VisitorDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'visitas' | 'transacoes'>('dados');

  const [convertOpen, setConvertOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [visits, setVisits] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tabsLoaded, setTabsLoaded] = useState({ visitas: false, transacoes: false });

  const fetchVisitor = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const result = await getVisitorById(id);
    if (result.success && result.data) {
      setVisitor(result.data);
      setForm({
        fullName: result.data.fullName,
        cpf: applyCpfMask(result.data.cpf),
        phone: result.data.phone || '',
        email: result.data.email || '',
        dateOfBirth: result.data.dateOfBirth ? result.data.dateOfBirth.slice(0, 10) : '',
        address: result.data.address || '',
        city: result.data.city || '',
        state: result.data.state || 'BA',
        zipCode: result.data.zipCode || '',
      });
    } else {
      toast({
        title: 'Erro ao carregar visitante',
        description: result.error,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [id, toast]);

  useEffect(() => {
    fetchVisitor();
  }, [fetchVisitor]);

  // Lazy load tabs
  useEffect(() => {
    if (!id) return;
    if (activeTab === 'visitas' && !tabsLoaded.visitas) {
      api
        .get('/api/visits', { params: { memberId: id, limit: 50 } })
        .then((res) => {
          if (res.data?.success) setVisits(res.data.data || []);
        })
        .finally(() => setTabsLoaded((prev) => ({ ...prev, visitas: true })));
    }
    if (activeTab === 'transacoes' && !tabsLoaded.transacoes) {
      api
        .get('/api/transactions', { params: { memberId: id, limit: 50 } })
        .then((res) => {
          if (res.data?.success) setTransactions(res.data.data || []);
        })
        .finally(() => setTabsLoaded((prev) => ({ ...prev, transacoes: true })));
    }
  }, [activeTab, id, tabsLoaded]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const handleCpfChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => (prev ? { ...prev, cpf: applyCpfMask(e.target.value) } : prev));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || !visitor) return;

    if (!form.fullName.trim()) {
      toast({ title: 'Nome obrigatorio', variant: 'destructive' });
      return;
    }
    if (stripCpfMask(form.cpf).length !== 11) {
      toast({ title: 'CPF invalido', variant: 'destructive' });
      return;
    }
    if (!form.phone.trim()) {
      toast({ title: 'Telefone obrigatorio', variant: 'destructive' });
      return;
    }

    const payload: UpdateVisitorData = {
      fullName: form.fullName.trim(),
      cpf: stripCpfMask(form.cpf),
      phone: form.phone.trim(),
      email: form.email.trim() ? form.email.trim().toLowerCase() : null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() ? form.state.trim().toUpperCase().slice(0, 2) : null,
      zipCode: form.zipCode.trim() || null,
    };
    if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;

    setIsSaving(true);
    const result = await updateVisitor(visitor.id, payload);
    setIsSaving(false);

    if (result.success && result.data) {
      toast({ title: 'Dados atualizados' });
      setVisitor(result.data);
    } else {
      toast({
        title: 'Erro ao atualizar',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = () => {
    if (!visitor) return;
    setConfirmDialog({
      open: true,
      title: 'Excluir visitante',
      description: `Tem certeza que deseja excluir o visitante "${visitor.fullName}"? Esta acao nao pode ser desfeita.`,
      onConfirm: async () => {
        setIsActionLoading(true);
        const result = await deleteVisitor(visitor.id);
        setIsActionLoading(false);
        if (result.success) {
          toast({ title: 'Visitante excluido' });
          setConfirmDialog((prev) => ({ ...prev, open: false }));
          navigate('/admin/visitantes');
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

  if (isLoading || !visitor || !form) {
    return (
      <div className="py-12">
        <LoadingSpinner message="Carregando visitante..." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={visitor.fullName}
        description={
          <span className="flex items-center gap-2">
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-tactical bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Visitante
            </span>
            <span>CPF {formatCpf(visitor.cpf)}</span>
            <span>•</span>
            <span>{formatPhone(visitor.phone)}</span>
          </span>
        }
        actions={
          <>
            <Button
              asChild
              variant="outline"
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
            >
              <Link to="/admin/visitantes">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Link>
            </Button>
            <Button
              onClick={() => setConvertOpen(true)}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Converter em Associado
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-gray-900 border border-gray-800">
          <TabsTrigger value="dados" className="data-[state=active]:bg-cbt-orange data-[state=active]:text-white">
            Dados
          </TabsTrigger>
          <TabsTrigger value="visitas" className="data-[state=active]:bg-cbt-orange data-[state=active]:text-white">
            Visitas
          </TabsTrigger>
          <TabsTrigger value="transacoes" className="data-[state=active]:bg-cbt-orange data-[state=active]:text-white">
            Transacoes
          </TabsTrigger>
        </TabsList>

        {/* TAB: DADOS */}
        <TabsContent value="dados" className="mt-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-military font-bold text-white tracking-wide mb-4">
                Dados Pessoais
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fullName" className={labelClasses}>
                    Nome Completo <span className="text-red-400">*</span>
                  </label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    className={inputClasses}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="cpf" className={labelClasses}>
                    CPF <span className="text-red-400">*</span>
                  </label>
                  <Input
                    id="cpf"
                    name="cpf"
                    value={form.cpf}
                    onChange={handleCpfChange}
                    className={inputClasses}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="phone" className={labelClasses}>
                    Telefone <span className="text-red-400">*</span>
                  </label>
                  <Input
                    id="phone"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className={inputClasses}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className={labelClasses}>
                    E-mail
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="dateOfBirth" className={labelClasses}>
                    Data de Nascimento
                  </label>
                  <Input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={handleChange}
                    className={inputClasses}
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-military font-bold text-white tracking-wide mb-4">
                Endereco
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="address" className={labelClasses}>
                    Endereco
                  </label>
                  <Input
                    id="address"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="city" className={labelClasses}>
                    Cidade
                  </label>
                  <Input
                    id="city"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="state" className={labelClasses}>
                    Estado
                  </label>
                  <Input
                    id="state"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    className={inputClasses}
                    maxLength={2}
                  />
                </div>
                <div>
                  <label htmlFor="zipCode" className={labelClasses}>
                    CEP
                  </label>
                  <Input
                    id="zipCode"
                    name="zipCode"
                    value={form.zipCode}
                    onChange={handleChange}
                    className={inputClasses}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                className="bg-gray-800 border-red-900/50 text-red-400 hover:bg-red-900/30 hover:text-red-300 font-tactical"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Visitante
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* TAB: VISITAS */}
        <TabsContent value="visitas" className="mt-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            {!tabsLoaded.visitas ? (
              <LoadingSpinner message="Carregando visitas..." />
            ) : visits.length === 0 ? (
              <EmptyState
                title="Nenhuma visita registrada"
                description="Quando o visitante for lancado no clube, as visitas aparecerao aqui."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400 font-tactical">Data</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Check-in</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Check-out</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Baia</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Finalidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visits.map((v) => (
                    <TableRow key={v.id} className="border-gray-800 hover:bg-gray-800/50">
                      <TableCell className="text-white">{formatDate(v.visitDate)}</TableCell>
                      <TableCell className="text-gray-300 font-mono text-sm">
                        {v.checkInTime ? formatDateTime(v.checkInTime) : '—'}
                      </TableCell>
                      <TableCell className="text-gray-300 font-mono text-sm">
                        {v.checkOutTime ? formatDateTime(v.checkOutTime) : (
                          <span className="text-amber-400">Em andamento</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {v.lane ? `Baia ${v.lane.number}` : '—'}
                      </TableCell>
                      <TableCell className="text-gray-300 text-sm">{v.purpose || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* TAB: TRANSACOES */}
        <TabsContent value="transacoes" className="mt-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            {!tabsLoaded.transacoes ? (
              <LoadingSpinner message="Carregando transacoes..." />
            ) : transactions.length === 0 ? (
              <EmptyState
                title="Nenhuma transacao registrada"
                description="Compras, comandas e pagamentos aparecerao aqui."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400 font-tactical">Data</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Tipo</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Status</TableHead>
                    <TableHead className="text-gray-400 font-tactical">Pgto</TableHead>
                    <TableHead className="text-gray-400 font-tactical text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id} className="border-gray-800 hover:bg-gray-800/50">
                      <TableCell className="text-white">{formatDate(t.transactionDate)}</TableCell>
                      <TableCell className="text-gray-300 text-sm">
                        {transactionTypeLabels[t.type as keyof typeof transactionTypeLabels] || t.type}
                      </TableCell>
                      <TableCell className="text-gray-300 text-sm">{t.status}</TableCell>
                      <TableCell className="text-gray-300 text-sm">
                        {t.paymentMethod || '—'}
                      </TableCell>
                      <TableCell className="text-right text-green-400 font-mono">
                        {formatCurrency(Number(t.totalAmount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <ConvertVisitorDialog
        visitor={visitor}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConverted={() => {
          // O visitante deixou de ser visitante; redireciona para o cadastro de associado
          navigate(`/admin/associados/${visitor.id}`);
        }}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant="destructive"
        onConfirm={confirmDialog.onConfirm}
        isLoading={isActionLoading}
      />
    </div>
  );
};

export default VisitorDetailPage;
