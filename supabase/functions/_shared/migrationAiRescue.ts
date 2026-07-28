/**
 * migrationAiRescue — Shared helper that forwards failed migration rows
 * to the `migration-ai-repair` edge function AFTER deterministic repair
 * has already failed.
 *
 * WHAT: Batches up to 100 rows at a time, posts to migration-ai-repair
 *       with x-internal-key auth, ignores transport failures silently
 *       (the rescue layer is an assist, never a blocker).
 * WHERE: Imported by relatio-commit, relatio-job-run, migration-commit,
 *        flocknote-import, and any future migration runner.
 * WHY:   Honors the Confidence Ladder — every proposal lands in
 *        migration_review_queue, the steward approves before commit, and
 *        the migration's own success/failure is never blocked by the
 *        rescue call.
 *
 * GOVERNANCE: This helper is the ONLY way runners should reach the AI
 *             rescue layer. Direct fetches scattered across runners drift.
 */

export interface FailedMigrationRow {
  source_row: Record<string, unknown>;
  target_entity: string;          // "people" | "opportunities" | "events" | ...
  failure_reason: string;
}

export interface RescueParams {
  migration_id: string;            // sync_job_id, migration_run_id, batch_id, etc.
  tenant_id: string;
  integration_key: string;         // connector_key — e.g. "relatio", "flocknote", "csv"
  failed_rows: FailedMigrationRow[];
  notify_gardener?: boolean;       // default true
}

export interface RescueOutcome {
  ok: boolean;
  invoked: boolean;                // false when skipped (no key, empty rows)
  processed?: number;
  rescued_count?: number;
  unrescuable_count?: number;
  gardener_notified?: boolean;
  skipped_reason?: string;
  error?: string;
}

const MAX_BATCH = 100;
const TIMEOUT_MS = 60_000;

/**
 * Forward failed rows to the AI rescue layer. NEVER throws — runners must
 * treat the rescue call as a fire-and-forget assist, not a critical path.
 */
export async function rescueFailedRows(
  params: RescueParams,
): Promise<RescueOutcome> {
  const rows = (params.failed_rows ?? []).filter(
    (r) => r && r.source_row && r.target_entity && r.failure_reason,
  );
  if (rows.length === 0) {
    return { ok: true, invoked: false, skipped_reason: "no_failed_rows" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const internalKey = Deno.env.get("INTERNAL_NOTIFY_KEY");
  if (!supabaseUrl || !internalKey) {
    console.warn(
      "[migrationAiRescue] Skipped — SUPABASE_URL or INTERNAL_NOTIFY_KEY missing",
    );
    return { ok: true, invoked: false, skipped_reason: "missing_internal_key" };
  }

  let processed = 0;
  let rescued = 0;
  let unrescuable = 0;
  let notified = false;
  let firstError: string | undefined;

  for (let i = 0; i < rows.length; i += MAX_BATCH) {
    const batch = rows.slice(i, i + MAX_BATCH);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/migration-ai-repair`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": internalKey,
        },
        body: JSON.stringify({
          migration_id: params.migration_id,
          tenant_id: params.tenant_id,
          integration_key: params.integration_key,
          failed_rows: batch,
          notify_gardener: params.notify_gardener !== false,
        }),
        signal: controller.signal,
      });
      const json = await resp.json().catch(() => null) as
        | {
          ok: boolean;
          processed?: number;
          rescued_count?: number;
          unrescuable_count?: number;
          gardener_notified?: boolean;
          error?: string;
        }
        | null;

      if (!resp.ok || !json?.ok) {
        firstError ??= json?.error ?? `HTTP ${resp.status}`;
        console.warn(
          `[migrationAiRescue] batch ${i / MAX_BATCH} failed: ${firstError}`,
        );
        continue;
      }
      processed += json.processed ?? batch.length;
      rescued += json.rescued_count ?? 0;
      unrescuable += json.unrescuable_count ?? 0;
      notified = notified || !!json.gardener_notified;
    } catch (err) {
      firstError ??= err instanceof Error ? err.message : String(err);
      console.warn(
        `[migrationAiRescue] batch ${i / MAX_BATCH} threw: ${firstError}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: !firstError,
    invoked: true,
    processed,
    rescued_count: rescued,
    unrescuable_count: unrescuable,
    gardener_notified: notified,
    error: firstError,
  };
}

/**
 * Convenience: shape a Postgres / supabase-js error into a calm failure_reason.
 */
export function describeFailure(err: unknown, fallback = "Unknown failure"): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const obj = err as { message?: string; details?: string; hint?: string; code?: string };
  return obj.message ?? obj.details ?? obj.hint ?? obj.code ?? fallback;
}
