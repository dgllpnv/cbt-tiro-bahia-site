import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileSignature, Loader2, ShieldCheck, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { invalidateSignatureCache } from '@/lib/reports/_shared/pdfSigning';
import {
  getDigitalSignature,
  uploadDigitalSignature,
  removeDigitalSignature,
  type DigitalSignatureMeta,
} from '@/services/clubSettingsService';

// =====================================================
// DigitalSignatureSettings — anexa o certificado digital (.pfx/.p12) do
// responsável legal. A partir do momento em que está configurado, TODOS
// os PDFs oficiais gerados pelo sistema (relatórios + declarações, tanto
// no admin quanto no portal do associado) passam a sair assinados
// digitalmente (PKCS#7/ICP-Brasil real) — ver POST /api/documents/sign.
//
// Titular, emissor e validade são extraídos automaticamente do próprio
// certificado no upload (node-forge, no backend) — não são digitados.
// =====================================================

// Le um arquivo como base64 PURO (sem o prefixo "data:...;base64,").
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

const DAY_MS = 24 * 60 * 60 * 1000;

const DigitalSignatureSettings = () => {
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const [meta, setMeta] = useState<DigitalSignatureMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fetchMeta = useCallback(async () => {
    setLoading(true);
    const res = await getDigitalSignature();
    if (res.success) {
      setMeta(res.data);
    } else {
      toast({ variant: 'destructive', title: 'Erro ao buscar assinatura digital', description: res.error });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  const handleRemove = async () => {
    setRemoving(true);
    const res = await removeDigitalSignature();
    setRemoving(false);
    setConfirmRemoveOpen(false);
    if (res.success) {
      invalidateSignatureCache();
      toast({ title: 'Assinatura digital removida' });
      fetchMeta();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao remover', description: res.error });
    }
  };

  if (!isAdmin) return null;

  const configured = meta?.configured ?? false;
  const validUntilMs = meta?.validUntil ? new Date(meta.validUntil).getTime() : null;
  const daysToExpire = validUntilMs != null ? Math.floor((validUntilMs - Date.now()) / DAY_MS) : null;
  const isExpired = daysToExpire != null && daysToExpire < 0;
  const isExpiringSoon = daysToExpire != null && daysToExpire >= 0 && daysToExpire <= 30;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-tactical text-muted-foreground uppercase tracking-[0.18em]">
        Assinatura Digital
      </h3>

      <div className="bg-card/40 border border-border rounded-lg p-4 space-y-4">
        <p className="text-xs font-tactical text-muted-foreground/80">
          Anexe o certificado digital (.pfx/.p12) do responsável legal. A partir daí, os PDFs oficiais gerados
          pelo sistema (relatórios, declarações e documentos do portal) saem assinados digitalmente — sem
          nenhum custo adicional.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-cbt-orange" />
          </div>
        ) : (
          <>
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                isExpired
                  ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                  : isExpiringSoon
                    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300'
                    : configured
                      ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300'
                      : 'bg-muted border-border text-muted-foreground'
              }`}
            >
              {isExpired || isExpiringSoon ? (
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              ) : configured ? (
                <ShieldCheck className="h-5 w-5 flex-shrink-0" />
              ) : (
                <FileSignature className="h-5 w-5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-tactical font-semibold text-sm">
                  {!configured
                    ? 'Nenhuma assinatura digital configurada'
                    : isExpired
                      ? 'Certificado vencido — PDFs não podem ser assinados'
                      : isExpiringSoon
                        ? `Certificado vence em ${daysToExpire} dia(s)`
                        : 'Assinatura digital configurada — PDFs saem assinados'}
                </p>
                {configured && (
                  <p className="font-tactical text-xs opacity-90 mt-0.5">
                    {meta?.fileName}
                    {meta?.holderName && ` — ${meta.holderName}`}
                    {meta?.validUntil &&
                      ` — válido ${meta.validFrom ? `de ${fmtDate(meta.validFrom)} ` : ''}até ${fmtDate(meta.validUntil)}`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(true)}
                className="bg-muted border-border text-foreground/85 hover:bg-secondary font-tactical"
              >
                <Upload className="h-4 w-4 mr-2" />
                {configured ? 'Substituir certificado' : 'Anexar certificado'}
              </Button>
              {configured && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmRemoveOpen(true)}
                  className="text-muted-foreground hover:text-red-700 dark:hover:text-red-400 font-tactical"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <UploadDigitalSignatureDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUploaded={() => {
          invalidateSignatureCache();
          fetchMeta();
        }}
      />

      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={setConfirmRemoveOpen}
        title="Remover assinatura digital"
        description="O certificado e a senha armazenados serão apagados. Os PDFs voltam a sair sem assinatura até um novo certificado ser anexado."
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={handleRemove}
        isLoading={removing}
      />
    </div>
  );
};

// ── Modal de upload ─────────────────────────────────────────────────────────

interface UploadDigitalSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}

const UploadDigitalSignatureDialog = ({ open, onOpenChange, onUploaded }: UploadDigitalSignatureDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFile(null);
    setPassword('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !saving) resetForm();
    onOpenChange(next);
  };

  const canSubmit = !!file && password.length > 0 && !saving;

  const handleSubmit = async () => {
    if (!file || !canSubmit) return;
    setSaving(true);
    try {
      const fileData = await readFileAsBase64(file);
      const result = await uploadDigitalSignature({ fileName: file.name, fileData, password });
      if (result.success) {
        toast({
          title: 'Assinatura digital anexada',
          description: result.data.holderName ? `Titular: ${result.data.holderName}` : undefined,
        });
        resetForm();
        onOpenChange(false);
        onUploaded();
      } else {
        toast({ variant: 'destructive', title: 'Erro ao anexar', description: result.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao ler o arquivo', description: 'Tente novamente.' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-military">Anexar assinatura digital</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground/85 font-tactical text-xs">Certificado (.pfx ou .p12) *</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pfx,.p12"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm font-tactical text-foreground/85 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-border file:bg-muted file:text-foreground/85 file:font-tactical file:text-xs hover:file:bg-secondary"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground/85 font-tactical text-xs">Senha do certificado *</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha do arquivo .pfx/.p12"
              autoComplete="new-password"
              className="bg-muted border-input text-foreground font-tactical"
            />
            <p className="text-[11px] font-tactical text-muted-foreground/70">
              Armazenada de forma cifrada e nunca é reexibida na tela. Titular e validade são lidos
              automaticamente do certificado — a senha errada é recusada na hora.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
            className="text-foreground/85"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical font-bold min-w-[120px]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DigitalSignatureSettings;
