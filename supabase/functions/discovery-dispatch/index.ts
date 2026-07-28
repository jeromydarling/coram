/**
 * discovery-dispatch — Routes discovery requests to internal worker edge functions.
 *
 * WHAT: Validates input, creates discovery_run, dispatches to discovery-{module}-worker.
 * WHERE: supabase/functions/discovery-dispatch/index.ts
 * WHY: Replaced n8n webhook dispatch with direct edge function calls.
 *
 * REWIRED: Now calls discovery-events-worker, discovery-grants-worker, discovery-people-worker
 *          directly instead of n8n webhooks.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
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
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export function authenticateServiceRequest(req: Request): boolean {
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken === serviceRoleKey) return true;
  }

  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();

  if (!token) return false;
  if (!enrichmentSecret && !sharedSecret) return false;

  return (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_MODULES = ["grants", "events", "people"] as const;
const VALID_SCOPES = ["metro", "opportunity"] as const;

/** Maps module → worker edge function name */
const WORKER_FUNCTIONS: Record<string, string> = {
  events: "discovery-events-worker",
  grants: "discovery-grants-worker",
  people: "discovery-people-worker",
};

interface DispatchInput {
  module: string;
  scope: string;
  metro_id?: string;
  opportunity_id?: string;
}

export function validateInput(body: unknown): { valid: true; data: DispatchInput } | { valid: false; error: string } {
  if (!body || typeof body !== "object") return { valid: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  if (!b.module || !VALID_MODULES.includes(b.module as typeof VALID_MODULES[number])) {
    return { valid: false, error: `module must be one of: ${VALID_MODULES.join(", ")}` };
  }
  if (!b.scope || !VALID_SCOPES.includes(b.scope as typeof VALID_SCOPES[number])) {
    return { valid: false, error: `scope must be one of: ${VALID_SCOPES.join(", ")}` };
  }

  if (b.scope === "metro") {
    if (!b.metro_id || typeof b.metro_id !== "string" || !UUID_RE.test(b.metro_id)) {
      return { valid: false, error: "metro_id is required (valid UUID) when scope=metro" };
    }
  }

  if (b.scope === "opportunity") {
    if (!b.opportunity_id || typeof b.opportunity_id !== "string" || !UUID_RE.test(b.opportunity_id)) {
      return { valid: false, error: "opportunity_id is required (valid UUID) when scope=opportunity" };
    }
  }

  return {
    valid: true,
    data: {
      module: b.module as string,
      scope: b.scope as string,
      metro_id: typeof b.metro_id === "string" ? b.metro_id : undefined,
      opportunity_id: typeof b.opportunity_id === "string" ? b.opportunity_id : undefined,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  if (!authenticateServiceRequest(req)) {
    return jsonError(401, "UNAUTHORIZED", "Invalid or missing authentication");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const validation = validateInput(body);
  if (!validation.valid) {
    return jsonError(400, "VALIDATION_ERROR", validation.error);
  }

  const { module, scope, metro_id, opportunity_id } = validation.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Build query_profile from org_knowledge_profiles if opportunity scope
  let queryProfile: Record<string, unknown> = {};
  if (scope === "opportunity" && opportunity_id) {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("id, organization, metro_id, website, status")
      .eq("id", opportunity_id)
      .maybeSingle();

    if (opp) {
      queryProfile = {
        organization: opp.organization,
        website: opp.website,
        metro_id: opp.metro_id,
        status: opp.status,
      };

      const { data: profile } = await supabase
        .from("org_knowledge_profiles")
        .select("event_targeting_profile, geo_reach_profile, grant_alignment_vectors, ecosystem_scope")
        .eq("organization_id", opportunity_id)
        .maybeSingle();

      if (profile) {
        queryProfile.knowledge = profile;
      }
    }
  } else if (scope === "metro" && metro_id) {
    const { data: metro } = await supabase
      .from("metros")
      .select("id, metro, region")
      .eq("id", metro_id)
      .maybeSingle();

    if (metro) {
      queryProfile = { metro: metro.metro, region: metro.region };
    }
  }

  // Insert discovery_run
  const { data: run, error: insertErr } = await supabase
    .from("discovery_runs")
    .insert({
      module,
      scope,
      metro_id: metro_id || null,
      opportunity_id: opportunity_id || null,
      status: "running",
      started_at: new Date().toISOString(),
      query_profile: queryProfile,
    })
    .select("id")
    .single();

  if (insertErr || !run) {
    console.error("Failed to insert discovery_run:", insertErr);
    return jsonError(500, "DB_ERROR", `Failed to create discovery run: ${insertErr?.message}`);
  }

  const run_id = run.id;

  // ── Dispatch to internal worker edge function (replaces n8n webhook) ──
  const workerFunction = WORKER_FUNCTIONS[module];
  const workerUrl = `${supabaseUrl}/functions/v1/${workerFunction}`;

  const dispatchPayload = {
    run_id,
    module,
    scope,
    metro_id: metro_id || null,
    opportunity_id: opportunity_id || null,
    query_profile: queryProfile,
  };

  console.log(`[discovery-dispatch] Dispatching ${module}/${scope} run=${run_id} to ${workerFunction}`);

  // Non-blocking dispatch via EdgeRuntime.waitUntil
  const backgroundTask = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);

      const resp = await fetch(workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify(dispatchPayload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "unknown");
        console.error(`[discovery-dispatch] Worker returned ${resp.status}: ${errText}`);
        await supabase
          .from("discovery_runs")
          .update({ status: "failed", error: { code: "WORKER_FAILED", message: errText.slice(0, 500) }, completed_at: new Date().toISOString() })
          .eq("id", run_id);
      } else {
        await resp.text(); // consume body
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[discovery-dispatch] Dispatch error:`, errMsg);
      await supabase
        .from("discovery_runs")
        .update({ status: "failed", error: { code: "DISPATCH_ERROR", message: errMsg }, completed_at: new Date().toISOString() })
        .eq("id", run_id);
    }
  })();

  const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(backgroundTask);
  } else {
    backgroundTask.catch(() => undefined);
  }

  return jsonOk({ ok: true, run_id, module, scope, source: "edge-worker" });
});
