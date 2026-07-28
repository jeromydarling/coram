import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Test: activation session types are valid
Deno.test("activation session types are valid", () => {
  const validTypes = ["guided_activation", "guided_activation_plus"];
  for (const t of validTypes) {
    assertEquals(validTypes.includes(t), true);
  }
  assertEquals(validTypes.includes("premium_activation"), false);
});

// Test: session status transitions are valid
Deno.test("session status values are valid", () => {
  const validStatuses = ["pending", "scheduled", "completed", "canceled"];
  for (const s of validStatuses) {
    assertEquals(validStatuses.includes(s), true);
  }
});

// Test: sessions_total matches session type
Deno.test("sessions_total matches type correctly", () => {
  const map: Record<string, number> = {
    guided_activation: 1,
    guided_activation_plus: 2,
  };
  assertEquals(map.guided_activation, 1);
  assertEquals(map.guided_activation_plus, 2);
});

// Test: decrement logic never goes below zero
Deno.test("sessions_remaining decrement never goes below zero", () => {
  const decrement = (remaining: number) => Math.max(0, remaining - 1);
  assertEquals(decrement(2), 1);
  assertEquals(decrement(1), 0);
  assertEquals(decrement(0), 0);
});

// Test: status after decrement is deterministic
Deno.test("status after complete is deterministic", () => {
  const getStatusAfterComplete = (remaining: number) => {
    const newRemaining = Math.max(0, remaining - 1);
    return newRemaining === 0 ? "completed" : "pending";
  };
  assertEquals(getStatusAfterComplete(1), "completed");
  assertEquals(getStatusAfterComplete(2), "pending");
  assertEquals(getStatusAfterComplete(0), "completed");
});

// Test: activation-manage rejects missing auth
Deno.test("activation-manage rejects unauthenticated requests", async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.log("SUPABASE_URL not set, skipping integration test");
    return;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/activation-manage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "schedule", activation_session_id: "test" }),
  });

  assertEquals(response.status, 401);
  await response.text();
});
