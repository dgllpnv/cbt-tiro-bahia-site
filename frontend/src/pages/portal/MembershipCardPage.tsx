import { useRef, useState } from 'react';
import { User, Download, RefreshCw, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useTheme } from 'next-themes';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import CbtLogo from '@/components/shared/CbtLogo';

import { Button } from '@/components/ui/button';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { formatCpf, formatDate } from '@/lib/formatters';

const MembershipCardPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, resolvedTheme } = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const isActive = user?.status === 'ACTIVE';
  const isDark = (theme === 'system' ? resolvedTheme : theme) === 'dark';

  // Estilos visuais da carteirinha por tema. Mantem branding laranja em ambos
  // e adapta fundo, sombras, texturas e cores de texto para legibilidade.
  const cardStyles = isDark
    ? {
        background:
          'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 40%, #0a0a0a 100%)',
        border: '1px solid rgba(255, 140, 0, 0.25)',
        shadow: 'shadow-2xl shadow-black/60',
        hatchOpacity: 0.06,
        hatchColor: 'rgba(255,255,255,0.6)',
        haloColor: 'rgba(255,140,0,0.18)',
        logoBoxBg: 'rgba(0,0,0,0.4)',
        logoBoxBorder: 'rgba(255,140,0,0.3)',
        nameColor: '#fafafa',
        labelColor: 'rgba(250,250,250,0.6)',
        valueColor: '#fafafa',
        dividerVia: 'rgba(255,140,0,0.3)',
        footerBorder: 'rgba(255,255,255,0.1)',
        footerColor: 'rgba(250,250,250,0.45)',
        photoBg: '#1a1a1a',
        photoIconColor: 'rgba(250,250,250,0.5)',
        memberSinceColor: '#fafafa',
        pdfBg: '#0b0b0b' as const,
        pdfBgRgb: [11, 11, 11] as [number, number, number],
      }
    : {
        background:
          'linear-gradient(135deg, #ffffff 0%, #fafafa 40%, #f5f5f5 100%)',
        border: '1px solid rgba(255, 140, 0, 0.45)',
        shadow: 'shadow-2xl shadow-black/15',
        hatchOpacity: 0.04,
        hatchColor: 'rgba(0,0,0,0.6)',
        haloColor: 'rgba(255,140,0,0.22)',
        logoBoxBg: 'rgba(255,140,0,0.08)',
        logoBoxBorder: 'rgba(255,140,0,0.4)',
        nameColor: '#0a0a0a',
        labelColor: 'rgba(60,60,60,0.75)',
        valueColor: '#0a0a0a',
        dividerVia: 'rgba(255,140,0,0.45)',
        footerBorder: 'rgba(0,0,0,0.1)',
        footerColor: 'rgba(60,60,60,0.7)',
        photoBg: '#f0f0f0',
        photoIconColor: 'rgba(60,60,60,0.5)',
        memberSinceColor: '#0a0a0a',
        pdfBg: '#fafafa' as const,
        pdfBgRgb: [250, 250, 250] as [number, number, number],
      };

  const handleDownload = async () => {
    if (!cardRef.current || !user) return;
    setIsDownloading(true);
    try {
      // Captura a carteira em alta resolucao para impressao nitida.
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: cardStyles.pdfBg,
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

      // Fundo do PDF combina com o tema da carteira (dark ou light).
      const [r, g, b] = cardStyles.pdfBgRgb;
      pdf.setFillColor(r, g, b);
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

  // QR aponta para a carteirinha do associado. Logado -> abre direto;
  // deslogado -> o ProtectedRoute manda pro login e retorna depois.
  const qrUrl = `${window.location.origin}/portal/carteirinha`;

  // Foto exibida = miniatura do reconhecimento facial cadastrado (base64).
  const facePhoto = user.faceProfiles?.[0]?.thumbnail ?? null;

  return (
    <div>
      <PageHeader
        title="Carteira de Associado"
        description="Sua carteirinha digital do CBT"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground font-tactical"
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
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
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
            className={`relative rounded-2xl overflow-hidden ${cardStyles.shadow}`}
            style={{
              background: cardStyles.background,
              border: cardStyles.border,
            }}
          >
            {/* Hairline metalico decorativo */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                opacity: cardStyles.hatchOpacity,
                backgroundImage: `repeating-linear-gradient(45deg, transparent 0, transparent 3px, ${cardStyles.hatchColor} 3px, ${cardStyles.hatchColor} 4px)`,
              }}
            />
            {/* Halo laranja superior */}
            <div
              aria-hidden
              className="absolute -top-24 -right-24 w-64 h-64 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, ${cardStyles.haloColor} 0%, transparent 70%)`,
              }}
            />

            {/* Faixa superior */}
            <div className="h-1.5 bg-gradient-to-r from-cbt-orange via-amber-500 to-cbt-orange" />

            <div className="relative px-6 pt-5 pb-6">
              {/* Header com logo + nome do clube + status */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="h-12 w-12 flex items-center justify-center rounded-lg p-1.5"
                    style={{
                      backgroundColor: cardStyles.logoBoxBg,
                      border: `1px solid ${cardStyles.logoBoxBorder}`,
                    }}
                  >
                    <CbtLogo className="h-full w-full" />
                  </div>
                  <div>
                    <p className="text-[11px] font-tactical text-cbt-orange tracking-[0.25em] uppercase font-semibold">
                      Clube Baiano de Tiro
                    </p>
                    <p
                      className="text-[9px] font-tactical tracking-[0.18em] uppercase"
                      style={{ color: cardStyles.labelColor }}
                    >
                      Associacao Desportiva · Salvador / BA
                    </p>
                  </div>
                </div>
                <div
                  className={`px-2.5 py-1 rounded-full text-[10px] font-tactical font-bold tracking-wider uppercase ${
                    isActive
                      ? 'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/40'
                      : 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/40'
                  }`}
                >
                  {isActive ? 'ATIVO' : 'INATIVO'}
                </div>
              </div>

              {/* Foto + dados centrais + QR */}
              <div className="flex items-start gap-4 mb-5">
                {/* Foto */}
                <div className="flex-shrink-0">
                  {facePhoto ? (
                    <img
                      src={facePhoto}
                      alt={user.fullName}
                      className="h-28 w-22 rounded-md object-cover border-2 border-cbt-orange/40 shadow-lg shadow-cbt-orange/10"
                      style={{ width: 88, height: 112 }}
                    />
                  ) : (
                    <div
                      className="rounded-md border-2 border-cbt-orange/30 flex items-center justify-center"
                      style={{
                        width: 88,
                        height: 112,
                        backgroundColor: cardStyles.photoBg,
                      }}
                    >
                      <User className="h-10 w-10" style={{ color: cardStyles.photoIconColor }} />
                    </div>
                  )}
                </div>

                {/* Nome + matricula + CR */}
                <div className="flex-1 min-w-0 pt-1">
                  <p
                    className="text-[10px] font-tactical tracking-[0.2em] uppercase"
                    style={{ color: cardStyles.labelColor }}
                  >
                    Associado
                  </p>
                  <p
                    className="text-lg font-military font-bold tracking-wide leading-tight mt-0.5 break-words"
                    style={{ wordBreak: 'break-word', color: cardStyles.nameColor }}
                  >
                    {user.fullName}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    <div>
                      <p
                        className="text-[9px] font-tactical uppercase tracking-wider"
                        style={{ color: cardStyles.labelColor }}
                      >
                        Nº Matricula
                      </p>
                      <p className="text-sm font-tactical font-semibold text-cbt-orange">
                        {user.memberNumber || '—'}
                      </p>
                    </div>
                    <div>
                      <p
                        className="text-[9px] font-tactical uppercase tracking-wider"
                        style={{ color: cardStyles.labelColor }}
                      >
                        Filiado desde
                      </p>
                      <p
                        className="text-sm font-tactical"
                        style={{ color: cardStyles.memberSinceColor }}
                      >
                        {user.memberSince ? formatDate(user.memberSince) : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* QR Code real */}
                <div className="flex-shrink-0 bg-white p-1.5 rounded-md hidden sm:block border border-cbt-orange/30">
                  <QRCodeSVG
                    value={qrUrl}
                    size={84}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
              </div>

              {/* Divider sutil */}
              <div
                className="h-px mb-4"
                style={{
                  background: `linear-gradient(to right, transparent, ${cardStyles.dividerVia}, transparent)`,
                }}
              />

              {/* Grid de dados */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoField
                  label="CPF"
                  value={user.cpf ? formatCpf(user.cpf) : '—'}
                  labelColor={cardStyles.labelColor}
                  valueColor={cardStyles.valueColor}
                />
                <InfoField
                  label="CR (Certificado de Registro)"
                  value={user.cr || '—'}
                  labelColor={cardStyles.labelColor}
                  valueColor={cardStyles.valueColor}
                />
                <InfoField
                  label="Nivel CR"
                  value={user.crLevel ? `Nivel ${user.crLevel}` : '—'}
                  labelColor={cardStyles.labelColor}
                  valueColor={cardStyles.valueColor}
                />
                <InfoField
                  label="Validade da Anuidade"
                  value={user.annuityValidUntil ? formatDate(user.annuityValidUntil) : '—'}
                  highlight
                  labelColor={cardStyles.labelColor}
                  valueColor={cardStyles.valueColor}
                />
              </div>

              {/* QR fallback mobile */}
              <div className="flex sm:hidden justify-center mt-5">
                <div className="bg-white p-1.5 rounded-md border border-cbt-orange/30">
                  <QRCodeSVG value={qrPayload} size={96} level="M" bgColor="#ffffff" fgColor="#000000" />
                </div>
              </div>

              {/* Footer institucional */}
              <div
                className="mt-5 pt-3 flex items-center justify-between"
                style={{ borderTop: `1px solid ${cardStyles.footerBorder}` }}
              >
                <p
                  className="text-[9px] font-tactical tracking-[0.18em] uppercase"
                  style={{ color: cardStyles.footerColor }}
                >
                  Documento de identificacao do clube
                </p>
                <p
                  className="text-[9px] font-tactical tracking-wider"
                  style={{ color: cardStyles.footerColor }}
                >
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
          <p className="text-center text-xs font-tactical text-muted-foreground/80 mt-6">
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
  labelColor,
  valueColor,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  labelColor: string;
  valueColor: string;
}) => (
  <div>
    <p
      className="text-[9px] font-tactical uppercase tracking-[0.18em] mb-0.5"
      style={{ color: labelColor }}
    >
      {label}
    </p>
    <p
      className="text-sm font-tactical font-medium"
      style={{ color: highlight ? '#FF8C00' : valueColor }}
    >
      {value}
    </p>
  </div>
);

export default MembershipCardPage;
