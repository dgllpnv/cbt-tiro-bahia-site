import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { equipmentTypeLabels, equipmentConditionLabels } from '@/lib/constants';
import type { CreateEquipmentData, Equipment } from '@/services/equipmentService';

interface EquipmentFormProps {
  initialData?: Partial<Equipment>;
  onSubmit: (data: CreateEquipmentData) => Promise<void> | void;
  onCancel: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
}

const inputClasses =
  'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-cbt-orange focus:ring-cbt-orange/20';

const selectClasses =
  'w-full rounded-md bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-cbt-orange focus:ring-1 focus:ring-cbt-orange/20';

const labelClasses = 'block text-sm font-tactical text-gray-300 mb-1';

interface FormState {
  name: string;
  equipmentType: string;
  serialNumber: string;
  registrationId: string;
  caliber: string;
  brand: string;
  model: string;
  condition: string;
  description: string;
  acquisitionDate: string;
  notes: string;
}

const buildInitial = (initial?: Partial<Equipment>): FormState => ({
  name: initial?.name ?? '',
  equipmentType: initial?.equipmentType ?? 'FIREARM',
  serialNumber: initial?.serialNumber ?? '',
  registrationId: initial?.registrationId ?? '',
  caliber: initial?.caliber ?? '',
  brand: initial?.brand ?? '',
  model: initial?.model ?? '',
  condition: initial?.condition ?? 'GOOD',
  description: initial?.description ?? '',
  acquisitionDate: initial?.acquisitionDate ? initial.acquisitionDate.slice(0, 10) : '',
  notes: initial?.notes ?? '',
});

const EquipmentForm = ({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Salvar',
  isSubmitting = false,
}: EquipmentFormProps) => {
  const [form, setForm] = useState<FormState>(() => buildInitial(initialData));

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload: CreateEquipmentData = {
      name: form.name.trim(),
      equipmentType: form.equipmentType,
    };
    if (form.serialNumber.trim()) payload.serialNumber = form.serialNumber.trim();
    if (form.registrationId.trim()) payload.registrationId = form.registrationId.trim();
    if (form.caliber.trim()) payload.caliber = form.caliber.trim();
    if (form.brand.trim()) payload.brand = form.brand.trim();
    if (form.model.trim()) payload.model = form.model.trim();
    if (form.condition) payload.condition = form.condition;
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.acquisitionDate) payload.acquisitionDate = form.acquisitionDate;
    if (form.notes.trim()) payload.notes = form.notes.trim();

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-military font-bold text-white tracking-wide mb-4">Identificação</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className={labelClasses}>
              Nome <span className="text-red-400">*</span>
            </label>
            <Input id="name" name="name" placeholder="Ex: Glock 17 Nº 42" value={form.name} onChange={handleChange} className={inputClasses} required />
          </div>
          <div>
            <label htmlFor="equipmentType" className={labelClasses}>
              Tipo <span className="text-red-400">*</span>
            </label>
            <select id="equipmentType" name="equipmentType" value={form.equipmentType} onChange={handleChange} className={selectClasses}>
              {Object.entries(equipmentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="serialNumber" className={labelClasses}>Número de Série</label>
            <Input id="serialNumber" name="serialNumber" placeholder="Único por equipamento" value={form.serialNumber} onChange={handleChange} className={inputClasses} />
          </div>
          <div>
            <label htmlFor="registrationId" className={labelClasses}>Registro (CR/SIGMA)</label>
            <Input id="registrationId" name="registrationId" placeholder="Opcional" value={form.registrationId} onChange={handleChange} className={inputClasses} />
          </div>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-military font-bold text-white tracking-wide mb-4">Especificações</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="caliber" className={labelClasses}>Calibre</label>
            <Input id="caliber" name="caliber" placeholder="Ex: 9mm, .38 SPL" value={form.caliber} onChange={handleChange} className={inputClasses} />
          </div>
          <div>
            <label htmlFor="brand" className={labelClasses}>Marca</label>
            <Input id="brand" name="brand" placeholder="Ex: Glock" value={form.brand} onChange={handleChange} className={inputClasses} />
          </div>
          <div>
            <label htmlFor="model" className={labelClasses}>Modelo</label>
            <Input id="model" name="model" placeholder="Ex: G17 Gen 5" value={form.model} onChange={handleChange} className={inputClasses} />
          </div>
          <div>
            <label htmlFor="condition" className={labelClasses}>Condição</label>
            <select id="condition" name="condition" value={form.condition} onChange={handleChange} className={selectClasses}>
              {Object.entries(equipmentConditionLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="acquisitionDate" className={labelClasses}>Data de Aquisição</label>
            <Input id="acquisitionDate" name="acquisitionDate" type="date" value={form.acquisitionDate} onChange={handleChange} className={inputClasses} />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="description" className={labelClasses}>Descrição</label>
          <Textarea id="description" name="description" placeholder="Detalhes adicionais sobre o equipamento" value={form.description} onChange={handleChange} className={inputClasses} />
        </div>
        <div className="mt-4">
          <label htmlFor="notes" className={labelClasses}>Observações Internas</label>
          <Textarea id="notes" name="notes" placeholder="Notas operacionais (apenas admin)" value={form.notes} onChange={handleChange} className={inputClasses} />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white font-tactical">
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default EquipmentForm;
