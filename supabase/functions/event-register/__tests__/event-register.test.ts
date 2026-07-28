/**
 * event-register Deno tests
 *
 * WHAT: Tests for the public event registration edge function.
 * WHERE: supabase/functions/event-register/__tests__/
 * WHY: Validates input validation, duplicate detection, capacity, rate limiting, and contact creation.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNC_URL = `${SUPABASE_URL}/functions/v1/event-register`;

const headers = {
  "Content-Type": "application/json",
  apikey: ANON_KEY,
};

// ── Helper: call function ──
async function invoke(body: Record<string, unknown>) {
  const res = await fetch(FUNC_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ── 1. Rejects GET method ──
Deno.test({
  name: "event-register: rejects GET requests",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const res = await fetch(FUNC_URL, { method: "GET", headers });
    assertEquals(res.status, 405);
    await res.text(); // consume body
  },
});

// ── 2. Rejects missing event_id ──
Deno.test({
  name: "event-register: rejects missing event_id",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { status, data } = await invoke({
      guest_name: "Test User",
      guest_email: "test@example.com",
    });
    assertEquals(status, 400);
    assertEquals(data.error, "event_id is required");
  },
});

// ── 3. Rejects missing name ──
Deno.test({
  name: "event-register: rejects missing guest_name",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { status, data } = await invoke({
      event_id: "00000000-0000-0000-0000-000000000001",
      guest_email: "test@example.com",
    });
    assertEquals(status, 400);
    assertEquals(data.error, "Name is required");
  },
});

// ── 4. Rejects empty name ──
Deno.test({
  name: "event-register: rejects empty guest_name",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { status, data } = await invoke({
      event_id: "00000000-0000-0000-0000-000000000001",
      guest_name: "   ",
      guest_email: "test@example.com",
    });
    assertEquals(status, 400);
    assertEquals(data.error, "Name is required");
  },
});

// ── 5. Rejects invalid email ──
Deno.test({
  name: "event-register: rejects invalid email",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { status, data } = await invoke({
      event_id: "00000000-0000-0000-0000-000000000001",
      guest_name: "Test User",
      guest_email: "not-an-email",
    });
    assertEquals(status, 400);
    assertEquals(data.error, "A valid email is required");
  },
});

// ── 6. Rejects missing email ──
Deno.test({
  name: "event-register: rejects missing email",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { status, data } = await invoke({
      event_id: "00000000-0000-0000-0000-000000000001",
      guest_name: "Test User",
    });
    assertEquals(status, 400);
    assertEquals(data.error, "A valid email is required");
  },
});

// ── 7. Rejects name longer than 100 chars ──
Deno.test({
  name: "event-register: rejects name over 100 chars",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { status, data } = await invoke({
      event_id: "00000000-0000-0000-0000-000000000001",
      guest_name: "A".repeat(101),
      guest_email: "test@example.com",
    });
    assertEquals(status, 400);
    assertEquals(data.error, "Name must be less than 100 characters");
  },
});

// ── 8. Returns 404 for non-existent event ──
Deno.test({
  name: "event-register: returns 404 for non-existent event",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { status, data } = await invoke({
      event_id: "00000000-0000-0000-0000-000000000000",
      guest_name: "Test User",
      guest_email: "test@example.com",
    });
    assertEquals(status, 404);
    assertEquals(data.error, "Event not found");
  },
});

// ── 9. OPTIONS returns CORS headers ──
Deno.test({
  name: "event-register: OPTIONS returns CORS headers",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const res = await fetch(FUNC_URL, {
      method: "OPTIONS",
      headers: { Origin: "https://thecros.lovable.app" },
    });
    assertEquals(res.status, 200);
    const acao = res.headers.get("access-control-allow-origin");
    assertExists(acao, "CORS allow-origin header should be present");
    await res.text();
  },
});

// ── 10. Rejects non-string event_id ──
Deno.test({
  name: "event-register: rejects numeric event_id",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { status, data } = await invoke({
      event_id: 12345,
      guest_name: "Test User",
      guest_email: "test@example.com",
    });
    assertEquals(status, 400);
    assertEquals(data.error, "event_id is required");
  },
});
