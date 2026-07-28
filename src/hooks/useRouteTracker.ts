/**
 * useRouteTracker — Logs page_view events on every route change.
 *
 * WHAT: Fires a privacy-safe page_view event to app_event_stream on navigation.
 * WHERE: Mounted once inside BrowserRouter (ScrollToTop component).
 * WHY: Telemetry was fully built but never wired — this is the flight recorder.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/appEventTracker';

export function useRouteTracker() {
  const { pathname } = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Skip duplicate fires for same path
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    // Don't track auth callback routes or very short fragments
    if (pathname.startsWith('/auth/callback')) return;

    trackPageView(pathname);
  }, [pathname]);
}
