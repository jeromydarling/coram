/**
 * permissionErrors — Detect & humanize RLS / permission-denied errors.
 *
 * WHAT: Maps Supabase/Postgres permission errors to a clear pastoral message.
 * WHERE: Used by Settings save handlers and any tenant-side mutation that may
 *        hit an RLS policy the current member doesn't own.
 * WHY: Pre-mortem #7 — RLS denials were surfacing as generic "save failed"
 *      toasts, leaving non-steward members convinced the page was broken.
 */
import { toast } from '@/components/ui/sonner';

const RLS_CODES = new Set(['42501', 'PGRST301', 'PGRST116']);

export function isPermissionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; status?: number };
  if (e.code && RLS_CODES.has(e.code)) return true;
  if (e.status === 403) return true;
  const msg = (e.message || '').toLowerCase();
  return (
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('not authorized')
  );
}

/**
 * Show a friendly toast for an error from a tenant-side mutation.
 * Returns true if it handled a permission error (caller can stop further work).
 *
 * `fallback` may be a string (becomes the error toast message) or a function
 * that receives the error and is invoked when this is NOT a permission error
 * — letting callers keep their existing toast style (crosToast.gentle, etc).
 */
export function handleMutationError(
  err: unknown,
  fallback: string | ((err: unknown) => void) = 'Could not save your change.'
): boolean {
  if (isPermissionError(err)) {
    toast.error('Your steward manages this', {
      description: "You don't have permission to change this. Ask the steward of this organization.",
    });
    return true;
  }
  // Surface correlation id (request_id) on edge-function errors so support
  // can trace a failure in one round-trip instead of fishing through logs.
  const requestId = (err as { request_id?: string; context?: { request_id?: string } })?.request_id
    ?? (err as { context?: { request_id?: string } })?.context?.request_id;
  if (typeof fallback === 'function') {
    fallback(err);
  } else {
    const msg = (err as { message?: string })?.message || fallback;
    toast.error(msg, requestId ? { description: `Ref: ${requestId}` } : undefined);
  }
  return false;
}
