/**
 * useToastDedup — Toast deduplication guard.
 *
 * WHAT: Prevents duplicate toasts from firing on re-renders or double callbacks.
 * WHERE: Wrap any mutation's onSuccess/onError that might fire multiple times.
 * WHY: React Query can fire onSuccess twice during rapid re-renders, causing double toasts.
 */
import { useRef, useCallback } from 'react';
import { toast } from 'sonner';

const DEDUP_WINDOW_MS = 2000;

/**
 * Returns a guarded toast function that deduplicates by message within a time window.
 */
export function useToastDedup() {
  const lastToast = useRef<{ message: string; at: number } | null>(null);

  const dedupToast = useCallback(
    (
      type: 'success' | 'error' | 'warning' | 'info',
      message: string,
      options?: { id?: string; duration?: number }
    ) => {
      const now = Date.now();
      if (
        lastToast.current &&
        lastToast.current.message === message &&
        now - lastToast.current.at < DEDUP_WINDOW_MS
      ) {
        return; // Skip duplicate
      }

      lastToast.current = { message, at: now };
      toast[type](message, options);
    },
    []
  );

  return dedupToast;
}
