interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

const PageHeader = ({ title, description, actions }: PageHeaderProps) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <div className="min-w-0">
      <h1 className="text-2xl font-military font-bold text-white tracking-wide">{title}</h1>
      {description && (
        typeof description === 'string'
          ? <p className="text-gray-400 font-tactical text-sm mt-1">{description}</p>
          : <div className="text-gray-400 font-tactical text-sm mt-1">{description}</div>
      )}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
