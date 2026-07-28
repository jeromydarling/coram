import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Import the pure function
import { computeHealthStatus } from "../system-sweep/index.ts";

Deno.test("computeHealthStatus: returns stale when no last run", () => {
  assertEquals(computeHealthStatus(null, 0), "stale");
});

Deno.test("computeHealthStatus: returns stale when last run > 8 days ago", () => {
  const old = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
  assertEquals(computeHealthStatus(old, 5), "stale");
});

Deno.test("computeHealthStatus: returns quiet when recent but 0 persisted", () => {
  const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  assertEquals(computeHealthStatus(recent, 0), "quiet");
});

Deno.test("computeHealthStatus: returns healthy when recent with content", () => {
  const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  assertEquals(computeHealthStatus(recent, 10), "healthy");
});

Deno.test("computeHealthStatus: custom threshold respected", () => {
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  assertEquals(computeHealthStatus(fourDaysAgo, 5, 3), "stale");
  assertEquals(computeHealthStatus(fourDaysAgo, 5, 5), "healthy");
});

// Integration test: verify system-sweep edge function is reachable
const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("system-sweep: rejects unauthenticated requests", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/system-sweep`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  assert(body.includes("unauthorized") || body.includes("Unauthorized"));
});

Deno.test("system-sweep: rejects non-admin JWT", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/system-sweep`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  // Should be 401 (invalid token) or 403 (insufficient role)
  assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
  assert(body.length > 0);
});
