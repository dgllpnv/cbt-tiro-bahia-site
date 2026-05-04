import { X, Crosshair, Headphones, Eye, Box, Package } from 'lucide-react';
import { equipmentTypeLabels } from '@/lib/constants';

interface LoanedEquipment {
  id: string;
  loanDate: string;
  expectedReturn: string | null;
  conditionAtLoan?: string | null;
  equipment: {
    id: string;
    name: string;
    equipmentType: string;
    serialNumber: string | null;
  };
}

interface MemberLoanedEquipmentListProps {
  loans: LoanedEquipment[];
  onReturn: (loanId: string) => void;
  compact?: boolean;
  disabled?: boolean;
}

function iconFor(equipmentType: string) {
  switch (equipmentType) {
    case 'FIREARM':
      return Crosshair;
    case 'EAR_PROTECTION':
      return Headphones;
    case 'EYE_PROTECTION':
      return Eye;
    case 'MAGAZINE':
      return Box;
    case 'HOLSTER':
    default:
      return Package;
  }
}

const MemberLoanedEquipmentList = ({ loans, onReturn, compact = false, disabled = false }: MemberLoanedEquipmentListProps) => {
  if (!loans || loans.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'p-2'}`}>
      {loans.map((loan) => {
        const Icon = iconFor(loan.equipment.equipmentType);
        const typeLabel = equipmentTypeLabels[loan.equipment.equipmentType] || loan.equipment.equipmentType;
        const titleText = `${typeLabel}${loan.equipment.serialNumber ? ` · ${loan.equipment.serialNumber}` : ''}`;
        return (
          <div
            key={loan.id}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/30 text-blue-200 font-tactical text-xs"
            title={titleText}
          >
            <Icon className="h-3.5 w-3.5 text-blue-300 flex-shrink-0" />
            <span className="truncate max-w-[140px]">{loan.equipment.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onReturn(loan.id);
              }}
              disabled={disabled}
              title="Devolver equipamento"
              className="ml-1 p-0.5 rounded hover:bg-red-500/20 hover:text-red-300 text-blue-300 transition-colors disabled:opacity-50"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default MemberLoanedEquipmentList;
