/**
 * eventStream — Privacy-safe action breadcrumb logger for CROS™.
 *
 * WHAT: Logs allowlisted user actions (not content) to app_event_stream for recovery intelligence.
 * WHERE: Called from UI destructive/major action handlers across the app.
 * WHY: Enables assistant-driven undo/restore guidance without surveillance.
 *
 * PRIVACY INVARIANTS:
 * - Only allowlisted event_types are accepted.
 * - metadata_json is strictly typed (source + surface only).
 * - No PII, no free-text, no content bodies.
 * - Fails silently — never blocks user actions.
 * - Respects tenant_privacy_settings.enable_recent_actions_for_assistant.
 *
 * RETENTION: app_event_stream entries are purged after 30 days
 *   by cleanup_old_app_events() / purge_old_app_events().
 */
import { supabase } from '@/integrations/supabase/client';

// ─── Allowlisted Event Types ──────────────────────────
const ALLOWED_EVENT_TYPES = [
  'entity_created',
  'entity_updated',
  'entity_deleted',
  'entity_restored',
  'connection_started',
  'connection_failed',
  'connection_connected',
  'import_started',
  'import_completed',
  'import_failed',
  'publish',
  'unpublish',
  'add_participant',
  'remove_participant',
  'role_switched',
] as const;

export type AllowedActionEventType = typeof ALLOWED_EVENT_TYPES[number];

/** Runtime type guard for allowed action event types. */
export function isAllowedActionEventType(event: string): event is AllowedActionEventType {
  return (ALLOWED_EVENT_TYPES as readonly string[]).includes(event);
}

// ─── Allowlisted Entity Types ─────────────────────────
const ALLOWED_ENTITY_TYPES = [
  'contacts', 'opportunities', 'events', 'activities',
  'volunteers', 'provisions', 'communio_profile',
  'essay', 'playbook', 'grants', 'projects',
  'voice_notes', 'reflections', 'metros',
] as const;

export type AllowedEntityType = typeof ALLOWED_ENTITY_TYPES[number];

// ─── Allowlisted Metadata Keys ────────────────────────
const ALLOWED_META_KEYS = new Set(['source', 'surface']);

export interface ActionEvent {
  event_type: string;
  entity_type: string;
  entity_id?: string;
  route?: string;
  metadata?: { source?: 'ui' | 'import' | 'assistant'; surface?: string };
  tenant_id?: string;
}

/** Sanitize metadata to only allowed keys with string values */
function sanitizeMeta(meta?: Record<string, unknown>): Record<string, string> {
  if (!meta) return {};
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (ALLOWED_META_KEYS.has(key) && typeof value === 'string') {
      clean[key] = value;
    }
  }
  return clean;
}

// ─── Privacy toggle cache (TTL: 5 minutes) ───────────
let _privacyEnabled: boolean | null = null;
let _privacyTenantId: string | null = null;
let _privacyCachedAt = 0;
const PRIVACY_CACHE_TTL_MS = 5 * 60 * 1000;

async function isRecentActionsEnabled(tenantId?: string): Promise<boolean> {
  if (!tenantId) return true;
  const now = Date.now();
  if (
    _privacyTenantId === tenantId &&
    _privacyEnabled !== null &&
    now - _privacyCachedAt < PRIVACY_CACHE_TTL_MS
  ) {
    return _privacyEnabled;
  }

  try {
    const { data } = await supabase
      .from('tenant_privacy_settings')
      .select('enable_recent_actions_for_assistant')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    _privacyEnabled = data ? data.enable_recent_actions_for_assistant !== false : true;
    _privacyTenantId = tenantId;
    _privacyCachedAt = now;
    return _privacyEnabled;
  } catch {
    return true;
  }
}

/**
 * Log a privacy-safe action breadcrumb. Fire-and-forget.
 * Only allowlisted event_types and entity_types are accepted.
 */
export function logActionEvent(event: ActionEvent): void {
  if (!isAllowedActionEventType(event.event_type)) return;
  if (!(ALLOWED_ENTITY_TYPES as readonly string[]).includes(event.entity_type)) return;

  const route = event.route ?? (typeof window !== 'undefined'
    ? window.location.pathname
    : undefined);

  (async () => {
    try {
      const enabled = await isRecentActionsEnabled(event.tenant_id);
      if (!enabled) return;

      const { data: { session } } = await supabase.auth.getSession();

      await supabase
        .from('app_event_stream')
        .insert({
          event_name: event.event_type,
          page_path: route,
          metadata: {
            ...sanitizeMeta(event.metadata),
            entity_type: event.entity_type,
            entity_id: event.entity_id ?? null,
            _action_breadcrumb: true,
          },
          is_error: false,
          tenant_id: event.tenant_id ?? null,
          user_id: session?.user?.id ?? null,
        });
    } catch {
      // Silent — never block the user action
    }
  })();
}

/** Typed action breadcrumb record shape. */
export interface ActionBreadcrumb {
  event_name: string;
  page_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Fetch recent action breadcrumbs for a user (for assistant context).
 */
export async function fetchRecentActions(
  userId: string,
  limit = 25
): Promise<ActionBreadcrumb[]> {
  try {
    const { data } = await supabase
      .from('app_event_stream')
      .select('event_name, page_path, metadata, created_at')
      .eq('user_id', userId)
      .eq('is_error', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    return ((data ?? []) as Array<{ event_name: string; page_path: string | null; metadata: Record<string, unknown> | null; created_at: string }>).filter(
      (e) => e.metadata && typeof e.metadata === 'object' && (e.metadata as Record<string, unknown>)._action_breadcrumb === true
    );
  } catch {
    return [];
  }
}

/**
 * Fetch recent tenant-level actions (for Steward/Shepherd context).
 */
export async function fetchTenantRecentActions(
  tenantId: string,
  limit = 10
): Promise<ActionBreadcrumb[]> {
  try {
    const { data } = await supabase
      .from('app_event_stream')
      .select('event_name, page_path, metadata, created_at')
      .eq('tenant_id', tenantId)
      .eq('is_error', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    return ((data ?? []) as Array<{ event_name: string; page_path: string | null; metadata: Record<string, unknown> | null; created_at: string }>).filter(
      (e) => e.metadata && typeof e.metadata === 'object' && (e.metadata as Record<string, unknown>)._action_breadcrumb === true
    );
  } catch {
    return [];
  }
}
