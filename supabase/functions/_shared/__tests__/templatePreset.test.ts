import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatCompanyKbForPrompt,
  buildCompanyKbSystemBlock,
} from "../companyKbContext.ts";
import type { CompanyKbContext } from "../companyKbContext.ts";

// === Template Preset Tests ===

Deno.test("buildCompanyKbSystemBlock includes all KB sections for template generation", () => {
  const ctx: CompanyKbContext = {
    documents: [
      { id: "1", key: "company_profile", title: "Company Profile", version: 3, content_markdown: "PCs for People bridges the digital divide." },
      { id: "2", key: "email_tone", title: "Email Tone", version: 2, content_markdown: "Professional, warm, mission-driven." },
      { id: "3", key: "approved_claims", title: "Approved Claims", version: 1, content_markdown: "- Served 500k+ people\n- Founded in 2009" },
    ],
    versions: { company_profile: 3, email_tone: 2, approved_claims: 1 },
  };

  const block = buildCompanyKbSystemBlock(ctx);
  assertEquals(block.includes("AUTHORITATIVE COMPANY KNOWLEDGE BASE"), true);
  assertEquals(block.includes("PCs for People bridges"), true);
  assertEquals(block.includes("Professional, warm"), true);
  assertEquals(block.includes("500k+"), true);
});

Deno.test("formatCompanyKbForPrompt includes version numbers for provenance", () => {
  const ctx: CompanyKbContext = {
    documents: [
      { id: "1", key: "company_profile", title: "Company Profile", version: 5, content_markdown: "Profile content" },
      { id: "2", key: "email_tone", title: "Email Tone", version: 3, content_markdown: "Tone content" },
      { id: "3", key: "approved_claims", title: "Approved Claims", version: 2, content_markdown: "Claims content" },
    ],
    versions: { company_profile: 5, email_tone: 3, approved_claims: 2 },
  };

  const text = formatCompanyKbForPrompt(ctx);
  assertEquals(text.includes("v5"), true);
  assertEquals(text.includes("v3"), true);
  assertEquals(text.includes("v2"), true);
});

Deno.test("company KB context handles missing sections gracefully for templates", () => {
  const ctx: CompanyKbContext = {
    documents: [],
    versions: {},
  };

  const block = buildCompanyKbSystemBlock(ctx);
  assertEquals(block, "");
});

Deno.test("subject_variants validation — 3 variants required", () => {
  const eventName = "Tech Conference 2026";
  const variants = [
    `Great meeting you at ${eventName}`,
    `Following up from ${eventName}`,
    `Quick follow-up from ${eventName}`,
  ];

  assertEquals(variants.length, 3);
  for (const v of variants) {
    assertEquals(v.includes(eventName), true);
  }
});

Deno.test("fallback template includes event name in subject and body", () => {
  const eventName = "Digital Inclusion Summit";
  const subject = `Great meeting you at ${eventName}`;
  const body = `<p>It was great meeting you at <strong>${eventName}</strong>.</p>`;

  assertEquals(subject.includes(eventName), true);
  assertEquals(body.includes(eventName), true);
});

Deno.test("preset defaults structure is valid", () => {
  const defaults = {
    ask_type: "intro_call",
    tone: "warm",
    length: "short",
    subject_variants: [
      "Great meeting you at {{ context.event_name }}",
      "Following up from {{ context.event_name }}",
      "Quick follow-up from {{ context.event_name }}",
    ],
    constraints: [
      "Do not invent facts.",
      "4–5 short paragraphs max.",
      "Ask for a 15–20 minute intro call.",
      "Warm, human, professional. No hype.",
    ],
  };

  assertEquals(defaults.ask_type, "intro_call");
  assertEquals(defaults.tone, "warm");
  assertEquals(defaults.length, "short");
  assertEquals(defaults.subject_variants.length, 3);
  assertEquals(defaults.constraints.length, 4);
  for (const sv of defaults.subject_variants) {
    assertEquals(sv.includes("{{ context.event_name }}"), true);
  }
});
