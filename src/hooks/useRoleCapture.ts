/**
 * useRoleCapture — Captures role selection from URL params into localStorage.
 *
 * WHAT: Reads ?role= query param and persists to localStorage.cros_role.
 * WHERE: Role deep pages, marketing pages with role links.
 * WHY: Enables continuity from marketing → onboarding by pre-selecting role.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const STORAGE_KEY = 'cros_role';

export function useRoleCapture() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const role = searchParams.get('role');
    if (role) {
      localStorage.setItem(STORAGE_KEY, role);
    }
  }, [searchParams]);
}

/** Read the stored role (if any) */
export function getStoredRole(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Clear the stored role after use */
export function clearStoredRole() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
