import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatOrgProfileForPrompt, buildOrgKnowledgeSystemBlock } from "../orgKnowledgeContext.ts";

Deno.test("formatOrgProfileForPrompt includes all fields", () => {
  const profile = {
    org_name: "Test Org",
    mission: "Help people",
    positioning: "Leading provider",
    who_we_serve: ["Youth", "Seniors"],
    geographies: ["Chicago"],
    programs: [{ name: "Program A", summary: "Does good" }],
    key_stats: [{ label: "Served", value: "1000" }],
    tone_keywords: ["empowering", "inclusive"],
    approved_claims: ["We serve 1000 people"],
    disallowed_claims: ["We are the biggest"],
    partnership_angles: ["Workforce"],
  };

  const text = formatOrgProfileForPrompt(profile);
  assertEquals(text.includes("Test Org"), true);
  assertEquals(text.includes("Help people"), true);
  assertEquals(text.includes("Leading provider"), true);
  assertEquals(text.includes("Youth"), true);
  assertEquals(text.includes("Program A"), true);
  assertEquals(text.includes("Served: 1000"), true);
  assertEquals(text.includes("empowering"), true);
  assertEquals(text.includes("✓ We serve 1000 people"), true);
  assertEquals(text.includes("✗ We are the biggest"), true);
});

Deno.test("formatOrgProfileForPrompt handles empty profile", () => {
  const text = formatOrgProfileForPrompt({ org_name: "", mission: "" });
  assertEquals(typeof text, "string");
});

Deno.test("formatOrgProfileForPrompt handles legacy who_they_serve", () => {
  const text = formatOrgProfileForPrompt({
    org_name: "Test",
    mission: "Test",
    who_they_serve: ["Students"],
  });
  assertEquals(text.includes("Students"), true);
});

Deno.test("buildOrgKnowledgeSystemBlock includes version", () => {
  const ctx = {
    snapshot_id: "abc",
    version: 3,
    org_profile_json: { org_name: "X", mission: "Y" },
    org_profile_text: "Organization: X\nMission: Y",
  };
  const block = buildOrgKnowledgeSystemBlock(ctx);
  assertEquals(block.includes("v3"), true);
  assertEquals(block.includes("AUTHORITATIVE"), true);
  assertEquals(block.includes("Organization: X"), true);
});

Deno.test("formatOrgProfileForPrompt deterministic output", () => {
  const profile = {
    org_name: "Stable Org",
    mission: "Stable mission",
    programs: [{ name: "A", summary: "B" }],
  };
  const a = formatOrgProfileForPrompt(profile);
  const b = formatOrgProfileForPrompt(profile);
  assertEquals(a, b);
});
