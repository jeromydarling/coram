import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ── Set env BEFORE importing ──
Deno.env.set("ENRICHMENT_WORKER_SECRET", "test_enrich_secret");
Deno.env.set("N8N_SHARED_SECRET", "test_shared_secret");
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

import { weekBucket, dateBucket } from "../notifications-generate/index.ts";

// ── weekBucket Tests ──

Deno.test("weekBucket: returns YYYY-Www format", () => {
  const result = weekBucket(new Date("2026-02-13T12:00:00Z"));
  assertEquals(typeof result, "string");
  assertEquals(result.includes("-W"), true);
  assertEquals(result.startsWith("2026"), true);
});

Deno.test("weekBucket: same day returns same bucket", () => {
  const a = weekBucket(new Date("2026-02-13T00:00:00Z"));
  const b = weekBucket(new Date("2026-02-13T23:59:59Z"));
  assertEquals(a, b);
});

Deno.test("weekBucket: different weeks return different buckets", () => {
  const a = weekBucket(new Date("2026-02-01T00:00:00Z"));
  const b = weekBucket(new Date("2026-02-15T00:00:00Z"));
  // Two weeks apart
  const aWeek = parseInt(a.split("-W")[1]);
  const bWeek = parseInt(b.split("-W")[1]);
  assertEquals(bWeek > aWeek, true);
});

// ── dateBucket Tests ──

Deno.test("dateBucket: returns YYYY-MM-DD format", () => {
  const result = dateBucket(new Date("2026-02-13T15:30:00Z"));
  assertEquals(result, "2026-02-13");
});
