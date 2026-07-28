import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Template generation tests ──

function buildGenericTemplate(eventName: string, eventDate: string | null, city: string | null): { subject: string; html_body: string } {
  const dateStr = eventDate
    ? new Date(eventDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";
  const locationStr = city ? ` in ${city}` : "";
  const subject = `Great connecting at ${eventName}`;
  const html_body = `<p>Hi {{ contact.FIRSTNAME }},</p>
<p>It was great meeting you at <strong>${eventName}</strong>${dateStr ? ` on ${dateStr}` : ""}${locationStr}.</p>
<p>I'd love to continue our conversation and explore how we might work together. Would you have time for a brief call this week?</p>
<p>Looking forward to hearing from you.</p>
<p>Best regards</p>`;
  return { subject, html_body };
}

function buildOrgKnowledgeTemplate(
  eventName: string,
  structured: { org_name?: string; mission?: string; partnership_angles?: string[] }
): { subject: string; html_body: string } {
  const orgName = structured?.org_name || "our organization";
  const mission = structured?.mission || "";
  const angles = structured?.partnership_angles || [];
  const angleText = angles.length > 0
    ? `<p>I think there could be a great synergy around <strong>${angles[0]}</strong>.</p>`
    : "";
  const subject = `Following up from ${eventName} — ${orgName}`;
  const html_body = `<p>Hi {{ contact.FIRSTNAME }},</p>
<p>It was wonderful connecting at <strong>${eventName}</strong>.</p>
${mission ? `<p>${orgName}'s mission — <em>${mission}</em> — really resonated with our work.</p>` : ""}
${angleText}
<p>I'd love to schedule a brief call to explore how we might collaborate. Would you have 15 minutes this week?</p>
<p>Best regards</p>`;
  return { subject, html_body };
}

Deno.test("generic template includes event name in subject", () => {
  const { subject } = buildGenericTemplate("Digital Equity Summit", null, null);
  assertEquals(subject, "Great connecting at Digital Equity Summit");
});

Deno.test("generic template includes city when provided", () => {
  const { html_body } = buildGenericTemplate("Summit", "2026-03-01", "Denver");
  assertEquals(html_body.includes("in Denver"), true);
});

Deno.test("generic template omits date when null", () => {
  const { html_body } = buildGenericTemplate("Summit", null, null);
  assertEquals(html_body.includes(" on "), false);
});

Deno.test("generic template includes merge tag", () => {
  const { html_body } = buildGenericTemplate("Summit", null, null);
  assertEquals(html_body.includes("{{ contact.FIRSTNAME }}"), true);
});

Deno.test("org knowledge template includes org name", () => {
  const { subject } = buildOrgKnowledgeTemplate("Summit", {
    org_name: "Acme Corp",
    mission: "helping people",
    partnership_angles: ["digital equity"],
  });
  assertEquals(subject.includes("Acme Corp"), true);
});

Deno.test("org knowledge template includes partnership angle", () => {
  const { html_body } = buildOrgKnowledgeTemplate("Summit", {
    org_name: "Acme",
    mission: "good work",
    partnership_angles: ["technology access"],
  });
  assertEquals(html_body.includes("technology access"), true);
});

Deno.test("org knowledge template handles empty angles", () => {
  const { html_body } = buildOrgKnowledgeTemplate("Summit", {
    org_name: "Acme",
    mission: "good work",
    partnership_angles: [],
  });
  assertEquals(html_body.includes("synergy"), false);
});

Deno.test("org knowledge template falls back gracefully", () => {
  const { subject } = buildOrgKnowledgeTemplate("Summit", {});
  assertEquals(subject.includes("our organization"), true);
});

// ── URL normalization tests ──

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_")) parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return url;
  }
}

Deno.test("normalizeUrl adds https", () => {
  assertEquals(normalizeUrl("example.org"), "https://example.org");
});

Deno.test("normalizeUrl strips fragment", () => {
  assertEquals(normalizeUrl("https://example.org/about#team"), "https://example.org/about");
});

Deno.test("normalizeUrl strips utm params", () => {
  assertEquals(normalizeUrl("https://example.org?utm_source=x&foo=bar"), "https://example.org/?foo=bar");
});

Deno.test("normalizeUrl strips trailing slash", () => {
  assertEquals(normalizeUrl("https://example.org/"), "https://example.org");
});

// ── Email validation tests ──

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.test("isValidEmail: valid email", () => {
  assertEquals(isValidEmail("test@example.com"), true);
});

Deno.test("isValidEmail: invalid email", () => {
  assertEquals(isValidEmail("not-an-email"), false);
});

Deno.test("isValidEmail: empty string", () => {
  assertEquals(isValidEmail(""), false);
});
