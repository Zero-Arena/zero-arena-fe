// OperatorBadge — small chip indicating who's signing the live cert's
// EpochCommitted updates for an iNFT. Pure render; pass `info` from
// inferOperatorBadge() in lib/chain/operators.

import type { OperatorBadgeInfo } from '@/lib/chain/operators';

export interface OperatorBadgeProps {
  info: OperatorBadgeInfo | null;
  /** "sm" for table rows + cards, "md" for detail page header. */
  size?: 'sm' | 'md';
}

const styleByKind: Record<OperatorBadgeInfo['kind'], string> = {
  'tee-attested':
    'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  'operator-attested':
    'bg-sky-500/15 text-sky-300 border-sky-500/40',
  'owner-operated':
    'bg-amber-500/15 text-amber-300 border-amber-500/40',
};

const sizeClass = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
} as const;

export function OperatorBadge({ info, size = 'sm' }: OperatorBadgeProps): React.ReactElement | null {
  if (!info) return null;

  const inner = (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border font-medium',
        sizeClass[size],
        styleByKind[info.kind],
      ].join(' ')}
      title={info.tooltip}
    >
      {info.label}
    </span>
  );

  if (info.href) {
    return (
      <a href={info.href} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
        {inner}
      </a>
    );
  }
  return inner;
}
