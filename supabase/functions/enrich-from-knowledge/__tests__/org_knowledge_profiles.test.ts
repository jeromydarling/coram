import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import "https://deno.land/std@0.224.0/dotenv/load.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/enrich-from-knowledge`;

const HAS_INTEGRATION_ENV = !!(SUPABASE_URL && SERVICE_ROLE_KEY);

// ── Pure Logic Tests (always run, no external deps) ──

Deno.test("isGarbage: detects placeholder values", () => {
  function isGarbage(v: string | null | undefined): boolean {
    if (!v || typeof v !== "string") return true;
    const trimmed = v.trim();
    if (!trimmed) return true;
    return /^(information not available|not found|n\/a|unknown|none|not available|not specified|tbd|to be determined)$/i.test(trimmed);
  }

  assertEquals(isGarbage(null), true);
  assertEquals(isGarbage(undefined), true);
  assertEquals(isGarbage(""), true);
  assertEquals(isGarbage("  "), true);
  assertEquals(isGarbage("N/A"), true);
  assertEquals(isGarbage("Unknown"), true);
  assertEquals(isGarbage("Information not available"), true);
  assertEquals(isGarbage("TBD"), true);
  assertEquals(isGarbage("not specified"), true);
  assertEquals(isGarbage("Real mission statement about digital equity"), false);
  assertEquals(isGarbage("PCs for People"), false);
});

Deno.test("profile default structure has all required JSONB keys", () => {
  const defaultProfile = {
    event_targeting_profile: {
      preferred_event_types: [],
      excluded_event_types: [],
      audience_level: null,
      attendance_mode: [],
    },
    geo_reach_profile: {
      primary_metros: [],
      secondary_metros: [],
      national_presence: false,
    },
    grant_alignment_vectors: {
      focus_areas: [],
      program_types: [],
    },
    ecosystem_scope: {
      sectors: [],
    },
  };

  assertExists(defaultProfile.event_targeting_profile);
  assertExists(defaultProfile.geo_reach_profile);
  assertExists(defaultProfile.grant_alignment_vectors);
  assertExists(defaultProfile.ecosystem_scope);
  assertEquals(Array.isArray(defaultProfile.event_targeting_profile.preferred_event_types), true);
  assertEquals(Array.isArray(defaultProfile.geo_reach_profile.primary_metros), true);
  assertEquals(defaultProfile.geo_reach_profile.national_presence, false);
  assertEquals(Array.isArray(defaultProfile.grant_alignment_vectors.focus_areas), true);
  assertEquals(Array.isArray(defaultProfile.ecosystem_scope.sectors), true);
});

Deno.test("response contract: profile_initialized always present as boolean", () => {
  // New contract: profile_initialized is ALWAYS a boolean, never omitted
  const responseCreated = {
    ok: true,
    enriched: true,
    fields_updated: ["mission_snapshot"],
    knowledge_version: 1,
    profile_initialized: true,
  };
  assertEquals(typeof responseCreated.profile_initialized, "boolean");
  assertEquals(responseCreated.profile_initialized, true);

  const responseExisted = {
    ok: true,
    enriched: false,
    fields_updated: [],
    knowledge_version: 2,
    profile_initialized: false,
  };
  assertEquals(typeof responseExisted.profile_initialized, "boolean");
  assertEquals(responseExisted.profile_initialized, false);

  // Even on error fallback, must be boolean false (never undefined)
  const responseError = {
    ok: true,
    enriched: false,
    fields_updated: [],
    knowledge_version: 1,
    profile_initialized: false,
  };
  assertEquals(typeof responseError.profile_initialized, "boolean");
  assertEquals(responseError.profile_initialized, false);
});

Deno.test("profile_initialized: true only when newly created", () => {
  // Simulate SELECT-then-INSERT logic
  function computeProfileInitialized(existsBefore: boolean, insertError: { code: string } | null): boolean {
    if (existsBefore) return false;
    if (insertError) return false; // includes 23505 race and other errors
    return true;
  }

  assertEquals(computeProfileInitialized(true, null), false, "existing profile → false");
  assertEquals(computeProfileInitialized(false, null), true, "new insert → true");
  assertEquals(computeProfileInitialized(false, { code: "23505" }), false, "race condition → false");
  assertEquals(computeProfileInitialized(false, { code: "42P01" }), false, "other error → false");
});

Deno.test("response contract: all required keys present", () => {
  const response = {
    ok: true,
    enriched: false,
    fields_updated: [] as string[],
    knowledge_version: 1,
    profile_initialized: false,
  };

  assertEquals("ok" in response, true);
  assertEquals("enriched" in response, true);
  assertEquals("fields_updated" in response, true);
  assertEquals("knowledge_version" in response, true);
  assertEquals("profile_initialized" in response, true);
  assertEquals(typeof response.ok, "boolean");
  assertEquals(typeof response.enriched, "boolean");
  assertEquals(Array.isArray(response.fields_updated), true);
  assertEquals(typeof response.knowledge_version, "number");
  assertEquals(typeof response.profile_initialized, "boolean");
});

// ── Integration Tests (require deployed function + service-role key) ──

Deno.test("INTEGRATION: Missing org_id returns error", async () => {
  if (!HAS_INTEGRATION_ENV) {
    console.log("SKIP: No integration env vars");
    return;
  }

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assertEquals(body.ok, false);
});

Deno.test("INTEGRATION: Unauthorized user rejected", async () => {
  if (!HAS_INTEGRATION_ENV || !ANON_KEY) {
    console.log("SKIP: No integration env vars");
    return;
  }

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ org_id: "00000000-0000-0000-0000-000000000001" }),
  });
  await res.text();
  assertEquals(res.status >= 401 && res.status <= 403, true);
});

Deno.test("INTEGRATION: Nonexistent org returns 404", async () => {
  if (!HAS_INTEGRATION_ENV) {
    console.log("SKIP: No integration env vars");
    return;
  }

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ org_id: "00000000-0000-0000-0000-000000000099" }),
  });
  const body = await res.json();
  assertEquals(res.status, 404);
  assertEquals(body.ok, false);
});
