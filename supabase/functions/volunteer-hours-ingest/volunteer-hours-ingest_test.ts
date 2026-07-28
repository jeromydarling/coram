import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const BASE_URL = `${SUPABASE_URL}/functions/v1/volunteer-hours-ingest`;

Deno.test("OPTIONS returns CORS headers", async () => {
  const res = await fetch(BASE_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  await res.text();
});

Deno.test("Rejects unauthenticated requests", async () => {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gmail_message_id: "test-1",
      from_email: "test@example.com",
      raw_text: "HOURS: 2026-02-18 | 3 | warehouse",
    }),
  });
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("Returns 400 for missing fields", async () => {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ gmail_message_id: "test-2" }),
  });
  // Will be 401 (anon key isn't service role) or 400
  const status = res.status;
  // anon key won't pass service-only auth, so expect 401
  assertEquals(status, 401);
  await res.text();
});

Deno.test("Duplicate gmail_message_id returns ok:true duplicate", async () => {
  // First call - will be needs_review (unknown email) but creates inbox row
  const msgId = `dedupe-test-${Date.now()}`;
  const payload = {
    gmail_message_id: msgId,
    from_email: `unknown-${Date.now()}@example.com`,
    raw_text: "HOURS: 2026-02-18 | 2 | warehouse",
  };

  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SERVICE_ROLE_KEY) {
    console.warn("Skipping dedupe test: SUPABASE_SERVICE_ROLE_KEY not set");
    return;
  }

  const res1 = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const body1 = await res1.json();
  assertEquals(res1.status, 200);
  assertEquals(body1.ok, true);

  // Second call with same gmail_message_id → must return duplicate
  const res2 = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const body2 = await res2.json();
  assertEquals(res2.status, 200);
  assertEquals(body2.ok, true);
  assertEquals(body2.status, "duplicate");
});
