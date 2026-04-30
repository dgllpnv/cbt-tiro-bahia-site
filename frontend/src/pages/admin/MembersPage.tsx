import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Pencil, UserPlus, ToggleRight, Trash2, ChevronLeft, ChevronRight, Users } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import SearchInput from '@/components/shared/SearchInput';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import MemberStatusBadge from '@/components/members/MemberStatusBadge';

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
import { listUsers, updateUserStatus, deleteUser } from '@/services/usersService';
import type { User } from '@/types/user';
import type { PaginationMeta } from '@/services/usersService';
import { formatCpf } from '@/lib/formatters';

const ITEMS_PER_PAGE = 10;

const MembersPage = () => {
  const { toast } = useToast();

  // ── State ───────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: 'default' | 'destructive';
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    variant: 'default',
    onConfirm: () => {},
  });
  const [isActionLoading, setIsActionLoading] = useState(false);

  // ── Fetch Users ─────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    const result = await listUsers({
      search: search || undefined,
      page,
      limit: ITEMS_PER_PAGE,
    });

    if (result.success && result.data) {
      setUsers(result.data.users);
      setPagination(result.data.pagination);
    } else {
      toast({
        title: 'Erro ao carregar associados',
        description: result.error,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [search, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleToggleStatus = (user: User) => {
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const label = newStatus === 'ACTIVE' ? 'ativar' : 'desativar';

    setConfirmDialog({
      open: true,
      title: `${newStatus === 'ACTIVE' ? 'Ativar' : 'Desativar'} associado`,
      description: `Tem certeza que deseja ${label} o associado "${user.fullName}"?`,
      variant: 'default',
      onConfirm: async () => {
        setIsActionLoading(true);
        const result = await updateUserStatus(user.id, newStatus);
        setIsActionLoading(false);

        if (result.success) {
          toast({ title: `Associado ${label === 'ativar' ? 'ativado' : 'desativado'} com sucesso` });
          setConfirmDialog((prev) => ({ ...prev, open: false }));
          fetchUsers();
        } else {
          toast({
            title: `Erro ao ${label} associado`,
            description: result.error,
            variant: 'destructive',
          });
        }
      },
    });
  };

  const handleDelete = (user: User) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir associado',
      description: `Tem certeza que deseja excluir permanentemente o associado "${user.fullName}"? Esta acao nao pode ser desfeita.`,
      variant: 'destructive',
      onConfirm: async () => {
        setIsActionLoading(true);
        const result = await deleteUser(user.id);
        setIsActionLoading(false);

        if (result.success) {
          toast({ title: 'Associado excluido com sucesso' });
          setConfirmDialog((prev) => ({ ...prev, open: false }));
          fetchUsers();
        } else {
          toast({
            title: 'Erro ao excluir associado',
            description: result.error,
            variant: 'destructive',
          });
        }
      },
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Associados"
        description="Gestao de membros do clube"
        actions={
          <Button asChild className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical">
            <Link to="/admin/associados/novo">
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Associado
            </Link>
          </Button>
        }
      />

      {/* Search */}
      <div className="mb-6 max-w-sm">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, CPF ou email..."
        />
      </div>

      {/* Content */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Carregando associados..." />
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users className="w-8 h-8 text-gray-500" />}
            title="Nenhum associado encontrado"
            description={
              search
                ? 'Tente ajustar os termos da busca.'
                : 'Cadastre o primeiro associado para comecar.'
            }
            action={
              !search ? (
                <Button asChild className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical">
                  <Link to="/admin/associados/novo">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Novo Associado
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400 font-tactical">Nome</TableHead>
                  <TableHead className="text-gray-400 font-tactical">CPF</TableHead>
                  <TableHead className="text-gray-400 font-tactical">N. Associado</TableHead>
                  <TableHead className="text-gray-400 font-tactical">Perfil</TableHead>
                  <TableHead className="text-gray-400 font-tactical">Status</TableHead>
                  <TableHead className="text-gray-400 font-tactical text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-gray-800 hover:bg-gray-800/50">
                    <TableCell className="text-white font-medium">{user.fullName}</TableCell>
                    <TableCell className="text-gray-300 font-mono text-sm">
                      {formatCpf(user.cpf)}
                    </TableCell>
                    <TableCell className="text-gray-300">{user.memberNumber || '—'}</TableCell>
                    <TableCell className="text-gray-300">
                      {user.role === 'admin' ? 'Admin' : 'Associado'}
                    </TableCell>
                    <TableCell>
                      <MemberStatusBadge status={user.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"
                          title="Perfil"
                        >
                          <Link to={`/admin/associados/${user.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8 text-gray-400 hover:text-cbt-orange hover:bg-gray-700"
                          title="Editar"
                        >
                          <Link to={`/admin/associados/${user.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-cbt-orange hover:bg-gray-700"
                          title={user.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                          onClick={() => handleToggleStatus(user)}
                        >
                          <ToggleRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-gray-700"
                          title="Excluir"
                          onClick={() => handleDelete(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                <p className="text-sm text-gray-400 font-tactical">
                  Mostrando {(page - 1) * ITEMS_PER_PAGE + 1} a{' '}
                  {Math.min(page * ITEMS_PER_PAGE, pagination.total)} de{' '}
                  {pagination.total} associados
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-sm text-gray-400 font-tactical px-2">
                    {page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
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

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        isLoading={isActionLoading}
      />
    </div>
  );
};

export default MembersPage;
