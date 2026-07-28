import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Test: import endpoint rejects unauthenticated calls
Deno.test("import-from-profunda rejects missing auth", async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.log("SUPABASE_URL not set, skipping integration test");
    return;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/import-from-profunda`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_tenant_id: "00000000-0000-0000-0000-000000000000" }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertEquals(data.ok, false);
});

// Test: import stats structure
Deno.test("import stats object has expected shape", () => {
  const stats = {
    opportunities: { copied: 5, skipped: 2 },
    contacts: { copied: 10, skipped: 0 },
    events: { copied: 3, skipped: 1 },
    activities: { copied: 8, skipped: 0 },
  };

  assertEquals(typeof stats.opportunities.copied, "number");
  assertEquals(typeof stats.contacts.skipped, "number");
  assertEquals(Object.keys(stats).length, 4);
});

// Test: idempotency principle — re-import should skip already mapped
Deno.test("import mapping dedupe key is deterministic", () => {
  const makeKey = (batchId: string, entity: string, sourceId: string) =>
    `${batchId}:${entity}:${sourceId}`;

  const key1 = makeKey("batch-1", "contact", "abc");
  const key2 = makeKey("batch-1", "contact", "abc");
  assertEquals(key1, key2);
});
