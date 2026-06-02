import { useState } from 'react';
import { Download, ShieldAlert, Loader2, FileJson, FileSpreadsheet, Eye, EyeOff } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { exportDatabase, type ExportFormat } from '@/services/exportService';

const ExportPage = () => {
  const { toast } = useToast();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    if (passphrase.length < 8) {
      toast({ variant: 'destructive', title: 'Senha muito curta', description: 'Use no mínimo 8 caracteres.' });
      return;
    }
    if (passphrase !== confirm) {
      toast({ variant: 'destructive', title: 'As senhas não conferem' });
      return;
    }
    setLoading(format);
    const result = await exportDatabase(format, passphrase);
    setLoading(null);
    if (result.success) {
      toast({
        title: 'Backup gerado',
        description: 'O download começou. Guarde a senha — sem ela o arquivo é irrecuperável.',
      });
    } else {
      toast({ variant: 'destructive', title: 'Erro ao exportar', description: result.error });
    }
  };

  const busy = loading !== null;

  return (
    <div>
      <PageHeader
        title="Exportação dos dados"
        description="Backup completo do banco — sempre criptografado com a senha que você definir"
      />

      <div className="max-w-2xl space-y-5">
        {/* Aviso de segurança */}
        <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-4 flex gap-3">
          <ShieldAlert className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-sm font-tactical text-foreground/90 space-y-1">
            <p className="font-semibold text-yellow-300">Arquivo sensível e criptografado</p>
            <p className="text-muted-foreground/90">
              O backup contém todos os dados cadastrais (CPFs, endereços, etc.). Ele é sempre cifrado
              (AES-256) com a senha abaixo. <strong>Guarde a senha</strong>: sem ela o arquivo não pode
              ser aberto nem restaurado. Para descriptografar:{' '}
              <code className="text-cbt-orange">scripts/csv-crypto.ts decrypt &lt;arquivo&gt; &lt;saída&gt;</code>.
            </p>
          </div>
        </div>

        {/* Senha */}
        <div className="bg-card/50 border border-border rounded-lg p-6 space-y-4">
          <div>
            <Label className="font-tactical text-xs text-muted-foreground/90">Senha de criptografia</Label>
            <div className="relative mt-1">
              <Input
                type={showPass ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="bg-muted border-border text-foreground pr-10"
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="font-tactical text-xs text-muted-foreground/90">Confirmar senha</Label>
            <Input
              type={showPass ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a senha"
              className="bg-muted border-border text-foreground mt-1"
              disabled={busy}
            />
          </div>

          {/* Botoes de export */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              onClick={() => handleExport('json')}
              disabled={busy}
              className="flex-1 bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
            >
              {loading === 'json' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4 mr-2" />
              )}
              Exportar JSON (completo)
            </Button>
            <Button
              type="button"
              onClick={() => handleExport('csv')}
              disabled={busy}
              variant="outline"
              className="flex-1 font-tactical"
            >
              {loading === 'csv' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              Exportar CSV (planilhas)
            </Button>
          </div>
          <p className="text-[11px] font-tactical text-muted-foreground/70 flex items-center gap-1">
            <Download className="h-3 w-3" />
            JSON = backup fiel e re-importável · CSV = tabelas legíveis em Excel. Ambos cifrados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExportPage;
