import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/opportunity-auto-enrich`;

async function post(body: unknown, opts?: { token?: string }) {
  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts?.token ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  return { status: resp.status, json };
}

// ── Auth tests ──

Deno.test("opportunity-auto-enrich: missing JWT returns 401", async () => {
  const { status, json } = await post({ opportunity_id: "00000000-0000-0000-0000-000000000001" });
  assertEquals(status, 401);
  assertEquals(json.ok, false);
});

Deno.test("opportunity-auto-enrich: invalid JWT returns 401", async () => {
  const { status, json } = await post(
    { opportunity_id: "00000000-0000-0000-0000-000000000001" },
    { token: "invalid-token" },
  );
  assertEquals(status, 401);
  assertEquals(json.ok, false);
});

// ── Validation tests ──

Deno.test("opportunity-auto-enrich: anon key (no user) returns 401 for missing opportunity_id", async () => {
  const { status, json } = await post(
    {},
    { token: SUPABASE_ANON_KEY },
  );
  // Anon key is not a valid user JWT, so auth fails first
  assertEquals(status, 401);
  assertEquals(json.ok, false);
});

Deno.test("opportunity-auto-enrich: anon key returns 401 for invalid opportunity_id", async () => {
  const { status, json } = await post(
    { opportunity_id: "not-a-uuid" },
    { token: SUPABASE_ANON_KEY },
  );
  assertEquals(status, 401);
  assertEquals(json.ok, false);
});

Deno.test("opportunity-auto-enrich: anon key returns 401 for invalid source_url", async () => {
  const { status, json } = await post(
    { opportunity_id: "00000000-0000-0000-0000-000000000001", source_url: "not-a-url" },
    { token: SUPABASE_ANON_KEY },
  );
  assertEquals(status, 401);
  assertEquals(json.ok, false);
});

// ── Unit tests for validateBody ──

import { validateBody } from "./index.ts";

Deno.test("validateBody: valid body with all fields", () => {
  const result = validateBody({
    opportunity_id: "00000000-0000-0000-0000-000000000001",
    source_url: "https://example.com",
    idempotency_key: "test-key-123",
  });
  assertEquals(result.valid, true);
});

Deno.test("validateBody: valid body without optional fields", () => {
  const result = validateBody({
    opportunity_id: "00000000-0000-0000-0000-000000000001",
  });
  assertEquals(result.valid, true);
});

Deno.test("validateBody: empty source_url is valid (treated as no URL)", () => {
  const result = validateBody({
    opportunity_id: "00000000-0000-0000-0000-000000000001",
    source_url: "",
  });
  assertEquals(result.valid, true);
});

Deno.test("validateBody: null body returns error", () => {
  const result = validateBody(null);
  assertEquals(result.valid, false);
});

Deno.test("validateBody: missing opportunity_id returns error", () => {
  const result = validateBody({ source_url: "https://example.com" });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: invalid UUID returns error", () => {
  const result = validateBody({ opportunity_id: "bad-uuid" });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: non-http URL returns error", () => {
  const result = validateBody({
    opportunity_id: "00000000-0000-0000-0000-000000000001",
    source_url: "ftp://example.com",
  });
  assertEquals(result.valid, false);
});
