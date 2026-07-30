/**
 * Loading, empty, and failed — the three states screens usually get wrong.
 *
 * The one that matters is Empty. Coram's access model is turf-scoped and
 * role-scoped at the database, so a person genuinely can be looking at a
 * correct, working screen with nothing on it. Rendered as a bare "no results",
 * a functioning permission boundary looks like a broken product — and that is
 * how a working control gets reported as a bug and then "fixed". So Empty
 * insists on a reason, and Denied says the quiet part out loud.
 */

import type { ReactNode } from 'react';
import { Loader2, Lock, TriangleAlert } from 'lucide-react';

import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function Loading({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** For a button mid-flight. §8.4 forbids motion, so this does not spin. */
export function Busy({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn('mr-2 h-4 w-4', className)} />;
}

export function Empty({
  title,
  reason,
  action,
}: {
  title: string;
  /** Why it is empty. Never "no results" — say which kind of nothing this is. */
  reason: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-10 text-center">
      <p className="font-display text-lg">{title}</p>
      <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
        {reason}
      </p>
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Empty because you are not allowed, which is a different fact entirely. */
export function Denied({ what, why }: { what: string; why: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-deep/25 bg-deep/[0.06] px-5 py-4">
      <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-deep" />
      <div>
        <p className="text-sm font-medium">{what}</p>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{why}</p>
      </div>
    </div>
  );
}

/**
 * A failure, in the words the API used.
 *
 * A 403 is shown as the boundary it is rather than as an error, because being
 * told "forbidden" in red when you are simply an observer teaches you that the
 * product is broken instead of that the product is working.
 */
export function Failed({ error, what }: { error: unknown; what?: string }) {
  const status = error instanceof ApiError ? error.status : 0;
  const message =
    error instanceof Error ? error.message : 'Something went wrong and we do not know what.';

  if (status === 403) {
    return <Denied what={what ?? 'Your role does not reach this'} why={message} />;
  }

  return (
    <div
      role="alert"
      className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-5 py-4"
    >
      <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div>
        <p className="text-sm font-medium">{what ?? 'That did not work'}</p>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
