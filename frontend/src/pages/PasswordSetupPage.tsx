import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { finalizeFirstAccess } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Eye, EyeOff, ShieldCheck, KeyRound, CheckCircle2 } from 'lucide-react';
import CbtLogo from '@/components/shared/CbtLogo';

// =====================================================
// PasswordSetupPage — tela de "primeiro acesso"
// =====================================================
// Renderizada quando user.mustChangePassword === true. Forca o usuario a
// escolher uma das duas opcoes antes de seguir para o portal:
//   1. Definir nova senha (>= 6 chars)
//   2. Manter o CPF como senha (decisao consciente, registrada em audit)
//
// Apos qualquer decisao, refreshUser() pega o novo estado do backend
// (mustChangePassword=false) e os route guards passam a deixar o usuario
// navegar normalmente.
// =====================================================

const PasswordSetupPage = () => {
  const { user, refreshUser, isAuthenticated } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState<'change' | 'keep' | null>(null);
  const [error, setError] = useState('');

  // Sem auth -> manda pro login. Se ja concluiu o fluxo, manda pra home.
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) {
    const target =
      user.role === 'admin' ? '/admin' :
      user.role === 'cashier' ? '/admin/caixa' :
      '/portal';
    return <Navigate to={target} replace />;
  }

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('A senha deve ter no minimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas nao conferem.');
      return;
    }

    setSubmitting('change');
    const result = await finalizeFirstAccess({ action: 'change', newPassword });
    if (!result.success) {
      setError(result.error || 'Erro ao definir nova senha.');
      setSubmitting(null);
      return;
    }
    await refreshUser();
    // refreshUser atualiza user.mustChangePassword=false e o Navigate
    // do inicio do componente redireciona para a home do role.
    setSubmitting(null);
  };

  const handleKeepCpf = async () => {
    setError('');
    setSubmitting('keep');
    const result = await finalizeFirstAccess({ action: 'keep' });
    if (!result.success) {
      setError(result.error || 'Erro ao concluir.');
      setSubmitting(null);
      return;
    }
    await refreshUser();
    setSubmitting(null);
  };

  const isBusy = submitting !== null;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900" />
      <div className="absolute top-20 right-20 w-72 h-72 bg-cbt-orange/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-cbt-orange/3 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-card/80 border border-border rounded-2xl p-8 backdrop-blur-sm tactical-shadow">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <CbtLogo className="w-full h-full" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cbt-orange/10 border border-cbt-orange/30 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-cbt-orange" />
              <span className="text-cbt-orange font-tactical text-[11px] uppercase tracking-wider font-bold">
                Primeiro Acesso
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-military font-bold text-foreground tracking-wide">
              Olá, {user.fullName.split(' ')[0]}
            </h1>
            <p className="text-muted-foreground font-tactical text-sm mt-2 leading-relaxed">
              Sua senha atual é o seu CPF. Por segurança, recomendamos definir uma senha pessoal.
              Você também pode manter o CPF como senha se preferir.
            </p>
          </div>

          {/* Form: nova senha */}
          <form onSubmit={handleSetNewPassword} className="space-y-4" noValidate>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-tactical text-foreground/85 mb-2">
                Nova senha (mínimo 6 caracteres)
              </label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); if (error) setError(''); }}
                  placeholder="Defina sua nova senha"
                  className="bg-muted border-input text-foreground placeholder:text-muted-foreground/60 focus:border-cbt-orange focus:ring-cbt-orange/20 h-11 font-tactical pr-12"
                  disabled={isBusy}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-tactical text-foreground/85 mb-2">
                Confirme a nova senha
              </label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(''); }}
                placeholder="Repita a senha"
                className="bg-muted border-input text-foreground placeholder:text-muted-foreground/60 focus:border-cbt-orange focus:ring-cbt-orange/20 h-11 font-tactical"
                disabled={isBusy}
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm font-tactical">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isBusy}
              className="w-full h-11 bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold tracking-wide glow-orange transition-all"
            >
              {submitting === 'change' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Definir nova senha
                </>
              )}
            </Button>
          </form>

          {/* Separador */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground/70 font-tactical text-[10px] uppercase tracking-widest">
              ou
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Opcao: manter CPF como senha */}
          <button
            type="button"
            onClick={handleKeepCpf}
            disabled={isBusy}
            className="w-full h-11 rounded-md border border-border bg-card hover:bg-muted/40 hover:border-cbt-orange/50 text-foreground/85 font-tactical text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting === 'keep' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-cbt-orange" />
                Manter meu CPF como senha
              </>
            )}
          </button>

          <p className="mt-5 text-center text-muted-foreground/70 font-tactical text-xs leading-relaxed">
            Você pode trocar a senha a qualquer momento pelo seu perfil.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PasswordSetupPage;
