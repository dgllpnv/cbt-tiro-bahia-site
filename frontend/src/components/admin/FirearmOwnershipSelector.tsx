import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { FIREARM_CATEGORIES } from '@/lib/firearmsCatalog';
import { listMemberFirearms, type MemberFirearm } from '@/services/memberFirearmsService';
import type { FirearmOwnership } from '@/services/visitDetailsService';

// =====================================================
// FirearmOwnershipSelector — por linha de tiro: arma "Propria" ou "Terceiro".
// Propria: lista as armas ativas do acervo do associado como chips; ao
// escolher uma, o pai preenche categoria/nome/calibre e guarda o id.
// Sem escolha = null (nao informado). Terceiro = fluxo livre.
// =====================================================

export const OWNERSHIP_LABEL: Record<FirearmOwnership, string> = {
  OWN: 'Própria',
  THIRD_PARTY: 'Terceiro',
};

export function memberFirearmName(f: MemberFirearm): string {
  return [f.brand, f.model].filter(Boolean).join(' ').trim() || FIREARM_CATEGORIES[f.category].label;
}

function memberFirearmLabel(f: MemberFirearm): string {
  const name = memberFirearmName(f);
  return f.caliber ? `${name} · ${f.caliber}` : name;
}

/** Badge pequeno para listagens. Nada quando null. */
export const OwnershipBadge = ({ ownership }: { ownership?: FirearmOwnership | null }) => {
  if (!ownership) return null;
  const own = ownership === 'OWN';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0 rounded border text-[10px] font-tactical leading-4 ${
        own
          ? 'bg-cbt-orange/15 border-cbt-orange/40 text-cbt-orange'
          : 'bg-muted border-border text-muted-foreground'
      }`}
    >
      {OWNERSHIP_LABEL[ownership]}
    </span>
  );
};

const chipCls = (active: boolean) =>
  `px-3 py-1.5 rounded-md border text-xs font-tactical transition-colors ${
    active
      ? 'bg-cbt-orange/20 border-cbt-orange text-cbt-orange'
      : 'bg-muted border-border text-foreground/85 hover:border-muted-foreground/30'
  }`;

interface Props {
  memberId: string;
  ownership: FirearmOwnership | null;
  memberFirearmId: string | null;
  /** Rotulo mostrado quando o id vinculado nao esta mais na lista ativa (edicao). */
  fallbackLabel?: string;
  onOwnershipChange: (next: FirearmOwnership | null) => void;
  /** null = desvinculou (seguir com arma livre). */
  onPickMemberFirearm: (firearm: MemberFirearm | null) => void;
}

const FirearmOwnershipSelector = ({
  memberId,
  ownership,
  memberFirearmId,
  fallbackLabel,
  onOwnershipChange,
  onPickMemberFirearm,
}: Props) => {
  const [firearms, setFirearms] = useState<MemberFirearm[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ownership !== 'OWN' || !memberId) return;
    let cancelled = false;
    setLoading(true);
    listMemberFirearms(memberId).then((res) => {
      if (cancelled) return;
      setFirearms(res.success ? res.data.filter((f) => f.isActive) : []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ownership, memberId]);

  const options: Array<{ value: FirearmOwnership; label: string }> = [
    { value: 'OWN', label: OWNERSHIP_LABEL.OWN },
    { value: 'THIRD_PARTY', label: OWNERSHIP_LABEL.THIRD_PARTY },
  ];
  const missingLinked =
    !!memberFirearmId && !!firearms && !firearms.some((f) => f.id === memberFirearmId);

  return (
    <div className="space-y-2">
      <Label className="text-foreground/85 font-tactical text-xs">
        Origem da arma <span className="text-muted-foreground/70">(opcional)</span>
      </Label>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onOwnershipChange(ownership === o.value ? null : o.value)}
            className={`flex-1 ${chipCls(ownership === o.value)}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {ownership === 'OWN' && (
        <div className="space-y-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/80" />
          ) : firearms && firearms.length === 0 && !memberFirearmId ? (
            <p className="text-xs font-tactical text-muted-foreground/80">
              Nenhuma arma cadastrada para este associado. Informe a arma abaixo.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(firearms ?? []).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onPickMemberFirearm(memberFirearmId === f.id ? null : f)}
                  className={chipCls(memberFirearmId === f.id)}
                >
                  {memberFirearmLabel(f)}
                </button>
              ))}
              {missingLinked && (
                <button type="button" onClick={() => onPickMemberFirearm(null)} className={chipCls(true)}>
                  {fallbackLabel || 'Arma vinculada'}
                </button>
              )}
              {firearms && firearms.length > 0 && (
                <button
                  type="button"
                  onClick={() => onPickMemberFirearm(null)}
                  className={chipCls(!memberFirearmId)}
                >
                  Outra arma…
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FirearmOwnershipSelector;
