import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Upload, FileText, X } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';
import { createUser, type CreateUserData } from '@/services/usersService';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Applies CPF mask: ###.###.###-## */
function applyCpfMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Strips CPF mask, returning raw digits */
function stripCpfMask(value: string): string {
  return value.replace(/\D/g, '');
}

// ── Form state shape ─────────────────────────────────────────────────────────

interface FormData {
  fullName: string;
  cpf: string;
  email: string;
  password: string;
  dateOfBirth: string;
  phone: string;
  memberNumber: string;
  role: string;
  cr: string;
  crLevel: string;
  membershipTier: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  rg: string;
  rgIssuer: string;
  nationality: string;
  naturality: string;
  fatherName: string;
  motherName: string;
  profession: string;
  maritalStatus: string;
}

const initialFormData: FormData = {
  fullName: '',
  cpf: '',
  email: '',
  password: '',
  dateOfBirth: '',
  phone: '',
  memberNumber: '',
  role: 'ASSOCIATE',
  cr: '',
  crLevel: '',
  membershipTier: 'STANDARD',
  address: '',
  neighborhood: '',
  city: '',
  state: 'BA',
  zipCode: '',
  rg: '',
  rgIssuer: '',
  nationality: 'BRASILEIRA',
  naturality: '',
  fatherName: '',
  motherName: '',
  profession: '',
  maritalStatus: '',
};

// ── Shared styles ────────────────────────────────────────────────────────────

const inputClasses =
  'bg-muted border-input text-foreground placeholder:text-muted-foreground/60 focus:border-cbt-orange focus:ring-cbt-orange/20';

const selectClasses =
  'w-full rounded-md bg-muted border border-input text-foreground px-3 py-2 text-sm focus:outline-none focus:border-cbt-orange focus:ring-1 focus:ring-cbt-orange/20';

const labelClasses = 'block text-sm font-tactical text-foreground/85 mb-1';

// ── Component ────────────────────────────────────────────────────────────────

const MemberCreatePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<{name: string, type: string, size: number, data: string}[]>([]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCpfChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, cpf: applyCpfMask(e.target.value) }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // ── Validation ───────────────────────────────────────────────────────
    if (!form.fullName.trim()) {
      toast({ title: 'Nome completo e obrigatorio', variant: 'destructive' });
      return;
    }
    if (stripCpfMask(form.cpf).length !== 11) {
      toast({ title: 'CPF invalido', variant: 'destructive' });
      return;
    }
    if (!form.email.trim()) {
      toast({ title: 'E-mail e obrigatorio', variant: 'destructive' });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: 'A senha deve ter no minimo 6 caracteres', variant: 'destructive' });
      return;
    }
    if (!form.memberNumber.trim()) {
      toast({ title: 'Numero de associado e obrigatorio', variant: 'destructive' });
      return;
    }

    // ── Build payload ────────────────────────────────────────────────────
    const payload: CreateUserData = {
      fullName: form.fullName.trim(),
      cpf: stripCpfMask(form.cpf),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      memberNumber: form.memberNumber.trim(),
      role: form.role === 'ADMIN' ? 'ADMIN' : 'ASSOCIATE',
    };

    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
    if (form.cr.trim()) payload.cr = form.cr.trim();
    if (form.crLevel) payload.crLevel = Number(form.crLevel);
    if (form.membershipTier) payload.membershipTier = form.membershipTier;
    if (form.address.trim()) payload.address = form.address.trim();
    if (form.neighborhood.trim()) payload.neighborhood = form.neighborhood.trim();
    if (form.city.trim()) payload.city = form.city.trim();
    if (form.state.trim()) payload.state = form.state.trim().toUpperCase().slice(0, 2);
    if (form.zipCode.trim()) payload.zipCode = form.zipCode.trim();
    if (form.rg.trim()) payload.rg = form.rg.trim();
    if (form.rgIssuer.trim()) payload.rgIssuer = form.rgIssuer.trim();
    if (form.nationality.trim()) payload.nationality = form.nationality.trim();
    if (form.naturality.trim()) payload.naturality = form.naturality.trim();
    if (form.fatherName.trim()) payload.fatherName = form.fatherName.trim();
    if (form.motherName.trim()) payload.motherName = form.motherName.trim();
    if (form.profession.trim()) payload.profession = form.profession.trim();
    if (form.maritalStatus) payload.maritalStatus = form.maritalStatus;

    // ── Submit ───────────────────────────────────────────────────────────
    setIsSubmitting(true);
    try {
      const result = await createUser(payload);

      if (result.success && result.data) {
        if (files.length > 0) {
          for (const file of files) {
            await api
              .post(`/api/users/${result.data.id}/attachments`, {
                fileName: file.name,
                fileUrl: file.data,
                fileType: file.type,
                fileSize: file.size,
              })
              .catch(() => {});
          }
        }
        toast({ title: 'Associado cadastrado com sucesso' });
        navigate('/admin/associados');
      } else {
        toast({
          title: 'Erro ao cadastrar associado',
          description: result.error || 'Erro inesperado. Verifique os dados e tente novamente.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Novo Associado"
        description="Cadastrar novo membro no clube"
        actions={
          <Button
            asChild
            variant="outline"
            className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
          >
            <Link to="/admin/associados">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── Section 1: Dados Pessoais ─────────────────────────────────── */}
        <div className="bg-card/50 border border-border rounded-lg p-6">
          <h2 className="text-lg font-military font-bold text-foreground tracking-wide mb-4">
            Dados Pessoais
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* fullName */}
            <div>
              <label htmlFor="fullName" className={labelClasses}>
                Nome Completo <span className="text-red-700 dark:text-red-400">*</span>
              </label>
              <Input
                id="fullName"
                name="fullName"
                placeholder="Nome completo do associado"
                value={form.fullName}
                onChange={handleChange}
                className={inputClasses}
                required
              />
            </div>

            {/* cpf */}
            <div>
              <label htmlFor="cpf" className={labelClasses}>
                CPF <span className="text-red-700 dark:text-red-400">*</span>
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

            {/* email */}
            <div>
              <label htmlFor="email" className={labelClasses}>
                E-mail <span className="text-red-700 dark:text-red-400">*</span>
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="email@exemplo.com"
                value={form.email}
                onChange={handleChange}
                className={inputClasses}
                required
              />
            </div>

            {/* password */}
            <div>
              <label htmlFor="password" className={labelClasses}>
                Senha <span className="text-red-700 dark:text-red-400">*</span>
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Minimo 6 caracteres"
                value={form.password}
                onChange={handleChange}
                className={inputClasses}
                minLength={6}
                required
              />
            </div>

            {/* dateOfBirth */}
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

            {/* phone */}
            <div>
              <label htmlFor="phone" className={labelClasses}>
                Telefone
              </label>
              <Input
                id="phone"
                name="phone"
                placeholder="(71) 99999-9999"
                value={form.phone}
                onChange={handleChange}
                className={inputClasses}
              />
            </div>
          </div>
        </div>

        {/* ── Section 2: Dados do Clube ─────────────────────────────────── */}
        <div className="bg-card/50 border border-border rounded-lg p-6">
          <h2 className="text-lg font-military font-bold text-foreground tracking-wide mb-4">
            Dados do Clube
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* memberNumber */}
            <div>
              <label htmlFor="memberNumber" className={labelClasses}>
                Numero de Associado <span className="text-red-700 dark:text-red-400">*</span>
              </label>
              <Input
                id="memberNumber"
                name="memberNumber"
                placeholder="Ex: 0001"
                value={form.memberNumber}
                onChange={handleChange}
                className={inputClasses}
                required
              />
            </div>

            {/* role */}
            <div>
              <label htmlFor="role" className={labelClasses}>
                Perfil
              </label>
              <select
                id="role"
                name="role"
                value={form.role}
                onChange={handleChange}
                className={selectClasses}
              >
                <option value="ASSOCIATE">Associado</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>

            {/* cr */}
            <div>
              <label htmlFor="cr" className={labelClasses}>
                CR (Certificado de Registro)
              </label>
              <Input
                id="cr"
                name="cr"
                placeholder="Numero do CR"
                value={form.cr}
                onChange={handleChange}
                className={inputClasses}
              />
            </div>

            {/* crLevel */}
            <div>
              <label htmlFor="crLevel" className={labelClasses}>
                Nivel do CR
              </label>
              <select
                id="crLevel"
                name="crLevel"
                value={form.crLevel}
                onChange={handleChange}
                className={selectClasses}
              >
                <option value="">Selecione</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>

            {/* membershipTier */}
            <div>
              <label htmlFor="membershipTier" className={labelClasses}>
                Categoria
              </label>
              <select
                id="membershipTier"
                name="membershipTier"
                value={form.membershipTier}
                onChange={handleChange}
                className={selectClasses}
              >
                <option value="STANDARD">Standard</option>
                <option value="PREMIUM">Premium</option>
                <option value="HONORARY">Honorario</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Section 3: Endereco ───────────────────────────────────────── */}
        <div className="bg-card/50 border border-border rounded-lg p-6">
          <h2 className="text-lg font-military font-bold text-foreground tracking-wide mb-4">
            Endereco
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* address */}
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

            {/* neighborhood */}
            <div>
              <label htmlFor="neighborhood" className={labelClasses}>
                Bairro
              </label>
              <Input
                id="neighborhood"
                name="neighborhood"
                placeholder="Bairro"
                value={form.neighborhood}
                onChange={handleChange}
                className={inputClasses}
              />
            </div>

            {/* city */}
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

            {/* state */}
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

            {/* zipCode */}
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

        {/* ── Section: Dados Civis (Declarações) ───────────────────────── */}
        <div className="bg-card/50 border border-border rounded-lg p-6">
          <h2 className="text-lg font-military font-bold text-foreground tracking-wide mb-1">
            Dados Civis
          </h2>
          <p className="text-xs text-muted-foreground font-tactical mb-4">
            Usados nas declarações oficiais (DGA, DSA, DIC, FILIAÇÃO, etc.). Opcionais, mas recomendados.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rg" className={labelClasses}>RG (Identidade)</label>
              <Input id="rg" name="rg" placeholder="Numero da identidade" value={form.rg} onChange={handleChange} className={inputClasses} />
            </div>
            <div>
              <label htmlFor="rgIssuer" className={labelClasses}>Órgão Emissor</label>
              <Input id="rgIssuer" name="rgIssuer" placeholder="Ex: SSP/BA" value={form.rgIssuer} onChange={handleChange} className={inputClasses} />
            </div>
            <div>
              <label htmlFor="nationality" className={labelClasses}>Nacionalidade</label>
              <Input id="nationality" name="nationality" placeholder="Ex: BRASILEIRA" value={form.nationality} onChange={handleChange} className={inputClasses} />
            </div>
            <div>
              <label htmlFor="naturality" className={labelClasses}>Naturalidade (cidade natal)</label>
              <Input id="naturality" name="naturality" placeholder="Cidade onde nasceu" value={form.naturality} onChange={handleChange} className={inputClasses} />
            </div>
            <div>
              <label htmlFor="fatherName" className={labelClasses}>Nome do Pai</label>
              <Input id="fatherName" name="fatherName" placeholder="Nome completo" value={form.fatherName} onChange={handleChange} className={inputClasses} />
            </div>
            <div>
              <label htmlFor="motherName" className={labelClasses}>Nome da Mãe</label>
              <Input id="motherName" name="motherName" placeholder="Nome completo" value={form.motherName} onChange={handleChange} className={inputClasses} />
            </div>
            <div>
              <label htmlFor="profession" className={labelClasses}>Profissão</label>
              <Input id="profession" name="profession" placeholder="Ex: Empresário" value={form.profession} onChange={handleChange} className={inputClasses} />
            </div>
            <div>
              <label htmlFor="maritalStatus" className={labelClasses}>Estado Civil</label>
              <select id="maritalStatus" name="maritalStatus" value={form.maritalStatus} onChange={handleChange} className={selectClasses}>
                <option value="">Selecione</option>
                <option value="SOLTEIRO">Solteiro(a)</option>
                <option value="CASADO">Casado(a)</option>
                <option value="DIVORCIADO">Divorciado(a)</option>
                <option value="VIUVO">Viúvo(a)</option>
                <option value="UNIAO_ESTAVEL">União estável</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Section 4: Anexos ──────────────────────────────────────── */}
        <div className="bg-card/50 border border-border rounded-lg p-6">
          <h2 className="text-lg font-military font-bold text-foreground tracking-wide mb-4">Anexos</h2>

          <input
            type="file"
            id="file-upload"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            className="hidden"
            onChange={(e) => {
              const selectedFiles = Array.from(e.target.files || []);
              selectedFiles.forEach(file => {
                if (file.size > 5 * 1024 * 1024) {
                  toast({ title: 'Arquivo muito grande', description: 'Maximo 5MB por arquivo', variant: 'destructive' });
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  setFiles(prev => [...prev, {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: reader.result as string,
                  }]);
                };
                reader.readAsDataURL(file);
              });
              e.target.value = '';
            }}
          />

          <label htmlFor="file-upload" className="flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/40 p-8 cursor-pointer hover:border-cbt-orange/50 transition-colors">
            <div className="text-center">
              <Upload className="mx-auto h-10 w-10 text-muted-foreground/80 mb-3" />
              <p className="text-sm font-tactical text-muted-foreground">Clique para selecionar arquivos</p>
              <p className="text-xs font-tactical text-muted-foreground/60 mt-1">PDF, JPG, PNG (max 5MB)</p>
            </div>
          </label>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-muted border border-border rounded-lg px-4 py-2">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-cbt-orange" />
                    <div>
                      <p className="text-foreground font-tactical text-sm">{f.name}</p>
                      <p className="text-muted-foreground/80 font-tactical text-xs">{(f.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-700 dark:text-red-400">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/associados')}
            className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Cadastrar Associado
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default MemberCreatePage;
