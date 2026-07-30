/**
 * One way to tell someone what just happened.
 *
 * Two toast systems are installed — shadcn's Radix one and sonner — and only
 * sonner's Toaster is mounted. Screens importing the other got silence, which
 * is the worst possible failure mode for "we deleted that for you". So this is
 * the only import screens use, and it wraps the one that is actually rendered.
 *
 * `failed` takes the error rather than a string because the API writes better
 * messages than we would guess: "Promote another steward before stepping down
 * from the last one" beats "Something went wrong".
 */

import { toast } from 'sonner';

export const say = (title: string, description?: string) => toast.success(title, { description });

export const warn = (title: string, description?: string) => toast.warning(title, { description });

export const failed = (title: string, error: unknown) =>
  toast.error(title, {
    description: error instanceof Error ? error.message : 'We do not know what went wrong.',
  });

/**
 * Several routes answer with a sentence the person needs to read — "closed, and
 * everything on this case is deleted in thirty days". When one does, show it
 * instead of our generic confirmation.
 */
export const sayResult = (fallback: string, notice?: string) =>
  notice ? toast(fallback, { description: notice, duration: 8_000 }) : toast.success(fallback);
