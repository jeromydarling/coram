/**
 * DemoModeContext — Read-only demo experience provider.
 *
 * WHAT: Provides demo state (active, role, tenant) and write-interception utilities.
 * WHERE: Wraps the entire app when demo mode is active.
 * WHY: Allows prospects to explore CROS without creating auth sessions or writing data.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { LensRole } from '@/lib/ministryRole';
import { activateDemoProxy, deactivateDemoProxy } from '@/lib/demoWriteProxy';

const DEMO_STORAGE_KEY = 'cros_demo_session';
const DEMO_TENANT_SLUG = 'community-tech-alliance';
const DEMO_TENANT_ID = 'a2916470-63cd-464b-9f70-17c6a75a5416';

export interface DemoSession {
  name: string;
  email: string;
  location: string;
  role: LensRole;
  grantedAt: string;
}

interface DemoModeContextValue {
  isDemoMode: boolean;
  demoSession: DemoSession | null;
  demoTenantSlug: string;
  demoTenantId: string;
  demoRole: LensRole;
  startDemo: (session: DemoSession) => void;
  endDemo: () => void;
  setDemoRole: (role: LensRole) => void;
  /** Simulates a successful write — returns true and shows a toast */
  simulateWrite: (actionLabel?: string) => boolean;
}

const DemoModeCtx = createContext<DemoModeContextValue | undefined>(undefined);

function loadSession(): DemoSession | null {
  try {
    const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: DemoSession | null) {
  try {
    if (session) {
      sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(DEMO_STORAGE_KEY);
    }
  } catch { /* ignore */ }
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(loadSession);

  // Activate/deactivate Supabase client write interception based on demo state
  useEffect(() => {
    if (session) {
      activateDemoProxy();
    } else {
      deactivateDemoProxy();
    }
    return () => {
      deactivateDemoProxy();
    };
  }, [session]);

  const startDemo = useCallback((s: DemoSession) => {
    setSession(s);
    saveSession(s);
  }, []);

  const endDemo = useCallback(() => {
    setSession(null);
    saveSession(null);
  }, []);

  const setDemoRole = useCallback((role: LensRole) => {
    setSession(prev => {
      if (!prev) return prev;
      const updated = { ...prev, role };
      saveSession(updated);
      return updated;
    });
  }, []);

  const simulateWrite = useCallback((actionLabel?: string) => {
    toast.success(actionLabel || 'Changes saved', {
      description: 'Demo mode — no data was written',
      duration: 2000,
    });
    return true;
  }, []);

  return (
    <DemoModeCtx.Provider value={{
      isDemoMode: !!session,
      demoSession: session,
      demoTenantSlug: DEMO_TENANT_SLUG,
      demoTenantId: DEMO_TENANT_ID,
      demoRole: session?.role ?? 'companion',
      startDemo,
      endDemo,
      setDemoRole,
      simulateWrite,
    }}>
      {children}
    </DemoModeCtx.Provider>
  );
}

export function useDemoMode() {
  const ctx = useContext(DemoModeCtx);
  if (!ctx) throw new Error('useDemoMode must be used within DemoModeProvider');
  return ctx;
}

/**
 * Hook to guard write operations in demo mode.
 * Returns a wrapper that intercepts mutations when demo is active.
 * NOTE: With the global proxy active, this is now a secondary safety net.
 */
export function useDemoGuard() {
  const { isDemoMode, simulateWrite } = useDemoMode();

  const guardedMutate = useCallback(
    <T,>(realMutate: () => T, label?: string): T | undefined => {
      if (isDemoMode) {
        simulateWrite(label);
        return undefined;
      }
      return realMutate();
    },
    [isDemoMode, simulateWrite],
  );

  return { isDemoMode, guardedMutate, simulateWrite };
}
