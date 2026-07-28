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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonError(500, "CONFIG_ERROR", "Supabase configuration missing");
  }

  // ── Auth: verify user JWT ──
  const authHeader = req.headers.get("Authorization") ?? "";
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
  const userId = userData.user.id;

  // ── Service role client ──
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── RBAC check ──
  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (roleError) {
    return jsonError(500, "ROLE_LOOKUP_FAILED", "Could not determine user role");
  }

  const userRoles = (roleRows || []).map((r: { role: string }) => r.role);
  const allowed = userRoles.some((role: string) =>
    ["admin", "leadership", "regional_lead"].includes(role)
  );
  if (!allowed) {
    return jsonError(403, "ROLE_DENIED", "Only admin/leadership/regional_lead can retry runs");
  }

  // ── Parse body ──
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const { run_id, mode } = body as { run_id?: string; mode?: string };
  if (!run_id || typeof run_id !== "string") {
    return jsonError(400, "MISSING_FIELD", "run_id is required");
  }
  // mode: "retry" (default) | "force_crawl" — force_crawl bypasses dedupe
  const retryMode = mode === "force_crawl" ? "force_crawl" : "retry";

  // ── Load original run ──
  const { data: origRun, error: fetchErr } = await supabaseAdmin
    .from("automation_runs")
    .select("run_id, workflow_key, status, dispatch_payload, scope_json, triggered_by")
    .eq("run_id", run_id)
    .maybeSingle();

  if (fetchErr) {
    return jsonError(500, "FETCH_FAILED", `Could not load run: ${fetchErr.message}`);
  }
  if (!origRun) {
    return jsonError(404, "NOT_FOUND", `Run ${run_id} not found`);
  }

  // ── Extract dispatch payload ──
  const dispatchPayload = origRun.dispatch_payload || origRun.scope_json;
  if (!dispatchPayload || typeof dispatchPayload !== "object") {
    return jsonError(
      400,
      "NO_PAYLOAD",
      "Original run has no stored dispatch payload — cannot retry",
    );
  }

  const workflowKey = origRun.workflow_key;

  // ── Create new run via internal dispatch ──
  const newRunId = crypto.randomUUID();

  // Build the dispatch body matching what n8n-dispatch would send
  const n8nBaseUrl = Deno.env.get("N8N_WEBHOOK_BASE_URL");
  const n8nSecret = Deno.env.get("N8N_SHARED_SECRET");

  if (!n8nBaseUrl || !n8nSecret) {
    return jsonError(500, "CONFIG_ERROR", "N8N configuration missing for retry");
  }

  const WORKFLOW_PATHS: Record<string, string> = {
    partner_enrich: "/webhook/partner-enrich",
    opportunity_monitor: "/webhook/opportunity-monitor",
    recommendations_generate: "/webhook/recommendations-generate",
    watchlist_ingest: "/webhook/watchlist-ingest",
    watchlist_diff: "/webhook/watchlist-diff",
  };

  const webhookPath = WORKFLOW_PATHS[workflowKey];
  if (!webhookPath) {
    return jsonError(400, "INVALID_WORKFLOW", `Unknown workflow_key: ${workflowKey}`);
  }

  // ── Insert new automation_runs row ──
  const scopedPayload = dispatchPayload as Record<string, unknown>;
  // For force_crawl mode, add a flag to bypass dedupe on the n8n side
  const enrichedPayload = retryMode === "force_crawl"
    ? { ...scopedPayload, force_crawl: true }
    : scopedPayload;

  const { error: insertErr } = await supabaseAdmin.from("automation_runs").insert({
    run_id: newRunId,
    workflow_key: workflowKey,
    status: "queued",
    triggered_by: userId,
    scope_json: enrichedPayload,
    dispatch_payload: enrichedPayload,
    parent_run_id: run_id,
    org_id: (scopedPayload as Record<string, unknown>).org_id || null,
    org_name: (scopedPayload as Record<string, unknown>).org_name || null,
    metro_id: (scopedPayload as Record<string, unknown>).metro_id || null,
  });

  if (insertErr) {
    return jsonError(500, "INSERT_FAILED", `Could not create retry run: ${insertErr.message}`);
  }

  // ── HMAC sign ──
  const dispatchBody = JSON.stringify({
    run_id: newRunId,
    workflow_key: workflowKey,
    triggered_by: userId,
    retry_mode: retryMode,
    parent_run_id: run_id,
    ...enrichedPayload,
  });

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(n8nSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(dispatchBody));
  const signature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const webhookUrl = n8nBaseUrl.replace(/\/+$/, "") + webhookPath;

  try {
    const n8nResp = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-profunda-signature": signature,
        "x-profunda-run-id": newRunId,
      },
      body: dispatchBody,
    });

    if (!n8nResp.ok) {
      const errText = await n8nResp.text();
      await supabaseAdmin
        .from("automation_runs")
        .update({
          status: "error",
          error_message: `n8n retry ${n8nResp.status}: ${errText.slice(0, 500)}`,
          processed_at: new Date().toISOString(),
        })
        .eq("run_id", newRunId);

      return jsonError(502, "N8N_ERROR", `n8n returned ${n8nResp.status} on retry`);
    }

    await n8nResp.text();

    await supabaseAdmin
      .from("automation_runs")
      .update({ status: "dispatched", processed_at: new Date().toISOString() })
      .eq("run_id", newRunId);

    return jsonOk({ ok: true, old_run_id: run_id, new_run_id: newRunId, workflow_key: workflowKey });
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    try {
      await supabaseAdmin
        .from("automation_runs")
        .update({
          status: "error",
          error_message: `retry dispatch failed: ${msg.slice(0, 500)}`,
          processed_at: new Date().toISOString(),
        })
        .eq("run_id", newRunId);
    } catch { /* best-effort */ }

    return jsonError(502, "DISPATCH_FAILED", `Could not reach n8n on retry: ${msg}`);
  }
});
