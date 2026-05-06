import { cn } from '@/lib/utils';

export type MemberAvatarSize = 'sm' | 'md' | 'lg';

interface MemberAvatarProps {
  fullName: string;
  /** thumbnail base64 do FaceProfile mais recente. null/undefined → renderiza iniciais */
  facePhoto?: string | null;
  size?: MemberAvatarSize;
  className?: string;
  /** Override do ring. Default: ring-2 ring-cbt-orange/40 */
  ringClassName?: string;
}

const SIZE_CLASSES: Record<MemberAvatarSize, { box: string; text: string }> = {
  sm: { box: 'h-9 w-9', text: 'text-xs' },
  md: { box: 'h-12 w-12', text: 'text-base' },
  lg: { box: 'h-24 w-24', text: 'text-2xl' },
};

function getInitials(fullName: string): string {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  // Primeira + ultima — pula sobrenomes intermediarios (de, da, dos, e, etc.)
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return `${first}${last}`.toUpperCase();
}

const MemberAvatar = ({
  fullName,
  facePhoto,
  size = 'sm',
  className,
  ringClassName = 'ring-2 ring-cbt-orange/40',
}: MemberAvatarProps) => {
  const sz = SIZE_CLASSES[size];

  if (facePhoto) {
    return (
      <img
        src={facePhoto}
        alt={fullName}
        className={cn(
          'rounded-full object-cover flex-shrink-0 bg-muted',
          sz.box,
          ringClassName,
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center flex-shrink-0 bg-cbt-orange/15 text-cbt-orange font-military font-bold tracking-wide select-none',
        sz.box,
        sz.text,
        ringClassName,
        className,
      )}
      aria-label={fullName}
      title={fullName}
    >
      {getInitials(fullName)}
    </div>
  );
};

export default MemberAvatar;
