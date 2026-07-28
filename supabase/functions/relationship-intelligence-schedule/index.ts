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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const job = body.job as string;
  if (!["nightly_actions", "weekly_briefings"].includes(job)) {
    return jsonError(400, "INVALID_JOB", "job must be 'nightly_actions' or 'weekly_briefings'");
  }

  const dryRun = body.dry_run === true;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // Get active metros
    const MAX_METROS = 50;
    const { data: metros, error: metrosErr } = await sb
      .from("metros")
      .select("id, metro")
      .limit(MAX_METROS + 1);
    if (metrosErr) throw metrosErr;
    let metroList = metros || [];
    if (metroList.length > MAX_METROS) {
      console.warn(`Metro cap applied: processing ${MAX_METROS} of ${metroList.length} metros`);
      metroList = metroList.slice(0, MAX_METROS);
    }

    if (dryRun) {
      return jsonOk({
        ok: true,
        dry_run: true,
        job,
        metros: metroList.map((m: { id: string; metro: string }) => ({ id: m.id, name: m.metro })),
        would_process: metroList.length,
      });
    }

    const results: Record<string, unknown>[] = [];

    if (job === "nightly_actions") {
      // Generate actions for each metro
      for (const metro of metroList) {
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/relationship-actions-generate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ scope: "metro", metro_id: metro.id }),
            signal: AbortSignal.timeout(55000),
          });
          const data = await resp.json();
          results.push({ metro_id: metro.id, metro: (metro as { metro: string }).metro, status: resp.ok ? "ok" : "error", data });
        } catch (err) {
          results.push({ metro_id: metro.id, status: "error", error: err instanceof Error ? err.message : "timeout" });
        }
      }
    } else if (job === "weekly_briefings") {
      // Generate briefings for each metro
      for (const metro of metroList) {
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/relationship-briefings-generate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ scope: "metro", metro_id: metro.id }),
            signal: AbortSignal.timeout(55000),
          });
          const data = await resp.json();
          results.push({ metro_id: metro.id, metro: (metro as { metro: string }).metro, status: resp.ok ? "ok" : "error", data });
        } catch (err) {
          results.push({ metro_id: metro.id, status: "error", error: err instanceof Error ? err.message : "timeout" });
        }
      }
    }

    return jsonOk({
      ok: true,
      job,
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error("relationship-intelligence-schedule error:", err);
    return jsonError(500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
});
