import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import EquipmentForm from '@/components/admin/EquipmentForm';
import { createEquipment, type CreateEquipmentData } from '@/services/equipmentService';

const EquipmentCreatePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: CreateEquipmentData) => {
    if (!data.name) {
      toast({ title: 'Nome obrigatorio', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const result = await createEquipment(data);
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: 'Equipamento cadastrado com sucesso' });
      navigate('/admin/equipamentos');
    } else {
      toast({
        title: 'Erro ao cadastrar equipamento',
        description: result.error || 'Erro inesperado.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Novo Equipamento"
        description="Cadastrar equipamento do clube"
        actions={
          <Button
            asChild
            variant="outline"
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical"
          >
            <Link to="/admin/equipamentos">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        }
      />

      <EquipmentForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/equipamentos')}
        submitLabel="Cadastrar Equipamento"
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default EquipmentCreatePage;
