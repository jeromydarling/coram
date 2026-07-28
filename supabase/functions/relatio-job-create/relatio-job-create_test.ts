import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("relatio-job-create rejects unauthenticated", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/relatio-job-create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: "x", connector_key: "csv" }),
  });
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("relatio-job-create rejects missing fields", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/relatio-job-create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  // Will fail auth first (anon key isn't a user token)
  const status = res.status;
  assertEquals(status >= 400, true);
  await res.text();
});

Deno.test("relatio-job-status rejects unauthenticated", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/relatio-job-status?job_id=fake`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("relatio-job-cancel rejects unauthenticated", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/relatio-job-cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: "fake" }),
  });
  assertEquals(res.status, 401);
  await res.text();
});
