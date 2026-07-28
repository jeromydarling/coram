import { useEffect } from 'react';

/**
 * useGlobalAnalytics — Federated Google Analytics for the CROS family.
 *
 * WHAT: On mount, fetches the canonical GA config from thecros's
 *       `analytics-config` edge function and injects gtag.js with the
 *       returned measurement ID. Every event is stamped with
 *       `cros_app: <sourceApp>` so reports can filter per app even
 *       when all apps share one GA4 property.
 * WHERE: Mounted once at app root (typically inside <GlobalEffects />).
 * WHY: One Measurement ID for the whole family + a `cros_app` custom
 *      dimension lets us run unified analytics with per-app drill-down,
 *      and lets us swap the property server-side without redeploying
 *      every app.
 *
 * Setup checklist for the GA4 property:
 *   1. Admin → Custom definitions → Create custom dimension
 *      Name: "CROS App"
 *      Scope: Event
 *      Event parameter: cros_app
 *   2. (Optional) Save a "comparison" per app for quick filtering.
 *
 * Fallback behavior: if the federation endpoint is unreachable, the hook
 * silently no-ops — analytics is non-essential and must not break the app.
 */

const CONFIG_URL = 'https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/analytics-config';

interface AnalyticsConfig {
  measurementId: string;
  provider: 'ga4';
  debug: boolean;
  customDimensionParams: string[];
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function useGlobalAnalytics(sourceApp: string) {
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // De-duplicate: if a previous mount already injected the script, bail.
      if (document.getElementById('ga-global-script')) return;

      let cfg: AnalyticsConfig;
      try {
        const res = await fetch(`${CONFIG_URL}?app=${encodeURIComponent(sourceApp)}`, {
          method: 'GET',
        });
        if (!res.ok) return;
        cfg = (await res.json()) as AnalyticsConfig;
      } catch {
        // Federation hub unreachable. Silently degrade — analytics is non-essential.
        return;
      }

      if (cancelled) return;
      if (!cfg?.measurementId) return;

      // Inject gtag.js
      const script = document.createElement('script');
      script.id = 'ga-global-script';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${cfg.measurementId}`;
      document.head.appendChild(script);

      // Initialize dataLayer + stamp cros_app on every event.
      window.dataLayer = window.dataLayer || [];
      function gtag(...args: unknown[]) {
        window.dataLayer.push(args);
      }
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', cfg.measurementId, {
        // Stamp the source app on every event in this property.
        cros_app: sourceApp,
        debug_mode: cfg.debug || undefined,
        // Don't send PII as user_id by default.
        send_page_view: true,
      });
    }

    void init();

    return () => {
      cancelled = true;
      // We deliberately do NOT remove the GA script on unmount —
      // gtag is meant to live for the lifetime of the page.
    };
  }, [sourceApp]);
}
