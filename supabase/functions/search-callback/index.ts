import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SearchResult {
  title: string;
  description?: string;
  url?: string;
  source?: string;
  location?: string;
  date_info?: string;
  organization?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  confidence?: number;
  raw_data?: Record<string, unknown>;
}

interface SearchBrief {
  summary: string;
  what_we_found: string[];
  what_may_be_missing: string[];
  helpful_sites: { name: string; url: string; why: string }[];
  suggested_queries: string[];
  confidence: number | null;
  caveats: string[];
}

interface CallbackBody {
  run_id: string;
  status: "completed" | "failed";
  error_message?: string;
  results?: SearchResult[];
  brief?: SearchBrief | null;
}

export function validateBrief(brief: unknown): { valid: true; data: SearchBrief } | { valid: false; error: string } {
  if (brief === null || brief === undefined) {
    return { valid: true, data: null as unknown as SearchBrief };
  }
  if (typeof brief !== "object") {
    return { valid: false, error: "brief: must be an object or null" };
  }
  const b = brief as Record<string, unknown>;
  if (typeof b.summary !== "string") {
    return { valid: false, error: "brief.summary: required string" };
  }
  if (!Array.isArray(b.what_we_found)) {
    return { valid: false, error: "brief.what_we_found: required array" };
  }
  if (!Array.isArray(b.what_may_be_missing)) {
    return { valid: false, error: "brief.what_may_be_missing: required array" };
  }
  if (!Array.isArray(b.helpful_sites)) {
    return { valid: false, error: "brief.helpful_sites: required array" };
  }
  if (!Array.isArray(b.suggested_queries)) {
    return { valid: false, error: "brief.suggested_queries: required array" };
  }
  if (!Array.isArray(b.caveats)) {
    return { valid: false, error: "brief.caveats: required array" };
  }
  return { valid: true, data: b as unknown as SearchBrief };
}

export function validateBody(body: unknown): { valid: true; data: CallbackBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") return { valid: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  // Defensive: coerce run_id to string in case n8n sends it wrapped
  if (b.run_id !== undefined && b.run_id !== null) {
    b.run_id = String(b.run_id).trim();
  }

  console.log("Callback body received:", JSON.stringify({ run_id: b.run_id, status: b.status, run_id_type: typeof b.run_id, results_count: Array.isArray(b.results) ? b.results.length : 'n/a', has_brief: b.brief !== undefined }));

  if (typeof b.run_id !== "string" || !UUID_RE.test(b.run_id)) {
    return { valid: false, error: `run_id: required valid UUID (got: ${JSON.stringify(b.run_id)})` };
  }

  if (b.status !== "completed" && b.status !== "failed") {
    return { valid: false, error: "status: must be 'completed' or 'failed'" };
  }

  if (b.status === "failed" && typeof b.error_message !== "string") {
    return { valid: false, error: "error_message required when status is 'failed'" };
  }

  if (b.status === "completed") {
    if (!Array.isArray(b.results)) {
      return { valid: false, error: "results: required array when status is 'completed'" };
    }
    for (let i = 0; i < b.results.length; i++) {
      const r = b.results[i];
      if (!r || typeof r !== "object" || typeof r.title !== "string" || !r.title.trim()) {
        return { valid: false, error: `results[${i}].title: required non-empty string` };
      }
    }
  }

  // Validate brief if present (non-null, non-undefined)
  if (b.brief !== undefined && b.brief !== null) {
    const briefValidation = validateBrief(b.brief);
    if (!briefValidation.valid) {
      return { valid: false, error: briefValidation.error };
    }
  }

  return { valid: true, data: b as unknown as CallbackBody };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  // Auth: accept SEARCH_WORKER_SECRET (preferred), ENRICHMENT_WORKER_SECRET (legacy),
  // N8N_SHARED_SECRET (universal fallback), or SUPABASE_SERVICE_ROLE_KEY (internal edge-to-edge calls).
  const searchSecret = Deno.env.get("SEARCH_WORKER_SECRET");
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!searchSecret && !enrichmentSecret && !sharedSecret && !serviceRoleKey) {
    return jsonError(
      500,
      "CONFIG_ERROR",
      "No authentication secrets configured",
    );
  }

  // Accept Bearer token OR X-Api-Key OR apikey header
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";
  const apikeyHeader = req.headers.get("apikey") ?? "";

  let token = "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  } else if (apikeyHeader) {
    token = apikeyHeader.trim();
  }

  if (!token) {
    console.warn("search-callback unauthorized: missing auth token header");
    return jsonError(401, "UNAUTHORIZED", "Missing Authorization (Bearer), X-Api-Key, or apikey header");
  }

  const authenticated =
    (searchSecret ? constantTimeCompare(token, searchSecret) : false) ||
    (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false) ||
    (serviceRoleKey ? constantTimeCompare(token, serviceRoleKey) : false);

  if (!authenticated) {
    return jsonError(401, "UNAUTHORIZED", "Invalid or missing authentication");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const validation = validateBody(body);
  if (!validation.valid) {
    return jsonError(400, "VALIDATION_ERROR", validation.error);
  }

  const { run_id, status, error_message, results, brief } = validation.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Find the search run (include search_type + user_id for merge)
  const { data: searchRun, error: fetchErr } = await supabase
    .from("search_runs")
    .select("id, run_id, status, search_type, requested_by, query")
    .eq("run_id", run_id)
    .maybeSingle();

  if (fetchErr) {
    return jsonError(500, "DB_ERROR", `Failed to look up search run: ${fetchErr.message}`);
  }
  if (!searchRun) {
    return jsonError(404, "NOT_FOUND", `No search run found for run_id ${run_id}`);
  }

  // Idempotency: if already completed/failed, return duplicate
  if (searchRun.status === "completed" || searchRun.status === "failed") {
    return jsonOk({ ok: true, duplicate: true, run_id, status: searchRun.status });
  }

  if (status === "failed") {
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("search_runs")
      .update({
        status: "failed",
        error_message: error_message?.slice(0, 2000) ?? "Unknown error",
        completed_at: now,
      })
      .eq("run_id", run_id);

    // Also update automation_runs to release concurrency lock
    await supabase
      .from("automation_runs")
      .update({ status: "failed", error_message: error_message?.slice(0, 2000) ?? "Unknown error", processed_at: now })
      .eq("run_id", run_id)
      .in("status", ["dispatched", "pending"]);

    if (updateErr) {
      return jsonError(500, "DB_ERROR", `Failed to update run: ${updateErr.message}`);
    }
    return jsonOk({ ok: true, run_id, status: "failed" });
  }

  // Status is "completed" — insert results
  const resultRows = (results || []).map((r: SearchResult, i: number) => ({
    search_run_id: searchRun.id,
    result_index: i,
    title: r.title.trim(),
    description: r.description ?? null,
    url: r.url ?? null,
    source: r.source ?? null,
    location: r.location ?? null,
    date_info: r.date_info ?? null,
    organization: r.organization ?? null,
    contact_name: r.contact_name ?? null,
    contact_email: r.contact_email ?? null,
    contact_phone: r.contact_phone ?? null,
    confidence: typeof r.confidence === "number" ? Math.min(1, Math.max(0, r.confidence)) : null,
    raw_data: r.raw_data ?? {},
  }));

  let insertWarning: string | null = null;

  if (resultRows.length > 0) {
    const { error: insertErr } = await supabase
      .from("search_results")
      .insert(resultRows);

    if (insertErr) {
      // If results insert fails (e.g. duplicate), try to continue
      insertWarning = `Results insert warning: ${insertErr.message}`;
      console.error(insertWarning);
    }
  }

  // Compute metrics
  const resultsReturned = (results || []).length;
  const resultsSaved = resultRows.length;
  const resultsRejected = resultsReturned - resultsSaved;
  // Legacy: accept firecrawl_ms or search_ms for backward compat with n8n workflows
  const rawBody = body as Record<string, unknown>;
  const searchMs = typeof rawBody.search_ms === "number" ? rawBody.search_ms as number
    : typeof rawBody.firecrawl_ms === "number" ? rawBody.firecrawl_ms as number
    : null;

  // --- Search Memory Merge: pull prior results and merge ---
  let mergedResultsCount = 0;
  let priorRunsMerged = 0;
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Build query for prior completed runs of same type + user
    // Only merge prior results if the same query/keyword was used
    if (!searchRun.query) {
      // No query to match against — skip merge
    } else {

    let priorQuery = supabase
      .from("search_runs")
      .select("id")
      .eq("search_type", searchRun.search_type)
      .eq("requested_by", searchRun.requested_by)
      .eq("query", searchRun.query)
      .eq("status", "completed")
      .neq("id", searchRun.id)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: priorRuns } = await priorQuery;

    if (priorRuns && priorRuns.length > 0) {
      const priorRunIds = priorRuns.map((r: { id: string }) => r.id);

      // Get prior results
      const { data: priorResults } = await supabase
        .from("search_results")
        .select("title, url, description, source, location, date_info, organization, contact_name, contact_email, contact_phone, confidence, raw_data")
        .in("search_run_id", priorRunIds)
        .limit(200);

      if (priorResults && priorResults.length > 0) {
        // Build set of current URLs for dedup
        const currentUrls = new Set(
          resultRows.map((r: { url: string | null }) => r.url?.toLowerCase()).filter(Boolean)
        );

        // Filter prior results not in current set
        const newFromPrior = priorResults.filter(
          (pr: { url?: string | null }) => pr.url && !currentUrls.has(pr.url.toLowerCase())
        );

        if (newFromPrior.length > 0) {
          const mergeRows = newFromPrior.map((r: SearchResult, i: number) => ({
            search_run_id: searchRun.id,
            result_index: resultRows.length + i,
            title: r.title,
            description: r.description ?? null,
            url: r.url ?? null,
            source: r.source ?? null,
            location: r.location ?? null,
            date_info: r.date_info ?? null,
            organization: r.organization ?? null,
            contact_name: r.contact_name ?? null,
            contact_email: r.contact_email ?? null,
            contact_phone: r.contact_phone ?? null,
            confidence: r.confidence ?? null,
            raw_data: r.raw_data ?? {},
          }));

          const { error: mergeErr } = await supabase
            .from("search_results")
            .insert(mergeRows);

          if (!mergeErr) {
            mergedResultsCount = mergeRows.length;
            priorRunsMerged = priorRunIds.length;
          } else {
            console.error("Merge insert warning:", mergeErr.message);
          }
        }
      }
    }
    } // end query-match guard
  } catch (mergeErr) {
    // Non-fatal: merge is best-effort
    console.error("Search memory merge failed:", mergeErr);
  }

   const now = new Date().toISOString();
   const { error: updateErr } = await supabase
    .from("search_runs")
    .update({
      status: "completed",
      result_count: resultsSaved + mergedResultsCount,
      results_returned: resultsReturned,
      results_saved: resultsSaved,
      results_rejected: resultsRejected,
      merged_results_count: mergedResultsCount,
      prior_runs_merged: priorRunsMerged,
      ...(searchMs !== null ? { firecrawl_ms: searchMs } : {}),
      ...(brief ? { search_brief: brief } : {}),
      completed_at: now,
    })
    .eq("run_id", run_id);

  // Also update automation_runs to release concurrency lock
  await supabase
    .from("automation_runs")
    .update({ status: "completed", processed_at: now })
    .eq("run_id", run_id)
    .in("status", ["dispatched", "pending"]);

  if (updateErr) {
    return jsonError(500, "DB_ERROR", `Failed to update run: ${updateErr.message}`);
  }

  // ── Momentum recompute trigger (best-effort, non-blocking) ──
  // For search results, derive org_ids from the search run's intent_profile or linked opportunities
  if (resultsSaved > 0 && searchRun.search_type && ["grant", "event", "people"].includes(searchRun.search_type)) {
    try {
      // Get distinct opportunity_ids from the saved results that have org links
      // For now, use the search run's user context to find related orgs
      const { data: recentOpps } = await supabase
        .from("opportunities")
        .select("id")
        .eq("status", "Active")
        .order("updated_at", { ascending: false })
        .limit(25);

      const orgIdsToRecompute = (recentOpps || []).map((o: { id: string }) => o.id).slice(0, 25);

      if (orgIdsToRecompute.length > 0) {
        const fnUrl = `${supabaseUrl}/functions/v1/momentum-recalculate`;
        const workerSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET") || "";
        const resp = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": workerSecret,
          },
          body: JSON.stringify({
            mode: "batch",
          }),
        });
        if (!resp.ok) {
          console.error("Momentum recompute after search failed:", await resp.text());
        }
      }
    } catch (momentumErr) {
      console.error("Momentum recompute error (non-fatal):", momentumErr);
    }
  }

  return jsonOk({
    ok: true,
    run_id,
    status: "completed",
    result_count: resultRows.length,
    ...(insertWarning ? { warning: insertWarning } : {}),
  });
});
