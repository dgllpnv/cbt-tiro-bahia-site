import { useState, useEffect, useCallback } from 'react';
import {
  User as UserIcon,
  Mail,
  Phone,
  CreditCard,
  Shield,
  Calendar,
  MapPin,
  Lock,
  FileText,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { formatDate, maskCpf } from '@/lib/formatters';
import type { UserAttachment } from '@/types/user';

// ── Component ─────────────────────────────────────────────────────────────────

const ProfilePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Attachments
  const [attachments, setAttachments] = useState<UserAttachment[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(true);

  // Change password dialog
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // ── Annuity helpers ────────────────────────────────────────────────────────
  const getDaysRemaining = useCallback(() => {
    if (!user?.annuityValidUntil) return -1;
    const now = new Date();
    const valid = new Date(user.annuityValidUntil);
    return Math.ceil((valid.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, [user]);

  const getAnnuityStatus = () => {
    const days = getDaysRemaining();
    if (days < 0) return { label: 'VENCIDA', color: 'bg-red-500/20 text-red-400 border-red-500/30', borderColor: 'border-red-500/40' };
    if (days <= 30) return { label: 'VENCENDO', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', borderColor: 'border-yellow-500/40' };
    return { label: 'ATIVA', color: 'bg-green-500/20 text-green-400 border-green-500/30', borderColor: 'border-green-500/40' };
  };

  // ── Fetch attachments ──────────────────────────────────────────────────────
  const fetchAttachments = useCallback(async () => {
    if (!user) return;
    setIsLoadingAttachments(true);
    try {
      const res = await api.get(`/api/users/${user.id}`);
      const data = res.data;
      const userData = data.data || data;
      setAttachments(userData.attachments || []);
    } catch {
      setAttachments([]);
    } finally {
      setIsLoadingAttachments(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // ── Change password ────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      toast({ title: 'Nova senha e obrigatoria', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'A nova senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'As senhas nao coincidem', variant: 'destructive' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.put('/api/auth/change-password', {
        oldPassword: currentPassword,
        newPassword,
      });
      toast({ title: 'Senha alterada com sucesso' });
      setPasswordDialogOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast({
        title: 'Erro ao alterar senha',
        description: 'Verifique a senha atual e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // ── Profile info row helper ────────────────────────────────────────────────
  const InfoRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) => (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <Icon className="h-4 w-4 text-cbt-orange mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-tactical text-muted-foreground/80 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-tactical text-foreground mt-0.5">{value || '---'}</p>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div>
        <PageHeader title="Meu Perfil" description="Seus dados pessoais" />
        <LoadingSpinner message="Carregando perfil..." />
      </div>
    );
  }

  const annuityStatus = getAnnuityStatus();
  const daysRemaining = getDaysRemaining();

  return (
    <div>
      <PageHeader
        title="Meu Perfil"
        description="Seus dados pessoais"
        actions={
          <Button
            className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
            onClick={() => setPasswordDialogOpen(true)}
          >
            <Lock className="h-4 w-4 mr-2" />
            Alterar Senha
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main profile card ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-card/50 border border-border rounded-lg p-6">
          {/* Photo + name header */}
          <div className="flex items-center gap-5 mb-6 pb-6 border-b border-border">
            <div className="h-20 w-20 rounded-full bg-muted border-2 border-cbt-orange/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {user.photoUrl ? (
                <img src={user.photoUrl} alt={user.fullName} className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-10 w-10 text-muted-foreground/80" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-military font-bold text-foreground tracking-wide">
                {user.fullName}
              </h2>
              <p className="text-muted-foreground font-tactical text-sm mt-0.5">
                Associado #{user.memberNumber}
              </p>
              <Badge variant="outline" className="mt-2 bg-cbt-orange/10 text-cbt-orange border-cbt-orange/30 text-xs font-tactical">
                {user.role === 'admin' ? 'Administrador' : 'Associado'}
              </Badge>
            </div>
          </div>

          {/* Info rows */}
          <div className="space-y-0">
            <InfoRow icon={Mail} label="E-mail" value={user.email} />
            <InfoRow icon={CreditCard} label="CPF" value={user.cpf ? maskCpf(user.cpf) : undefined} />
            <InfoRow icon={Phone} label="Telefone" value={user.phone} />
            <InfoRow icon={Shield} label="Numero de Socio" value={user.memberNumber} />
            <InfoRow icon={Shield} label="CR" value={user.cr} />
            <InfoRow
              icon={Shield}
              label="Nivel do CR"
              value={user.crLevel != null ? String(user.crLevel) : undefined}
            />
            <InfoRow
              icon={Calendar}
              label="Membro desde"
              value={user.memberSince ? formatDate(user.memberSince) : undefined}
            />
          </div>
        </div>

        {/* ── Sidebar cards ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Annuity status card */}
          <div className={`bg-card/50 border rounded-lg p-5 ${annuityStatus.borderColor}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-cbt-orange" />
                <span className="text-muted-foreground font-tactical text-sm font-semibold uppercase tracking-wide">
                  Anuidade
                </span>
              </div>
              <Badge variant="outline" className={`text-[10px] font-tactical ${annuityStatus.color}`}>
                {annuityStatus.label}
              </Badge>
            </div>
            <p className="text-lg font-military font-bold text-foreground">
              {user.annuityValidUntil ? formatDate(user.annuityValidUntil) : '---'}
            </p>
            {daysRemaining >= 0 ? (
              <p className="text-xs font-tactical text-muted-foreground mt-1">
                {daysRemaining} dias restantes
              </p>
            ) : (
              <p className="text-xs font-tactical text-red-400 mt-1">
                Anuidade vencida
              </p>
            )}
          </div>

          {/* Attachments card */}
          <div className="bg-card/50 border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-cbt-orange" />
              <span className="text-muted-foreground font-tactical text-sm font-semibold uppercase tracking-wide">
                Meus Anexos
              </span>
            </div>

            {isLoadingAttachments ? (
              <LoadingSpinner message="Carregando anexos..." />
            ) : attachments.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-6 h-6 text-muted-foreground/80" />}
                title="Nenhum anexo"
                description="Nenhum documento anexado ao seu perfil."
              />
            ) : (
              <div className="space-y-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 py-2 px-3 bg-muted/50 rounded-md border border-border/50"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-tactical text-foreground truncate">{att.fileName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-tactical text-muted-foreground/80 uppercase">
                          {att.fileType}
                        </span>
                        <span className="text-[10px] font-tactical text-muted-foreground/80">
                          {formatDate(att.uploadedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Change Password Dialog ────────────────────────────────────────── */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground font-military tracking-wide">
              Alterar Senha
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-tactical text-sm">
              Informe a senha atual e a nova senha desejada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Current password */}
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Senha Atual</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Senha atual"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 hover:text-foreground/85"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha (min. 6 caracteres)"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 hover:text-foreground/85"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="space-y-2">
              <Label className="text-foreground/85 font-tactical text-sm">Confirmar Nova Senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground/80 focus:border-cbt-orange"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-400 font-tactical">As senhas nao coincidem</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPasswordDialogOpen(false)}
              disabled={isChangingPassword}
              className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical min-w-[120px]"
            >
              {isChangingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Alterar Senha'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;
