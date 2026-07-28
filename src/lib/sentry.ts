/**
 * Sentry initialization — federation-aware error tracking.
 *
 * Configured per CROS doctrine (see cros-doctrine + cros-federation skills):
 *   - app_slug tag so the hub can route errors per satellite
 *   - sendDefaultPii: false (no IP collection by default)
 *   - replays masked + media blocked (privacy-first, Catholic eldercare etc.)
 *   - replay sampling: 0% random, 100% on error
 *
 * DSN is loaded from VITE_SENTRY_DSN. If unset (e.g. local dev without secret),
 * Sentry silently no-ops — no errors reported, no crash.
 */
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "unknown",
    initialScope: {
      tags: {
        app_slug: "thecros",
        federation_phase: "3",
      },
    },
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 1.0,
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/[a-z]+\.lovable\.app/,
      /^https:\/\/[a-z]+\.supabase\.co/,
    ],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}
