/**
 * useOperatorBookmarks — Persists operator sidebar bookmarks in localStorage.
 *
 * WHAT: Manages a set of bookmarked href paths for the operator console.
 * WHERE: Used by OperatorLayout sidebar.
 * WHY: Lets operators pin frequently-used pages for quick access across all views.
 */
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'cros-operator-bookmarks';

function loadBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveBookmarks(bookmarks: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...bookmarks]));
}

export function useOperatorBookmarks() {
  const [bookmarks, setBookmarks] = useState<Set<string>>(loadBookmarks);

  const toggleBookmark = useCallback((href: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      saveBookmarks(next);
      return next;
    });
  }, []);

  const isBookmarked = useCallback((href: string) => bookmarks.has(href), [bookmarks]);

  return { bookmarks, toggleBookmark, isBookmarked };
}
