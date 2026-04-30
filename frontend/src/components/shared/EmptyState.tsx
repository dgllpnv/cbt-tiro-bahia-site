import { InboxIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
      {icon || <InboxIcon className="w-8 h-8 text-gray-500" />}
    </div>
    <h3 className="text-lg font-military font-bold text-white mb-1">{title}</h3>
    {description && <p className="text-gray-400 font-tactical text-sm max-w-md">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
