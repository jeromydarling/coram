import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { normalizeUrl } from "../_shared/normalizeUrl.ts";

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

// ── Intent enforcement (mirrors n8n-dispatch logic) ──
interface IntentProfile {
  module: string;
  required_all: string[];
  required_any: string[];
  blocked_patterns: string[];
  enforced_suffix: string;
  scope_mode: string;
}

const FALLBACK_PROFILES: Record<string, IntentProfile> = {
  grants: {
    module: "grants",
    required_all: ["grant"],
    required_any: [],
    blocked_patterns: ["-grant", "not grant", "without grant", "exclude grant", "non-grant"],
    enforced_suffix: "grant",
    scope_mode: "national",
  },
  events: {
    module: "events",
    required_all: [],
    required_any: ["event", "conference", "summit", "webinar", "workshop", "expo", "symposium"],
    blocked_patterns: ["-event", "not event", "without event", "exclude conference"],
    enforced_suffix: "(event OR conference OR summit OR webinar OR workshop OR expo OR symposium)",
    scope_mode: "national",
  },
  opportunities: {
    module: "opportunities",
    required_all: [],
    required_any: ["organization", "company", "nonprofit", "foundation", "employer", "firm", "startup"],
    blocked_patterns: ["-company", "not nonprofit", "exclude organization"],
    enforced_suffix: "(organization OR company OR nonprofit OR foundation OR employer OR firm OR startup)",
    scope_mode: "national",
  },
};

// Map module name to search_intent_profiles module column (singular)
const MODULE_TO_PROFILE: Record<string, string> = {
  events: "event",
  opportunities: "opportunity",
  grants: "grant",
};

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

async function loadIntentProfile(
  supabaseAdmin: ReturnType<typeof createClient>,
  module: string,
): Promise<IntentProfile> {
  const profileKey = MODULE_TO_PROFILE[module] || module;
  try {
    const { data, error } = await supabaseAdmin
      .from("search_intent_profiles")
      .select("module, required_all, required_any, blocked_patterns, enforced_suffix, scope_mode")
      .eq("module", profileKey)
      .eq("active", true)
      .single();

    if (error || !data) {
      return FALLBACK_PROFILES[module] || FALLBACK_PROFILES.events;
    }
    return data as IntentProfile;
  } catch {
    return FALLBACK_PROFILES[module] || FALLBACK_PROFILES.events;
  }
}

function buildEnforcedQueryTemplate(rawQuery: string, profile: IntentProfile): string {
  // Template = sanitized query + enforced suffix (NO scope clause)
  let template = rawQuery;
  if (profile.enforced_suffix) {
    template = `${template} ${profile.enforced_suffix}`;
  }
  return template.trim();
}

function buildScopeClause(metroName: string | null): string {
  if (!metroName) return "";
  return ` ("in ${metroName}" OR "${metroName}" OR "${metroName} area")`;
}

const VALID_MODULES = ["events", "opportunities", "grants"];
const VALID_SCOPES = ["metro", "national"];

// ── Auth helper ──
async function authenticateUser(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "UNAUTHORIZED", "Missing Authorization header");
  }
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    return jsonError(401, "UNAUTHORIZED", "Invalid or expired token");
  }
  return { userId: data.user.id };
}

// ── Route handlers ──

async function handleCreate(
  body: Record<string, unknown>,
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<Response> {
  const { module, scope, metro_id, name, raw_query, max_results } = body as {
    module?: string; scope?: string; metro_id?: string; name?: string;
    raw_query?: string; max_results?: number;
  };

  if (!module || !VALID_MODULES.includes(module)) {
    return jsonError(400, "INVALID_MODULE", `module must be one of: ${VALID_MODULES.join(", ")}`);
  }
  if (!scope || !VALID_SCOPES.includes(scope)) {
    return jsonError(400, "INVALID_SCOPE", `scope must be one of: ${VALID_SCOPES.join(", ")}`);
  }
  if (scope === "metro" && (!metro_id || typeof metro_id !== "string")) {
    return jsonError(400, "MISSING_METRO", "metro_id is required when scope is 'metro'");
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return jsonError(400, "MISSING_NAME", "name is required");
  }
  if (!raw_query || typeof raw_query !== "string" || !raw_query.trim()) {
    return jsonError(400, "MISSING_QUERY", "raw_query is required");
  }

  const sanitized = sanitizeQuery(raw_query);
  const profile = await loadIntentProfile(supabaseAdmin, module);

  const blocked = checkBlockedPatterns(sanitized, profile.blocked_patterns);
  if (blocked) {
    return jsonError(400, "DISALLOWED_QUERY", `Query contains disallowed pattern: "${blocked}"`);
  }

  const enforcedTemplate = buildEnforcedQueryTemplate(sanitized, profile);

  const { data, error } = await supabaseAdmin
    .from("saved_searches")
    .insert({
      user_id: userId,
      module,
      scope,
      metro_id: scope === "metro" ? metro_id : null,
      name: name.trim(),
      raw_query: sanitized,
      enforced_query_template: enforcedTemplate,
      max_results: typeof max_results === "number" && max_results > 0 ? Math.min(max_results, 100) : 20,
    })
    .select()
    .single();

  if (error) {
    return jsonError(500, "DB_ERROR", `Failed to create saved search: ${error.message}`);
  }

  return jsonOk({ ok: true, saved_search: data });
}

async function handleList(
  url: URL,
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<Response> {
  const module = url.searchParams.get("module");

  let query = supabaseAdmin
    .from("saved_searches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (module && VALID_MODULES.includes(module)) {
    query = query.eq("module", module);
  }

  const { data, error } = await query.limit(50);
  if (error) {
    return jsonError(500, "DB_ERROR", `Failed to list saved searches: ${error.message}`);
  }

  return jsonOk({ ok: true, saved_searches: data || [] });
}

async function handleUpdate(
  body: Record<string, unknown>,
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<Response> {
  const { id, name, scope, metro_id, raw_query, max_results } = body as {
    id?: string; name?: string; scope?: string; metro_id?: string;
    raw_query?: string; max_results?: number;
  };

  if (!id || typeof id !== "string") {
    return jsonError(400, "MISSING_ID", "id is required");
  }

  // Ownership check
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("saved_searches")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !existing) {
    return jsonError(404, "NOT_FOUND", "Saved search not found or not owned by you");
  }

  const updates: Record<string, unknown> = {};
  if (name && typeof name === "string" && name.trim()) updates.name = name.trim();
  if (scope && VALID_SCOPES.includes(scope)) updates.scope = scope;
  if (metro_id !== undefined) updates.metro_id = metro_id || null;
  if (typeof max_results === "number" && max_results > 0) updates.max_results = Math.min(max_results, 100);

  // If scope changed to metro, require metro_id
  const finalScope = (updates.scope as string) || existing.scope;
  if (finalScope === "metro" && !((updates.metro_id as string) || existing.metro_id)) {
    return jsonError(400, "MISSING_METRO", "metro_id is required when scope is 'metro'");
  }

  // If raw_query changed, rebuild enforced_query_template
  if (raw_query && typeof raw_query === "string" && raw_query.trim()) {
    const sanitized = sanitizeQuery(raw_query);
    const profile = await loadIntentProfile(supabaseAdmin, existing.module);
    const blocked = checkBlockedPatterns(sanitized, profile.blocked_patterns);
    if (blocked) {
      return jsonError(400, "DISALLOWED_QUERY", `Query contains disallowed pattern: "${blocked}"`);
    }
    updates.raw_query = sanitized;
    updates.enforced_query_template = buildEnforcedQueryTemplate(sanitized, profile);
  }

  if (Object.keys(updates).length === 0) {
    return jsonOk({ ok: true, saved_search: existing });
  }

  const { data, error } = await supabaseAdmin
    .from("saved_searches")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    return jsonError(500, "DB_ERROR", `Failed to update: ${error.message}`);
  }

  return jsonOk({ ok: true, saved_search: data });
}

async function handleDelete(
  body: Record<string, unknown>,
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<Response> {
  const { id } = body as { id?: string };
  if (!id || typeof id !== "string") {
    return jsonError(400, "MISSING_ID", "id is required");
  }

  const { error } = await supabaseAdmin
    .from("saved_searches")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return jsonError(500, "DB_ERROR", `Failed to delete: ${error.message}`);
  }

  return jsonOk({ ok: true, deleted: id });
}

async function handleRun(
  body: Record<string, unknown>,
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<Response> {
  const { id } = body as { id?: string };
  if (!id || typeof id !== "string") {
    return jsonError(400, "MISSING_ID", "id is required");
  }

  // Ownership check
  const { data: saved, error: fetchErr } = await supabaseAdmin
    .from("saved_searches")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !saved) {
    return jsonError(404, "NOT_FOUND", "Saved search not found or not owned by you");
  }

  // Resolve metro name for scope clause
  let metroName: string | null = null;
  if (saved.scope === "metro" && saved.metro_id) {
    const { data: metro } = await supabaseAdmin
      .from("metros")
      .select("metro")
      .eq("id", saved.metro_id)
      .single();
    metroName = metro?.metro || null;
  }

  // Build full enforced query = template + scope clause
  const enforcedQuery = saved.enforced_query_template + buildScopeClause(metroName);
  const runId = crypto.randomUUID();

  // Module -> search_type mapping
  const MODULE_TO_SEARCH_TYPE: Record<string, string> = {
    events: "event",
    opportunities: "opportunity",
    grants: "grant",
  };
  const searchType = MODULE_TO_SEARCH_TYPE[saved.module] || saved.module;

  // Insert search_runs
  const { error: runInsertErr } = await supabaseAdmin.from("search_runs").insert({
    run_id: runId,
    search_type: searchType,
    query: enforcedQuery,
    raw_query: saved.raw_query,
    enforced_query: enforcedQuery,
    intent_keywords: [],
    status: "pending",
    requested_by: userId,
    metro_id: saved.metro_id || null,
  });

  if (runInsertErr) {
    return jsonError(500, "DB_ERROR", `Failed to create search run: ${runInsertErr.message}`);
  }

  // Insert automation_runs
  const workflowKey = `search_${saved.module}`;
  const { error: autoRunErr } = await supabaseAdmin.from("automation_runs").insert({
    run_id: runId,
    workflow_key: workflowKey,
    status: "queued",
    triggered_by: userId,
    scope_json: { raw_query: saved.raw_query, enforced_query: enforcedQuery, saved_search_id: id },
    metro_id: saved.metro_id || null,
  });

  if (autoRunErr) {
    console.error("automation_runs insert failed:", autoRunErr);
  }

  // Record saved_search_runs mapping
  await supabaseAdmin.from("saved_search_runs").insert({
    saved_search_id: id,
    run_id: runId,
  });

  // Update last_run_id + last_ran_at
  await supabaseAdmin.from("saved_searches").update({
    last_run_id: runId,
    last_ran_at: new Date().toISOString(),
  }).eq("id", id);

  // Dispatch to n8n
  const n8nBaseUrl = Deno.env.get("N8N_WEBHOOK_BASE_URL");
  const n8nSecret = Deno.env.get("N8N_SHARED_SECRET");

  if (n8nBaseUrl && n8nSecret) {
    const WORKFLOW_PATHS: Record<string, string> = {
      search_events: "/webhook/search-events",
      search_opportunities: "/webhook/search-opportunities",
      search_grants: "/webhook/search-grants",
    };
    const webhookPath = WORKFLOW_PATHS[workflowKey];
    if (webhookPath) {
      const dispatchBody = JSON.stringify({
        run_id: runId,
        workflow_key: workflowKey,
        triggered_by: userId,
        query: enforcedQuery,
        raw_query: saved.raw_query,
        enforced_query: enforcedQuery,
        metro_id: saved.metro_id || null,
        search_type: searchType,
        max_results: saved.max_results,
      });

      // HMAC sign
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", enc.encode(n8nSecret),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
      );
      const sig = await crypto.subtle.sign("HMAC", key, enc.encode(dispatchBody));
      const signature = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0")).join("");

      const webhookUrl = n8nBaseUrl.replace(/\/+$/, "") + webhookPath;

      try {
        const resp = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-profunda-signature": signature,
            "x-profunda-run-id": runId,
          },
          body: dispatchBody,
        });

        if (resp.ok) {
          await resp.text();
          await supabaseAdmin.from("automation_runs")
            .update({ status: "dispatched", processed_at: new Date().toISOString() })
            .eq("run_id", runId);
        } else {
          const errText = await resp.text();
          await supabaseAdmin.from("automation_runs")
            .update({ status: "error", error_message: `n8n ${resp.status}: ${errText.slice(0, 500)}`, processed_at: new Date().toISOString() })
            .eq("run_id", runId);
        }
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        try {
          await supabaseAdmin.from("automation_runs")
            .update({ status: "error", error_message: `dispatch failed: ${msg.slice(0, 500)}`, processed_at: new Date().toISOString() })
            .eq("run_id", runId);
        } catch { /* best-effort */ }
      }
    }
  }

  return jsonOk({ ok: true, run_id: runId });
}

async function handleResults(
  url: URL,
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<Response> {
  const runId = url.searchParams.get("run_id");
  const savedSearchId = url.searchParams.get("saved_search_id");

  if (!runId || !savedSearchId) {
    return jsonError(400, "MISSING_PARAMS", "run_id and saved_search_id are required");
  }

  // Ownership check
  const { data: saved, error: fetchErr } = await supabaseAdmin
    .from("saved_searches")
    .select("id")
    .eq("id", savedSearchId)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !saved) {
    return jsonError(404, "NOT_FOUND", "Saved search not found or not owned by you");
  }

  // Get the search_run by run_id
  const { data: searchRun } = await supabaseAdmin
    .from("search_runs")
    .select("id")
    .eq("run_id", runId)
    .single();

  if (!searchRun) {
    return jsonError(404, "NOT_FOUND", "Search run not found");
  }

  // Get results
  const { data: results, error: resErr } = await supabaseAdmin
    .from("search_results")
    .select("*")
    .eq("search_run_id", searchRun.id)
    .order("result_index", { ascending: true });

  if (resErr) {
    return jsonError(500, "DB_ERROR", `Failed to fetch results: ${resErr.message}`);
  }

  // Get seen URLs for this saved search
  const { data: seenUrls } = await supabaseAdmin
    .from("result_seen_urls")
    .select("url_normalized")
    .eq("saved_search_id", savedSearchId);

  const seenSet = new Set((seenUrls || []).map((s: { url_normalized: string }) => s.url_normalized));

  // Annotate results with is_new
  let newCount = 0;
  const annotated = (results || []).map((r: Record<string, unknown>) => {
    const normalized = r.url ? normalizeUrl(r.url as string) : "";
    const isNew = normalized ? !seenSet.has(normalized) : true;
    if (isNew) newCount++;
    return { ...r, is_new: isNew };
  });

  return jsonOk({
    ok: true,
    results: annotated,
    summary: { new_count: newCount, total: annotated.length },
  });
}

async function handleMarkSeen(
  body: Record<string, unknown>,
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<Response> {
  const { saved_search_id, run_id } = body as { saved_search_id?: string; run_id?: string };

  if (!saved_search_id || !run_id) {
    return jsonError(400, "MISSING_PARAMS", "saved_search_id and run_id are required");
  }

  // Ownership check
  const { data: saved, error: fetchErr } = await supabaseAdmin
    .from("saved_searches")
    .select("id")
    .eq("id", saved_search_id)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !saved) {
    return jsonError(404, "NOT_FOUND", "Saved search not found or not owned by you");
  }

  // Get search run
  const { data: searchRun } = await supabaseAdmin
    .from("search_runs")
    .select("id")
    .eq("run_id", run_id)
    .single();

  if (!searchRun) {
    return jsonError(404, "NOT_FOUND", "Search run not found");
  }

  // Get results with URLs
  const { data: results } = await supabaseAdmin
    .from("search_results")
    .select("url")
    .eq("search_run_id", searchRun.id)
    .not("url", "is", null);

  if (!results || results.length === 0) {
    return jsonOk({ ok: true, inserted_count: 0 });
  }

  // Upsert normalized URLs
  const rows = results
    .map((r: { url: string }) => ({
      saved_search_id,
      url_normalized: normalizeUrl(r.url),
      first_seen_run_id: run_id,
    }))
    .filter((r: { url_normalized: string }) => r.url_normalized !== "");

  if (rows.length === 0) {
    return jsonOk({ ok: true, inserted_count: 0 });
  }

  const { error: upsertErr } = await supabaseAdmin
    .from("result_seen_urls")
    .upsert(rows, { onConflict: "saved_search_id,url_normalized", ignoreDuplicates: true });

  if (upsertErr) {
    return jsonError(500, "DB_ERROR", `Failed to mark seen: ${upsertErr.message}`);
  }

  return jsonOk({ ok: true, inserted_count: rows.length });
}

// ── Main handler with path routing ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonError(500, "CONFIG_ERROR", "Supabase configuration missing");
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Authenticate user
  const authResult = await authenticateUser(req, supabaseUrl, supabaseAnonKey);
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Parse the action from the URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Path: /saved-searches/<action>
  const action = pathParts[pathParts.length - 1] || "saved-searches";

  try {
    // GET routes
    if (req.method === "GET") {
      if (action === "list" || action === "saved-searches") {
        return await handleList(url, userId, supabaseAdmin);
      }
      if (action === "results") {
        return await handleResults(url, userId, supabaseAdmin);
      }
      return jsonError(404, "NOT_FOUND", `Unknown GET action: ${action}`);
    }

    // POST routes
    if (req.method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
      }

      switch (action) {
        case "create":
          return await handleCreate(body, userId, supabaseAdmin);
        case "update":
          return await handleUpdate(body, userId, supabaseAdmin);
        case "delete":
          return await handleDelete(body, userId, supabaseAdmin);
        case "run":
          return await handleRun(body, userId, supabaseAdmin);
        case "mark-seen":
          return await handleMarkSeen(body, userId, supabaseAdmin);
        default:
          return jsonError(404, "NOT_FOUND", `Unknown POST action: ${action}`);
      }
    }

    return jsonError(405, "METHOD_NOT_ALLOWED", "Only GET and POST are accepted");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Unhandled error:", msg);
    return jsonError(500, "INTERNAL_ERROR", msg);
  }
});
