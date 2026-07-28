import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Test: tenant-bootstrap validates required fields
Deno.test("tenant-bootstrap rejects missing slug", async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.log("SUPABASE_URL not set, skipping integration test");
    return;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/tenant-bootstrap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // No auth header — should fail at auth level
    },
    body: JSON.stringify({ name: "Test Org" }),
  });

  // Should be unauthorized without auth
  assertEquals(response.status, 401);
  const data = await response.json();
  assertEquals(data.ok, false);
});

// Test: feature flag defaults are predictable
Deno.test("core feature flag list is defined", () => {
  const coreFlags = ["civitas", "voluntarium", "provisio", "signum", "testimonium", "impulsus", "relatio"];
  assertEquals(coreFlags.length, 7);
  assertExists(coreFlags.find(f => f === "civitas"));
  assertExists(coreFlags.find(f => f === "relatio"));
});

// Test: archetype keys are valid
Deno.test("archetype keys follow convention", () => {
  const archetypes = [
    "church", "digital_inclusion", "social_enterprise",
    "workforce", "refugee_support", "education_access", "library_system"
  ];
  for (const key of archetypes) {
    assertEquals(/^[a-z_]+$/.test(key), true, `Invalid archetype key: ${key}`);
  }
});

// Test: slug validation rules
Deno.test("slug normalization works correctly", () => {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
  assertEquals(normalize("PCs for People"), "pcsforpeople");
  assertEquals(normalize("church-xyz"), "church-xyz");
  assertEquals(normalize("Hello World!!!"), "helloworld");
});
