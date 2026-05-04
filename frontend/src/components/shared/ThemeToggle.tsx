import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';

/**
 * Botao Sol/Lua que alterna o tema entre light e dark.
 *
 * - Persiste a escolha no localStorage (gerenciado por next-themes).
 * - Ate o componente montar, renderiza um placeholder neutro para evitar
 *   mismatch entre SSR/CSR (boa pratica recomendada por next-themes).
 */
const ThemeToggle = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Placeholder durante hidratacao para evitar pisca-pisca
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-hidden
        className="h-9 w-9 text-muted-foreground"
      >
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  const current = theme === 'system' ? resolvedTheme : theme;
  const isDark = current === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent/10"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
};

export default ThemeToggle;
