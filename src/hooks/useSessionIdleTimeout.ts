/**
 * useSessionIdleTimeout — Auto-logout after prolonged inactivity.
 *
 * WHAT: Monitors user activity and signs out after IDLE_LIMIT_MS of inactivity.
 * WHERE: Mounted once inside GlobalEffects.
 * WHY: Prevents unattended sessions from remaining authenticated indefinitely.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/** 30 minutes of inactivity before auto-logout */
const IDLE_LIMIT_MS = 30 * 60 * 1000;
/** Warning shown 2 minutes before logout */
const WARNING_BEFORE_MS = 2 * 60 * 1000;

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'pointermove'] as const;

export function useSessionIdleTimeout() {
  const { user, signOut } = useAuth();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningShown = useRef(false);

  const clearTimers = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
  }, []);

  const handleLogout = useCallback(async () => {
    toast.info('You have been signed out due to inactivity.', { duration: 6000 });
    await signOut();
  }, [signOut]);

  const resetTimers = useCallback(() => {
    clearTimers();
    warningShown.current = false;

    // Warning timer
    warningTimer.current = setTimeout(() => {
      if (!warningShown.current) {
        warningShown.current = true;
        toast.warning('Your session will expire in 2 minutes due to inactivity.', {
          duration: 10000,
          id: 'idle-warning',
        });
      }
    }, IDLE_LIMIT_MS - WARNING_BEFORE_MS);

    // Logout timer
    idleTimer.current = setTimeout(() => {
      handleLogout();
    }, IDLE_LIMIT_MS);
  }, [clearTimers, handleLogout]);

  useEffect(() => {
    if (!user) return;

    resetTimers();

    const handler = () => resetTimers();
    ACTIVITY_EVENTS.forEach((e) => document.addEventListener(e, handler, { passive: true }));

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((e) => document.removeEventListener(e, handler));
    };
  }, [user, resetTimers, clearTimers]);
}
