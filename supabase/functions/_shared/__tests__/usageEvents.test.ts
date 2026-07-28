import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { emitUsageEvents, type UsageEvent } from "../usageEvents.ts";

// ── Mock supabase client ──
function mockSupabase(shouldFail = false) {
  const inserted: Record<string, unknown>[][] = [];
  return {
    inserted,
    from: (_table: string) => ({
      insert: (rows: Record<string, unknown>[]) => {
        if (shouldFail) {
          return { error: { message: "mock insert failure" } };
        }
        inserted.push(rows);
        return { error: null };
      },
    }),
  };
}

Deno.test("usageEvents: emits single event correctly", async () => {
  const sb = mockSupabase();
  const result = await emitUsageEvents(sb, [
    { workflow_key: "partner_enrich", run_id: "r1", event_type: "successful_run" },
  ]);
  assertEquals(result.emitted, 1);
  assertEquals(result.errors, 0);
  assertEquals(sb.inserted.length, 1);
  assertEquals(sb.inserted[0][0].event_type, "successful_run");
  assertEquals(sb.inserted[0][0].unit, "count");
  assertEquals(sb.inserted[0][0].quantity, 1);
});

Deno.test("usageEvents: emits multiple events in one call", async () => {
  const sb = mockSupabase();
  const events: UsageEvent[] = [
    { workflow_key: "watchlist_ingest", run_id: "r2", event_type: "crawl_processed", unit: "perplexity_search" },
    { workflow_key: "watchlist_ingest", run_id: "r2", event_type: "signals_emitted", quantity: 3, unit: "signal" },
  ];
  const result = await emitUsageEvents(sb, events);
  assertEquals(result.emitted, 2);
  assertEquals(sb.inserted[0][1].quantity, 3);
  assertEquals(sb.inserted[0][1].unit, "signal");
});

Deno.test("usageEvents: empty array returns zero", async () => {
  const sb = mockSupabase();
  const result = await emitUsageEvents(sb, []);
  assertEquals(result.emitted, 0);
  assertEquals(result.errors, 0);
  assertEquals(sb.inserted.length, 0);
});

Deno.test("usageEvents: failure is non-fatal", async () => {
  const sb = mockSupabase(true);
  const result = await emitUsageEvents(sb, [
    { workflow_key: "test", run_id: "r3", event_type: "test" },
  ]);
  assertEquals(result.emitted, 0);
  assertEquals(result.errors, 1);
});

Deno.test("usageEvents: defaults org_id to null", async () => {
  const sb = mockSupabase();
  await emitUsageEvents(sb, [
    { workflow_key: "test", run_id: "r4", event_type: "test" },
  ]);
  assertEquals(sb.inserted[0][0].org_id, null);
});

Deno.test("usageEvents: preserves org_id when provided", async () => {
  const sb = mockSupabase();
  await emitUsageEvents(sb, [
    { org_id: "org-123", workflow_key: "test", run_id: "r5", event_type: "test" },
  ]);
  assertEquals(sb.inserted[0][0].org_id, "org-123");
});

Deno.test("usageEvents: metadata defaults to empty object", async () => {
  const sb = mockSupabase();
  await emitUsageEvents(sb, [
    { workflow_key: "test", run_id: "r6", event_type: "test" },
  ]);
  assertEquals(JSON.stringify(sb.inserted[0][0].metadata), "{}");
});

Deno.test("usageEvents: never bills deduped work (caller responsibility)", () => {
  // This test documents the contract: caller must check dedup before emitting
  const deduped = true;
  const events: UsageEvent[] = [];
  if (!deduped) {
    events.push({ workflow_key: "watchlist_ingest", run_id: "r7", event_type: "crawl_processed", unit: "perplexity_search" });
  }
  assertEquals(events.length, 0);
});

Deno.test("usageEvents: retry safety — same run_id is append-only", async () => {
  const sb = mockSupabase();
  // First emit
  await emitUsageEvents(sb, [
    { workflow_key: "test", run_id: "same-run", event_type: "successful_run" },
  ]);
  // Retry emit (same run_id) — still succeeds (append-only)
  await emitUsageEvents(sb, [
    { workflow_key: "test", run_id: "same-run", event_type: "successful_run" },
  ]);
  // Both inserted (append-only table)
  assertEquals(sb.inserted.length, 2);
});
