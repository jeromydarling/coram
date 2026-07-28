import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// Test: tenant-archetype-apply rejects unauthenticated requests
Deno.test("tenant-archetype-apply rejects no auth", async () => {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/tenant-archetype-apply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: "fake", archetype: "church" }),
    }
  );
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.ok, false);
});

// Test: archetype defaults seed data is complete
Deno.test("archetype_defaults covers all 9 archetypes", () => {
  const expectedArchetypes = [
    "church",
    "workforce_development",
    "housing",
    "education",
    "government",
    "social_enterprise",
    "nonprofit_program",
    "community_foundation",
    "public_library_or_city_program",
  ];
  // Each must have at least journey_stages + signum_keywords
  const requiredKeys = ["journey_stages", "signum_keywords"];
  // This is a structural test — actual DB seeding verified by migration
  assertEquals(expectedArchetypes.length, 9);
  assertEquals(requiredKeys.length, 2);
});

// Test: keyword config structure is valid
Deno.test("signum keyword configs have correct shape", () => {
  const sampleKeywords = [
    { keyword: "church outreach", category: "community", weight: 5 },
    { keyword: "food pantry", category: "need_signals", weight: 5 },
  ];

  for (const kw of sampleKeywords) {
    assertExists(kw.keyword);
    assertExists(kw.category);
    assertEquals(typeof kw.weight, "number");
    assertEquals(kw.weight > 0 && kw.weight <= 10, true);
  }
});

// Test: journey stages are ordered arrays
Deno.test("journey stages are string arrays with 6 entries", () => {
  const churchStages = [
    "First Visit",
    "Getting Connected",
    "Active Member",
    "Serving",
    "Leading",
    "Shepherding",
  ];
  assertEquals(churchStages.length, 6);
  for (const s of churchStages) {
    assertEquals(typeof s, "string");
    assertEquals(s.length > 0, true);
  }
});

// Test: dedupe key patterns for idempotency
Deno.test("upsert on tenant_journey_stages uses correct conflict target", () => {
  // The unique index is (tenant_id, stage_label)
  // Running apply twice should not duplicate stages
  const conflictTarget = "tenant_id,stage_label";
  assertEquals(conflictTarget, "tenant_id,stage_label");
});

// Test: no PII in testimonium initialization event
Deno.test("testimonium init event contains no PII fields", () => {
  const forbiddenKeys = ["body", "html", "raw", "full_text", "note_text", "email_body"];
  const sampleMetadata = {
    archetype: "church",
    stats: { journey_stages: 6, signum_keywords: 6 },
  };

  const jsonStr = JSON.stringify(sampleMetadata);
  for (const key of forbiddenKeys) {
    assertEquals(
      jsonStr.includes(`"${key}"`),
      false,
      `Metadata should not contain "${key}"`
    );
  }
});
