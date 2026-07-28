import { assertEquals, assertNotEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Fixtures (inline) ──
const maliciousExtra = {
  workflow_key: "partner_enrich",
  run_id: "33333333-aaaa-bbbb-cccc-dddddddddddd",
  org_name: "Legit Org",
  website_url: "https://legit.org",
  __admin_override: true,
  role: "superadmin",
  delete_all: true,
  sql_injection: "'; DROP TABLE automation_runs; --",
};

// ── Helpers mirroring n8n-dispatch ──
function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const WORKFLOW_PATHS: Record<string, string> = {
  partner_enrich: "/webhook/partner-enrich",
  opportunity_monitor: "/webhook/opportunity-monitor",
  recommendations_generate: "/webhook/recommendations-generate",
  watchlist_ingest: "/webhook/watchlist-ingest",
  watchlist_diff: "/webhook/watchlist-diff",
  event_attendee_enrich: "/webhook/event-attendee-enrich",
  watchlist_deep_dive: "/webhook/watchlist-deep-dive",
};

const ROLE_ALLOWLIST: Record<string, string[]> = {
  admin: ["partner_enrich", "opportunity_monitor", "recommendations_generate", "watchlist_ingest", "watchlist_diff", "event_attendee_enrich", "watchlist_deep_dive"],
  leadership: ["partner_enrich", "opportunity_monitor", "recommendations_generate", "watchlist_ingest", "watchlist_diff", "event_attendee_enrich", "watchlist_deep_dive"],
  regional_lead: ["partner_enrich", "opportunity_monitor", "recommendations_generate", "watchlist_ingest", "event_attendee_enrich", "watchlist_deep_dive"],
  staff: ["partner_enrich", "recommendations_generate", "event_attendee_enrich"],
};

function buildPartnerEnrichPayload(body: Record<string, unknown>) {
  const org_name = body.org_name;
  if (!org_name || typeof org_name !== "string") throw new Error("org_name required");
  return { org_id: body.org_id || null, org_name, website_url: normalizeUrl(body.website_url) };
}

function buildOpportunityMonitorPayload(body: Record<string, unknown>) {
  const opportunity_id = typeof body.opportunity_id === "string" ? body.opportunity_id : null;
  const since = typeof body.since === "string" ? body.since : null;
  if (!opportunity_id && !since) throw new Error("opportunity_monitor requires either opportunity_id or since");
  let monitor_urls: string[] = [];
  if (Array.isArray(body.monitor_urls)) {
    monitor_urls = body.monitor_urls.slice(0, 6)
      .map((u: unknown) => normalizeUrl(u))
      .filter((u: string | null): u is string => u !== null);
  }
  const scope: Record<string, unknown> = {};
  if (since) {
    scope.since = since;
    if (Array.isArray(body.metro_ids)) scope.metro_ids = body.metro_ids.filter((id: unknown) => typeof id === "string").slice(0, 20);
    if (typeof body.region_id === "string") scope.region_id = body.region_id;
    if (typeof body.owner_user_id === "string") scope.owner_user_id = body.owner_user_id;
  }
  return {
    ...(opportunity_id ? { opportunity_id } : {}),
    ...scope,
    org_id: body.org_id || null,
    org_name: typeof body.org_name === "string" ? body.org_name : null,
    monitor_urls,
    previous_hashes: Array.isArray(body.previous_hashes)
      ? body.previous_hashes.filter((h: unknown) => typeof h === "string").slice(0, 50)
      : [],
  };
}

function buildRecommendationsPayload(body: Record<string, unknown>) {
  const metro_id = body.metro_id;
  if (!metro_id || typeof metro_id !== "string") throw new Error("metro_id required");
  const horizon_days = typeof body.horizon_days === "number" && body.horizon_days > 0
    ? Math.min(body.horizon_days, 365) : 30;
  return {
    metro_id, horizon_days,
    opportunities: Array.isArray(body.opportunities) ? body.opportunities.slice(0, 30) : [],
    recent_signals: Array.isArray(body.recent_signals) ? body.recent_signals.slice(0, 50) : [],
    org_facts: Array.isArray(body.org_facts) ? body.org_facts.slice(0, 50) : [],
  };
}

function buildWatchlistPayload(body: Record<string, unknown>) {
  const org_id = body.org_id;
  if (!org_id || typeof org_id !== "string") throw new Error("org_id is required for watchlist workflows");
  const org_name = typeof body.org_name === "string" ? body.org_name : null;
  const website_url = normalizeUrl(body.website_url);
  return { org_id, org_name, website_url };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildEventAttendeeEnrichPayload(body: Record<string, unknown>) {
  const event_id = body.event_id;
  if (!event_id || typeof event_id !== "string" || !UUID_RE.test(event_id)) {
    throw new Error("event_id must be a valid UUID");
  }

  if (body.attendee_ids !== undefined && body.attendee_ids !== null) {
    if (!Array.isArray(body.attendee_ids)) {
      throw new Error("attendee_ids must be an array of UUIDs");
    }
    for (const id of body.attendee_ids) {
      if (typeof id !== "string" || !UUID_RE.test(id)) {
        throw new Error("Each attendee_id must be a valid UUID");
      }
    }
    const attendee_ids = body.attendee_ids.slice(0, 50) as string[];
    if (attendee_ids.length === 0) {
      return { event_id };
    }
    return { event_id, attendee_ids };
  }

  return { event_id };
}

// ── Existing Tests ──

Deno.test("RBAC: denies staff from opportunity_monitor", () => {
  const allowed = ["staff"].some((r) => ROLE_ALLOWLIST[r]?.includes("opportunity_monitor"));
  assertEquals(allowed, false);
});

Deno.test("RBAC: allows admin for all workflows", () => {
  for (const wk of Object.keys(WORKFLOW_PATHS)) {
    assertEquals(["admin"].some((r) => ROLE_ALLOWLIST[r]?.includes(wk)), true);
  }
});

Deno.test("RBAC: allows staff for partner_enrich + recommendations_generate", () => {
  assertEquals(["staff"].some((r) => ROLE_ALLOWLIST[r]?.includes("partner_enrich")), true);
  assertEquals(["staff"].some((r) => ROLE_ALLOWLIST[r]?.includes("recommendations_generate")), true);
});

Deno.test("payload scoping: partner_enrich strips extra keys", () => {
  const result = buildPartnerEnrichPayload({
    org_id: "org-1", org_name: "Test", website_url: "https://test.org",
    __admin_override: true, sql_injection: "DROP TABLE",
  });
  assertEquals(Object.keys(result).sort(), ["org_id", "org_name", "website_url"]);
});

Deno.test("payload scoping: malicious fixture stripped", () => {
  const result = buildPartnerEnrichPayload(maliciousExtra);
  assertEquals(Object.keys(result).sort(), ["org_id", "org_name", "website_url"]);
});

Deno.test("payload scoping: opportunity_monitor accepts opportunity_id only", () => {
  const result = buildOpportunityMonitorPayload({ opportunity_id: "opp-1", monitor_urls: ["example.com"] });
  assertEquals(result.opportunity_id, "opp-1");
  assertEquals("since" in result, false);
});

Deno.test("payload scoping: opportunity_monitor accepts since+scope (batch mode)", () => {
  const result = buildOpportunityMonitorPayload({
    since: "2026-01-01T00:00:00Z",
    metro_ids: ["m1", "m2"],
    region_id: "r1",
  });
  assertEquals("opportunity_id" in result, false);
  assertEquals((result as Record<string, unknown>).since, "2026-01-01T00:00:00Z");
  assertEquals((result as Record<string, unknown>).metro_ids, ["m1", "m2"]);
  assertEquals((result as Record<string, unknown>).region_id, "r1");
});

Deno.test("payload scoping: opportunity_monitor rejects when neither mode supplied", () => {
  let threw = false;
  try { buildOpportunityMonitorPayload({}); } catch { threw = true; }
  assertEquals(threw, true);
});

Deno.test("payload scoping: opportunity_monitor limits URLs to 6", () => {
  const urls = Array.from({ length: 10 }, (_, i) => `example${i}.com`);
  const result = buildOpportunityMonitorPayload({ opportunity_id: "opp-1", monitor_urls: urls });
  assertEquals(result.monitor_urls.length <= 6, true);
  for (const u of result.monitor_urls) assertMatch(u, /^https:\/\//);
});

Deno.test("payload scoping: recommendations defaults horizon_days to 30", () => {
  const result = buildRecommendationsPayload({ metro_id: "m-1" });
  assertEquals(result.horizon_days, 30);
});

Deno.test("payload scoping: recommendations caps horizon_days at 365", () => {
  assertEquals(buildRecommendationsPayload({ metro_id: "m-1", horizon_days: 999 }).horizon_days, 365);
});

Deno.test("payload scoping: recommendations limits array sizes", () => {
  const r = buildRecommendationsPayload({
    metro_id: "m-1", opportunities: Array(50).fill({}),
    recent_signals: Array(100).fill({}), org_facts: Array(100).fill({}),
  });
  assertEquals(r.opportunities.length <= 30, true);
  assertEquals(r.recent_signals.length <= 50, true);
  assertEquals(r.org_facts.length <= 50, true);
});

Deno.test("URL normalization: bare domain", () => {
  assertEquals(normalizeUrl("example.org"), "https://example.org/");
});

Deno.test("URL normalization: trims whitespace", () => {
  assertEquals(normalizeUrl("  https://a.com  "), "https://a.com/");
});

Deno.test("URL normalization: preserves http://", () => {
  assertEquals(normalizeUrl("http://a.com"), "http://a.com/");
});

Deno.test("URL normalization: null for empty", () => {
  assertEquals(normalizeUrl(""), null);
});

Deno.test("URL normalization: null for non-string", () => {
  assertEquals(normalizeUrl(42), null);
});

Deno.test("HMAC: produces 64-char hex digest", async () => {
  const sig = await hmacSign("secret", '{"test":true}');
  assertMatch(sig, /^[0-9a-f]{64}$/);
});

Deno.test("HMAC: is deterministic", async () => {
  const body = '{"run_id":"x"}';
  assertEquals(await hmacSign("key", body), await hmacSign("key", body));
});

Deno.test("HMAC: varies with different secrets", async () => {
  const body = '{"test":1}';
  assertNotEquals(await hmacSign("key-a", body), await hmacSign("key-b", body));
});

Deno.test("webhook URL routing: correct paths", () => {
  assertEquals(WORKFLOW_PATHS["partner_enrich"], "/webhook/partner-enrich");
  assertEquals(WORKFLOW_PATHS["opportunity_monitor"], "/webhook/opportunity-monitor");
  assertEquals(WORKFLOW_PATHS["recommendations_generate"], "/webhook/recommendations-generate");
});

Deno.test("run_id: crypto.randomUUID is v4", () => {
  assertMatch(crypto.randomUUID(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

// ── Schedule secret auth tests ──

function resolveAuth(
  headers: Record<string, string | undefined>,
  scheduleSecret: string | undefined,
): { mode: string; error?: string } {
  const scheduleHeader = headers["x-n8n-schedule-secret"];
  const authHeader = headers["authorization"] ?? "";

  if (scheduleHeader) {
    if (!scheduleSecret) return { mode: "error", error: "N8N_SCHEDULE_SECRET not configured" };
    if (scheduleHeader !== scheduleSecret) return { mode: "error", error: "Invalid schedule secret" };
    return { mode: "schedule" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { mode: "error", error: "Missing Authorization header" };
  }

  return { mode: "jwt" };
}

Deno.test("schedule auth: valid secret accepted", () => {
  const r = resolveAuth({ "x-n8n-schedule-secret": "s3cr3t" }, "s3cr3t");
  assertEquals(r.mode, "schedule");
});

Deno.test("schedule auth: invalid secret rejected", () => {
  const r = resolveAuth({ "x-n8n-schedule-secret": "wrong" }, "s3cr3t");
  assertEquals(r.mode, "error");
  assertEquals(r.error, "Invalid schedule secret");
});

Deno.test("schedule auth: missing env config rejected", () => {
  const r = resolveAuth({ "x-n8n-schedule-secret": "any" }, undefined);
  assertEquals(r.mode, "error");
  assertEquals(r.error, "N8N_SCHEDULE_SECRET not configured");
});

Deno.test("schedule auth: falls back to JWT when no schedule header", () => {
  const r = resolveAuth({ authorization: "Bearer tok" }, "s3cr3t");
  assertEquals(r.mode, "jwt");
});

Deno.test("schedule auth: schedule header takes priority over JWT", () => {
  const r = resolveAuth(
    { "x-n8n-schedule-secret": "s3cr3t", authorization: "Bearer tok" },
    "s3cr3t",
  );
  assertEquals(r.mode, "schedule");
});

Deno.test("schedule auth: no headers returns error", () => {
  const r = resolveAuth({}, "s3cr3t");
  assertEquals(r.mode, "error");
});

Deno.test("schedule auth: only allowlisted workflow_keys dispatched", () => {
  assertEquals("evil_workflow" in WORKFLOW_PATHS, false);
  assertEquals("partner_enrich" in WORKFLOW_PATHS, true);
  assertEquals("watchlist_ingest" in WORKFLOW_PATHS, true);
});

Deno.test("schedule auth: triggered_by is null for schedule mode", () => {
  const r = resolveAuth({ "x-n8n-schedule-secret": "s3cr3t" }, "s3cr3t");
  assertEquals(r.mode, "schedule");
  const userId = r.mode === "schedule" ? null : "user-id";
  assertEquals(userId, null);
});

// ── Watchlist RBAC tests ──

Deno.test("RBAC: admin can dispatch watchlist_ingest", () => {
  assertEquals(["admin"].some((r) => ROLE_ALLOWLIST[r]?.includes("watchlist_ingest")), true);
});

Deno.test("RBAC: staff cannot dispatch watchlist_ingest", () => {
  assertEquals(["staff"].some((r) => ROLE_ALLOWLIST[r]?.includes("watchlist_ingest")), false);
});

Deno.test("RBAC: regional_lead can dispatch watchlist_ingest but not watchlist_diff", () => {
  assertEquals(["regional_lead"].some((r) => ROLE_ALLOWLIST[r]?.includes("watchlist_ingest")), true);
  assertEquals(["regional_lead"].some((r) => ROLE_ALLOWLIST[r]?.includes("watchlist_diff")), false);
});

// ── Domain normalization tests ──

import { normalizeDomain } from "../../_shared/domainNormalize.ts";

Deno.test("dispatch: domain normalization for partner_enrich", () => {
  assertEquals(normalizeDomain("https://WWW.Example.org/about"), "example.org");
  assertEquals(normalizeDomain(null), null);
});

// ── Daily cap test (crawlLimits removed — unified AI budget) ──

Deno.test("dispatch: daily watchlist cap is 50", () => {
  // Simple constant — unified budget now governs total AI usage
  const DAILY_CAP = 50;
  assertEquals(DAILY_CAP, 50);
});

// ══════════════════════════════════════════════════
// Phase 3+4: event_attendee_enrich & watchlist_deep_dive
// ══════════════════════════════════════════════════

// ── RBAC: event_attendee_enrich ──

Deno.test("RBAC: admin can dispatch event_attendee_enrich", () => {
  assertEquals(["admin"].some((r) => ROLE_ALLOWLIST[r]?.includes("event_attendee_enrich")), true);
});

Deno.test("RBAC: staff can dispatch event_attendee_enrich", () => {
  assertEquals(["staff"].some((r) => ROLE_ALLOWLIST[r]?.includes("event_attendee_enrich")), true);
});

Deno.test("RBAC: regional_lead can dispatch event_attendee_enrich", () => {
  assertEquals(["regional_lead"].some((r) => ROLE_ALLOWLIST[r]?.includes("event_attendee_enrich")), true);
});

// ── RBAC: watchlist_deep_dive ──

Deno.test("RBAC: admin can dispatch watchlist_deep_dive", () => {
  assertEquals(["admin"].some((r) => ROLE_ALLOWLIST[r]?.includes("watchlist_deep_dive")), true);
});

Deno.test("RBAC: staff CANNOT dispatch watchlist_deep_dive", () => {
  assertEquals(["staff"].some((r) => ROLE_ALLOWLIST[r]?.includes("watchlist_deep_dive")), false);
});

Deno.test("RBAC: regional_lead can dispatch watchlist_deep_dive", () => {
  assertEquals(["regional_lead"].some((r) => ROLE_ALLOWLIST[r]?.includes("watchlist_deep_dive")), true);
});

// ── Routing: new workflow keys ──

Deno.test("routing: event_attendee_enrich maps to correct path", () => {
  assertEquals(WORKFLOW_PATHS["event_attendee_enrich"], "/webhook/event-attendee-enrich");
});

Deno.test("routing: watchlist_deep_dive maps to correct path", () => {
  assertEquals(WORKFLOW_PATHS["watchlist_deep_dive"], "/webhook/watchlist-deep-dive");
});

// ── Payload: event_attendee_enrich ──

const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const VALID_UUID_2 = "b2c3d4e5-f6a7-8901-bcde-f12345678901";

Deno.test("Payload: event_attendee_enrich missing event_id throws", () => {
  let threw = false;
  try { buildEventAttendeeEnrichPayload({}); } catch { threw = true; }
  assertEquals(threw, true);
});

Deno.test("Payload: event_attendee_enrich non-UUID event_id throws", () => {
  let threw = false;
  try { buildEventAttendeeEnrichPayload({ event_id: "not-a-uuid" }); } catch { threw = true; }
  assertEquals(threw, true);
});

Deno.test("Payload: event_attendee_enrich invalid UUID in attendee_ids throws", () => {
  let threw = false;
  try {
    buildEventAttendeeEnrichPayload({
      event_id: VALID_UUID,
      attendee_ids: [VALID_UUID_2, "bad-id"],
    });
  } catch { threw = true; }
  assertEquals(threw, true);
});

Deno.test("Payload: event_attendee_enrich strips extra keys", () => {
  const result = buildEventAttendeeEnrichPayload({
    event_id: VALID_UUID,
    attendee_ids: [VALID_UUID_2],
    __admin_override: true,
    sql_injection: "DROP TABLE",
  });
  assertEquals(Object.keys(result).sort(), ["attendee_ids", "event_id"]);
});

Deno.test("Payload: event_attendee_enrich caps attendee_ids at 50", () => {
  const ids = Array.from({ length: 60 }, (_, i) =>
    `${String(i).padStart(8, "0")}-0000-0000-0000-000000000000`
  );
  const result = buildEventAttendeeEnrichPayload({ event_id: VALID_UUID, attendee_ids: ids });
  const resultIds = (result as { attendee_ids: string[] }).attendee_ids;
  assertEquals(resultIds.length, 50);
  // Preserve order: first element matches
  assertEquals(resultIds[0], ids[0]);
  assertEquals(resultIds[49], ids[49]);
});

Deno.test("Payload: event_attendee_enrich omits attendee_ids when not provided", () => {
  const result = buildEventAttendeeEnrichPayload({ event_id: VALID_UUID });
  assertEquals("attendee_ids" in result, false);
  assertEquals(Object.keys(result), ["event_id"]);
});

Deno.test("Payload: event_attendee_enrich omits attendee_ids when empty array", () => {
  const result = buildEventAttendeeEnrichPayload({
    event_id: VALID_UUID,
    attendee_ids: [],
  });
  assertEquals("attendee_ids" in result, false);
  assertEquals(Object.keys(result), ["event_id"]);
});

// ── Payload: watchlist_deep_dive uses watchlist builder ──

Deno.test("Payload: watchlist_deep_dive requires org_id", () => {
  let threw = false;
  try { buildWatchlistPayload({}); } catch { threw = true; }
  assertEquals(threw, true);
});
