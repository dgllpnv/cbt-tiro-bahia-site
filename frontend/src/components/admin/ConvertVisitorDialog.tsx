import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { Loader2, UserCheck } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  convertVisitorToAssociate,
  type Visitor,
  type ConvertVisitorData,
} from '@/services/visitorsService';
import { getClubSettings } from '@/services/clubSettingsService';

interface ConvertVisitorDialogProps {
  visitor: Visitor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted: () => void;
}

const inputClasses =
  'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-cbt-orange focus:ring-cbt-orange/20';

const selectClasses =
  'w-full rounded-md bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-cbt-orange focus:ring-1 focus:ring-cbt-orange/20';

const labelClasses = 'block text-sm font-tactical text-gray-300 mb-1';

const ConvertVisitorDialog = ({
  visitor,
  open,
  onOpenChange,
  onConverted,
}: ConvertVisitorDialogProps) => {
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();

  const [email, setEmail] = useState(visitor.email ?? '');
  const [password, setPassword] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [referenceYear, setReferenceYear] = useState(currentYear);
  const [notes, setNotes] = useState('');
  const [cr, setCr] = useState('');
  const [crLevel, setCrLevel] = useState('');
  const [membershipTier, setMembershipTier] = useState('STANDARD');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultAnnuityLoaded, setDefaultAnnuityLoaded] = useState(false);

  // Reseta o form e busca o valor sugerido da anuidade quando o dialog abre
  useEffect(() => {
    if (!open) return;

    setEmail(visitor.email ?? '');
    setPassword('');
    setMemberNumber('');
    setReferenceYear(currentYear);
    setNotes('');
    setCr('');
    setCrLevel('');
    setMembershipTier('STANDARD');
    setPaymentMethod('PIX');

    if (!defaultAnnuityLoaded) {
      getClubSettings().then((res) => {
        if (res.success && res.data?.annuityAmount) {
          const num =
            typeof res.data.annuityAmount === 'string'
              ? parseFloat(res.data.annuityAmount)
              : res.data.annuityAmount;
          if (!isNaN(num) && num > 0) {
            setAmount(num.toFixed(2));
          }
        }
        setDefaultAnnuityLoaded(true);
      });
    }
  }, [open, visitor.email, currentYear, defaultAnnuityLoaded]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({ title: 'E-mail e obrigatorio para virar associado', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Senha deve ter no minimo 6 caracteres', variant: 'destructive' });
      return;
    }
    if (!memberNumber.trim()) {
      toast({ title: 'Numero de associado e obrigatorio', variant: 'destructive' });
      return;
    }
    const annuityAmount = parseFloat(amount);
    if (isNaN(annuityAmount) || annuityAmount <= 0) {
      toast({ title: 'Valor da anuidade invalido', variant: 'destructive' });
      return;
    }

    const payload: ConvertVisitorData = {
      email: email.trim().toLowerCase(),
      password,
      memberNumber: memberNumber.trim(),
      annuityAmount,
      annuityPaymentMethod: paymentMethod || null,
      annuityReferenceYear: referenceYear,
      annuityNotes: notes.trim() || null,
      cr: cr.trim() || null,
      crLevel: crLevel ? Number(crLevel) : null,
      membershipTier: membershipTier || 'STANDARD',
    };

    setIsSubmitting(true);
    try {
      const result = await convertVisitorToAssociate(visitor.id, payload);
      if (result.success) {
        toast({
          title: 'Visitante convertido em associado',
          description: `${visitor.fullName} agora e associado nº ${memberNumber.trim()} com anuidade ${referenceYear} paga.`,
        });
        onOpenChange(false);
        onConverted();
      } else {
        toast({
          title: 'Erro ao converter visitante',
          description: result.error || 'Tente novamente.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-cbt-orange" />
            Converter em Associado
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Preencha os dados que faltam para que <strong className="text-white">{visitor.fullName}</strong>{' '}
            (CPF {visitor.cpf}) vire associado. A anuidade sera lancada como pagamento e aparecera no
            financeiro.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* Acesso ao portal */}
          <div className="space-y-3">
            <h3 className="text-sm font-military font-bold text-white tracking-wide uppercase">
              Acesso ao Portal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="conv-email" className={labelClasses}>
                  E-mail <span className="text-red-400">*</span>
                </label>
                <Input
                  id="conv-email"
                  type="email"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  className={inputClasses}
                  required
                />
              </div>
              <div>
                <label htmlFor="conv-password" className={labelClasses}>
                  Senha <span className="text-red-400">*</span>
                </label>
                <Input
                  id="conv-password"
                  type="password"
                  placeholder="Minimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClasses}
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label htmlFor="conv-member-number" className={labelClasses}>
                  Numero de Associado <span className="text-red-400">*</span>
                </label>
                <Input
                  id="conv-member-number"
                  placeholder="Ex: 0042"
                  value={memberNumber}
                  onChange={(e) => setMemberNumber(e.target.value)}
                  className={inputClasses}
                  required
                />
              </div>
              <div>
                <label htmlFor="conv-tier" className={labelClasses}>
                  Categoria
                </label>
                <select
                  id="conv-tier"
                  value={membershipTier}
                  onChange={(e) => setMembershipTier(e.target.value)}
                  className={selectClasses}
                >
                  <option value="STANDARD">Standard</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="HONORARY">Honorario</option>
                </select>
              </div>
            </div>
          </div>

          {/* CR */}
          <div className="space-y-3">
            <h3 className="text-sm font-military font-bold text-white tracking-wide uppercase">
              Certificado de Registro (opcional)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="conv-cr" className={labelClasses}>
                  CR
                </label>
                <Input
                  id="conv-cr"
                  placeholder="Numero do CR"
                  value={cr}
                  onChange={(e) => setCr(e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="conv-cr-level" className={labelClasses}>
                  Nivel do CR
                </label>
                <select
                  id="conv-cr-level"
                  value={crLevel}
                  onChange={(e) => setCrLevel(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Selecione</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div>
            </div>
          </div>

          {/* Anuidade */}
          <div className="space-y-3">
            <h3 className="text-sm font-military font-bold text-cbt-orange tracking-wide uppercase">
              Pagamento da Anuidade
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label htmlFor="conv-amount" className={labelClasses}>
                  Valor (R$) <span className="text-red-400">*</span>
                </label>
                <Input
                  id="conv-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputClasses}
                  required
                />
              </div>
              <div>
                <label htmlFor="conv-year" className={labelClasses}>
                  Ano de Referencia <span className="text-red-400">*</span>
                </label>
                <Input
                  id="conv-year"
                  type="number"
                  min="2000"
                  max="2100"
                  value={referenceYear}
                  onChange={(e) => setReferenceYear(parseInt(e.target.value) || currentYear)}
                  className={inputClasses}
                  required
                />
              </div>
              <div>
                <label htmlFor="conv-payment" className={labelClasses}>
                  Forma de Pagamento
                </label>
                <select
                  id="conv-payment"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={selectClasses}
                >
                  <option value="PIX">PIX</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Debito">Cartao de Debito</option>
                  <option value="Credito">Cartao de Credito</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Transferencia">Transferencia</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="conv-notes" className={labelClasses}>
                Observacoes (opcional)
              </label>
              <Input
                id="conv-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotacoes sobre o pagamento"
                className={inputClasses}
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Convertendo...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                Confirmar Conversao
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConvertVisitorDialog;
