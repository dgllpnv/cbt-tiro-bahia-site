import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, User, Users, Crosshair, Loader2, Plus, Receipt, ShoppingCart } from 'lucide-react';
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
  memberNumber: string;
  cpf?: string;
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
        const res = await api.get('/api/users', {
          params: { search: text.trim(), limit: 8, status: 'ACTIVE' },
        });
        if (res.data?.success) {
          const data: SearchHit[] = Array.isArray(res.data.data) ? res.data.data : [];
          setResults(data.filter((m) => !excludeIds.has(m.id)));
          setOpen(true);
        }
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
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
      <input
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Buscar associado para registrar chegada..."
        className="w-full h-12 pl-10 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white font-tactical text-sm placeholder:text-gray-500 focus:border-cbt-orange focus:outline-none disabled:opacity-50"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cbt-orange animate-spin" />
      )}

      {open && results.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handlePick(m)}
              className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0"
            >
              <div className="h-9 w-9 rounded-full bg-cbt-orange/20 text-cbt-orange flex items-center justify-center font-tactical text-xs font-bold">
                {getInitials(m.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-tactical text-sm truncate">{m.fullName}</p>
                <p className="text-gray-500 font-tactical text-xs">Nº {m.memberNumber}</p>
              </div>
              <span className="text-cbt-orange text-xs font-tactical">Registrar →</span>
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && !loading && results.length === 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 text-center">
          <p className="text-gray-500 font-tactical text-sm">Nenhum associado encontrado</p>
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
  onCheckOut: (visit: Visit) => void;
}

const PresentCard = ({
  visit,
  now,
  tabSummary,
  onNewSale,
  onRegisterShot,
  onCheckOut,
}: PresentCardProps) => {
  const totalShots = totalShotsFor(visit);
  const hasTab = (tabSummary?.itemCount ?? 0) > 0;
  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-lg p-4 flex flex-col gap-3 hover:border-cbt-orange/40 hover:ring-1 hover:ring-cbt-orange/20 transition-all">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-full bg-cbt-orange/20 text-cbt-orange flex items-center justify-center font-tactical text-sm font-bold flex-shrink-0">
          {getInitials(visit.member.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white font-tactical text-sm font-semibold truncate">
            {visit.member.fullName}
          </p>
          <p className="text-gray-500 font-tactical text-xs">
            Nº {visit.member.memberNumber ?? '—'} · entrou {formatTime(visit.checkInTime)}
          </p>
          <p className="text-gray-300 font-tactical text-xs mt-0.5">
            <span className="text-cbt-orange">{formatDuration(visit.checkInTime, now)}</span>
            {visit.lane && <span className="text-gray-500"> · {visit.lane.name}</span>}
          </p>
        </div>
        {hasTab && (
          <span
            className="px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/40 text-green-300 font-tactical text-[10px] flex items-center gap-1"
            title={`Comanda em aberto: ${tabSummary?.itemCount} ite${tabSummary?.itemCount === 1 ? 'm' : 'ns'} • ${formatCurrency(tabSummary?.subtotal ?? 0)}`}
          >
            <ShoppingCart className="h-3 w-3" />
            {tabSummary!.itemCount} · {formatCurrency(tabSummary!.subtotal)}
          </span>
        )}
      </div>

      {/* Top-3 shots pills */}
      <div className="px-2 py-1.5 bg-gray-800/60 rounded-md text-xs font-tactical">
        {totalShots === 0 ? (
          <div className="flex items-center gap-2 text-gray-500">
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
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-900/70 border border-gray-700 text-gray-300"
                  title={d.firearmName ? `${d.firearmName} · ${d.caliber}` : d.caliber}
                >
                  <Icon className="h-3 w-3" style={{ color: iconColor }} />
                  <span className="text-white">{d.caliber}</span>
                  <span className="text-cbt-orange">{d.shotsFired}</span>
                </span>
              );
            })}
            {(visit.details?.length ?? 0) > 3 && (
              <span className="text-gray-500">+{(visit.details!.length) - 3}</span>
            )}
            <span className="text-gray-500 ml-auto">{totalShots} total</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onNewSale(visit)}
          className="bg-gray-800 border-gray-700 text-gray-200 hover:bg-green-500/10 hover:border-green-500/40 hover:text-green-300 font-tactical h-9"
        >
          <ShoppingCart className="h-3.5 w-3.5 mr-1" />
          Venda
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRegisterShot(visit)}
          className="bg-gray-800 border-gray-700 text-gray-200 hover:bg-cbt-orange/10 hover:border-cbt-orange/40 hover:text-cbt-orange font-tactical h-9"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Tiro
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCheckOut(visit)}
          className="bg-gray-800 border-gray-700 text-gray-200 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-300 font-tactical h-9"
        >
          <Receipt className="h-3.5 w-3.5 mr-1" />
          Fechar
        </Button>
      </div>
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
  const [closeTab, setCloseTab] = useState<{ visit: Visit; draft: Transaction } | null>(null);

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
      performCheckOut(visit);
    }
  };

  const handleNewSale = (visit: Visit) => {
    setOpenTab({ visit });
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

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-military font-bold text-white tracking-wide flex items-center gap-2">
            <Users className="h-5 w-5 text-cbt-orange" />
            Presentes no Clube
          </h2>
          <p className="text-xs font-tactical text-gray-500 mt-0.5">
            Quem está no clube agora — registre chegadas, vendas, tiros e fechamento de conta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 font-tactical text-xs flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            {present.length} {present.length === 1 ? 'presente' : 'presentes'}
          </span>
          {capacity && (
            <span className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 font-tactical text-xs flex items-center gap-1.5">
              <Crosshair className="h-3 w-3" />
              {capacity.occupied}/{capacity.total} baias
            </span>
          )}
        </div>
      </div>

      {/* Search / quick check-in */}
      <div className="mb-4">
        <CheckInSearch onPick={handleCheckIn} excludeIds={excludeIds} disabled={busy} />
      </div>

      {/* Grid of cards */}
      {loading ? (
        <div className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-cbt-orange animate-spin" />
        </div>
      ) : present.length === 0 ? (
        <div className="py-10 px-4 bg-gray-900/40 border border-dashed border-gray-700 rounded-lg text-center">
          <User className="h-10 w-10 text-gray-600 mx-auto mb-2" />
          <p className="text-white font-military text-sm tracking-wide">Ninguém no clube ainda</p>
          <p className="text-gray-500 font-tactical text-xs mt-1">
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
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-military">Fechar conta sem tiros registrados?</DialogTitle>
            <DialogDescription className="text-gray-400 font-tactical text-sm">
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
              className="font-tactical text-gray-300"
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
              className="bg-cbt-orange hover:bg-cbt-orange/90 text-white font-tactical"
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

      {/* Fechar conta — resumo + desconto + pagamento */}
      <CloseTabDialog
        open={!!closeTab}
        onOpenChange={(o) => !o && setCloseTab(null)}
        draft={closeTab?.draft ?? null}
        onFinalized={async () => {
          if (closeTab) await handleTabFinalized(closeTab.visit);
        }}
      />
    </div>
  );
};

export default PresentMembersPanel;
