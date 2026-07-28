/**
 * RoleContext — Marketing-side role identity provider.
 *
 * WHAT: Stores which role the visitor identifies with (shepherd/companion/visitor/leader).
 * WHERE: Wraps public marketing pages.
 * WHY: Allows narrative content to adapt based on visitor role resonance.
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type MarketingRole = 'shepherd' | 'companion' | 'visitor' | 'leader' | null;

interface RoleContextValue {
  role: MarketingRole;
  setRole: (role: MarketingRole) => void;
  clearRole: () => void;
}

const STORAGE_KEY = 'cros_role';
const RoleCtx = createContext<RoleContextValue | undefined>(undefined);

export function MarketingRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<MarketingRole>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as MarketingRole) || null;
    } catch {
      return null;
    }
  });

  const setRole = (r: MarketingRole) => {
    setRoleState(r);
    try {
      if (r) localStorage.setItem(STORAGE_KEY, r);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  };

  const clearRole = () => setRole(null);

  // Sync from URL param on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRole = params.get('role') as MarketingRole;
      if (urlRole && ['shepherd', 'companion', 'visitor', 'leader'].includes(urlRole)) {
        setRole(urlRole);
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <RoleCtx.Provider value={{ role, setRole, clearRole }}>
      {children}
    </RoleCtx.Provider>
  );
}

export function useMarketingRole() {
  const ctx = useContext(RoleCtx);
  if (!ctx) throw new Error('useMarketingRole must be used within MarketingRoleProvider');
  return ctx;
}
