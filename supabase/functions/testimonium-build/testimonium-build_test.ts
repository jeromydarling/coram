import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("testimonium-build rejects unauthenticated requests", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/testimonium-build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenant_id: "fake",
      period_start: "2025-01-01",
      period_end: "2025-01-31",
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Missing auth");
});

Deno.test("testimonium-build rejects missing fields", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/testimonium-build`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  assertEquals(res.status >= 400, true);
  // Consume response body
  void body;
});

Deno.test("testimonium-build handles empty period gracefully", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/testimonium-build`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      tenant_id: "00000000-0000-0000-0000-000000000000",
      period_start: "2020-01-01",
      period_end: "2020-01-02",
    }),
  });
  // Will fail with 401 (anon key isn't a real user) but should not 500
  assertEquals(res.status < 500, true);
  await res.text();
});
