import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Eye, EyeOff, IdCard, ShieldCheck } from 'lucide-react';
import CbtLogo from '@/components/shared/CbtLogo';
import { formatCpfMask, isValidCpf, stripCpf } from '@/lib/cpf';

// =====================================================
// LoginPage com dois modos via abas:
//   - Associado: CPF (mascara + validacao DV) + senha
//   - Admin:     E-mail (admin master ou caixa) + senha
//
// O backend aceita ambos os identificadores no mesmo endpoint
// (OR no findFirst), entao a separacao e puramente de UX/UI.
// Apos o login, AuthContext + LoginPage redirecionam ao "home" do role.
// =====================================================

type LoginMode = 'associate' | 'admin';

const LoginPage = () => {
  const { login, isAuthenticated, user } = useAuth();
  const [mode, setMode] = useState<LoginMode>('associate');

  // Estado por modo — preserva o que voce digitou ao trocar de aba.
  const [cpf, setCpf] = useState('');
  const [cpfError, setCpfError] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redireciona se ja autenticado. Se ainda esta no fluxo de primeiro
  // acesso, manda direto pra tela de definicao de senha.
  if (isAuthenticated && user) {
    if (user.mustChangePassword) {
      return <Navigate to="/primeiro-acesso" replace />;
    }
    const target =
      user.role === 'admin' ? '/admin' :
      user.role === 'cashier' ? '/admin/caixa' :
      '/portal';
    return <Navigate to={target} replace />;
  }

  // ── Handlers do tab Associado (CPF) ────────────────────────────────────
  const handleCpfChange = (raw: string) => {
    setCpf(formatCpfMask(raw));
    if (cpfError) setCpfError('');
    if (error) setError('');
  };

  const handleCpfBlur = () => {
    const digits = stripCpf(cpf);
    if (digits.length === 0) {
      setCpfError('');
      return;
    }
    if (digits.length < 11) {
      setCpfError('CPF incompleto.');
      return;
    }
    if (!isValidCpf(digits)) {
      setCpfError('CPF invalido. Confira os digitos.');
      return;
    }
    setCpfError('');
  };

  // ── Handlers do tab Admin (e-mail) ─────────────────────────────────────
  const handleEmailChange = (v: string) => {
    setEmail(v);
    if (emailError) setEmailError('');
    if (error) setError('');
  };

  const handleEmailBlur = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('E-mail invalido.');
      return;
    }
    setEmailError('');
  };

  const handleModeChange = (next: string) => {
    setMode(next as LoginMode);
    setError('');
    setCpfError('');
    setEmailError('');
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let identifier = '';

    if (mode === 'associate') {
      const digits = stripCpf(cpf);
      if (!digits || !password.trim()) {
        setError('Preencha CPF e senha.');
        return;
      }
      if (!isValidCpf(digits)) {
        setCpfError('CPF invalido. Confira os digitos.');
        return;
      }
      identifier = digits;
    } else {
      const trimmed = email.trim();
      if (!trimmed || !password.trim()) {
        setError('Preencha e-mail e senha.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setEmailError('E-mail invalido.');
        return;
      }
      identifier = trimmed;
    }

    setIsSubmitting(true);
    const result = await login(identifier, password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Erro ao fazer login.');
    }
  };

  const subtitle =
    mode === 'associate' ? 'PORTAL DO ASSOCIADO' : 'AREA ADMINISTRATIVA';

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900" />
      <div className="absolute top-20 right-20 w-72 h-72 bg-cbt-orange/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-cbt-orange/3 rounded-full blur-3xl" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-card/80 border border-border rounded-2xl p-8 backdrop-blur-sm tactical-shadow">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
              <CbtLogo className="w-full h-full" />
            </div>
            <h1 className="text-2xl font-military font-bold text-foreground tracking-wider">
              CLUBE BAIANO DE TIRO
            </h1>
            <p className="text-cbt-orange font-tactical text-sm mt-1 tracking-widest transition-colors duration-300">
              {subtitle}
            </p>
          </div>

          {/* Tabs Associado/Admin */}
          <Tabs value={mode} onValueChange={handleModeChange} className="mb-5">
            <TabsList className="grid grid-cols-2 w-full bg-muted border border-border p-1 h-11">
              <TabsTrigger
                value="associate"
                className="font-tactical tracking-wide data-[state=active]:bg-cbt-orange data-[state=active]:text-black data-[state=active]:shadow-md text-muted-foreground"
              >
                <IdCard className="h-4 w-4 mr-2" />
                Associado
              </TabsTrigger>
              <TabsTrigger
                value="admin"
                className="font-tactical tracking-wide data-[state=active]:bg-cbt-orange data-[state=active]:text-black data-[state=active]:shadow-md text-muted-foreground"
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                Admin
              </TabsTrigger>
            </TabsList>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5 mt-5" noValidate>
              {/* Identifier varia por modo */}
              <TabsContent value="associate" className="m-0">
                <label
                  htmlFor="cpf"
                  className="block text-sm font-tactical text-foreground/85 mb-2"
                >
                  CPF
                </label>
                <Input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  value={cpf}
                  onChange={(e) => handleCpfChange(e.target.value)}
                  onBlur={handleCpfBlur}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  aria-invalid={!!cpfError}
                  aria-describedby={cpfError ? 'cpf-error' : undefined}
                  className={`bg-muted border-input text-foreground placeholder:text-muted-foreground/60 focus:border-cbt-orange focus:ring-cbt-orange/20 h-12 font-tactical tracking-wider ${
                    cpfError ? 'border-red-700/60 focus:border-red-700' : ''
                  }`}
                  disabled={isSubmitting}
                />
                {cpfError && (
                  <p
                    id="cpf-error"
                    className="mt-1.5 text-xs font-tactical text-red-500"
                  >
                    {cpfError}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="admin" className="m-0">
                <label
                  htmlFor="email"
                  className="block text-sm font-tactical text-foreground/85 mb-2"
                >
                  E-mail
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={handleEmailBlur}
                  placeholder="admin@cbt.com.br"
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? 'email-error' : undefined}
                  className={`bg-muted border-input text-foreground placeholder:text-muted-foreground/60 focus:border-cbt-orange focus:ring-cbt-orange/20 h-12 font-tactical ${
                    emailError ? 'border-red-700/60 focus:border-red-700' : ''
                  }`}
                  disabled={isSubmitting}
                />
                {emailError && (
                  <p
                    id="email-error"
                    className="mt-1.5 text-xs font-tactical text-red-500"
                  >
                    {emailError}
                  </p>
                )}
              </TabsContent>

              {/* Senha — mesmo campo nas duas abas */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-tactical text-foreground/85 mb-2"
                >
                  Senha
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="bg-muted border-input text-foreground placeholder:text-muted-foreground/60 focus:border-cbt-orange focus:ring-cbt-orange/20 h-12 font-tactical pr-12"
                    disabled={isSubmitting}
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

              {error && (
                <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm font-tactical">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold text-lg tracking-wide glow-orange transition-all duration-300"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ENTRAR'}
              </Button>
            </form>
          </Tabs>

          {/* Back to site */}
          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-muted-foreground/80 hover:text-cbt-orange font-tactical text-sm transition-colors"
            >
              Voltar ao site
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
