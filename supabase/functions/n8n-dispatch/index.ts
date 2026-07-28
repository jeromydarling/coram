import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
// crawlLimits removed — unified AI budget now governs all engine usage
import { normalizeDomain } from "../_shared/domainNormalize.ts";

// ── CORS ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ── Workflow config ──
const WORKFLOW_PATHS: Record<string, string> = {
  partner_enrich: "/webhook/partner-enrich",
  opportunity_monitor: "/webhook/opportunity-monitor",
  recommendations_generate: "/webhook/recommendations-generate",
  watchlist_ingest: "/webhook/watchlist-ingest",
  watchlist_diff: "/webhook/watchlist-diff",
  event_attendee_enrich: "/webhook/event-attendee-enrich",
  watchlist_deep_dive: "/webhook/watchlist-deep-dive",
  search_events: "/webhook/search-events",
  search_opportunities: "/webhook/search-opportunities",
  search_people: "/webhook/search-people",
  search_grants: "/webhook/search-grants",
  grant_enrich: "/webhook/grant-enrich-v1",
};

const ROLE_ALLOWLIST: Record<string, string[]> = {
  admin: ["partner_enrich", "opportunity_monitor", "recommendations_generate", "watchlist_ingest", "watchlist_diff", "event_attendee_enrich", "watchlist_deep_dive", "search_events", "search_opportunities", "search_people", "search_grants", "grant_enrich"],
  leadership: ["partner_enrich", "opportunity_monitor", "recommendations_generate", "watchlist_ingest", "watchlist_diff", "event_attendee_enrich", "watchlist_deep_dive", "search_events", "search_opportunities", "search_people", "search_grants", "grant_enrich"],
  regional_lead: ["partner_enrich", "opportunity_monitor", "recommendations_generate", "watchlist_ingest", "event_attendee_enrich", "watchlist_deep_dive", "search_events", "search_opportunities", "search_people", "search_grants", "grant_enrich"],
  staff: ["partner_enrich", "recommendations_generate", "event_attendee_enrich", "search_events", "search_opportunities", "search_people", "search_grants", "grant_enrich"],
};

// ── Helpers ──
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
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Payload builders ──
function buildPartnerEnrichPayload(body: Record<string, unknown>) {
  const org_id = body.org_id;
  const org_name = body.org_name;
  if (!org_name || typeof org_name !== "string") {
    throw new Error("org_name is required for partner_enrich");
  }
  const website_url = normalizeUrl(body.website_url);
  return { org_id: org_id || null, org_name, website_url };
}

function buildOpportunityMonitorPayload(body: Record<string, unknown>) {
  const opportunity_id = typeof body.opportunity_id === "string" ? body.opportunity_id : null;
  const since = typeof body.since === "string" ? body.since : null;

  // Must supply either opportunity_id (single mode) or since (batch mode)
  if (!opportunity_id && !since) {
    throw new Error("opportunity_monitor requires either opportunity_id or since");
  }

  const org_id = body.org_id || null;
  const org_name = typeof body.org_name === "string" ? body.org_name : null;

  let monitor_urls: string[] = [];
  if (Array.isArray(body.monitor_urls)) {
    monitor_urls = body.monitor_urls
      .slice(0, 6)
      .map((u: unknown) => normalizeUrl(u))
      .filter((u: string | null): u is string => u !== null);
  }

  const previous_hashes = Array.isArray(body.previous_hashes)
    ? body.previous_hashes.filter((h: unknown) => typeof h === "string").slice(0, 50)
    : [];

  // Batch scope fields (only relevant when since is provided)
  const scope: Record<string, unknown> = {};
  if (since) {
    scope.since = since;
    if (Array.isArray(body.metro_ids)) {
      scope.metro_ids = body.metro_ids.filter((id: unknown) => typeof id === "string").slice(0, 20);
    }
    if (typeof body.region_id === "string") scope.region_id = body.region_id;
    if (typeof body.owner_user_id === "string") scope.owner_user_id = body.owner_user_id;
  }

  return {
    ...(opportunity_id ? { opportunity_id } : {}),
    ...scope,
    org_id,
    org_name,
    monitor_urls,
    previous_hashes,
  };
}

function buildRecommendationsPayload(body: Record<string, unknown>) {
  const metro_id = body.metro_id;
  if (!metro_id || typeof metro_id !== "string") {
    throw new Error("metro_id is required for recommendations_generate");
  }
  const horizon_days =
    typeof body.horizon_days === "number" && body.horizon_days > 0
      ? Math.min(body.horizon_days, 365)
      : 30;

  const opportunities = Array.isArray(body.opportunities)
    ? body.opportunities.slice(0, 30)
    : [];
  const recent_signals = Array.isArray(body.recent_signals)
    ? body.recent_signals.slice(0, 50)
    : [];
  const org_facts = Array.isArray(body.org_facts)
    ? body.org_facts.slice(0, 50)
    : [];
  const watchlist_signals = Array.isArray(body.watchlist_signals)
    ? body.watchlist_signals.slice(0, 50)
    : [];

  return { metro_id, horizon_days, opportunities, recent_signals, org_facts, watchlist_signals };
}

function buildWatchlistPayload(body: Record<string, unknown>) {
  const org_id = body.org_id;
  if (!org_id || typeof org_id !== "string") {
    throw new Error("org_id is required for watchlist workflows");
  }
  if (!UUID_RE.test(org_id)) {
    throw new Error("org_id must be a valid UUID");
  }
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

// ── Intent profile types ──
interface IntentProfile {
  module: string;
  required_all: string[];
  required_any: string[];
  blocked_patterns: string[];
  enforced_suffix: string;
  scope_mode: string;
}

// ── Hardcoded fallback profiles ──
const FALLBACK_PROFILES: Record<string, IntentProfile> = {
  grant: {
    module: "grant",
    required_all: ["grant"],
    required_any: [],
    blocked_patterns: ["-grant", "not grant", "without grant", "exclude grant", "non-grant"],
    enforced_suffix: "grant",
    scope_mode: "national",
  },
  event: {
    module: "event",
    required_all: [],
    required_any: ["event", "conference", "summit", "webinar", "workshop", "expo", "symposium"],
    blocked_patterns: ["-event", "not event", "without event", "exclude conference"],
    enforced_suffix: "(event OR conference OR summit OR webinar OR workshop OR expo OR symposium)",
    scope_mode: "national",
  },
  opportunity: {
    module: "opportunity",
    required_all: [],
    required_any: ["organization", "company", "nonprofit", "foundation", "employer", "firm", "startup"],
    blocked_patterns: ["-company", "not nonprofit", "exclude organization"],
    enforced_suffix: "(organization OR company OR nonprofit OR foundation OR employer OR firm OR startup)",
    scope_mode: "national",
  },
  people: {
    module: "people",
    required_all: [],
    required_any: ["director", "manager", "coordinator", "specialist", "officer", "leader", "executive", "president", "CEO", "founder"],
    blocked_patterns: ["-person", "not people", "exclude person"],
    enforced_suffix: "(director OR manager OR coordinator OR specialist OR officer OR leader OR executive)",
    scope_mode: "national",
  },
};

// ── Intent enforcement helpers (exported for testing) ──
function sanitizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 500);
}

function checkBlockedPatterns(query: string, blocked: string[]): string | null {
  const lower = query.toLowerCase();
  for (const pat of blocked) {
    if (lower.includes(pat.toLowerCase())) return pat;
  }
  return null;
}

function buildEnforcedQuery(
  rawQuery: string,
  profile: IntentProfile,
  metroName: string | null,
): string {
  let enforced = rawQuery;

  // Always append enforced_suffix (deterministic; never try to be clever)
  if (profile.enforced_suffix) {
    enforced = `${enforced} ${profile.enforced_suffix}`;
  }

  // Append metro scope clause if metro provided
  if (metroName) {
    enforced = `${enforced} ("in ${metroName}" OR "${metroName}" OR "${metroName} area")`;
  }

  return enforced.trim();
}

async function loadIntentProfile(
  supabaseAdmin: ReturnType<typeof createClient>,
  module: string,
): Promise<IntentProfile> {
  try {
    const { data, error } = await supabaseAdmin
      .from("search_intent_profiles")
      .select("module, required_all, required_any, blocked_patterns, enforced_suffix, scope_mode")
      .eq("module", module)
      .eq("active", true)
      .single();

    if (error || !data) {
      console.warn(`Intent profile not found for ${module}, using fallback`);
      return FALLBACK_PROFILES[module] || FALLBACK_PROFILES.event;
    }
    return data as IntentProfile;
  } catch {
    return FALLBACK_PROFILES[module] || FALLBACK_PROFILES.event;
  }
}

async function buildSearchPayload(
  body: Record<string, unknown>,
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const query = body.query;
  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("query is required for search workflows");
  }
  const rawQuery = sanitizeQuery(query as string);
  const metro_id = typeof body.metro_id === "string" ? body.metro_id : null;
  const search_type = typeof body.search_type === "string" ? body.search_type : null;

  if (!search_type || !["event", "opportunity", "grant", "people"].includes(search_type)) {
    throw new Error("search_type must be one of: event, opportunity, grant, people");
  }

  // Cross-validate search_type matches workflow_key to prevent intent mismatch
  const WORKFLOW_KEY_TO_EXPECTED_TYPE: Record<string, string> = {
    search_events: "event",
    search_opportunities: "opportunity",
    search_people: "people",
    search_grants: "grant",
  };
  const expectedType = WORKFLOW_KEY_TO_EXPECTED_TYPE[body.workflow_key as string];
  if (expectedType && search_type !== expectedType) {
    throw new Error(
      `search_type '${search_type}' does not match workflow '${body.workflow_key}' (expected '${expectedType}')`,
    );
  }

  // Load intent profile from DB (fallback to hardcoded)
  const profile = await loadIntentProfile(supabaseAdmin, search_type);

  // Check blocked patterns
  const blockedMatch = checkBlockedPatterns(rawQuery, profile.blocked_patterns);
  if (blockedMatch) {
    throw Object.assign(
      new Error(`Query contains disallowed pattern: "${blockedMatch}"`),
      { code: "DISALLOWED_QUERY" },
    );
  }

  // Metro scope enforcement
  let metroName: string | null = null;
  if (metro_id) {
    const { data: metro } = await supabaseAdmin
      .from("metros")
      .select("metro")
      .eq("id", metro_id)
      .single();
    metroName = metro?.metro || null;
  }

  // Construct enforced query
  const enforcedQuery = buildEnforcedQuery(rawQuery, profile, metroName);

  return {
    raw_query: rawQuery,
    enforced_query: enforcedQuery,
    query: enforcedQuery, // n8n receives the enforced query
    metro_id,
    search_type,
    intent_keywords: profile.required_any.length > 0 ? profile.required_any : profile.required_all,
    intent_profile: {
      required_all: profile.required_all,
      required_any: profile.required_any,
      enforced_suffix: profile.enforced_suffix,
      blocked_patterns: profile.blocked_patterns,
    },
  };
}

function buildGrantEnrichPayload(body: Record<string, unknown>) {
  const grant_id = body.grant_id;
  if (!grant_id || typeof grant_id !== "string" || !UUID_RE.test(grant_id)) {
    throw new Error("grant_id must be a valid UUID");
  }
  const source_url = normalizeUrl(body.source_url);
  if (!source_url) {
    throw new Error("source_url is required for grant_enrich");
  }
  const grant_name = typeof body.grant_name === "string" ? body.grant_name : null;
  const funder_name = typeof body.funder_name === "string" ? body.funder_name : null;
  return { grant_id, source_url, grant_name, funder_name };
}

const SYNC_PAYLOAD_BUILDERS: Record<string, (body: Record<string, unknown>) => Record<string, unknown>> = {
  partner_enrich: buildPartnerEnrichPayload,
  opportunity_monitor: buildOpportunityMonitorPayload,
  recommendations_generate: buildRecommendationsPayload,
  watchlist_ingest: buildWatchlistPayload,
  watchlist_diff: buildWatchlistPayload,
  event_attendee_enrich: buildEventAttendeeEnrichPayload,
  watchlist_deep_dive: buildWatchlistPayload,
  grant_enrich: buildGrantEnrichPayload,
};

const SEARCH_WORKFLOW_KEYS = ["search_events", "search_opportunities", "search_people", "search_grants"];

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  // ── Env checks ──
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const n8nBaseUrl = Deno.env.get("N8N_WEBHOOK_BASE_URL");
  const n8nSecret = Deno.env.get("N8N_SHARED_SECRET");
  const n8nScheduleSecret = Deno.env.get("N8N_SCHEDULE_SECRET");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonError(500, "CONFIG_ERROR", "Supabase configuration missing");
  }
  if (!n8nBaseUrl) {
    return jsonError(500, "CONFIG_ERROR", "N8N_WEBHOOK_BASE_URL not configured");
  }
  if (!n8nSecret) {
    return jsonError(500, "CONFIG_ERROR", "N8N_SHARED_SECRET not configured");
  }

  // ── Service role client for DB writes ──
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── Auth: determine auth mode ──
  const scheduleSecretHeader = req.headers.get("x-n8n-schedule-secret");
  const authHeader = req.headers.get("Authorization") ?? "";
  let userId: string | null = null;
  let isScheduleAuth = false;

  if (scheduleSecretHeader) {
    // ── Schedule secret auth (server-to-server) ──
    if (!n8nScheduleSecret) {
      return jsonError(500, "CONFIG_ERROR", "N8N_SCHEDULE_SECRET not configured");
    }
    if (scheduleSecretHeader !== n8nScheduleSecret) {
      return jsonError(401, "UNAUTHORIZED", "Invalid schedule secret");
    }
    isScheduleAuth = true;
    userId = null; // system-triggered, no user
  } else {
    // ── User JWT auth (existing path) ──
    if (!authHeader.startsWith("Bearer ")) {
      return jsonError(401, "UNAUTHORIZED", "Missing Authorization header");
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonError(401, "UNAUTHORIZED", "Invalid or expired token");
    }
    userId = userData.user.id;
  }

  // ── Parse body ──
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const { workflow_key } = body as { workflow_key?: string };
  if (!workflow_key || typeof workflow_key !== "string") {
    return jsonError(400, "MISSING_FIELD", "workflow_key is required");
  }
  if (!WORKFLOW_PATHS[workflow_key]) {
    return jsonError(
      400,
      "INVALID_WORKFLOW_KEY",
      `workflow_key must be one of: ${Object.keys(WORKFLOW_PATHS).join(", ")}`,
    );
  }

  // ── RBAC + rate limits (user auth only) ──
  if (!isScheduleAuth && userId) {
    // Get user roles (need to fetch here since we deferred)
    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roleError) {
      return jsonError(500, "ROLE_LOOKUP_FAILED", "Could not determine user role");
    }
    const userRoles = (roleRows || []).map((r: { role: string }) => r.role);

    const allowed = userRoles.some(
      (role: string) => ROLE_ALLOWLIST[role]?.includes(workflow_key),
    );
    if (!allowed) {
      return jsonError(
        403,
        "ROLE_DENIED",
        `Your role does not have access to workflow '${workflow_key}'`,
      );
    }

    // ── Rate limit (10/10min per user per workflow) ──
    const { data: withinLimit, error: rlError } = await supabaseAdmin.rpc(
      "check_and_increment_rate_limit",
      {
        p_user_id: userId,
        p_function_name: `n8n-dispatch:${workflow_key}`,
        p_window_minutes: 10,
        p_max_requests: 10,
      },
    );
    if (rlError) {
      return jsonError(500, "RATE_LIMIT_ERROR", "Rate limit check failed");
    }
    if (withinLimit === false) {
      // Record rate-limited run (non-fatal terminal state)
      const rlRunId = crypto.randomUUID();
      await supabaseAdmin.from("automation_runs").insert({
        run_id: rlRunId,
        workflow_key,
        status: "rate_limited",
        triggered_by: userId,
        scope_json: { ...body, limit_reason: "rate_limit", window: "10min", max: 10 },
        org_id: (body as Record<string, unknown>).org_id || null,
        error_message: "Rate limited: max 10 per 10 minutes per workflow",
      });
      return jsonError(429, "RATE_LIMITED", "Too many requests. Max 10 per 10 minutes per workflow.");
    }

    // ── Concurrency guard: max 3 running per user per workflow ──
    const { count: runningCount, error: concErr } = await supabaseAdmin
      .from("automation_runs")
      .select("run_id", { count: "exact", head: true })
      .eq("triggered_by", userId)
      .eq("workflow_key", workflow_key)
      .in("status", ["dispatched", "running"]);

    if (!concErr && (runningCount ?? 0) >= 3) {
      // Record throttled run (non-fatal terminal state)
      const throttledRunId = crypto.randomUUID();
      await supabaseAdmin.from("automation_runs").insert({
        run_id: throttledRunId,
        workflow_key,
        status: "throttled",
        triggered_by: userId,
        scope_json: { ...body, throttle_reason: "concurrency_limit", max_concurrent: 3 },
        org_id: (body as Record<string, unknown>).org_id || null,
        error_message: "Throttled: max 3 concurrent runs per workflow",
      });
      return jsonError(429, "CONCURRENCY_LIMIT", "Max 3 concurrent runs per workflow. Wait for existing runs to complete.");
    }
  }

  // ── Build scoped payload ──
  let scopedPayload: Record<string, unknown>;
  try {
    if (SEARCH_WORKFLOW_KEYS.includes(workflow_key)) {
      scopedPayload = await buildSearchPayload(body, supabaseAdmin);
    } else {
      scopedPayload = SYNC_PAYLOAD_BUILDERS[workflow_key](body);
    }
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === "DISALLOWED_QUERY") {
      return jsonError(400, "DISALLOWED_QUERY", errObj.message || "Query contains disallowed pattern");
    }
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(400, "INVALID_PAYLOAD", msg);
  }

  // ── Daily watchlist cap (simple count check — unified budget enforced at AI layer) ──
  if (workflow_key === "watchlist_ingest" || workflow_key === "watchlist_diff") {
    const orgId = (scopedPayload as Record<string, unknown>).org_id as string;
    if (orgId) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { count: todayCount } = await supabaseAdmin
        .from("automation_runs")
        .select("run_id", { count: "exact", head: true })
        .eq("workflow_key", "watchlist_ingest")
        .gte("created_at", todayStart.toISOString())
        .neq("status", "error");

      const DAILY_CAP = 50;
      if ((todayCount ?? 0) >= DAILY_CAP) {
        const skipRunId = crypto.randomUUID();
        await supabaseAdmin.from("automation_runs").insert({
          run_id: skipRunId,
          workflow_key,
          status: "skipped_due_to_cap",
          triggered_by: userId,
          scope_json: { ...scopedPayload, limit_reason: `Daily cap reached (${todayCount}/${DAILY_CAP})`, limit_type: "daily_cap" },
          org_id: orgId,
          error_message: `Daily cap reached (${todayCount}/${DAILY_CAP})`,
        });
        return jsonOk({ ok: true, skipped: true, reason: `Daily cap reached (${todayCount}/${DAILY_CAP})`, limit_type: "daily_cap", run_id: skipRunId });
      }
    }
  }

  // ── Opportunistic website_domain update for partner_enrich ──
  if (workflow_key === "partner_enrich") {
    const webUrl = (scopedPayload as Record<string, unknown>).website_url as string | null;
    const orgId = (scopedPayload as Record<string, unknown>).org_id as string | null;
    if (webUrl && orgId) {
      const domain = normalizeDomain(webUrl);
      if (domain) {
        try {
          await supabaseAdmin
            .from("opportunities")
            .update({ website_url: webUrl, website_domain: domain })
            .is("website_domain", null)
            .eq("id", orgId);
        } catch { /* best-effort */ }
      }
    }
  }

  // ── Opportunistic cleanup: auto-fail stuck dispatched/running runs older than 90s ──
  try {
    const cutoff = new Date(Date.now() - 90_000).toISOString();
    await supabaseAdmin
      .from("automation_runs")
      .update({
        status: "failed_timeout",
        error_message: "Auto-failed: no callback received within 90 seconds",
        processed_at: new Date().toISOString(),
      })
      .in("status", ["dispatched", "running"])
      .lt("created_at", cutoff);
  } catch {
    // Best-effort cleanup, never block dispatch
  }

  // ── Mint run_id ──
  const run_id = crypto.randomUUID();

  // ── Insert automation_runs (queued) with dispatch_payload ──
  const { error: insertErr } = await supabaseAdmin.from("automation_runs").insert({
    run_id,
    workflow_key,
    status: "queued",
    triggered_by: userId,
    scope_json: scopedPayload,
    dispatch_payload: scopedPayload,
    org_id: (scopedPayload as Record<string, unknown>).org_id || null,
    org_name: (scopedPayload as Record<string, unknown>).org_name || null,
    metro_id: (scopedPayload as Record<string, unknown>).metro_id || null,
  });

  if (insertErr) {
    return jsonError(500, "INSERT_FAILED", `Could not create automation run: ${insertErr.message}`);
  }

  // ── For search workflows, create search_runs row ──
  // Explicit reverse mapping — never derive via string manipulation
  const WORKFLOW_KEY_TO_SEARCH_TYPE: Record<string, string> = {
    search_events: "event",
    search_opportunities: "opportunity",
    search_people: "people",
    search_grants: "grant",
  };
  const derivedSearchType = WORKFLOW_KEY_TO_SEARCH_TYPE[workflow_key];
  if (derivedSearchType) {
    const sp = scopedPayload as Record<string, unknown>;
    const { error: searchRunErr } = await supabaseAdmin.from("search_runs").insert({
      run_id,
      search_type: derivedSearchType,
      query: sp.enforced_query as string || sp.query as string,
      raw_query: sp.raw_query as string || sp.query as string,
      enforced_query: sp.enforced_query as string || null,
      intent_keywords: (sp.intent_keywords as string[]) || [],
      status: "pending",
      requested_by: userId,
      metro_id: sp.metro_id || null,
    });
    if (searchRunErr) {
      console.error("search_runs insert failed:", searchRunErr.message);
    }
  }

  // ── Route: search workflows go to perplexity-search, others to n8n ──
  if (SEARCH_WORKFLOW_KEYS.includes(workflow_key)) {
    // ── Perplexity search: non-blocking dispatch via EdgeRuntime.waitUntil ──
    const sp = scopedPayload as Record<string, unknown>;

    // Mark as running immediately
    await supabaseAdmin
      .from("automation_runs")
      .update({ status: "dispatched", processed_at: new Date().toISOString() })
      .eq("run_id", run_id);

    await supabaseAdmin
      .from("search_runs")
      .update({ status: "running" })
      .eq("run_id", run_id);

    const searchFnUrl = `${supabaseUrl}/functions/v1/perplexity-search`;

    // Resolve tenant_id for keyword augmentation (gardener has no tenant → null)
    let tenantId: string | null = null;
    if (userId) {
      try {
        const { data: tu } = await supabaseAdmin
          .from("tenant_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .limit(1)
          .single();
        tenantId = tu?.tenant_id || null;
      } catch {
        // non-fatal — gardener or no tenant
      }
    }

    const backgroundTask = (async () => {
      try {
        const searchResp = await fetch(searchFnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            run_id,
            query: sp.enforced_query || sp.query,
            raw_query: sp.raw_query || sp.query,
            enforced_query: sp.enforced_query,
            search_type: sp.search_type,
            metro_id: sp.metro_id || null,
            tenant_id: tenantId,
            max_results: 20,
          }),
        });

        if (!searchResp.ok) {
          const errText = await searchResp.text();
          const now = new Date().toISOString();
          const errMsg = `perplexity-search ${searchResp.status}: ${errText.slice(0, 500)}`;
          await supabaseAdmin
            .from("automation_runs")
            .update({ status: "error", error_message: errMsg, processed_at: now })
            .eq("run_id", run_id);
          await supabaseAdmin
            .from("search_runs")
            .update({ status: "failed", error_message: errMsg, completed_at: now })
            .eq("run_id", run_id);
          return;
        }
        await searchResp.text(); // consume body
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        const now = new Date().toISOString();
        try {
          await supabaseAdmin
            .from("automation_runs")
            .update({ status: "error", error_message: `dispatch failed: ${msg.slice(0, 500)}`, processed_at: now })
            .eq("run_id", run_id);
          await supabaseAdmin
            .from("search_runs")
            .update({ status: "failed", error_message: `dispatch failed: ${msg.slice(0, 500)}`, completed_at: now })
            .eq("run_id", run_id);
        } catch { /* best-effort */ }
      }
    })();

    const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(backgroundTask);
    } else {
      backgroundTask.catch(() => undefined);
    }

    return jsonOk({ ok: true, run_id, workflow_key, source: "perplexity" });
  }

  // ── Workflow-to-worker mapping (edge functions replacing n8n) ──
  const EDGE_WORKER_MAP: Record<string, string> = {
    partner_enrich: "partner-enrich-worker",
    opportunity_monitor: "opportunity-monitor-worker",
    recommendations_generate: "recommendations-generate-worker",
    watchlist_deep_dive: "watchlist-deep-dive-worker",
    grant_enrich: "grant-enrich-worker",
  };

  const workerFunction = EDGE_WORKER_MAP[workflow_key];

  if (workerFunction) {
    // ── Route to internal edge function worker (replaces n8n) ──
    const workerUrl = `${supabaseUrl}/functions/v1/${workerFunction}`;

    // Mark as dispatched immediately
    await supabaseAdmin
      .from("automation_runs")
      .update({ status: "dispatched", processed_at: new Date().toISOString() })
      .eq("run_id", run_id);

    const backgroundTask = (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 55000);

        const resp = await fetch(workerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ run_id, triggered_by: userId, ...scopedPayload }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!resp.ok) {
          const errText = await resp.text().catch(() => "unknown");
          const now = new Date().toISOString();
          await supabaseAdmin
            .from("automation_runs")
            .update({ status: "error", error_message: `${workerFunction} ${resp.status}: ${errText.slice(0, 500)}`, processed_at: now })
            .eq("run_id", run_id);
          return;
        }

        const result = await resp.json().catch(() => ({}));

        // Mark as processed on success
        await supabaseAdmin
          .from("automation_runs")
          .update({
            status: "processed",
            payload: result,
            processed_at: new Date().toISOString(),
          })
          .eq("run_id", run_id);
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        try {
          await supabaseAdmin
            .from("automation_runs")
            .update({ status: "error", error_message: `worker dispatch failed: ${msg.slice(0, 500)}`, processed_at: new Date().toISOString() })
            .eq("run_id", run_id);
        } catch { /* best-effort */ }
      }
    })();

    const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(backgroundTask);
    } else {
      backgroundTask.catch(() => undefined);
    }

    return jsonOk({ ok: true, run_id, workflow_key, source: "edge-worker" });
  }

  // ── Remaining workflows: dispatch to n8n (legacy path) ──
  const dispatchBody = JSON.stringify({
    run_id,
    workflow_key,
    triggered_by: userId,
    ...scopedPayload,
  });

  const signature = await hmacSign(n8nSecret, dispatchBody);
  const webhookUrl = n8nBaseUrl.replace(/\/+$/, "") + WORKFLOW_PATHS[workflow_key];

  try {
    const n8nResp = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-profunda-signature": signature,
        "x-profunda-run-id": run_id,
      },
      body: dispatchBody,
    });

    if (!n8nResp.ok) {
      const errText = await n8nResp.text();
      await supabaseAdmin
        .from("automation_runs")
        .update({
          status: "error",
          error_message: `n8n ${n8nResp.status}: ${errText.slice(0, 500)}`,
          processed_at: new Date().toISOString(),
        })
        .eq("run_id", run_id);

      return jsonError(502, "N8N_ERROR", `n8n returned ${n8nResp.status}`);
    }

    // Consume response body
    await n8nResp.text();

    // Mark dispatched
    await supabaseAdmin
      .from("automation_runs")
      .update({ status: "dispatched", processed_at: new Date().toISOString() })
      .eq("run_id", run_id);

    return jsonOk({ ok: true, run_id, workflow_key });
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    try {
      await supabaseAdmin
        .from("automation_runs")
        .update({
          status: "error",
          error_message: `dispatch failed: ${msg.slice(0, 500)}`,
          processed_at: new Date().toISOString(),
        })
        .eq("run_id", run_id);
    } catch { /* best-effort */ }

    return jsonError(502, "DISPATCH_FAILED", `Could not reach n8n: ${msg}`);
  }
});
