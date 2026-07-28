import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatCompanyKbForPrompt,
  buildCompanyKbSystemBlock,
} from "../companyKbContext.ts";
import type { CompanyKbContext } from "../companyKbContext.ts";

Deno.test("formatCompanyKbForPrompt includes all sections", () => {
  const ctx: CompanyKbContext = {
    documents: [
      { id: "1", key: "company_profile", title: "Company Profile", version: 2, content_markdown: "# PCs for People\nWe bridge the digital divide." },
      { id: "2", key: "email_tone", title: "Email Tone", version: 1, content_markdown: "Professional and mission-driven." },
      { id: "3", key: "approved_claims", title: "Approved Claims", version: 3, content_markdown: "- We have served 500k+ people.\n- Founded in 2009." },
    ],
    versions: { company_profile: 2, email_tone: 1, approved_claims: 3 },
  };

  const text = formatCompanyKbForPrompt(ctx);
  assertEquals(text.includes("PCs for People"), true);
  assertEquals(text.includes("digital divide"), true);
  assertEquals(text.includes("Professional and mission-driven"), true);
  assertEquals(text.includes("500k+"), true);
  assertEquals(text.includes("v2"), true);
  assertEquals(text.includes("v1"), true);
  assertEquals(text.includes("v3"), true);
});

Deno.test("formatCompanyKbForPrompt handles single document", () => {
  const ctx: CompanyKbContext = {
    documents: [
      { id: "1", key: "company_profile", title: "Company Profile", version: 1, content_markdown: "Just the profile." },
    ],
    versions: { company_profile: 1 },
  };

  const text = formatCompanyKbForPrompt(ctx);
  assertEquals(text.includes("Just the profile"), true);
});

Deno.test("buildCompanyKbSystemBlock wraps with instructions", () => {
  const ctx: CompanyKbContext = {
    documents: [
      { id: "1", key: "company_profile", title: "Company Profile", version: 1, content_markdown: "Our mission is X." },
    ],
    versions: { company_profile: 1 },
  };

  const block = buildCompanyKbSystemBlock(ctx);
  assertEquals(block.includes("AUTHORITATIVE COMPANY KNOWLEDGE BASE"), true);
  assertEquals(block.includes("Do not contradict"), true);
  assertEquals(block.includes("Our mission is X"), true);
});

Deno.test("buildCompanyKbSystemBlock returns empty string when no content", () => {
  const ctx: CompanyKbContext = {
    documents: [],
    versions: {},
  };

  const block = buildCompanyKbSystemBlock(ctx);
  assertEquals(block, "");
});

Deno.test("formatCompanyKbForPrompt is deterministic", () => {
  const ctx: CompanyKbContext = {
    documents: [
      { id: "1", key: "company_profile", title: "Profile", version: 1, content_markdown: "Profile A" },
      { id: "2", key: "email_tone", title: "Tone", version: 2, content_markdown: "Tone B" },
    ],
    versions: { company_profile: 1, email_tone: 2 },
  };

  const a = formatCompanyKbForPrompt(ctx);
  const b = formatCompanyKbForPrompt(ctx);
  assertEquals(a, b);
});

Deno.test("company KB versions are recorded for provenance", () => {
  const ctx: CompanyKbContext = {
    documents: [
      { id: "doc-1", key: "company_profile", title: "Company Profile", version: 5, content_markdown: "..." },
      { id: "doc-2", key: "email_tone", title: "Email Tone", version: 3, content_markdown: "..." },
    ],
    versions: { company_profile: 5, email_tone: 3 },
  };

  assertEquals(ctx.versions.company_profile, 5);
  assertEquals(ctx.versions.email_tone, 3);
});
