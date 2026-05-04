import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MemberStatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: 'Ativo',
    className: 'bg-green-900/50 text-green-400 border-green-800 hover:bg-green-900/70',
  },
  INACTIVE: {
    label: 'Inativo',
    className: 'bg-muted/50 text-muted-foreground border-border hover:bg-muted/70',
  },
  SUSPENDED: {
    label: 'Suspenso',
    className: 'bg-red-900/50 text-red-400 border-red-800 hover:bg-red-900/70',
  },
};

const MemberStatusBadge = ({ status }: MemberStatusBadgeProps) => {
  const config = statusConfig[status] || statusConfig.INACTIVE;

  return (
    <Badge variant="outline" className={cn('font-tactical text-xs', config.className)}>
      {config.label}
    </Badge>
  );
};

export default MemberStatusBadge;
