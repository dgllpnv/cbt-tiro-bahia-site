import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { createVisitor, type CreateVisitorData } from '@/services/visitorsService';

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

interface FormData {
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

const initialFormData: FormData = {
  fullName: '',
  cpf: '',
  phone: '',
  email: '',
  dateOfBirth: '',
  address: '',
  city: '',
  state: 'BA',
  zipCode: '',
};

const inputClasses =
  'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-cbt-orange focus:ring-cbt-orange/20';

const labelClasses = 'block text-sm font-tactical text-gray-300 mb-1';

const VisitorCreatePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCpfChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, cpf: applyCpfMask(e.target.value) }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.fullName.trim()) {
      toast({ title: 'Nome completo e obrigatorio', variant: 'destructive' });
      return;
    }
    if (stripCpfMask(form.cpf).length !== 11) {
      toast({ title: 'CPF invalido', variant: 'destructive' });
      return;
    }
    if (!form.phone.trim()) {
      toast({ title: 'Telefone e obrigatorio', variant: 'destructive' });
      return;
    }

    const payload: CreateVisitorData = {
      fullName: form.fullName.trim(),
      cpf: stripCpfMask(form.cpf),
      phone: form.phone.trim(),
    };

    if (form.email.trim()) payload.email = form.email.trim().toLowerCase();
    if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
    if (form.address.trim()) payload.address = form.address.trim();
    if (form.city.trim()) payload.city = form.city.trim();
    if (form.state.trim()) payload.state = form.state.trim().toUpperCase().slice(0, 2);
    if (form.zipCode.trim()) payload.zipCode = form.zipCode.trim();

    setIsSubmitting(true);
    try {
      const result = await createVisitor(payload);
      if (result.success && result.data) {
        toast({ title: 'Visitante cadastrado com sucesso' });
        navigate('/admin/visitantes');
      } else {
        toast({
          title: 'Erro ao cadastrar visitante',
          description: result.error || 'Erro inesperado.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Novo Visitante"
        description="Cadastrar visitante para uso pontual do clube"
        actions={
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
        }
      />

      <form onSubmit={handleSubmit} className="space-y-8">
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
                placeholder="Nome completo do visitante"
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
                placeholder="000.000.000-00"
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
                placeholder="(71) 99999-9999"
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
                placeholder="email@exemplo.com (opcional)"
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
            Endereco (opcional)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="address" className={labelClasses}>
                Endereco
              </label>
              <Input
                id="address"
                name="address"
                placeholder="Rua, numero, complemento"
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
                placeholder="Cidade"
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
                placeholder="UF"
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
                placeholder="00000-000"
                value={form.zipCode}
                onChange={handleChange}
                className={inputClasses}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/visitantes')}
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Cadastrar Visitante
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default VisitorCreatePage;
