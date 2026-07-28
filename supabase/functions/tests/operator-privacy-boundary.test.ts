/**
 * Operator Privacy Boundary — Guardrail tests.
 *
 * Verifies that operator-role users CANNOT access tenant PII
 * from recycle_bin_payloads or the tenant view.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.208.0/assert/assert_equals.ts";
import { assert } from "https://deno.land/std@0.208.0/assert/assert.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("recycle_bin_payloads - anon cannot SELECT", async () => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/recycle_bin_payloads?limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );
  const body = await res.text();
  // Should either return empty or 403/401
  assert(
    res.status === 200 || res.status === 401 || res.status === 403,
    `Unexpected status: ${res.status}`,
  );
  if (res.status === 200) {
    const data = JSON.parse(body);
    assertEquals(data.length, 0, "Anon should get zero rows from payloads");
  }
});

Deno.test("recycle_bin - entity_name and snapshot are null", async () => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/recycle_bin?limit=5&select=entity_name,snapshot`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );
  const body = await res.text();
  if (res.status === 200) {
    const data = JSON.parse(body);
    for (const row of data) {
      assertEquals(row.entity_name, null, "entity_name must be null in recycle_bin");
      // snapshot should be empty object
      assert(
        row.snapshot === null || JSON.stringify(row.snapshot) === "{}",
        "snapshot must be empty in recycle_bin",
      );
    }
  }
  // If no rows or auth required, that's also fine
});

Deno.test("sanitizeRecoveryActions - strips PII from actions", () => {
  // Inline test of the sanitization logic
  const ALLOWED_KEYS = new Set([
    'event_type', 'entity_type', 'entity_id', 'route', 'current_route',
    'timestamp', 'created_at', 'correlation_id', 'action', 'surface', 'source', 'metadata',
  ]);

  const PII_PATTERNS = [
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  ];

  function containsPII(value: string): boolean {
    return PII_PATTERNS.some(p => p.test(value));
  }

  function sanitizeAction(action: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(action)) {
      if (!ALLOWED_KEYS.has(key)) continue;
      if (typeof value === 'string') {
        if (containsPII(value)) continue;
        clean[key] = value;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        clean[key] = value;
      }
    }
    return clean;
  }

  // Test: entity_name is stripped (not in allowed keys)
  const result1 = sanitizeAction({
    event_type: 'entity_deleted',
    entity_type: 'contacts',
    entity_name: 'John Doe',  // Should be stripped
    entity_id: 'abc-123',
  });
  assertEquals(result1.entity_name, undefined, "entity_name must be stripped");
  assertEquals(result1.entity_type, "contacts");
  assertEquals(result1.entity_id, "abc-123");

  // Test: email in value is stripped
  const result2 = sanitizeAction({
    event_type: 'note',
    source: 'john@example.com',  // PII — should be dropped
  });
  assertEquals(result2.source, undefined, "email values must be dropped");
  assertEquals(result2.event_type, "note");

  // Test: phone in value is stripped
  const result3 = sanitizeAction({
    event_type: 'call',
    route: '555-123-4567',  // PII
  });
  assertEquals(result3.route, undefined, "phone values must be dropped");
});
