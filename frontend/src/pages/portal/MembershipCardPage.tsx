import { useRef, useState } from 'react';
import { User, Download, RefreshCw, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import CbtLogo from '@/components/shared/CbtLogo';

import { Button } from '@/components/ui/button';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { maskCpf, formatDate } from '@/lib/formatters';

const MembershipCardPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const isActive = user?.status === 'ACTIVE';

  const handleDownload = async () => {
    if (!cardRef.current || !user) return;
    setIsDownloading(true);
    try {
      // Captura a carteira em alta resolucao para impressao nitida.
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0b0b0b',
        scale: 3,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const cardW = canvas.width;
      const cardH = canvas.height;

      // PDF A4 paisagem; encaixa a carteira centralizada com margem visual.
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;

      const ratio = cardW / cardH;
      let drawW = maxW;
      let drawH = drawW / ratio;
      if (drawH > maxH) {
        drawH = maxH;
        drawW = drawH * ratio;
      }
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;

      // Fundo preto do PDF para combinar com o tema da carteira.
      pdf.setFillColor(11, 11, 11);
      pdf.rect(0, 0, pageW, pageH, 'F');
      pdf.addImage(imgData, 'PNG', x, y, drawW, drawH);

      const filename = `carteirinha-${user.memberNumber || 'cbt'}.pdf`;
      pdf.save(filename);

      toast({ title: 'PDF gerado', description: `Salvo como ${filename}` });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar PDF',
        description: 'Tente novamente em instantes.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleGenerate = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      await api.post(`/api/documents/generate/membership-card/${user.id}`);
      toast({
        title: 'Carteirinha registrada',
        description: 'Uma copia digital foi adicionada aos seus documentos.',
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

  // QR codifica dados publicos para validacao manual no balcao (numero + CPF mascarado).
  const qrPayload = JSON.stringify({
    cbt: 'membership',
    n: user.memberNumber,
    cpf: user.cpf ? maskCpf(user.cpf) : null,
    name: user.fullName,
    valid: user.annuityValidUntil ?? null,
  });

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
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
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
        <div className="w-full max-w-xl">
          {/* Card capturavel pelo PDF */}
          <div
            ref={cardRef}
            className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/60"
            style={{
              background:
                'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 40%, #0a0a0a 100%)',
              border: '1px solid rgba(255, 140, 0, 0.25)',
            }}
          >
            {/* Hairline metalico decorativo */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.06] pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, transparent 0, transparent 3px, rgba(255,255,255,0.6) 3px, rgba(255,255,255,0.6) 4px)',
              }}
            />
            {/* Halo laranja superior */}
            <div
              aria-hidden
              className="absolute -top-24 -right-24 w-64 h-64 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgba(255,140,0,0.18) 0%, transparent 70%)',
              }}
            />

            {/* Faixa superior */}
            <div className="h-1.5 bg-gradient-to-r from-cbt-orange via-amber-500 to-cbt-orange" />

            <div className="relative px-6 pt-5 pb-6">
              {/* Header com logo + nome do clube + status */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 flex items-center justify-center bg-black/40 rounded-lg p-1.5 border border-cbt-orange/30">
                    <CbtLogo className="h-full w-full" />
                  </div>
                  <div>
                    <p className="text-[11px] font-tactical text-cbt-orange tracking-[0.25em] uppercase font-semibold">
                      Clube Baiano de Tiro
                    </p>
                    <p className="text-[9px] font-tactical text-gray-500 tracking-[0.18em] uppercase">
                      Associacao Desportiva · Salvador / BA
                    </p>
                  </div>
                </div>
                <div
                  className={`px-2.5 py-1 rounded-full text-[10px] font-tactical font-bold tracking-wider uppercase ${
                    isActive
                      ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                  }`}
                >
                  {isActive ? 'ATIVO' : 'INATIVO'}
                </div>
              </div>

              {/* Foto + dados centrais + QR */}
              <div className="flex items-start gap-4 mb-5">
                {/* Foto */}
                <div className="flex-shrink-0">
                  {user.photoUrl ? (
                    <img
                      src={user.photoUrl}
                      alt={user.fullName}
                      crossOrigin="anonymous"
                      className="h-28 w-22 rounded-md object-cover border-2 border-cbt-orange/40 shadow-lg shadow-cbt-orange/10"
                      style={{ width: 88, height: 112 }}
                    />
                  ) : (
                    <div
                      className="rounded-md bg-gray-800 border-2 border-cbt-orange/30 flex items-center justify-center"
                      style={{ width: 88, height: 112 }}
                    >
                      <User className="h-10 w-10 text-gray-500" />
                    </div>
                  )}
                </div>

                {/* Nome + matricula + CR */}
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-[10px] font-tactical text-gray-500 tracking-[0.2em] uppercase">
                    Associado
                  </p>
                  <p
                    className="text-lg font-military font-bold text-white tracking-wide leading-tight mt-0.5 break-words"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {user.fullName}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    <div>
                      <p className="text-[9px] font-tactical text-gray-500 uppercase tracking-wider">
                        Nº Matricula
                      </p>
                      <p className="text-sm font-tactical font-semibold text-cbt-orange">
                        {user.memberNumber || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-tactical text-gray-500 uppercase tracking-wider">
                        Filiado desde
                      </p>
                      <p className="text-sm font-tactical text-gray-200">
                        {user.memberSince ? formatDate(user.memberSince) : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* QR Code real */}
                <div className="flex-shrink-0 bg-white p-1.5 rounded-md hidden sm:block">
                  <QRCodeSVG
                    value={qrPayload}
                    size={84}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
              </div>

              {/* Divider sutil */}
              <div className="h-px bg-gradient-to-r from-transparent via-cbt-orange/30 to-transparent mb-4" />

              {/* Grid de dados */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoField label="CPF" value={user.cpf ? maskCpf(user.cpf) : '—'} />
                <InfoField
                  label="CR (Certificado de Registro)"
                  value={user.cr || '—'}
                />
                <InfoField
                  label="Nivel CR"
                  value={user.crLevel ? `Nivel ${user.crLevel}` : '—'}
                />
                <InfoField
                  label="Validade da Anuidade"
                  value={user.annuityValidUntil ? formatDate(user.annuityValidUntil) : '—'}
                  highlight
                />
              </div>

              {/* QR fallback mobile */}
              <div className="flex sm:hidden justify-center mt-5">
                <div className="bg-white p-1.5 rounded-md">
                  <QRCodeSVG value={qrPayload} size={96} level="M" bgColor="#ffffff" fgColor="#000000" />
                </div>
              </div>

              {/* Footer institucional */}
              <div className="mt-5 pt-3 border-t border-gray-800 flex items-center justify-between">
                <p className="text-[9px] font-tactical text-gray-600 tracking-[0.18em] uppercase">
                  Documento de identificacao do clube
                </p>
                <p className="text-[9px] font-tactical text-gray-600 tracking-wider">
                  cbt.com.br
                </p>
              </div>
            </div>

            {/* Faixa inferior */}
            <div className="h-1 bg-gradient-to-r from-cbt-orange/60 via-amber-500/40 to-cbt-orange/60" />
          </div>

          {/* Sombra/halo abaixo */}
          <div
            aria-hidden
            className="h-6 mx-12 -mt-3 rounded-full blur-2xl"
            style={{ background: 'rgba(255,140,0,0.14)' }}
          />

          {/* Aviso pequeno abaixo do card */}
          <p className="text-center text-xs font-tactical text-gray-500 mt-6">
            Apresente esta carteirinha (digital ou impressa) na entrada do clube.
            O QR Code permite validacao rapida no balcao.
          </p>
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
    <p className="text-[9px] font-tactical text-gray-500 uppercase tracking-[0.18em] mb-0.5">
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
