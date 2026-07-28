/**
 * useOnlineStatus — Tracks browser online/offline state.
 *
 * WHAT: Returns current online status and shows toast on connectivity changes.
 * WHERE: Mounted inside GlobalEffects for app-wide awareness.
 * WHY: Users need clear feedback when network is unavailable to avoid silent failures.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored.', { id: 'network-status', duration: 3000 });
    };
    const goOffline = () => {
      setIsOnline(false);
      toast.error('You are offline. Changes may not be saved.', {
        id: 'network-status',
        duration: Infinity,
      });
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
