import { useState } from 'react';
import { Shield, User, Download, RefreshCw } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

import { Button } from '@/components/ui/button';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { maskCpf, formatDate } from '@/lib/formatters';

const MembershipCardPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isGenerating, setIsGenerating] = useState(false);

  const isActive = user?.status === 'ACTIVE';

  const handleDownload = () => {
    toast({
      title: 'Em breve',
      description: 'O download em PDF estara disponivel em breve.',
    });
  };

  const handleGenerate = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      await api.post(`/api/documents/generate/membership-card/${user.id}`);
      toast({
        title: 'Carteirinha gerada',
        description: 'Sua nova carteirinha digital foi gerada com sucesso.',
      });
    } catch {
      toast({
        title: 'Erro ao gerar carteirinha',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!user) {
    return (
      <div>
        <PageHeader title="Carteira de Associado" description="Sua carteirinha digital do CBT" />
        <LoadingSpinner message="Carregando dados..." />
      </div>
    );
  }

  // ── QR Code placeholder ────────────────────────────────────────────────
  const QrPlaceholder = () => (
    <div className="w-20 h-20 bg-white rounded p-1">
      <div className="w-full h-full grid grid-cols-7 grid-rows-7 gap-px">
        {Array.from({ length: 49 }).map((_, i) => {
          const row = Math.floor(i / 7);
          const col = i % 7;
          // Corner patterns for QR look
          const isCorner =
            (row < 3 && col < 3) ||
            (row < 3 && col > 3) ||
            (row > 3 && col < 3);
          const isFilled = isCorner
            ? (row === 1 && col === 1) || (row === 1 && col === 5) || (row === 5 && col === 1) || row === 0 || col === 0 || row === 2 || col === 2 || col === 4 || col === 6 || row === 4 || row === 6
            : Math.random() > 0.45;
          return (
            <div
              key={i}
              className={`${isFilled ? 'bg-gray-900' : 'bg-white'}`}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Carteira de Associado"
        description="Sua carteirinha digital do CBT"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
            <Button
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Gerar Nova Carteirinha
            </Button>
          </div>
        }
      />

      {/* Card container */}
      <div className="flex justify-center">
        <div className="w-full max-w-lg">
          {/* Physical card simulation */}
          <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-gray-700 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
            {/* Metallic texture overlay */}
            <div className="absolute inset-0 opacity-5 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(255,255,255,0.03)_2px,rgba(255,255,255,0.03)_4px)]" />

            {/* Top accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-cbt-orange via-cbt-orange/80 to-cbt-orange" />

            {/* Card content */}
            <div className="relative p-6">
              {/* Header: Logo + Club name */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-cbt-orange/20 border border-cbt-orange/40 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-cbt-orange" />
                  </div>
                  <div>
                    <p className="text-xs font-tactical text-cbt-orange tracking-[0.2em] uppercase font-semibold">
                      Clube Baiano de Tiro
                    </p>
                    <p className="text-[10px] font-tactical text-gray-500 tracking-wider uppercase">
                      Associacao Desportiva
                    </p>
                  </div>
                </div>
                {/* Status badge */}
                <div
                  className={`px-3 py-1 rounded-full text-[10px] font-tactical font-bold tracking-wider uppercase ${
                    isActive
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                >
                  {isActive ? 'ATIVO' : 'INATIVO'}
                </div>
              </div>

              {/* Photo + Name section */}
              <div className="flex items-center gap-5 mb-6">
                {/* Photo */}
                <div className="flex-shrink-0">
                  {user.photoUrl ? (
                    <img
                      src={user.photoUrl}
                      alt={user.fullName}
                      className="h-24 w-20 rounded-lg object-cover border-2 border-gray-600"
                    />
                  ) : (
                    <div className="h-24 w-20 rounded-lg bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
                      <User className="h-10 w-10 text-gray-500" />
                    </div>
                  )}
                </div>

                {/* Name + QR */}
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-military font-bold text-white tracking-wide leading-tight truncate">
                    {user.fullName}
                  </p>
                  <p className="text-xs font-tactical text-gray-400 mt-1">Associado</p>
                </div>

                <div className="flex-shrink-0 hidden sm:block">
                  <QrPlaceholder />
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent mb-5" />

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoField label="N. Associado" value={user.memberNumber || '—'} />
                <InfoField label="CPF" value={user.cpf ? maskCpf(user.cpf) : '—'} />
                <InfoField label="CR" value={user.cr || '—'} />
                <InfoField
                  label="Nivel"
                  value={user.crLevel ? `Nivel ${user.crLevel}` : '—'}
                />
                <InfoField
                  label="Filiado desde"
                  value={user.memberSince ? formatDate(user.memberSince) : '—'}
                />
                <InfoField
                  label="Validade Anuidade"
                  value={user.annuityValidUntil ? formatDate(user.annuityValidUntil) : '—'}
                  highlight
                />
              </div>

              {/* QR Code mobile fallback */}
              <div className="flex sm:hidden justify-center mt-5">
                <QrPlaceholder />
              </div>
            </div>

            {/* Bottom accent bar */}
            <div className="h-1 bg-gradient-to-r from-cbt-orange/60 via-cbt-orange/30 to-cbt-orange/60" />
          </div>

          {/* Card shadow glow */}
          <div className="h-4 mx-8 bg-cbt-orange/5 blur-xl rounded-full -mt-2" />
        </div>
      </div>
    </div>
  );
};

// ── Sub-component: Info Field ──────────────────────────────────────────────
const InfoField = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div>
    <p className="text-[10px] font-tactical text-gray-500 uppercase tracking-wider mb-0.5">
      {label}
    </p>
    <p
      className={`text-sm font-tactical font-medium ${
        highlight ? 'text-cbt-orange' : 'text-gray-200'
      }`}
    >
      {value}
    </p>
  </div>
);

export default MembershipCardPage;
