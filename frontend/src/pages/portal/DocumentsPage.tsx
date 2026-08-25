import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus, CreditCard, FileCheck, Loader2, ScrollText } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  getFiliacaoDeclarationData,
  getHabitualityDeclarationData,
} from '@/services/documentsService';
import { buildFiliacaoPdf } from '@/lib/reports/declarations/pdfFiliacao';
import { generateHabitualityPdf } from '@/lib/pdfHabituality';
import { downloadPdfSigned } from '@/lib/reports/_shared/pdfSigning';

// ── Component ─────────────────────────────────────────────────────────────────
// O associado gera as declarações como PDF real no proprio navegador (mesmos
// builders usados pelo admin), buscando os dados em endpoints self-acessiveis.
const DocumentsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isGeneratingFiliation, setIsGeneratingFiliation] = useState(false);
  const [isGeneratingHabituality, setIsGeneratingHabituality] = useState(false);

  const handleGenerateFiliation = async () => {
    if (!user) return;
    setIsGeneratingFiliation(true);
    try {
      const res = await getFiliacaoDeclarationData(user.id);
      if (!res.success) throw new Error(res.error);
      const pdf = await buildFiliacaoPdf(res.data);
      await downloadPdfSigned(pdf, `declaracao-filiacao-${user.memberNumber || 'cbt'}.pdf`);
      toast({ title: 'Declaração de filiação gerada' });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar declaração',
        description: e?.message || 'Tente novamente mais tarde.',
      });
    } finally {
      setIsGeneratingFiliation(false);
    }
  };

  const handleGenerateHabituality = async () => {
    if (!user) return;
    setIsGeneratingHabituality(true);
    try {
      const res = await getHabitualityDeclarationData(user.id);
      if (!res.success) throw new Error(res.error);
      const pdf = await generateHabitualityPdf(res.data);
      await downloadPdfSigned(pdf, `declaracao-habitualidade-${user.memberNumber || 'cbt'}.pdf`);
      toast({ title: 'Declaração de habitualidade gerada' });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar declaração',
        description: e?.message || 'Tente novamente mais tarde.',
      });
    } finally {
      setIsGeneratingHabituality(false);
    }
  };

  return (
    <div>
      <PageHeader title="Meus Documentos" description="Gere suas declarações em PDF" />

      <div className="bg-card/50 border border-border rounded-lg p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FilePlus className="h-5 w-5 text-cbt-orange" />
          <h3 className="text-lg font-military font-bold text-foreground tracking-wide">
            Gerar Documento
          </h3>
        </div>
        <p className="text-sm font-tactical text-muted-foreground mb-4">
          Selecione o documento que deseja baixar em PDF.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground hover:border-blue-500/40 font-tactical justify-start h-auto py-3 px-4"
            onClick={handleGenerateFiliation}
            disabled={isGeneratingFiliation}
          >
            {isGeneratingFiliation ? (
              <Loader2 className="h-4 w-4 mr-3 animate-spin" />
            ) : (
              <FileCheck className="h-4 w-4 mr-3 text-blue-700 dark:text-blue-400" />
            )}
            <div className="text-left">
              <p className="text-sm font-medium">Declaração de Filiação</p>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5">Comprova vinculo com o clube</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground hover:border-green-500/40 font-tactical justify-start h-auto py-3 px-4"
            onClick={handleGenerateHabituality}
            disabled={isGeneratingHabituality}
          >
            {isGeneratingHabituality ? (
              <Loader2 className="h-4 w-4 mr-3 animate-spin" />
            ) : (
              <ScrollText className="h-4 w-4 mr-3 text-green-700 dark:text-green-400" />
            )}
            <div className="text-left">
              <p className="text-sm font-medium">Declaração de Habitualidade</p>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5">Comprova frequencia de treinos</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground hover:border-cbt-orange/40 font-tactical justify-start h-auto py-3 px-4"
            onClick={() => navigate('/portal/carteirinha')}
          >
            <CreditCard className="h-4 w-4 mr-3 text-cbt-orange" />
            <div className="text-left">
              <p className="text-sm font-medium">Carteirinha Digital</p>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5">Visualizar sua carteirinha</p>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DocumentsPage;
