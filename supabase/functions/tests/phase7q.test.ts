import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("onboarding-start rejects unauthenticated", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/onboarding-start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ archetype: "church", tenant_id: "fake" }),
  });
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("onboarding-step-complete rejects unauthenticated", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/onboarding-step-complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ step_key: "connect_email", tenant_id: "fake" }),
  });
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("nri-support-context rejects unauthenticated", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/nri-support-context`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ tenant_id: "fake" }),
  });
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("onboarding-start requires archetype and tenant_id", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/onboarding-start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  // Should fail auth or validation
  const status = res.status;
  const body = await res.text();
  assertExists(body);
  assertEquals(status >= 400, true);
});

Deno.test("nri-support-context requires tenant_id", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/nri-support-context`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const status = res.status;
  const body = await res.text();
  assertExists(body);
  assertEquals(status >= 400, true);
});
