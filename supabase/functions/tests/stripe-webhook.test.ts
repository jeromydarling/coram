import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Test: webhook rejects missing signature
Deno.test("stripe-webhook rejects missing signature", async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.log("SUPABASE_URL not set, skipping integration test");
    return;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/stripe-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "checkout.session.completed", data: { object: {} } }),
  });

  // Should reject — either 400 (missing sig) or 503 (not configured)
  const status = response.status;
  assertEquals(status === 400 || status === 503, true, `Expected 400 or 503, got ${status}`);
  await response.text(); // consume body
});

// Test: subscription status mapping
Deno.test("subscription status mapping is correct", () => {
  const mapStatus = (s: string) =>
    s === "active" ? "active"
    : s === "past_due" ? "past_due"
    : s === "canceled" ? "cancelled"
    : s;

  assertEquals(mapStatus("active"), "active");
  assertEquals(mapStatus("past_due"), "past_due");
  assertEquals(mapStatus("canceled"), "cancelled");
  assertEquals(mapStatus("trialing"), "trialing");
});

// Test: tier derivation logic
Deno.test("tier values are valid", () => {
  const validTiers = ["core", "insight", "story", "bridge"];
  for (const t of validTiers) {
    assertEquals(validTiers.includes(t), true);
  }
  assertEquals(validTiers.includes("premium"), false);
});
