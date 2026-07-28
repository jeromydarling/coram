/**
 * appEventTracker — Privacy-safe behavioral event logger for CROS™.
 *
 * WHAT: Logs anonymized user interactions to app_event_stream for discovery insights.
 * WHERE: Used across marketing pages and in-app surfaces.
 * WHY: Powers Gardener Discovery Insights without collecting PII.
 *
 * PRIVACY INVARIANTS:
 * - PII keys (email, name, phone, notes, password) are stripped from metadata.
 * - session_hash is a random per-session ID (no cookies, no fingerprinting).
 * - is_error flag separates error events from behavioral events.
 *
 * RETENTION: app_event_stream entries are purged after 30 days
 *   by cleanup_old_app_events() / purge_old_app_events().
 */
import { supabase } from '@/integrations/supabase/client';

/** Keys that must NEVER appear in event metadata. */
const PII_KEYS = new Set([
  'email', 'name', 'phone', 'notes', 'password', 'address',
  'first_name', 'last_name', 'full_name', 'ssn', 'dob',
  'date_of_birth', 'credit_card', 'card_number',
]);

// ─── Allowed Event Types (strict allowlist) ──────────
const ALLOWED_EVENT_TYPES = [
  'page_view',
  'feature_click',
  'essay_read_start',
  'essay_read_complete',
  'onboarding_step',
  'integration_interest',
  'archetype_selected',
  'cta_click',
  'scroll_depth',
  'search_query',
  'error_boundary',
] as const;

export type AllowedEventType = typeof ALLOWED_EVENT_TYPES[number];

/** Runtime type guard for allowed event names. */
export function isAllowedEventType(event: string): event is AllowedEventType {
  return (ALLOWED_EVENT_TYPES as readonly string[]).includes(event);
}

/**
 * Allowlisted metadata keys for marketing analytics events.
 * Any key NOT in this set is silently dropped — even after PII sanitization.
 */
const ALLOWED_APP_EVENT_META_KEYS = new Set([
  'feature_key', 'slug', 'step', 'integration_key', 'archetype_key',
  'cta_id', 'depth_percent', 'query_hash', 'error_type', 'page',
]);

/** Typed metadata — only safe, anonymized keys. */
export interface SafeEventMetadata {
  feature_key?: string;
  slug?: string;
  step?: string;
  integration_key?: string;
  archetype_key?: string;
  cta_id?: string;
  depth_percent?: number;
  query_hash?: string;
  error_type?: string;
  page?: string;
  [key: string]: string | number | boolean | null | undefined;
}

/** Strip PII keys AND non-allowlisted keys from metadata object. */
function sanitizeMetadata(meta: Record<string, unknown>): SafeEventMetadata {
  const clean: SafeEventMetadata = {};
  for (const [key, value] of Object.entries(meta)) {
    if (!ALLOWED_APP_EVENT_META_KEYS.has(key)) continue;
    if (PII_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) continue;
    clean[key] = value as string | number | boolean | null;
  }
  return clean;
}

/** Per-session hash — random, no persistence across tabs. */
let _sessionHash: string | null = null;
function getSessionHash(): string {
  if (!_sessionHash) {
    _sessionHash = crypto.randomUUID().slice(0, 12);
  }
  return _sessionHash;
}

export interface AppEvent {
  event_name: string;
  page_path?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
  is_error?: boolean;
  tenant_id?: string;
}

/**
 * Fire-and-forget event logger. Safe to call from anywhere.
 * PII is stripped automatically. Errors are flagged with is_error=true.
 */
export function trackAppEvent(event: AppEvent): void {
  const payload = {
    event_name: event.event_name,
    page_path: event.page_path ?? (typeof window !== 'undefined' ? window.location.pathname : null),
    referrer: event.referrer ?? (typeof document !== 'undefined' ? document.referrer || null : null),
    metadata: event.metadata ? (sanitizeMetadata(event.metadata) as Record<string, string | number | boolean | null>) : {},
    is_error: event.is_error ?? false,
    session_hash: getSessionHash(),
    tenant_id: event.tenant_id ?? null,
    user_id: null,
  };

  // Fire and forget — void wrapper suppresses unhandled promise noise
  void Promise.resolve(
    supabase
      .from('app_event_stream')
      .insert([payload])
  ).catch(() => {});
}

/** Convenience: track a marketing page view. */
export function trackPageView(pagePath?: string): void {
  trackAppEvent({ event_name: 'page_view', page_path: pagePath });
}

/** Convenience: track a feature card click. */
export function trackFeatureClick(featureKey: string): void {
  trackAppEvent({
    event_name: 'feature_click',
    metadata: { feature_key: featureKey },
  });
}

/** Convenience: track an essay read. */
export function trackEssayRead(slug: string, action: 'start' | 'complete'): void {
  trackAppEvent({
    event_name: `essay_read_${action}`,
    metadata: { slug },
  });
}

/** Convenience: track onboarding step completion. */
export function trackOnboardingStep(step: string): void {
  trackAppEvent({
    event_name: 'onboarding_step',
    metadata: { step },
  });
}

/** Convenience: track integration interest. */
export function trackIntegrationInterest(integrationKey: string): void {
  trackAppEvent({
    event_name: 'integration_interest',
    metadata: { integration_key: integrationKey },
  });
}
