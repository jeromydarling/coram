import { useGlobalAnalytics } from '@/hooks/useGlobalAnalytics';
import { useSessionIdleTimeout } from '@/hooks/useSessionIdleTimeout';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface GlobalEffectsProps {
  /**
   * CROS-family slug for this app, e.g. "thecros", "bitoku", "heritage-kitchen".
   * Stamped on every GA event as the `cros_app` custom dimension so reports
   * can be filtered per app inside the shared GA4 property.
   */
  sourceApp: string;
}

/**
 * Invisible component that activates global side-effects (analytics, security, etc.)
 * Renders nothing — mount once inside the provider tree.
 */
export function GlobalEffects({ sourceApp }: GlobalEffectsProps) {
  useGlobalAnalytics(sourceApp);
  useSessionIdleTimeout();
  useOnlineStatus();
  return null;
}
