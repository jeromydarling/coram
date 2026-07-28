/**
 * Usage metering helpers — append-only event emission.
 *
 * All hooks are idempotent: duplicate events with same run_id + event_type
 * are safe (append-only table, no unique constraints on event_type).
 *
 * Billable rules:
 * - Only emit on successful or partial-success runs
 * - Never bill retries twice (caller checks parent_run_id)
 * - Never bill deduped work (caller gates on dedup flag)
 */

export interface UsageEvent {
  org_id?: string | null;
  workflow_key: string;
  run_id: string;
  event_type: string;
  quantity?: number;
  unit?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Emit one or more usage events. Best-effort: failures are logged but do not
 * throw so they never break the ingest pipeline.
 */
export async function emitUsageEvents(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  events: UsageEvent[],
): Promise<{ emitted: number; errors: number }> {
  if (events.length === 0) return { emitted: 0, errors: 0 };

  const rows = events.map((e) => ({
    org_id: e.org_id || null,
    workflow_key: e.workflow_key,
    run_id: e.run_id,
    event_type: e.event_type,
    quantity: e.quantity ?? 1,
    unit: e.unit ?? "count",
    metadata: e.metadata ?? {},
  }));

  try {
    const { error } = await supabase.from("usage_events").insert(rows);
    if (error) {
      console.error(`[usage] insert failed: ${error.message}`);
      return { emitted: 0, errors: rows.length };
    }
    return { emitted: rows.length, errors: 0 };
  } catch (err) {
    console.error(`[usage] unexpected error: ${err}`);
    return { emitted: 0, errors: rows.length };
  }
}

/**
 * Convenience: emit a single usage event.
 */
export async function emitUsageEvent(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  event: UsageEvent,
): Promise<boolean> {
  const result = await emitUsageEvents(supabase, [event]);
  return result.emitted > 0;
}
