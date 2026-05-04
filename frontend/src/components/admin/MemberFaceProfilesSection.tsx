import { useState, useEffect, useCallback } from 'react';
import { ScanFace, Trash2, Plus, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import {
  listMemberFaceProfiles,
  deleteFaceProfile,
  type FaceProfileSummary,
} from '@/services/faceProfilesService';
import FaceCaptureDialog, { type FaceCaptureTarget } from '@/components/admin/FaceCaptureDialog';
import { formatDateTime } from '@/lib/formatters';

interface MemberFaceProfilesSectionProps {
  memberId: string;
  memberName: string;
}

const sourceLabels: Record<string, string> = {
  CHECK_IN: 'Check-in',
  CHECK_OUT: 'Check-out',
  MANUAL: 'Manual',
};

const MemberFaceProfilesSection = ({ memberId, memberName }: MemberFaceProfilesSectionProps) => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<FaceProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [captureTarget, setCaptureTarget] = useState<FaceCaptureTarget | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    profileId: string;
  }>({ open: false, profileId: '' });
  const [deleting, setDeleting] = useState(false);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    const result = await listMemberFaceProfiles(memberId);
    if (result.success) {
      setProfiles(result.data);
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar perfis faciais',
        description: result.error,
      });
    }
    setLoading(false);
  }, [memberId, toast]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleDelete = (profileId: string) => {
    setConfirmDialog({ open: true, profileId });
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const res = await deleteFaceProfile(confirmDialog.profileId);
    setDeleting(false);
    if (res.success) {
      toast({ title: 'Perfil facial removido' });
      setConfirmDialog({ open: false, profileId: '' });
      fetchProfiles();
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover',
        description: res.error,
      });
    }
  };

  return (
    <div className="bg-card/50 border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-military font-bold text-foreground tracking-wide flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-cbt-orange" />
            Identidade Facial
          </h3>
          <p className="text-xs font-tactical text-muted-foreground/80 mt-1">
            Perfis faciais cadastrados — usados para check-in e validação de habitualidade
          </p>
        </div>
        <Button
          type="button"
          onClick={() =>
            setCaptureTarget({ memberId, memberName, source: 'MANUAL' })
          }
          className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar facial
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-cbt-orange" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground/80 font-tactical text-sm">
          Nenhum perfil facial cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="bg-muted/50 border border-border rounded-lg p-3 flex flex-col gap-2 group hover:border-cbt-orange/40 transition-colors"
            >
              <div className="aspect-square rounded-md overflow-hidden bg-card flex items-center justify-center">
                {p.thumbnail ? (
                  <img src={p.thumbnail} alt="Face" className="w-full h-full object-cover" />
                ) : (
                  <ScanFace className="h-8 w-8 text-muted-foreground/60" />
                )}
              </div>
              <div className="text-xs font-tactical">
                <p className="text-foreground font-semibold truncate">
                  {sourceLabels[p.source] || p.source}
                </p>
                <p className="text-muted-foreground/80 truncate" title={formatDateTime(p.createdAt)}>
                  {formatDateTime(p.createdAt)}
                </p>
                <p className="text-muted-foreground/60 truncate">por {p.capturedBy.fullName}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleDelete(p.id)}
                className="bg-card border-border text-muted-foreground hover:text-red-300 hover:border-red-500/50 hover:bg-red-500/10 font-tactical h-8 w-full"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Remover
              </Button>
            </div>
          ))}
        </div>
      )}

      <FaceCaptureDialog
        open={!!captureTarget}
        onOpenChange={(o) => !o && setCaptureTarget(null)}
        target={captureTarget}
        onCaptured={() => {
          setCaptureTarget(null);
          fetchProfiles();
        }}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title="Remover perfil facial"
        description="Esta ação remove o descriptor e thumbnail. O membro perderá a possibilidade de check-in via Facial até nova captura. Continuar?"
        variant="destructive"
        onConfirm={confirmDelete}
        isLoading={deleting}
      />
    </div>
  );
};

export default MemberFaceProfilesSection;
