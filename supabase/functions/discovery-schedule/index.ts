import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * discovery-schedule: Scheduled trigger for weekly/daily discovery runs.
 * Invoked by pg_cron or external scheduler.
 * 
 * POST { mode: "weekly" | "daily" }
 * 
 * Weekly: dispatches metro-level events+grants for active metros,
 *         plus opportunity-level people+events+grants for orgs with knowledge profiles.
 * Daily:  dispatches metro-level events only (for urgent 14-day detection).
 */

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

function authenticateServiceRequest(req: Request): boolean {
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    if (authHeader.slice(7).trim() === serviceRoleKey) return true;
  }

  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();

  if (!token) return false;
  if (!enrichmentSecret && !sharedSecret) return false;

  return (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);
}

const MAX_METROS = 50;
const MAX_OPPORTUNITIES = 200;

async function dispatchDiscovery(
  supabaseUrl: string,
  serviceKey: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; run_id?: string; error?: string }> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/discovery-dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, run_id: data.run_id, error: data.message };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
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

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Default to weekly if no body
    body = { mode: "weekly" };
  }

  const mode = body.mode === "daily" ? "daily" : "weekly";

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const dispatched: Array<{ module: string; scope: string; id: string; ok: boolean; error?: string }> = [];
  const skipped: string[] = [];

  // Get active metros (those with active opportunities)
  const { data: activeMetros } = await supabase
    .from("opportunities")
    .select("metro_id")
    .eq("status", "Active")
    .not("metro_id", "is", null)
    .limit(500);

  const uniqueMetroIds = [...new Set((activeMetros || []).map((o: { metro_id: string }) => o.metro_id))];

  if (uniqueMetroIds.length > MAX_METROS) {
    skipped.push(`Capped metros from ${uniqueMetroIds.length} to ${MAX_METROS}`);
  }
  const metroIds = uniqueMetroIds.slice(0, MAX_METROS);

  // ── Daily: metro-level events only ──
  if (mode === "daily") {
    for (const metroId of metroIds) {
      const result = await dispatchDiscovery(supabaseUrl, serviceKey, {
        module: "events",
        scope: "metro",
        metro_id: metroId,
      });
      dispatched.push({ module: "events", scope: "metro", id: metroId, ...result });
    }

    console.log(`[discovery-schedule] Daily: dispatched ${dispatched.filter(d => d.ok).length}/${dispatched.length} event runs`);

    return jsonOk({
      ok: true,
      mode,
      dispatched_count: dispatched.filter(d => d.ok).length,
      failed_count: dispatched.filter(d => !d.ok).length,
      skipped,
    });
  }

  // ── Weekly: metro-level events+grants, opportunity-level all modules ──

  // Metro-level
  for (const metroId of metroIds) {
    for (const module of ["events", "grants"]) {
      const result = await dispatchDiscovery(supabaseUrl, serviceKey, {
        module,
        scope: "metro",
        metro_id: metroId,
      });
      dispatched.push({ module, scope: "metro", id: metroId, ...result });
    }
  }

  // Opportunity-level for those with knowledge profiles
  const { data: profiledOpps } = await supabase
    .from("org_knowledge_profiles")
    .select("organization_id")
    .limit(MAX_OPPORTUNITIES);

  const oppIds = (profiledOpps || []).map((p: { organization_id: string }) => p.organization_id);

  if (oppIds.length > MAX_OPPORTUNITIES) {
    skipped.push(`Capped opportunities from ${oppIds.length} to ${MAX_OPPORTUNITIES}`);
  }
  const cappedOppIds = oppIds.slice(0, MAX_OPPORTUNITIES);

  for (const oppId of cappedOppIds) {
    for (const module of ["events", "grants", "people"]) {
      const result = await dispatchDiscovery(supabaseUrl, serviceKey, {
        module,
        scope: "opportunity",
        opportunity_id: oppId,
      });
      dispatched.push({ module, scope: "opportunity", id: oppId, ...result });
    }
  }

  const successCount = dispatched.filter(d => d.ok).length;
  const failCount = dispatched.filter(d => !d.ok).length;

  console.log(`[discovery-schedule] Weekly: dispatched ${successCount}/${dispatched.length} runs (${failCount} failed)`);

  return jsonOk({
    ok: true,
    mode,
    dispatched_count: successCount,
    failed_count: failCount,
    total: dispatched.length,
    skipped,
  });
});
