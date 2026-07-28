/**
 * untypedTable — A centralized helper for querying tables not yet in the auto-generated types.
 *
 * WHAT: Wraps (supabase as any).from() with a named, auditable call.
 * WHERE: Any hook or component querying tables missing from types.ts.
 * WHY: Centralizes the `as any` cast so:
 *   1. grep/search finds all untyped queries in one pattern
 *   2. When types.ts is regenerated, this file is the single migration point
 *   3. Runtime column names are at least documented in one place
 *
 * MIGRATION PATH:
 *   After types.ts regeneration, search for `untypedTable` usages.
 *   Replace each with `supabase.from('table_name')` and delete this file.
 *
 * ─── DEVELOPER CONVENTION ───────────────────────────────
 *
 * FORBIDDEN: `(supabase as any).from('...')` scattered in components.
 *
 * If a table is NOT in types.ts:
 *   → Use `untypedTable('table_name')` from this module.
 *   → Add a `// TEMP TYPE ESCAPE — <table> not in types.ts` comment at the call site.
 *
 * If a table IS in types.ts but columns mismatch:
 *   → Use `(supabase as any)` with comment:
 *     `// TEMP TYPE ESCAPE — <column> not in generated schema for <table>`
 *   → File an issue to regenerate types.ts.
 *
 * Goal: ZERO unexplained `as any` casts. Every escape must have a reason.
 *
 * ─── CURRENT STATUS ─────────────────────────────────────
 *
 * ✅ MIGRATED (now typed — use supabase.from() directly):
 *   - recovery_tickets, tenant_privacy_settings, restoration_signals, app_event_stream
 *   - familia_memberships, familia_suggestions, familias, user_alerts
 *   - lumen_signals (basic queries), public_metro_pages, narrative_stories
 *   - operator_notifications, communio_activity_log, activity_impact
 *   - metro_activation_actions, metro_activation_log, nri_design_suggestions
 *   - nri_playbook_drafts, gardener_insights, library_essays
 *   - email_task_suggestions, archetype_signal_rollups, testimonium_rollups (basic)
 *   - operator_content_drafts, gardener_audit_log, metro_expansion_plans
 *   - field_notes, familia_provision_rollups, tenant_settings (flat queries)
 *   - user_preferences, testimonium_events, and many more
 *
 * ⚠️ STILL UNTYPED (missing from types.ts — tables/views do not exist in generated schema):
 *   - providence_signals → use ProvidenceSignalSnapshot from lib/types/publicMovement.ts
 *   - public_movement_cache → use PublicMovementSnapshot from lib/types/publicMovement.ts
 *   - qa_run_results → QA infrastructure table, not yet generated
 *   - friction_events → behavioral analytics table, not yet generated
 *   - action_type_effectiveness_v → materialized view, not in types.ts
 *   - signal_type_effectiveness_v → materialized view, not in types.ts
 *
 * ⚠️ SCHEMA MISMATCHES (table exists but code uses columns not in generated types):
 *   - lumen_signals: queries using `status`, `title`, `narrative`, `acknowledged` columns
 *   - testimonium_rollups: queries using `period_start`, `summary`, `signal_count`, `themes`
 *   - tenant_settings: EAV pattern using `setting_key` / `setting_value` columns
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Tables that exist in the DB but are NOT yet in the generated types.
 * As types.ts catches up, move tables OUT of this list.
 */
const KNOWN_UNTYPED_TABLES = [
  'providence_signals',
  'public_movement_cache',
  'qa_run_results',
  'friction_events',
  'action_type_effectiveness_v',
  'signal_type_effectiveness_v',
  // Schema mismatch tables — exist in types.ts but queries use columns not yet generated
  'lumen_signals',        // status, title, narrative, acknowledged columns
  'testimonium_rollups',  // period_start, summary, signal_count, themes columns
  'tenant_settings',      // EAV pattern: setting_key/setting_value columns
] as const;

type UntypedTableName = typeof KNOWN_UNTYPED_TABLES[number] | (string & {});

/**
 * Returns a Supabase query builder for a table not in the generated types.
 * Intentionally casts once here so callers don't scatter `as any` everywhere.
 */
export function untypedTable(tableName: UntypedTableName) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(tableName);
}
