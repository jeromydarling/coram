/**
 * useAccessibilityMode — Persistent accessibility mode toggle.
 *
 * WHAT: Manages the a11y-mode class on <html> and persists preference to localStorage.
 * WHERE: Header toggle, MainLayout, any component needing a11y state.
 * WHY: CROS serves diverse users — accessibility is a core expression of the mission.
 */
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'cros_a11y_mode';

export function useAccessibilityMode() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Sync class to <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (enabled) {
      root.classList.add('a11y-mode');
    } else {
      root.classList.remove('a11y-mode');
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // localStorage unavailable — graceful degradation
    }
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled(prev => !prev);
  }, []);

  return { enabled, toggle };
}
