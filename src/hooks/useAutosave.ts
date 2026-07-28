/**
 * useAutosave — Universal autosave hook for CROS forms.
 *
 * WHAT: Debounced autosave to sessionStorage with silent "Held." confirmation.
 * WHERE: Every form with long-form text or multi-field input.
 * WHY: "There must never be a scenario where long-form work is lost."
 *       — CROS Tone & Language Charter, Autosave Mandate.
 *
 * Features:
 *  - Silent save every 3 seconds after typing
 *  - Draft recovery after refresh/crash
 *  - "Held." toast on save (configurable)
 *  - "We found where you left off." on recovery
 *  - Compass notification if save fails
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { crosToast } from '@/lib/crosToast';
import { FRICTION_COPY } from '@/lib/toneCharter';

const DRAFT_PREFIX = 'cros_draft_';
const DEFAULT_DEBOUNCE_MS = 3000;

interface AutosaveOptions {
  /** Unique key for this form (e.g. 'event-edit-{id}') */
  key: string;
  /** Debounce interval in ms (default: 3000) */
  debounceMs?: number;
  /** Show "Held." toast on save (default: false — truly silent) */
  showToast?: boolean;
  /** Show recovery toast when draft is restored (default: true) */
  showRecoveryToast?: boolean;
}

interface AutosaveReturn<T> {
  /** Call this whenever form data changes */
  save: (data: T) => void;
  /** Attempt to restore a saved draft. Returns null if none. */
  restore: () => T | null;
  /** Clear the draft (call on successful submit) */
  clear: () => void;
  /** Whether a draft exists */
  hasDraft: boolean;
  /** Whether we just recovered a draft this session */
  wasRecovered: boolean;
}

export function useAutosave<T = Record<string, unknown>>(
  options: AutosaveOptions
): AutosaveReturn<T> {
  const { key, debounceMs = DEFAULT_DEBOUNCE_MS, showToast = false, showRecoveryToast = true } = options;
  const storageKey = `${DRAFT_PREFIX}${key}`;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wasRecovered, setWasRecovered] = useState(false);
  const lastSavedRef = useRef<string>('');

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const writeToDisk = useCallback(
    (data: T) => {
      try {
        const serialized = JSON.stringify(data);
        // Skip if identical to last save
        if (serialized === lastSavedRef.current) return;
        sessionStorage.setItem(storageKey, serialized);
        lastSavedRef.current = serialized;
        if (showToast) {
          crosToast.held();
        }
      } catch {
        // sessionStorage full — notify gently
        crosToast.gentle(FRICTION_COPY.autosaveFallback);
      }
    },
    [storageKey, showToast]
  );

  /** Debounced save */
  const save = useCallback(
    (data: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => writeToDisk(data), debounceMs);
    },
    [writeToDisk, debounceMs]
  );

  /** Restore draft */
  const restore = useCallback((): T | null => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as T;
        lastSavedRef.current = stored;
        setWasRecovered(true);
        if (showRecoveryToast) {
          // Slight delay so it appears after page renders
          setTimeout(() => crosToast.info(FRICTION_COPY.draftRecovered), 300);
        }
        return parsed;
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
    return null;
  }, [storageKey, showRecoveryToast]);

  /** Clear draft */
  const clear = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    lastSavedRef.current = '';
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [storageKey]);

  /** Check if draft exists */
  const hasDraft = (() => {
    try {
      return sessionStorage.getItem(storageKey) !== null;
    } catch {
      return false;
    }
  })();

  return { save, restore, clear, hasDraft, wasRecovered };
}
