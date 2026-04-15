import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Download,
  FilePlus,
  CreditCard,
  FileCheck,
  Loader2,
  ScrollText,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { formatDate } from '@/lib/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemberDocument {
  id: string;
  documentType: string;
  title: string;
  description?: string;
  generatedAt: string;
  fileUrl?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const getDocumentTypeBadge = (type: string) => {
  const map: Record<string, { label: string; className: string }> = {
    FILIATION: { label: 'Filiacao', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    HABITUALITY: { label: 'Habitualidade', className: 'bg-green-500/15 text-green-400 border-green-500/30' },
    MEMBERSHIP_CARD: { label: 'Carteirinha', className: 'bg-cbt-orange/15 text-cbt-orange border-cbt-orange/30' },
    DECLARATION: { label: 'Declaracao', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  };
  return map[type] || { label: type, className: 'bg-gray-500/15 text-gray-400 border-gray-500/30' };
};

// ── Component ─────────────────────────────────────────────────────────────────

const DocumentsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<MemberDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingFiliation, setIsGeneratingFiliation] = useState(false);
  const [isGeneratingHabituality, setIsGeneratingHabituality] = useState(false);

  // ── Fetch documents ────────────────────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/api/documents/member/${user.id}`);
      const data = res.data;
      setDocuments(Array.isArray(data) ? data : data.data || []);
    } catch {
      setDocuments([]);
      toast({
        title: 'Erro ao carregar documentos',
        description: 'Nao foi possivel carregar seus documentos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ── Generate documents ─────────────────────────────────────────────────────
  const handleGenerateFiliation = async () => {
    if (!user) return;
    setIsGeneratingFiliation(true);
    try {
      await api.post(`/api/documents/generate/filiation/${user.id}`);
      toast({ title: 'Declaracao de filiacao gerada com sucesso' });
      fetchDocuments();
    } catch {
      toast({
        title: 'Erro ao gerar declaracao',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingFiliation(false);
    }
  };

  const handleGenerateHabituality = async () => {
    if (!user) return;
    setIsGeneratingHabituality(true);
    try {
      await api.post(`/api/documents/generate/habituality/${user.id}`);
      toast({ title: 'Declaracao de habitualidade gerada com sucesso' });
      fetchDocuments();
    } catch {
      toast({
        title: 'Erro ao gerar declaracao',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingHabituality(false);
    }
  };

  const handleDownload = (doc: MemberDocument) => {
    if (doc.fileUrl) {
      window.open(doc.fileUrl, '_blank');
    } else {
      toast({
        title: 'Download indisponivel',
        description: 'O arquivo deste documento nao esta disponivel no momento.',
      });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Meus Documentos" description="Declaracoes e documentos emitidos" />

      {/* ── Request document section ─────────────────────────────────────── */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FilePlus className="h-5 w-5 text-cbt-orange" />
          <h3 className="text-lg font-military font-bold text-white tracking-wide">
            Solicitar Documento
          </h3>
        </div>
        <p className="text-sm font-tactical text-gray-400 mb-4">
          Selecione o tipo de documento que deseja gerar.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-blue-500/40 font-tactical justify-start h-auto py-3 px-4"
            onClick={handleGenerateFiliation}
            disabled={isGeneratingFiliation}
          >
            {isGeneratingFiliation ? (
              <Loader2 className="h-4 w-4 mr-3 animate-spin" />
            ) : (
              <FileCheck className="h-4 w-4 mr-3 text-blue-400" />
            )}
            <div className="text-left">
              <p className="text-sm font-medium">Declaracao de Filiacao</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Comprova vinculo com o clube</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-green-500/40 font-tactical justify-start h-auto py-3 px-4"
            onClick={handleGenerateHabituality}
            disabled={isGeneratingHabituality}
          >
            {isGeneratingHabituality ? (
              <Loader2 className="h-4 w-4 mr-3 animate-spin" />
            ) : (
              <ScrollText className="h-4 w-4 mr-3 text-green-400" />
            )}
            <div className="text-left">
              <p className="text-sm font-medium">Declaracao de Habitualidade</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Comprova frequencia de treinos</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-cbt-orange/40 font-tactical justify-start h-auto py-3 px-4"
            onClick={() => navigate('/portal/carteirinha')}
          >
            <CreditCard className="h-4 w-4 mr-3 text-cbt-orange" />
            <div className="text-left">
              <p className="text-sm font-medium">Carteirinha Digital</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Visualizar sua carteirinha</p>
            </div>
          </Button>
        </div>
      </div>

      {/* ── Documents list ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-cbt-orange" />
          <h3 className="text-lg font-military font-bold text-white tracking-wide">
            Documentos Emitidos
          </h3>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          {isLoading ? (
            <LoadingSpinner message="Carregando documentos..." />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-8 h-8 text-gray-500" />}
              title="Nenhum documento encontrado"
              description="Solicite um documento usando os botoes acima."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {documents.map((doc) => {
                const typeBadge = getDocumentTypeBadge(doc.documentType);
                return (
                  <div
                    key={doc.id}
                    className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-tactical ${typeBadge.className}`}
                      >
                        {typeBadge.label}
                      </Badge>
                      <span className="text-[10px] font-tactical text-gray-500">
                        {formatDate(doc.generatedAt)}
                      </span>
                    </div>
                    <h4 className="text-sm font-military font-bold text-white mb-1 line-clamp-2">
                      {doc.title}
                    </h4>
                    {doc.description && (
                      <p className="text-xs font-tactical text-gray-400 line-clamp-2 mb-3">
                        {doc.description}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical text-xs mt-2"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-3.5 w-3.5 mr-2" />
                      Baixar
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentsPage;
