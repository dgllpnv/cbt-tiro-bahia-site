import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, AlertTriangle, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  getClubSettings,
  getMissingDeclarationFields,
  updateClubSettings,
  type ClubSettings,
  type UpdateClubSettingsData,
} from '@/services/clubSettingsService';

const REQUIRED_LABELS: Record<string, string> = {
  cnpj: 'CNPJ',
  crPj: 'CR PJ',
  addressLine: 'Endereco',
  city: 'Cidade',
  state: 'UF',
  responsibleName: 'Responsavel legal — Nome',
  responsibleRole: 'Responsavel legal — Cargo',
};

// ── Masks ────────────────────────────────────────────────────────────────
function maskCnpj(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}
function maskCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, '$1-$2');
}
function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '');
  }
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '');
}

const ClubLegalSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estado controlado em strings (mascaras lidam bem com string).
  const [form, setForm] = useState<UpdateClubSettingsData>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getClubSettings().then((res) => {
      if (cancelled) return;
      if (res.success) {
        setSettings(res.data);
        setForm({
          clubName: res.data.clubName,
          cnpj: res.data.cnpj,
          crPj: res.data.crPj,
          crPjIssueDate: res.data.crPjIssueDate,
          addressLine: res.data.addressLine,
          city: res.data.city,
          state: res.data.state,
          zipCode: res.data.zipCode,
          phone: res.data.phone,
          email: res.data.email,
          responsibleName: res.data.responsibleName,
          responsibleCpf: res.data.responsibleCpf,
          responsibleRole: res.data.responsibleRole,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar dados do clube',
          description: res.error,
        });
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const update = <K extends keyof UpdateClubSettingsData>(
    key: K,
    value: UpdateClubSettingsData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    // Normaliza strings vazias em null para o backend nao validar regex em vazio
    const payload: UpdateClubSettingsData = Object.fromEntries(
      Object.entries(form).map(([k, v]) => {
        if (typeof v === 'string' && v.trim() === '') return [k, null];
        return [k, v];
      }),
    ) as UpdateClubSettingsData;

    const res = await updateClubSettings(payload);
    setSaving(false);
    if (res.success) {
      setSettings(res.data);
      toast({ title: 'Dados do clube atualizados com sucesso.' });
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: res.error,
      });
    }
  };

  // Selo de prontidao baseado nos dados PERSISTIDOS (nao no form local)
  const missing = getMissingDeclarationFields(settings);
  const ready = missing.length === 0;

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-cbt-orange animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Selo de prontidao */}
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
          ready
            ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300'
            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300'
        }`}
      >
        {ready ? (
          <ShieldCheck className="h-5 w-5 flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-tactical font-semibold text-sm">
            {ready
              ? 'Pronto para emitir Declarações de Habitualidade'
              : `Pendências: ${missing.length} campo(s) obrigatório(s) faltando`}
          </p>
          {!ready && (
            <p className="font-tactical text-xs opacity-90 mt-0.5">
              {missing.map((k) => REQUIRED_LABELS[k] ?? k).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Identificacao */}
      <Section title="Identificação">
        <Field label="Razão Social" required>
          <Input
            value={form.clubName ?? ''}
            onChange={(e) => update('clubName', e.target.value)}
            className="bg-muted border-border text-foreground font-tactical"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="CNPJ" required>
            <Input
              value={form.cnpj ?? ''}
              onChange={(e) => update('cnpj', maskCnpj(e.target.value))}
              placeholder="00.000.000/0001-00"
              className="bg-muted border-border text-foreground font-tactical"
            />
          </Field>
          <Field label="CR PJ no Exército" required>
            <Input
              value={form.crPj ?? ''}
              onChange={(e) => update('crPj', e.target.value)}
              placeholder="CR-PJ-XXXX"
              className="bg-muted border-border text-foreground font-tactical"
            />
          </Field>
        </div>
        <Field label="Validade do CR PJ">
          <Input
            type="date"
            value={form.crPjIssueDate ? form.crPjIssueDate.slice(0, 10) : ''}
            onChange={(e) => update('crPjIssueDate', e.target.value || null)}
            className="bg-muted border-border text-foreground font-tactical"
          />
        </Field>
      </Section>

      {/* Endereco */}
      <Section title="Endereço">
        <Field label="Logradouro / nº / bairro" required>
          <Input
            value={form.addressLine ?? ''}
            onChange={(e) => update('addressLine', e.target.value)}
            className="bg-muted border-border text-foreground font-tactical"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Cidade" required>
            <Input
              value={form.city ?? ''}
              onChange={(e) => update('city', e.target.value)}
              className="bg-muted border-border text-foreground font-tactical"
            />
          </Field>
          <Field label="UF" required>
            <Input
              value={form.state ?? ''}
              onChange={(e) => update('state', e.target.value.toUpperCase().slice(0, 2))}
              maxLength={2}
              className="bg-muted border-border text-foreground font-tactical uppercase"
            />
          </Field>
          <Field label="CEP">
            <Input
              value={form.zipCode ?? ''}
              onChange={(e) => update('zipCode', maskCep(e.target.value))}
              placeholder="00000-000"
              className="bg-muted border-border text-foreground font-tactical"
            />
          </Field>
        </div>
      </Section>

      {/* Contato */}
      <Section title="Contato">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Telefone">
            <Input
              value={form.phone ?? ''}
              onChange={(e) => update('phone', maskPhone(e.target.value))}
              placeholder="(71) 0000-0000"
              className="bg-muted border-border text-foreground font-tactical"
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={form.email ?? ''}
              onChange={(e) => update('email', e.target.value)}
              placeholder="contato@cbt.com.br"
              className="bg-muted border-border text-foreground font-tactical"
            />
          </Field>
        </div>
      </Section>

      {/* Responsavel legal */}
      <Section title="Responsável Legal (assina as declarações)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nome completo" required>
            <Input
              value={form.responsibleName ?? ''}
              onChange={(e) => update('responsibleName', e.target.value)}
              className="bg-muted border-border text-foreground font-tactical"
            />
          </Field>
          <Field label="Cargo" required>
            <Input
              value={form.responsibleRole ?? ''}
              onChange={(e) => update('responsibleRole', e.target.value)}
              placeholder="Diretor Técnico, Presidente..."
              className="bg-muted border-border text-foreground font-tactical"
            />
          </Field>
        </div>
        <Field label="CPF do responsável">
          <Input
            value={form.responsibleCpf ?? ''}
            onChange={(e) => update('responsibleCpf', maskCpf(e.target.value))}
            placeholder="000.000.000-00"
            className="bg-muted border-border text-foreground font-tactical"
          />
        </Field>
      </Section>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-cbt-orange hover:bg-cbt-orange/90 text-primary-foreground font-tactical font-bold min-w-[180px]"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar dados do clube
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h3 className="text-xs font-tactical text-muted-foreground uppercase tracking-[0.18em]">{title}</h3>
    <div className="space-y-3 bg-card/40 border border-border rounded-lg p-4">{children}</div>
  </div>
);

const Field = ({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label className="text-foreground/85 font-tactical text-xs uppercase tracking-wider">
      {label} {required && <span className="text-cbt-orange">*</span>}
    </Label>
    {children}
  </div>
);

export default ClubLegalSettings;
