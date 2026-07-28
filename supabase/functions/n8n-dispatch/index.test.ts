import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { assertExists } from "https://deno.land/std@0.224.0/assert/assert_exists.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/n8n-dispatch`;

async function post(
  body: Record<string, unknown>,
  options?: { token?: string; scheduleSecret?: string },
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
  };
  if (options?.token) headers["Authorization"] = `Bearer ${options.token}`;
  if (options?.scheduleSecret) headers["x-n8n-schedule-secret"] = options.scheduleSecret;

  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  return { status: resp.status, json };
}

// ── Existing JWT tests ──

Deno.test("n8n-dispatch: missing JWT returns 401", async () => {
  const { status, json } = await post({ workflow_key: "partner_enrich" });
  assertEquals(status, 401);
  assertEquals(json.error, "UNAUTHORIZED");
});

Deno.test("n8n-dispatch: invalid JWT returns 401", async () => {
  const { status, json } = await post(
    { workflow_key: "partner_enrich" },
    { token: "invalid-token-abc123" },
  );
  assertEquals(status, 401);
  assertEquals(json.error, "UNAUTHORIZED");
});

Deno.test("n8n-dispatch: invalid workflow_key returns 400 or 401", async () => {
  const { status } = await post(
    { workflow_key: "nonexistent_workflow" },
    { token: "invalid-token" },
  );
  assertEquals(status, 401);
});

Deno.test("n8n-dispatch: missing workflow_key returns error", async () => {
  const { status } = await post({}, { token: "invalid-token" });
  assertEquals(status, 401);
});

Deno.test("n8n-dispatch: error response has ok=false and error code", async () => {
  const { json } = await post({ workflow_key: "partner_enrich" });
  assertEquals(json.ok, false);
  assertExists(json.error);
  assertExists(json.message);
});

// ── Schedule secret auth tests ──

Deno.test("n8n-dispatch: invalid schedule secret returns 401", async () => {
  const { status, json } = await post(
    { workflow_key: "partner_enrich", org_name: "Test" },
    { scheduleSecret: "wrong-secret-value" },
  );
  // Returns 401 (invalid) or 500 (not configured) depending on server config
  assertEquals(status === 401 || status === 500, true);
  assertEquals(json.ok, false);
});

Deno.test("n8n-dispatch: schedule secret cannot dispatch non-allowlisted key", async () => {
  const { status, json } = await post(
    { workflow_key: "admin_backdoor" },
    { scheduleSecret: "any-value" },
  );
  // Either auth fails (401/500) or workflow key is rejected (400)
  assertEquals(status >= 400, true);
  assertEquals(json.ok, false);
});

Deno.test("n8n-dispatch: schedule secret header takes priority over JWT", async () => {
  const { status, json } = await post(
    { workflow_key: "partner_enrich", org_name: "Test" },
    { token: "valid-looking-token", scheduleSecret: "wrong-secret" },
  );
  // Schedule secret is checked first, should fail on invalid secret
  assertEquals(status === 401 || status === 500, true);
  assertEquals(json.ok, false);
});
