import { ReactNode } from 'react';

/**
 * Wrapper para paginas publicas (site institucional, login).
 *
 * Forca a classe `dark` no escopo, isolando estas paginas do toggle
 * Light/Dark do portal — a identidade visual tatico/militar (texturas
 * metalicas, fundo preto, vibe de clube de tiro) e parte do branding
 * e nao deve mudar.
 */
const PublicLayout = ({ children }: { children: ReactNode }) => (
  <div className="dark min-h-screen bg-background text-foreground">
    {children}
  </div>
);

export default PublicLayout;
