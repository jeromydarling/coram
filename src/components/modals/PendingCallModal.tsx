import { useState, useEffect, useCallback } from 'react';
import { consumePendingCall, PendingCall } from '@/utils/pendingCallStorage';
import { CallModal } from '@/components/contacts/CallModal';

/**
 * Rendered once at App level. Detects when the user returns from the
 * OS phone dialer (via visibilitychange / focus) and auto-opens the
 * CallModal using the target saved in sessionStorage.
 */
export function PendingCallModal() {
  const [pending, setPending] = useState<PendingCall | null>(null);

  const checkPending = useCallback(() => {
    const entry = consumePendingCall();
    if (entry) setPending(entry);
  }, []);

  useEffect(() => {
    // Check on mount (covers full page reload)
    checkPending();

    // Check when user returns to the tab/app
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkPending();
      }
    };
    const onFocus = () => checkPending();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [checkPending]);

  if (!pending) return null;

  return (
    <CallModal
      open={true}
      onOpenChange={(open) => { if (!open) setPending(null); }}
      contactId={pending.contactId}
      contactName={pending.contactName}
      opportunityId={pending.opportunityId}
      metroId={pending.metroId}
    />
  );
}
