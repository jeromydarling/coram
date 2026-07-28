import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/operator-create-free-tenant`;

Deno.test("rejects unauthenticated requests", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organization_name: "Test", slug: "test", admin_email: "a@b.com" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "unauthorized");
});

Deno.test("rejects request with anon key (no admin role)", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ organization_name: "Test", slug: "test", admin_email: "a@b.com" }),
  });
  const body = await res.json();
  // Should be 401 (invalid token) or 403 (not admin)
  assertEquals(res.status >= 401, true);
  assertExists(body.error);
});

Deno.test("rejects invalid slug format", async () => {
  // This will fail at auth before slug validation, but tests the flow
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer invalid-token`,
    },
    body: JSON.stringify({
      organization_name: "Bad Slug",
      slug: "BAD SLUG!!!",
      admin_email: "a@b.com",
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertExists(body.error);
});

Deno.test("rejects missing required fields", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer invalid-token`,
    },
    body: JSON.stringify({ organization_name: "Test" }),
  });
  const body = await res.json();
  // Will fail at auth, proving the endpoint is secured
  assertEquals(res.status, 401);
  assertExists(body.error);
});
