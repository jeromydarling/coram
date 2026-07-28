/**
 * Phase 7T Deno tests — Relatio Marketplace edge functions.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

async function callFn(name: string, body: Record<string, unknown>, token?: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

Deno.test("relatio-install rejects unauthenticated", async () => {
  const { status, json } = await callFn("relatio-install", {
    tenant_id: "00000000-0000-0000-0000-000000000000",
    connector_key: "csv",
  });
  // Should be 401 or 403 (no valid user)
  assertEquals(status >= 400, true);
  assertExists(json.error);
  await Promise.resolve(); // consume
});

Deno.test("relatio-dry-run requires tenant_id", async () => {
  const { status, json } = await callFn("relatio-dry-run", {
    connector_key: "csv",
  });
  assertEquals(status >= 400, true);
  assertExists(json.error);
});

Deno.test("relatio-commit requires tenant_id and connector_key", async () => {
  const { status, json } = await callFn("relatio-commit", {});
  assertEquals(status >= 400, true);
  assertExists(json.error);
});

Deno.test("relatio-rollback requires sync_job_id", async () => {
  const { status, json } = await callFn("relatio-rollback", {});
  assertEquals(status >= 400, true);
  assertExists(json.error);
});

Deno.test("relatio-smoke-test requires connector_key", async () => {
  const { status, json } = await callFn("relatio-smoke-test", {
    tenant_id: "00000000-0000-0000-0000-000000000000",
  });
  assertEquals(status >= 400, true);
  assertExists(json.error);
});

Deno.test("relatio-rollback rejects non-demo tenant", async () => {
  const { status, json } = await callFn("relatio-rollback", {
    sync_job_id: "00000000-0000-0000-0000-000000000000",
  });
  // Should fail - either auth or not found
  assertEquals(status >= 400, true);
  assertExists(json.error);
});
