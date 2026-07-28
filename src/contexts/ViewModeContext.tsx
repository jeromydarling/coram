/**
 * ViewModeContext — Guided View vs Full Workspace toggle.
 *
 * WHAT: Provides a global UI-only toggle between "guided" (lens-filtered) and "full" (standard workspace) views.
 * WHERE: Consumed by Sidebar, Header avatar menu, and navigation guards.
 * WHY: Lets stewards and power users switch between a simplified role-adapted view and the full workspace without changing permissions.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type ViewMode = 'guided' | 'full';

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isGuidedView: boolean;
  isFullWorkspace: boolean;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

const STORAGE_KEY = 'cros-view-mode';

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { roles } = useAuth();
  const isSteward = roles.includes('steward' as any);

  // Default: stewards get full workspace, others get guided
  const getDefaultMode = (): ViewMode => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'guided' || stored === 'full') return stored;
    return isSteward ? 'full' : 'guided';
  };

  const [viewMode, setViewModeState] = useState<ViewMode>(getDefaultMode);

  // Sync default when roles load
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setViewModeState(isSteward ? 'full' : 'guided');
    }
  }, [isSteward]);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };

  return (
    <ViewModeContext.Provider value={{
      viewMode,
      setViewMode,
      isGuidedView: viewMode === 'guided',
      isFullWorkspace: viewMode === 'full',
    }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
}
