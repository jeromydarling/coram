/**
 * Auto-trigger insight generation after signal ingest.
 * Uses debounce lock to prevent over-generation.
 * Failures never break the ingest pipeline.
 */

import { tryAcquireInsightGenLock } from "./insightGenLock.ts";

// deno-lint-ignore no-explicit-any
export async function triggerInsightGenerationIfDue(
  supabase: any,
  orgId: string,
  correlationId: string,
): Promise<{ triggered: boolean; reason: string }> {
  try {
    // Try to acquire the 6-hour debounce lock
    const { acquired } = await tryAcquireInsightGenLock(supabase, orgId);

    if (!acquired) {
      return { triggered: false, reason: "lock_held" };
    }

    // Invoke generate-org-insights with service role (internal call)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/generate-org-insights`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ org_id: orgId, force: false }),
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(
          `[${correlationId}] auto-insight generation failed: ${resp.status} ${errText}`,
        );
        return { triggered: true, reason: `error_${resp.status}` };
      }

      // Consume body
      await resp.json();
      console.log(`[${correlationId}] auto-insight generation triggered for org ${orgId}`);
      return { triggered: true, reason: "success" };
    } catch (err) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${correlationId}] auto-insight fetch error: ${msg}`);
      return { triggered: true, reason: `fetch_error` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${correlationId}] auto-insight lock error: ${msg}`);
    return { triggered: false, reason: `lock_error` };
  }
}
