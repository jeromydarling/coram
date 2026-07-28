import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("create-checkout rejects missing tiers", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(typeof data.error, "string");
});

Deno.test("create-checkout rejects unknown tier", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ tiers: ["platinum"] }),
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.error, "Unknown tier: platinum");
});

Deno.test("stripe-webhook rejects missing signature", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ type: "test" }),
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.error, "missing_signature");
});

Deno.test("check-subscription rejects unauthenticated", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/check-subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
  });
  const data = await res.json();
  // Should return error for missing auth
  assertEquals(res.status >= 400, true);
  assertEquals(typeof data.error, "string");
});

Deno.test("tenant-bootstrap rejects unauthenticated", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/tenant-bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ slug: "test", name: "Test" }),
  });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.ok, false);
});

Deno.test("canUse feature gating logic", () => {
  // Inline test of the feature gating logic
  const planFeatures: Record<string, string[]> = {
    core: ["relationships", "journey", "reflections", "signum_baseline", "provisio", "events", "voluntarium_basic", "basic_narrative", "civitas"],
    insight: ["testimonium", "drift_detection", "momentum_map_overlays", "story_signals", "ingestion_confidence"],
    story: ["impulsus", "exec_exports", "narrative_reporting"],
    bridge: ["relatio_marketplace", "crm_migrations", "hubspot_two_way", "communio_opt_in"],
  };
  const hierarchy = ["core", "insight", "story", "bridge"];

  function canUse(key: string, plan: string, override?: boolean | null): boolean {
    if (override === true) return true;
    if (override === false) return false;
    const idx = hierarchy.indexOf(plan);
    if (idx === -1) return false;
    const features: string[] = [];
    for (let i = 0; i <= idx; i++) features.push(...planFeatures[hierarchy[i]]);
    return features.includes(key);
  }

  // Core plan
  assertEquals(canUse("relationships", "core"), true);
  assertEquals(canUse("testimonium", "core"), false);
  assertEquals(canUse("impulsus", "core"), false);
  assertEquals(canUse("relatio_marketplace", "core"), false);

  // Insight plan (includes core)
  assertEquals(canUse("relationships", "insight"), true);
  assertEquals(canUse("testimonium", "insight"), true);
  assertEquals(canUse("impulsus", "insight"), false);

  // Bridge plan (includes all)
  assertEquals(canUse("relatio_marketplace", "bridge"), true);
  assertEquals(canUse("impulsus", "bridge"), true);

  // Override wins
  assertEquals(canUse("testimonium", "core", true), true);
  assertEquals(canUse("relationships", "bridge", false), false);
});
