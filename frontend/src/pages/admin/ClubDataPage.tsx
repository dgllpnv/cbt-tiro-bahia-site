import PageHeader from '@/components/shared/PageHeader';
import ClubLegalSettings from '@/components/admin/ClubLegalSettings';

const ClubDataPage = () => (
  <div>
    <PageHeader
      title="Dados do Clube"
      description="Informacoes legais e operacionais — usadas em declaracoes (Anexo E) e documentos do clube"
    />
    <ClubLegalSettings />
  </div>
);

export default ClubDataPage;
