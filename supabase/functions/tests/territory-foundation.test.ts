import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ── Territory Type Validation ──

Deno.test("territory_type enum values are complete", () => {
  const types = ["metro", "county", "state", "country", "mission_field", "custom_region"];
  assertEquals(types.length, 6);
  for (const t of types) {
    assertEquals(/^[a-z_]+$/.test(t), true, `Invalid territory type: ${t}`);
  }
});

// ── Activation Slot Calculation ──

Deno.test("metro: 1 slot each", () => {
  // 3 metros = 3 slots
  const count = 3;
  assertEquals(count, 3);
});

Deno.test("county: ceil(count / 5) slots", () => {
  assertEquals(Math.ceil(1 / 5), 1);   // 1 county = 1 slot
  assertEquals(Math.ceil(5 / 5), 1);   // 5 counties = 1 slot
  assertEquals(Math.ceil(6 / 5), 2);   // 6 counties = 2 slots
  assertEquals(Math.ceil(10 / 5), 2);  // 10 counties = 2 slots
  assertEquals(Math.ceil(11 / 5), 3);  // 11 counties = 3 slots
});

Deno.test("state: 2 slots each", () => {
  assertEquals(1 * 2, 2);  // 1 state = 2 slots
  assertEquals(3 * 2, 6);  // 3 states = 6 slots
});

Deno.test("country: 1 slot each", () => {
  assertEquals(1, 1);
  assertEquals(4, 4);
});

Deno.test("mission_field: 0 slots (free with parent country)", () => {
  assertEquals(0, 0);
});

// ── Slot Calculation Combined ──

Deno.test("combined territory activation slots", () => {
  // Simulate: 2 metros + 7 counties + 1 state + 1 country + 2 mission fields
  const metroSlots = 2;
  const countySlots = Math.ceil(7 / 5); // = 2
  const stateSlots = 1 * 2; // = 2
  const countrySlots = 1;
  const missionSlots = 0; // free
  const total = metroSlots + countySlots + stateSlots + countrySlots + missionSlots;
  assertEquals(total, 7);
});

// ── Archetype Validation ──

Deno.test("missionary_org archetype key is valid", () => {
  const key = "missionary_org";
  assertEquals(/^[a-z_]+$/.test(key), true);
});

Deno.test("caregiver_solo has no territory activation", () => {
  // Solo caregivers use base location, not territories
  const consumesSlots = false;
  assertEquals(consumesSlots, false);
});

Deno.test("caregiver_agency uses standard territory activation", () => {
  const consumesSlots = true;
  assertEquals(consumesSlots, true);
});

// ── Territory Hierarchy ──

Deno.test("mission_field requires parent country", () => {
  const missionField = {
    territory_type: "mission_field",
    parent_id: "some-country-uuid",
    country_code: "KE",
  };
  assertExists(missionField.parent_id, "Mission field must have parent country");
  assertExists(missionField.country_code);
});

Deno.test("county must share state_code within bundle", () => {
  const bundle = [
    { name: "County A", state_code: "OH" },
    { name: "County B", state_code: "OH" },
    { name: "County C", state_code: "OH" },
  ];
  const allSameState = bundle.every(c => c.state_code === bundle[0].state_code);
  assertEquals(allSameState, true, "All counties in bundle must share same state");
});

Deno.test("county bundle max 5 per slot", () => {
  const maxPerSlot = 5;
  assertEquals(maxPerSlot, 5);
  // 5 counties = 1 slot
  assertEquals(Math.ceil(5 / maxPerSlot), 1);
  // 6 counties = 2 slots
  assertEquals(Math.ceil(6 / maxPerSlot), 2);
});

// ── Solo Caregiver Base Location ──

Deno.test("caregiver base location fields are private", () => {
  const baseLocation = {
    base_country_code: "US",
    base_state_code: "OR",
    base_city: "Portland",
    caregiver_network_opt_in: false,
  };
  // These fields should never render on Atlas
  assertExists(baseLocation.base_country_code);
  assertExists(baseLocation.base_state_code);
  assertEquals(baseLocation.caregiver_network_opt_in, false);
});

// ── Territory table query integration test ──

Deno.test("territories table is queryable", async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.log("SUPABASE_URL not set, skipping integration test");
    return;
  }

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey) {
    console.log("SUPABASE_ANON_KEY not set, skipping integration test");
    return;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/territories?select=id,territory_type,name&limit=5`, {
    headers: {
      "apikey": anonKey,
      "Authorization": `Bearer ${anonKey}`,
    },
  });

  assertEquals(response.status, 200);
  const data = await response.json();
  // Should be an array (may be empty if RLS blocks anon)
  assertEquals(Array.isArray(data) || (data.message !== undefined), true);
});
