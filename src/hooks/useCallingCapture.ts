/**
 * useCallingCapture — Captures calling selection from URL params into localStorage.
 *
 * WHAT: Reads ?calling= query param and persists to localStorage.cros_calling.
 * WHERE: Calling pages, marketing pages with calling links.
 * WHY: Enables continuity from marketing → onboarding by pre-selecting calling.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const STORAGE_KEY = 'cros_calling';

export function useCallingCapture() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const calling = searchParams.get('calling');
    if (calling) {
      localStorage.setItem(STORAGE_KEY, calling);
    }
  }, [searchParams]);
}

/** Read the stored calling (if any) */
export function getStoredCalling(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Clear the stored calling after use */
export function clearStoredCalling() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
