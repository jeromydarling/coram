import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// ─── create-checkout tests ─────────────────────────────────────

Deno.test("create-checkout: rejects missing tiers", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertExists(data.error);
});

Deno.test("create-checkout: rejects unknown tier", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ tiers: ["platinum"] }),
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.error, "Unknown tier: platinum");
});

Deno.test("create-checkout: rejects empty tiers array", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ tiers: [] }),
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertExists(data.error);
});

// ─── check-subscription tests ──────────────────────────────────

Deno.test("check-subscription: rejects unauthenticated request", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/check-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
  });
  const data = await res.json();
  assertEquals(res.status, 500);
  assertExists(data.error);
});

// ─── stripe-webhook tests ──────────────────────────────────────

Deno.test("stripe-webhook: rejects missing signature", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ type: "test" }),
  });
  const data = await res.json();
  // Should be 400 (missing_signature) or 503 (not configured)
  const validStatuses = [400, 503];
  assertEquals(validStatuses.includes(res.status), true, `Expected 400 or 503, got ${res.status}`);
  assertExists(data.error);
});

// ─── tenant-bootstrap tests ────────────────────────────────────

Deno.test("tenant-bootstrap: rejects unauthenticated request", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/tenant-bootstrap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ slug: "test", name: "Test" }),
  });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertExists(data.error || data.message);
});

// ─── customer-portal tests ─────────────────────────────────────

Deno.test("customer-portal: rejects unauthenticated request", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/customer-portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
  });
  const data = await res.json();
  assertEquals(res.status, 500);
  assertExists(data.error);
});
