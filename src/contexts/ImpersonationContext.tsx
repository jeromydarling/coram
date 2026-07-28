/**
 * ImpersonationContext — Global state for admin "View As" impersonation mode.
 *
 * WHAT: Tracks active impersonation session (Path B: admin keeps their auth, views data as target user).
 * WHERE: Wraps the app inside AuthProvider.
 * WHY: Enables admin to experience the app as a specific user in a demo tenant without token minting.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface ImpersonationSession {
  sessionId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  targetUserId: string;
  targetDisplayName: string;
  isDemo: boolean;
  expiresAt: string;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  session: ImpersonationSession | null;
  startImpersonation: (tenantId: string, targetUserId: string, reason?: string) => Promise<boolean>;
  stopImpersonation: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const STORAGE_KEY = 'cros_impersonation_session';

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ImpersonationSession | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as ImpersonationSession;
      // Auto-expire
      if (new Date(parsed.expiresAt) <= new Date()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const startImpersonation = useCallback(async (
    tenantId: string, targetUserId: string, reason?: string
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('impersonation-start', {
        body: { tenant_id: tenantId, target_user_id: targetUserId, reason },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Failed to start impersonation');

      const newSession: ImpersonationSession = {
        sessionId: data.impersonation_session_id,
        tenantId: data.tenant_id,
        tenantSlug: data.tenant_slug,
        tenantName: data.tenant_name,
        targetUserId: data.target_user_id,
        targetDisplayName: data.target_display_name,
        isDemo: data.is_demo,
        expiresAt: data.expires_at,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      setSession(newSession);
      toast.success(`Now viewing as ${newSession.targetDisplayName}`);
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Impersonation failed');
      return false;
    }
  }, []);

  const stopImpersonation = useCallback(async () => {
    if (!session) return;
    try {
      await supabase.functions.invoke('impersonation-end', {
        body: { impersonation_session_id: session.sessionId },
      });
    } catch {
      // Best-effort end
    }
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    toast.info('Impersonation ended. Returned to admin view.');
  }, [session]);

  return (
    <ImpersonationContext.Provider value={{
      isImpersonating: !!session,
      session,
      startImpersonation,
      stopImpersonation,
    }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider');
  return ctx;
}
