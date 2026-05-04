import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Pencil, UserPlus, Trash2, ChevronLeft, ChevronRight, UserCheck } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import SearchInput from '@/components/shared/SearchInput';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

import { useToast } from '@/hooks/use-toast';
import {
  listVisitors,
  deleteVisitor,
  type Visitor,
  type PaginationMeta,
} from '@/services/visitorsService';
import { formatCpf, formatPhone } from '@/lib/formatters';

const ITEMS_PER_PAGE = 10;

const VisitorsPage = () => {
  const { toast } = useToast();

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchVisitors = useCallback(async () => {
    setIsLoading(true);
    const result = await listVisitors({
      search: search || undefined,
      page,
      limit: ITEMS_PER_PAGE,
    });
    if (result.success && result.data) {
      setVisitors(result.data.visitors);
      setPagination(result.data.pagination);
    } else {
      toast({
        title: 'Erro ao carregar visitantes',
        description: result.error,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [search, page, toast]);

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleDelete = (visitor: Visitor) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir visitante',
      description: `Tem certeza que deseja excluir o visitante "${visitor.fullName}"? Esta acao nao pode ser desfeita.`,
      onConfirm: async () => {
        setIsActionLoading(true);
        const result = await deleteVisitor(visitor.id);
        setIsActionLoading(false);

        if (result.success) {
          toast({ title: 'Visitante excluido com sucesso' });
          setConfirmDialog((prev) => ({ ...prev, open: false }));
          fetchVisitors();
        } else {
          toast({
            title: 'Erro ao excluir visitante',
            description: result.error,
            variant: 'destructive',
          });
        }
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Visitantes"
        description="Cadastro e gestao de visitantes do clube"
        actions={
          <Button asChild className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical">
            <Link to="/admin/visitantes/novo">
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Visitante
            </Link>
          </Button>
        }
      />

      <div className="mb-6 max-w-sm">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, CPF ou telefone..."
        />
      </div>

      <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Carregando visitantes..." />
        ) : visitors.length === 0 ? (
          <EmptyState
            icon={<UserCheck className="w-8 h-8 text-muted-foreground/80" />}
            title="Nenhum visitante encontrado"
            description={
              search
                ? 'Tente ajustar os termos da busca.'
                : 'Cadastre o primeiro visitante para comecar.'
            }
            action={
              !search ? (
                <Button asChild className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical">
                  <Link to="/admin/visitantes/novo">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Novo Visitante
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-tactical">Nome</TableHead>
                  <TableHead className="text-muted-foreground font-tactical">CPF</TableHead>
                  <TableHead className="text-muted-foreground font-tactical">Telefone</TableHead>
                  <TableHead className="text-muted-foreground font-tactical">E-mail</TableHead>
                  <TableHead className="text-muted-foreground font-tactical text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitors.map((visitor) => (
                  <TableRow key={visitor.id} className="border-border hover:bg-muted/50">
                    <TableCell className="text-foreground font-medium">{visitor.fullName}</TableCell>
                    <TableCell className="text-foreground/85 font-mono text-sm">
                      {formatCpf(visitor.cpf)}
                    </TableCell>
                    <TableCell className="text-foreground/85 font-mono text-sm">
                      {formatPhone(visitor.phone)}
                    </TableCell>
                    <TableCell className="text-foreground/85 text-sm">
                      {visitor.email || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
                          title="Detalhes"
                        >
                          <Link to={`/admin/visitantes/${visitor.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8 text-muted-foreground hover:text-cbt-orange hover:bg-secondary"
                          title="Editar"
                        >
                          <Link to={`/admin/visitantes/${visitor.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-secondary"
                          title="Excluir"
                          onClick={() => handleDelete(visitor)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground font-tactical">
                  Mostrando {(page - 1) * ITEMS_PER_PAGE + 1} a{' '}
                  {Math.min(page * ITEMS_PER_PAGE, pagination.total)} de {pagination.total} visitantes
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground font-tactical px-2">
                    {page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="bg-muted border-border text-foreground/85 hover:bg-secondary hover:text-foreground disabled:opacity-50"
                  >
                    Proximo
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant="destructive"
        onConfirm={confirmDialog.onConfirm}
        isLoading={isActionLoading}
      />
    </div>
  );
};

export default VisitorsPage;
