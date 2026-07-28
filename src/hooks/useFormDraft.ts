import { useEffect, useCallback, useRef } from 'react';

const DRAFT_PREFIX = 'profunda_draft_';

interface DraftData {
  [key: string]: unknown;
}

/**
 * Auto-saves form drafts to sessionStorage and restores on mount.
 * Draft is cleared on successful submit or explicit reset.
 */
export function useFormDraft(key: string) {
  const storageKey = `${DRAFT_PREFIX}${key}`;
  const isRestoringRef = useRef(false);

  /** Save draft to sessionStorage */
  const saveDraft = useCallback((data: DraftData) => {
    if (isRestoringRef.current) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // sessionStorage full or unavailable — silently ignore
    }
  }, [storageKey]);

  /** Restore draft from sessionStorage */
  const restoreDraft = useCallback((): DraftData | null => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        isRestoringRef.current = true;
        const data = JSON.parse(stored) as DraftData;
        // Reset flag after a tick so saveDraft doesn't fire during restore
        setTimeout(() => { isRestoringRef.current = false; }, 0);
        return data;
      }
    } catch {
      // Corrupted data — clear it
      sessionStorage.removeItem(storageKey);
    }
    return null;
  }, [storageKey]);

  /** Clear draft (call on successful submit) */
  const clearDraft = useCallback(() => {
    sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  /** Check if a draft exists */
  const hasDraft = useCallback((): boolean => {
    return sessionStorage.getItem(storageKey) !== null;
  }, [storageKey]);

  return { saveDraft, restoreDraft, clearDraft, hasDraft };
}
