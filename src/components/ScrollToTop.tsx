import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useRouteTracker } from '@/hooks/useRouteTracker';

/**
 * ScrollToTop — Scrolls to top on every route change + fires telemetry.
 *
 * WHAT: Ensures pages start at the top when navigating, and logs page_view events.
 * WHERE: Mounted inside BrowserRouter in App.tsx.
 * WHY: React Router doesn't auto-scroll; telemetry needs a single global hook point.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  // Fire privacy-safe page_view telemetry on every route change
  useRouteTracker();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
