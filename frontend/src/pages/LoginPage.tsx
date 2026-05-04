import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import CbtLogo from '@/components/shared/CbtLogo';

const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated, user } = useAuth();

  // Redirect if already authenticated
  if (isAuthenticated && user) {
    const target = user.role === 'admin' ? '/admin' : '/portal';
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password.trim()) {
      setError('Preencha todos os campos.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(identifier.trim(), password);
    setIsSubmitting(false);

    if (result.success) {
      // AuthContext already has updated user, re-render will trigger redirect above
    } else {
      setError(result.error || 'Erro ao fazer login.');
    }
  };

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
          <div className="text-center mb-8">
            <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
              <CbtLogo className="w-full h-full" />
            </div>
            <h1 className="text-2xl font-military font-bold text-foreground tracking-wider">
              CLUBE BAIANO DE TIRO
            </h1>
            <p className="text-cbt-orange font-tactical text-sm mt-1 tracking-widest">
              PORTAL DO ASSOCIADO
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-tactical text-foreground/85 mb-2">
                CPF ou E-mail
              </label>
              <Input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Digite seu CPF ou e-mail"
                className="bg-muted border-input text-foreground placeholder:text-muted-foreground/60 focus:border-cbt-orange focus:ring-cbt-orange/20 h-12 font-tactical"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-tactical text-foreground/85 mb-2">
                Senha
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
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
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'ENTRAR'
              )}
            </Button>
          </form>

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

        {/* Test credentials hint (dev only) */}
        {import.meta.env.DEV && (
          <div className="mt-4 bg-card/50 border border-border rounded-lg p-4 text-xs font-tactical text-muted-foreground/80">
            <p className="text-cbt-orange font-bold mb-2">Credenciais de teste:</p>
            <p>Admin: admin@cbt.com.br / admin123</p>
            <p>Associado: associado@cbt.com.br / associado123</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
