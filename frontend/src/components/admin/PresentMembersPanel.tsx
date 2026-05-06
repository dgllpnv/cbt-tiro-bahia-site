import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, User, Users, UserCheck, Crosshair, Loader2, Plus, Receipt, ShoppingCart, Package, ScanFace } from 'lucide-react';
import { GiBullets } from 'react-icons/gi';

import api from '@/services/api';
import {
  checkInPresent,
  checkoutVisit,
  getPresentMembers,
  type Visit,
} from '@/services/visitsService';
import { listLanes } from '@/services/lanesService';
import { getDraftByVisit, type Transaction } from '@/services/transactionsService';
import { returnLoan as returnLoanApi } from '@/services/loansService';
import { verifyFaceForCheckout } from '@/services/faceProfilesService';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ShotEntryDialog from '@/components/admin/ShotEntryDialog';
import OpenTabDialog from '@/components/admin/OpenTabDialog';
import CloseTabDialog from '@/components/admin/CloseTabDialog';
import LoanIssueDialog from '@/components/admin/LoanIssueDialog';
import MemberLoanedEquipmentList from '@/components/admin/MemberLoanedEquipmentList';
import MemberAvatar from '@/components/admin/MemberAvatar';
import FaceVerifyDialog from '@/components/admin/FaceVerifyDialog';
import FaceCheckoutDialog, { type FaceCheckoutTarget } from '@/components/admin/FaceCheckoutDialog';
import FaceRegisterPromptDialog from '@/components/admin/FaceRegisterPromptDialog';
import { warmup as warmupFace } from '@/lib/faceCapture';
import { getCaliberColor } from '@/lib/ammunitionVisuals';
import { getFirearmCategory, getFirearmCategoryVisual } from '@/lib/firearmsCatalog';
import { formatCurrency } from '@/lib/formatters';

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(checkInIso: string, now: number): string {
  const start = new Date(checkInIso).getTime();
  const diffMin = Math.max(0, Math.floor((now - start) / 60000));
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

function totalShotsFor(visit: Visit): number {
  return (visit.details ?? []).reduce((acc, d) => acc + (d.shotsFired ?? 0), 0);
}

// ── Inline check-in autocomplete (unchanged from prior sprint) ─────────────

interface SearchHit {
  id: string;
  fullName: string;
  memberNumber: string | null;
  cpf?: string;
  isVisitor?: boolean;
}

interface CheckInSearchProps {
  onPick: (memberId: string, fullName: string) => void;
  excludeIds: Set<string>;
  disabled?: boolean;
}

const CheckInSearch = ({ onPick, excludeIds, disabled }: CheckInSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const onChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Busca associados e visitantes em paralelo — o painel registra qualquer um
        // dos dois no clube (visitantes podem comprar, fechar conta, etc.).
        const [usersRes, visitorsRes] = await Promise.all([
          api
            .get('/api/users', { params: { search: text.trim(), limit: 6, status: 'ACTIVE' } })
            .catch(() => ({ data: { success: false, data: [] } })),
          api
            .get('/api/visitors', { params: { search: text.trim(), limit: 6, status: 'ACTIVE' } })
            .catch(() => ({ data: { success: false, data: [] } })),
        ]);

        const users: SearchHit[] = usersRes.data?.success
          ? (usersRes.data.data || []).map((u: any) => ({
              id: u.id,
              fullName: u.fullName,
              memberNumber: u.memberNumber,
              cpf: u.cpf,
              isVisitor: false,
            }))
          : [];

        const visitors: SearchHit[] = visitorsRes.data?.success
          ? (visitorsRes.data.data || []).map((v: any) => ({
              id: v.id,
              fullName: v.fullName,
              memberNumber: null,
              cpf: v.cpf,
              isVisitor: true,
            }))
          : [];

        setResults([...users, ...visitors].filter((m) => !excludeIds.has(m.id)));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const handlePick = (m: SearchHit) => {
    onPick(m.id, m.fullName);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/80 pointer-events-none" />
      <input
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Buscar associado para registrar chegada..."
        className="w-full h-12 pl-10 pr-10 bg-muted border border-border rounded-lg text-foreground font-tactical text-sm placeholder:text-muted-foreground/80 focus:border-cbt-orange focus:outline-none disabled:opacity-50"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cbt-orange animate-spin" />
      )}

      {open && results.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-muted border border-border rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handlePick(m)}
              className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-secondary transition-colors border-b border-border/50 last:border-0"
            >
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center font-tactical text-xs font-bold ${m.isVisitor ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300' : 'bg-cbt-orange/20 text-cbt-orange'}`}
              >
                {getInitials(m.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-foreground font-tactical text-sm truncate">{m.fullName}</p>
                  {m.isVisitor && (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-tactical bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex-shrink-0">
                      Visitante
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground/80 font-tactical text-xs">
                  {m.isVisitor ? `CPF ${m.cpf || '—'}` : `Nº ${m.memberNumber || '—'}`}
                </p>
              </div>
              <span className="text-cbt-orange text-xs font-tactical">Registrar →</span>
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && !loading && results.length === 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-muted border border-border rounded-lg shadow-xl p-4 text-center">
          <p className="text-muted-foreground/80 font-tactical text-sm">Nenhum associado ou visitante encontrado</p>
        </div>
      )}
    </div>
  );
};

// ── Member card ────────────────────────────────────────────────────────────

interface TabSummary {
  itemCount: number;
  subtotal: number;
}

interface PresentCardProps {
  visit: Visit;
  now: number;
  tabSummary: TabSummary | null;
  onNewSale: (visit: Visit) => void;
  onRegisterShot: (visit: Visit) => void;
  onIssueLoan: (visit: Visit) => void;
  onReturnLoan: (loanId: string, visit: Visit) => void;
  onCheckOut: (visit: Visit) => void;
}

const PresentCard = ({
  visit,
  now,
  tabSummary,
  onNewSale,
  onRegisterShot,
  onIssueLoan,
  onReturnLoan,
  onCheckOut,
}: PresentCardProps) => {
  const totalShots = totalShotsFor(visit);
  const hasTab = (tabSummary?.itemCount ?? 0) > 0;
  const isVisitor = visit.member.role === 'VISITOR';
  return (
    <div
      className={`bg-card/70 border rounded-lg p-4 flex flex-col gap-3 transition-all ${isVisitor ? 'border-blue-500/30 hover:border-blue-500/60 hover:ring-1 hover:ring-blue-500/20' : 'border-border hover:border-cbt-orange/40 hover:ring-1 hover:ring-cbt-orange/20'}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <MemberAvatar
          size="md"
          fullName={visit.member.fullName}
          facePhoto={visit.member.faceProfiles?.[0]?.thumbnail ?? null}
          ringClassName={
            isVisitor ? 'ring-2 ring-blue-500/40' : 'ring-2 ring-cbt-orange/40'
          }
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-foreground font-tactical text-sm font-semibold truncate">
              {visit.member.fullName}
            </p>
            {isVisitor && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-tactical bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex-shrink-0">
                <UserCheck className="h-2.5 w-2.5" />
                Visitante
              </span>
            )}
          </div>
          <p className="text-muted-foreground/80 font-tactical text-xs">
            {isVisitor ? 'Visitante' : `Nº ${visit.member.memberNumber ?? '—'}`} · entrou {formatTime(visit.checkInTime)}
          </p>
          <p className="text-foreground/85 font-tactical text-xs mt-0.5">
            <span className={isVisitor ? 'text-blue-700 dark:text-blue-300' : 'text-cbt-orange'}>
              {formatDuration(visit.checkInTime, now)}
            </span>
            {visit.lane && <span className="text-muted-foreground/80"> · {visit.lane.name}</span>}
          </p>
        </div>
        {hasTab && (
          <span
            className="px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/40 text-green-700 dark:text-green-300 font-tactical text-[10px] flex items-center gap-1"
            title={`Comanda em aberto: ${tabSummary?.itemCount} ite${tabSummary?.itemCount === 1 ? 'm' : 'ns'} • ${formatCurrency(tabSummary?.subtotal ?? 0)}`}
          >
            <ShoppingCart className="h-3 w-3" />
            {tabSummary!.itemCount} · {formatCurrency(tabSummary!.subtotal)}
          </span>
        )}
      </div>

      {/* Top-3 shots pills */}
      <div className="px-2 py-1.5 bg-muted/60 rounded-md text-xs font-tactical">
        {totalShots === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground/80">
            <GiBullets className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Nenhum tiro registrado</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(visit.details ?? []).slice(0, 3).map((d) => {
              const cat = getFirearmCategory(d.firearmName);
              const visual = getFirearmCategoryVisual(cat);
              const Icon = visual?.icon ?? GiBullets;
              const iconColor = visual?.color ?? getCaliberColor(d.caliber);
              return (
                <span
                  key={d.id}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-card/70 border border-border text-foreground/85"
                  title={d.firearmName ? `${d.firearmName} · ${d.caliber}` : d.caliber}
                >
                  <Icon className="h-3 w-3" style={{ color: iconColor }} />
                  <span className="text-foreground">{d.caliber}</span>
                  <span className="text-cbt-orange">{d.shotsFired}</span>
                </span>
              );
            })}
            {(visit.details?.length ?? 0) > 3 && (
              <span className="text-muted-foreground/80">+{(visit.details!.length) - 3}</span>
            )}
            <span className="text-muted-foreground/80 ml-auto">{totalShots} total</span>
          </div>
        )}
      </div>

      {/* Actions — 4 botoes (Venda | Tiro | Empréstimo | Fechar) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onNewSale(visit)}
          className="bg-muted border-border text-foreground hover:bg-green-500/10 hover:border-green-500/40 hover:text-green-700 dark:text-green-300 font-tactical h-9"
        >
          <ShoppingCart className="h-3.5 w-3.5 mr-1" />
          Venda
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRegisterShot(visit)}
          className="bg-muted border-border text-foreground hover:bg-cbt-orange/10 hover:border-cbt-orange/40 hover:text-cbt-orange font-tactical h-9"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Tiro
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onIssueLoan(visit)}
          className="bg-muted border-border text-foreground hover:bg-blue-500/10 hover:border-blue-500/40 hover:text-blue-700 dark:text-blue-300 font-tactical h-9"
        >
          <Package className="h-3.5 w-3.5 mr-1" />
          Empréstimo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCheckOut(visit)}
          className="bg-muted border-border text-foreground hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-700 dark:text-red-300 font-tactical h-9"
        >
          <Receipt className="h-3.5 w-3.5 mr-1" />
          Fechar
        </Button>
      </div>

      {/* Equipamentos em uso pelo membro presente */}
      {visit.member.loansReceived && visit.member.loansReceived.length > 0 && (
        <div className="mt-1">
          <p className="text-[10px] font-tactical uppercase tracking-wider text-muted-foreground/80 mb-1">
            Equipamentos em uso
          </p>
          <MemberLoanedEquipmentList
            loans={visit.member.loansReceived}
            onReturn={(loanId) => onReturnLoan(loanId, visit)}
            compact
          />
        </div>
      )}
    </div>
  );
};

// ── Main panel ─────────────────────────────────────────────────────────────

const PresentMembersPanel = () => {
  const { toast } = useToast();
  const [present, setPresent] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [capacity, setCapacity] = useState<{ occupied: number; total: number } | null>(null);

  /** Resumo da comanda DRAFT por visitId. */
  const [tabs, setTabs] = useState<Record<string, { itemCount: number; subtotal: number; draft: Transaction }>>(
    {},
  );

  // ShotEntryDialog state
  const [shotDialog, setShotDialog] = useState<{ visitId: string; memberName: string } | null>(null);

  // Checkout prompt state (sem tiros + sem comanda)
  const [checkoutPrompt, setCheckoutPrompt] = useState<Visit | null>(null);

  // OpenTabDialog state — adicionar itens
  const [openTab, setOpenTab] = useState<{ visit: Visit } | null>(null);

  // CloseTabDialog state — finalizar comanda
  const [closeTab, setCloseTab] = useState<{
    visit: Visit;
    draft: Transaction;
    /** Quando true, o pagamento confirma e libera baia direto, sem perguntar
     *  "Verificar Facial?" depois (admin ja verificou no botao Facial). */
    skipFaceVerify?: boolean;
  } | null>(null);

  // LoanIssueDialog state — emprestimo de equipamento
  const [loanIssueVisit, setLoanIssueVisit] = useState<Visit | null>(null);

  // Face Recognition state
  const [faceVerifyOpen, setFaceVerifyOpen] = useState(false);
  const [faceCheckoutPrompt, setFaceCheckoutPrompt] = useState<Visit | null>(null);
  const [faceCheckoutTarget, setFaceCheckoutTarget] = useState<FaceCheckoutTarget | null>(null);
  // Quando o admin acabar de verificar/registrar a face no checkout, queremos disparar o checkout em seguida.
  const faceCaptureFollowUpRef = useRef<(() => void) | null>(null);

  // Pre-carrega modelos da Human em background quando o painel monta
  useEffect(() => {
    warmupFace().catch(() => {});
  }, []);

  // Tick clock for live duration
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const refreshTab = useCallback(async (visitId: string) => {
    const res = await getDraftByVisit(visitId);
    if (!res.success) return;
    const draft = res.data;
    setTabs((prev) => {
      const next = { ...prev };
      if (draft && draft.items.length > 0) {
        const subtotal = draft.items.reduce(
          (sum, it) => sum + Number(it.subtotal ?? it.quantity * it.unitPrice),
          0,
        );
        next[visitId] = { itemCount: draft.items.length, subtotal, draft };
      } else {
        delete next[visitId];
      }
      return next;
    });
  }, []);

  const fetchPresent = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      const [res, lanesRes] = await Promise.all([getPresentMembers(), listLanes()]);
      if (res.success && res.data) {
        setPresent(res.data);
        // Em paralelo, busca comanda de cada visita (lazy mas paralelizado)
        const visits = res.data;
        await Promise.all(visits.map((v) => refreshTab(v.id)));
      } else if (!silent) {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar presentes',
          description: res.error || 'Não foi possível obter a lista.',
        });
      }
      if (lanesRes.success && lanesRes.data) {
        const arr = lanesRes.data;
        setCapacity({
          occupied: arr.filter((l: any) => (l.status || '').toUpperCase() === 'OCCUPIED').length,
          total: arr.length,
        });
      }
      if (!silent) setLoading(false);
    },
    [toast, refreshTab],
  );

  useEffect(() => {
    fetchPresent();
    const t = setInterval(() => fetchPresent(true), 30_000);
    return () => clearInterval(t);
  }, [fetchPresent]);

  const excludeIds = new Set(present.map((v) => v.member.id));

  const handleCheckIn = async (memberId: string, fullName: string) => {
    setBusy(true);
    const result = await checkInPresent(memberId);
    setBusy(false);
    if (result.success) {
      toast({ title: `${fullName} registrado(a) no clube` });
      await fetchPresent(true);
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar chegada',
        description: result.error || 'Tente novamente.',
      });
    }
  };

  const performCheckOut = async (visit: Visit) => {
    const previous = present;
    setPresent((p) => p.filter((v) => v.id !== visit.id));

    const result = await checkoutVisit(visit.id);
    if (!result.success) {
      setPresent(previous);
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar saída',
        description: result.error || 'Tente novamente.',
      });
      return;
    }

    toast({
      title: `${visit.member.fullName} saiu do clube`,
      description: 'Saída registrada e visível em "Perfil → Visitas".',
      action: (
        <ToastAction
          altText="Desfazer"
          onClick={async () => {
            const undo = await checkInPresent(visit.member.id);
            if (undo.success) await fetchPresent(true);
          }}
        >
          Desfazer
        </ToastAction>
      ),
    });

    fetchPresent(true);
  };

  const handleCheckoutClick = (visit: Visit) => {
    const tab = tabs[visit.id];
    if (tab && tab.itemCount > 0) {
      // Tem comanda em aberto — abrir CloseTabDialog para fechar a conta
      setCloseTab({ visit, draft: tab.draft });
      return;
    }
    if ((visit.details?.length ?? 0) === 0) {
      // Sem comanda e sem tiros — prompt confirmando saída sem registro
      setCheckoutPrompt(visit);
    } else {
      // Sem comanda mas com tiros: pergunta se registra facial (que valida habitualidade)
      setFaceCheckoutPrompt(visit);
    }
  };

  const handleNewSale = (visit: Visit) => {
    setOpenTab({ visit });
  };

  const handleIssueLoan = (visit: Visit) => {
    setLoanIssueVisit(visit);
  };

  // Devolucao instantanea pelo X — sem dialog, mantem condicao do emprestimo.
  // Toast com botao "Desfazer" reabre o emprestimo se admin errou.
  const handleReturnLoan = async (loanId: string, visit: Visit) => {
    const loanRef = visit.member.loansReceived?.find((l) => l.id === loanId);
    if (!loanRef) return;

    const conditionToReturn = loanRef.conditionAtLoan || 'GOOD';

    // Optimistic update — remove o chip da lista
    setPresent((prev) =>
      prev.map((v) =>
        v.id === visit.id
          ? {
              ...v,
              member: {
                ...v.member,
                loansReceived: v.member.loansReceived?.filter((l) => l.id !== loanId) ?? [],
              },
            }
          : v,
      ),
    );

    const result = await returnLoanApi(loanId, { conditionAtReturn: conditionToReturn });

    if (!result.success) {
      // Reverte: refetch
      toast({
        variant: 'destructive',
        title: 'Erro ao devolver equipamento',
        description: result.error || 'Tente novamente.',
      });
      fetchPresent(true);
      return;
    }

    toast({
      title: `${loanRef.equipment.name} devolvido`,
      description: `Devolução registrada como ${conditionToReturn}.`,
      action: (
        <ToastAction
          altText="Desfazer"
          onClick={async () => {
            // Reabre emitindo novo emprestimo do mesmo equipamento para o mesmo membro
            const { issueLoan } = await import('@/services/loansService');
            const undo = await issueLoan({
              memberId: visit.member.id,
              equipmentId: loanRef.equipment.id,
            });
            if (undo.success) {
              toast({ title: 'Devolução desfeita' });
            } else {
              toast({
                variant: 'destructive',
                title: 'Não foi possível desfazer',
                description: undo.error || 'O equipamento pode ter sido emprestado a outra pessoa.',
              });
            }
            fetchPresent(true);
          }}
        >
          Desfazer
        </ToastAction>
      ),
    });

    fetchPresent(true);
  };

  const handleTabFinalized = async (visit: Visit) => {
    // Após finalize, libera a baia (checkout) e atualiza estado.
    setTabs((prev) => {
      const next = { ...prev };
      delete next[visit.id];
      return next;
    });
    await checkoutVisit(visit.id);
    setPresent((p) => p.filter((v) => v.id !== visit.id));
    fetchPresent(true);
  };

  /**
   * Acionado quando o admin clica "Fechar conta" no FaceVerifyDialog (membro
   * ja identificado E ja presente no clube). Cria habitualidade automaticamente
   * usando o descriptor recem-verificado e dispara o fluxo de checkout
   * apropriado, pulando a segunda verificacao facial.
   */
  const handleFacialMatchedCheckout = async (member: { id: string }, descriptor: number[]) => {
    const visit = present.find((v) => v.member.id === member.id);
    if (!visit) {
      toast({
        variant: 'destructive',
        title: 'Visita nao encontrada',
        description: 'Nao foi possivel localizar a visita ativa do membro.',
      });
      return;
    }

    // Cria habitualidade automaticamente (idempotente — backend dedupe)
    const verifyRes = await verifyFaceForCheckout({
      descriptor,
      memberId: member.id,
      visitId: visit.id,
    });
    if (verifyRes.success && verifyRes.data.matched && verifyRes.data.habituality.created > 0) {
      toast({
        title: 'Habitualidade registrada',
        description: `${verifyRes.data.habituality.created} registro(s) (${verifyRes.data.habituality.calibers.join(', ')}).`,
      });
    }

    // Dispara checkout pulando o prompt de Verificar Facial (ja verificado)
    const tab = tabs[visit.id];
    if (tab && tab.itemCount > 0) {
      // Cenario 1: tem comanda — admin ainda precisa confirmar pagamento,
      // mas pula a segunda pergunta de Verificar Facial
      setCloseTab({ visit, draft: tab.draft, skipFaceVerify: true });
      return;
    }
    if ((visit.details?.length ?? 0) === 0) {
      // Cenario 2: sem tiros — prompt de saida sem registro
      setCheckoutPrompt(visit);
      return;
    }
    // Cenario 3: tiros sem comanda — habitualidade ja foi criada, libera baia
    performCheckOut(visit);
  };

  return (
    <div className="bg-card/50 border border-border rounded-lg p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-military font-bold text-foreground tracking-wide flex items-center gap-2">
            <Users className="h-5 w-5 text-cbt-orange" />
            Presentes no Clube
          </h2>
          <p className="text-xs font-tactical text-muted-foreground/80 mt-0.5">
            Quem está no clube agora — registre chegadas, vendas, tiros e fechamento de conta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 font-tactical text-xs flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            {present.length} {present.length === 1 ? 'presente' : 'presentes'}
          </span>
          {capacity && (
            <span className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-tactical text-xs flex items-center gap-1.5">
              <Crosshair className="h-3 w-3" />
              {capacity.occupied}/{capacity.total} baias
            </span>
          )}
        </div>
      </div>

      {/* Search / quick check-in */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <CheckInSearch onPick={handleCheckIn} excludeIds={excludeIds} disabled={busy} />
        </div>
        <Button
          type="button"
          onClick={() => setFaceVerifyOpen(true)}
          disabled={busy}
          className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical h-12 gap-2 px-4 flex-shrink-0"
        >
          <ScanFace className="h-4 w-4" />
          <span className="hidden sm:inline">Facial</span>
        </Button>
      </div>

      {/* Grid of cards */}
      {loading ? (
        <div className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-cbt-orange animate-spin" />
        </div>
      ) : present.length === 0 ? (
        <div className="py-10 px-4 bg-card/40 border border-dashed border-border rounded-lg text-center">
          <User className="h-10 w-10 text-muted-foreground/60 mx-auto mb-2" />
          <p className="text-foreground font-military text-sm tracking-wide">Ninguém no clube ainda</p>
          <p className="text-muted-foreground/80 font-tactical text-xs mt-1">
            Use a busca acima para registrar a chegada de um associado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {present.map((v) => (
            <PresentCard
              key={v.id}
              visit={v}
              now={now}
              tabSummary={
                tabs[v.id]
                  ? { itemCount: tabs[v.id].itemCount, subtotal: tabs[v.id].subtotal }
                  : null
              }
              onNewSale={handleNewSale}
              onRegisterShot={(visit) =>
                setShotDialog({ visitId: visit.id, memberName: visit.member.fullName })
              }
              onIssueLoan={handleIssueLoan}
              onReturnLoan={handleReturnLoan}
              onCheckOut={handleCheckoutClick}
            />
          ))}
        </div>
      )}

      {/* Shot entry dialog */}
      <ShotEntryDialog
        visitId={shotDialog?.visitId ?? null}
        memberName={shotDialog?.memberName ?? ''}
        open={!!shotDialog}
        onOpenChange={(open) => !open && setShotDialog(null)}
        onSaved={() => fetchPresent(true)}
      />

      {/* Checkout-without-shots prompt */}
      <Dialog
        open={!!checkoutPrompt}
        onOpenChange={(open) => !open && setCheckoutPrompt(null)}
      >
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-military">Fechar conta sem tiros registrados?</DialogTitle>
            <DialogDescription className="text-muted-foreground font-tactical text-sm">
              {checkoutPrompt?.member.fullName} ainda não tem nenhum tiro registrado nesta visita.
              Quer registrar agora?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                if (checkoutPrompt) performCheckOut(checkoutPrompt);
                setCheckoutPrompt(null);
              }}
              className="font-tactical text-foreground/85"
            >
              Não, só fechar
            </Button>
            <Button
              onClick={() => {
                if (checkoutPrompt) {
                  setShotDialog({
                    visitId: checkoutPrompt.id,
                    memberName: checkoutPrompt.member.fullName,
                  });
                }
                setCheckoutPrompt(null);
              }}
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-foreground font-tactical"
            >
              <Plus className="h-4 w-4 mr-1" />
              Sim, registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comanda aberta — adicionar itens */}
      {openTab && (
        <OpenTabDialog
          open={!!openTab}
          onOpenChange={(o) => {
            if (!o) {
              // Ao fechar o dialog, refresca o resumo da comanda no card
              const visitId = openTab.visit.id;
              setOpenTab(null);
              refreshTab(visitId);
            }
          }}
          memberId={openTab.visit.member.id}
          visitId={openTab.visit.id}
          memberName={openTab.visit.member.fullName}
        />
      )}

      {/* Emprestimo de equipamento ao membro presente */}
      {loanIssueVisit && (
        <LoanIssueDialog
          open={!!loanIssueVisit}
          onOpenChange={(o) => !o && setLoanIssueVisit(null)}
          preselectedMemberId={loanIssueVisit.member.id}
          preselectedMemberName={loanIssueVisit.member.fullName}
          onCreated={() => {
            setLoanIssueVisit(null);
            fetchPresent(true);
          }}
        />
      )}

      {/* Identificacao facial — check-in OU checkout via Facial */}
      <FaceVerifyDialog
        open={faceVerifyOpen}
        onOpenChange={setFaceVerifyOpen}
        presentMemberIds={excludeIds}
        onMatched={async (member) => {
          setFaceVerifyOpen(false);
          if (excludeIds.has(member.id)) {
            // Edge-case: tinha mudado de status entre /verify e clique
            toast({
              variant: 'destructive',
              title: `${member.fullName} já está no clube.`,
            });
            return;
          }
          await handleCheckIn(member.id, member.fullName);
        }}
        onMatchedAlreadyPresent={async (member, descriptor) => {
          setFaceVerifyOpen(false);
          await handleFacialMatchedCheckout(member, descriptor);
        }}
      />

      {/* Pergunta "Registrar Facial?" no checkout (cenario 3 ou apos pagamento) */}
      {faceCheckoutPrompt && (
        <FaceRegisterPromptDialog
          open={!!faceCheckoutPrompt}
          onOpenChange={(o) => !o && setFaceCheckoutPrompt(null)}
          memberName={faceCheckoutPrompt.member.fullName}
          onSkip={() => {
            const fn = faceCaptureFollowUpRef.current;
            faceCaptureFollowUpRef.current = null;
            setFaceCheckoutPrompt(null);
            // Se nao ha follow-up explicito (cenario 3), default = performCheckOut
            const v = faceCheckoutPrompt;
            if (fn) {
              fn();
            } else if (v) {
              performCheckOut(v);
            }
          }}
          onConfirm={() => {
            const v = faceCheckoutPrompt;
            setFaceCheckoutPrompt(null);
            if (!v) return;
            // Se nao ha follow-up pre-configurado (cenario 3), seta default
            if (!faceCaptureFollowUpRef.current) {
              faceCaptureFollowUpRef.current = () => performCheckOut(v);
            }
            setFaceCheckoutTarget({
              memberId: v.member.id,
              memberName: v.member.fullName,
              visitId: v.id,
            });
          }}
        />
      )}

      {/* Verificacao facial no checkout — compara com perfil cadastrado */}
      <FaceCheckoutDialog
        open={!!faceCheckoutTarget}
        onOpenChange={(o) => {
          if (!o) {
            // Fechou sem confirmar: ainda dispara o checkout pendente (pagamento ja confirmado)
            const fn = faceCaptureFollowUpRef.current;
            faceCaptureFollowUpRef.current = null;
            setFaceCheckoutTarget(null);
            if (fn) fn();
          }
        }}
        target={faceCheckoutTarget}
        onConfirmed={() => {
          // Match ou registro inicial bem-sucedido: dispara checkout pendente
          const fn = faceCaptureFollowUpRef.current;
          faceCaptureFollowUpRef.current = null;
          if (fn) fn();
        }}
      />


      {/* Fechar conta — resumo + desconto + pagamento */}
      <CloseTabDialog
        open={!!closeTab}
        onOpenChange={(o) => !o && setCloseTab(null)}
        draft={closeTab?.draft ?? null}
        // Quando o admin entrou via "Fechar conta" do FaceVerifyDialog (skipFaceVerify),
        // pula o prompt de verificar facial pos-pagamento (ja foi feito).
        onRequestFaceRegister={
          closeTab?.skipFaceVerify
            ? undefined
            : ({ memberId, memberName, visitId }) => {
                const visit = closeTab?.visit;
                setCloseTab(null);
                if (!visit) return;
                faceCaptureFollowUpRef.current = () => handleTabFinalized(visit);
                setFaceCheckoutPrompt({
                  ...visit,
                  member: { ...visit.member, id: memberId, fullName: memberName },
                  id: visitId,
                } as Visit);
              }
        }
        onFinalized={async () => {
          if (closeTab) await handleTabFinalized(closeTab.visit);
        }}
      />
    </div>
  );
};

export default PresentMembersPanel;
