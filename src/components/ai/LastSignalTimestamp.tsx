/**
 * LastSignalTimestamp — Calm "last refreshed" label for AI-generated surfaces.
 *
 * WHAT: Small muted text that says "Last signal · 12m ago" so users know
 *       whether what they're reading is fresh or stale.
 * WHERE: Top-right of any AI-generated card / banner / narrative section.
 * WHY: Per Wave 4 of the pre-mortem plan — invisible AI must remain visibly
 *      honest. Users should never wonder if the screen is alive.
 */
import { formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  at?: string | Date | null;
  label?: string;
  className?: string;
}

export function LastSignalTimestamp({ at, label = 'Last signal', className }: Props) {
  if (!at) {
    return (
      <span className={cn('text-[11px] text-muted-foreground/70 italic', className)}>
        {label} · awaiting
      </span>
    );
  }
  const date = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(date.getTime())) return null;
  return (
    <span className={cn('text-[11px] text-muted-foreground/80', className)}>
      {label} · {formatDistanceToNowStrict(date, { addSuffix: true })}
    </span>
  );
}
