/**
 * useArchetypeCapture — Captures archetype selection from URL params into localStorage.
 *
 * WHAT: Reads ?archetype= query param and persists to localStorage.cros_archetype.
 * WHERE: Archetype deep pages, marketing pages with archetype links.
 * WHY: Enables continuity from marketing → onboarding by pre-selecting archetype.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const STORAGE_KEY = 'cros_archetype';

export function useArchetypeCapture() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const archetype = searchParams.get('archetype');
    if (archetype) {
      localStorage.setItem(STORAGE_KEY, archetype);
    }
  }, [searchParams]);
}

/** Read the stored archetype (if any) */
export function getStoredArchetype(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Clear the stored archetype after use */
export function clearStoredArchetype() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
