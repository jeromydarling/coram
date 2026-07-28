/**
 * Shared automation workflow key allowlist.
 * Single source of truth used by dispatch, ingest, QA, and frontend.
 */
export const AUTOMATION_WORKFLOW_KEYS = [
  "partner_enrich",
  "opportunity_monitor",
  "recommendations_generate",
  "watchlist_ingest",
  "watchlist_diff",
  "event_attendee_enrich",
  "watchlist_deep_dive",
] as const;

export type AutomationWorkflowKey = (typeof AUTOMATION_WORKFLOW_KEYS)[number];

export function isValidWorkflowKey(key: string): key is AutomationWorkflowKey {
  return (AUTOMATION_WORKFLOW_KEYS as readonly string[]).includes(key);
}
