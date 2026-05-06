import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Pencil, UserPlus, ToggleRight, Trash2, ChevronLeft, ChevronRight, Users } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import SearchInput from '@/components/shared/SearchInput';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import MemberStatusBadge from '@/components/members/MemberStatusBadge';
import MemberAvatar from '@/components/admin/MemberAvatar';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  // Por padrão lista só ativos. Quando o admin digita uma busca, o filtro
  // de status é ignorado (mostra ativos + inativos + suspensos) — esse é
  // o comportamento decidido pelo usuário para facilitar localizar histórico.
  const [onlyActive, setOnlyActive] = useState(true);
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

  // Quando há busca, ignora o filtro de status (mostra todos)
  const trimmedSearch = search.trim();
  const filteringByStatus = onlyActive && !trimmedSearch;

  // ── Fetch Users ─────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    const result = await listUsers({
      search: trimmedSearch || undefined,
      status: filteringByStatus ? 'ACTIVE' : undefined,
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
  }, [trimmedSearch, filteringByStatus, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [trimmedSearch, filteringByStatus]);

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
          <Button asChild className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical">
            <Link to="/admin/associados/novo">
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Associado
            </Link>
          </Button>
        }
      />

      {/* Search + filtros */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nome, CPF ou email..."
          />
        </div>
        <label
          className={`flex items-center gap-2 text-sm font-tactical px-3 py-2 rounded-md border border-border bg-card/50 cursor-pointer select-none transition-colors ${
            trimmedSearch
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-muted/40'
          }`}
          title={
            trimmedSearch
              ? 'Filtro desabilitado durante busca — mostrando ativos e inativos'
              : 'Mostrar apenas associados ativos'
          }
        >
          <Checkbox
            checked={onlyActive}
            onCheckedChange={(c) => setOnlyActive(c === true)}
            disabled={!!trimmedSearch}
          />
          <span className="text-foreground">Apenas ativos</span>
        </label>
      </div>

      {/* Content */}
      <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Carregando associados..." />
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users className="w-8 h-8 text-muted-foreground/80" />}
            title="Nenhum associado encontrado"
            description={
              search
                ? 'Tente ajustar os termos da busca.'
                : 'Cadastre o primeiro associado para comecar.'
            }
            action={
              !search ? (
                <Button asChild className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical">
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
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-14 text-muted-foreground font-tactical sr-only">Foto</TableHead>
                  <TableHead className="text-muted-foreground font-tactical">Nome</TableHead>
                  <TableHead className="text-muted-foreground font-tactical">CPF</TableHead>
                  <TableHead className="text-muted-foreground font-tactical">N. Associado</TableHead>
                  <TableHead className="text-muted-foreground font-tactical">Perfil</TableHead>
                  <TableHead className="text-muted-foreground font-tactical">Status</TableHead>
                  <TableHead className="text-muted-foreground font-tactical text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-border hover:bg-muted/50">
                    <TableCell className="w-14 py-2">
                      <MemberAvatar
                        size="sm"
                        fullName={user.fullName}
                        facePhoto={user.faceProfiles?.[0]?.thumbnail ?? null}
                      />
                    </TableCell>
                    <TableCell className="text-foreground font-medium">{user.fullName}</TableCell>
                    <TableCell className="text-foreground/85 font-mono text-sm">
                      {formatCpf(user.cpf)}
                    </TableCell>
                    <TableCell className="text-foreground/85">{user.memberNumber || '—'}</TableCell>
                    <TableCell className="text-foreground/85">
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
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
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
                          className="h-8 w-8 text-muted-foreground hover:text-cbt-orange hover:bg-secondary"
                          title="Editar"
                        >
                          <Link to={`/admin/associados/${user.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-cbt-orange hover:bg-secondary"
                          title={user.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                          onClick={() => handleToggleStatus(user)}
                        >
                          <ToggleRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-700 dark:text-red-400 hover:bg-secondary"
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground font-tactical">
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
