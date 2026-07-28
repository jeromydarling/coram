import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Persists the active tab in URL search params so tab state
 * survives browser tab switches, mobile backgrounding, and navigation.
 */
export function useTabPersistence(defaultTab: string, paramName = 'tab') {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get(paramName) || defaultTab;

  const setActiveTab = useCallback(
    (tab: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (tab === defaultTab) {
          next.delete(paramName);
        } else {
          next.set(paramName, tab);
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams, defaultTab, paramName],
  );

  return { activeTab, setActiveTab };
}
