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

export interface GrantAlignmentPayload {
  run_id: string;
  status: "completed" | "failed";
  error_message?: string;
  results?: Array<{
    org_id: string;
    grant_id: string;
    score: number;
    rationale?: string;
  }>;
}

export function validateBody(body: unknown): { valid: true; data: GrantAlignmentPayload } | { valid: false; error: string } {
  if (!body || typeof body !== "object") return { valid: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  if (b.run_id !== undefined) b.run_id = String(b.run_id).trim();
  if (typeof b.run_id !== "string" || !b.run_id) {
    return { valid: false, error: "run_id: required non-empty string" };
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
      const r = b.results[i] as Record<string, unknown>;
      if (!r || typeof r !== "object") return { valid: false, error: `results[${i}]: must be object` };
      if (typeof r.org_id !== "string" || !UUID_RE.test(r.org_id)) {
        return { valid: false, error: `results[${i}].org_id: required valid UUID` };
      }
      if (typeof r.grant_id !== "string" || !UUID_RE.test(r.grant_id)) {
        return { valid: false, error: `results[${i}].grant_id: required valid UUID` };
      }
      if (typeof r.score !== "number" || r.score < 0 || r.score > 100) {
        return { valid: false, error: `results[${i}].score: required number 0-100` };
      }
    }
  }
  return { valid: true, data: b as unknown as GrantAlignmentPayload };
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  // Auth: shared secret
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");

  if (!enrichmentSecret && !sharedSecret) {
    return jsonError(500, "CONFIG_ERROR", "No worker secrets configured");
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";
  const apikeyHeader = req.headers.get("apikey") ?? "";

  let token = "";
  if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  else if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (apikeyHeader) token = apikeyHeader.trim();

  if (!token) return jsonError(401, "UNAUTHORIZED", "Missing authentication header");

  const authenticated =
    (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);

  if (!authenticated) return jsonError(401, "UNAUTHORIZED", "Invalid authentication");

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

  const { run_id, status, error_message, results } = validation.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  if (status === "failed") {
    console.error(`Grant alignment failed for run ${run_id}: ${error_message}`);
    await supabase
      .from("automation_runs")
      .update({ status: "failed", error_message: error_message?.slice(0, 2000), processed_at: new Date().toISOString() })
      .eq("run_id", run_id)
      .in("status", ["dispatched", "pending", "queued"]);

    return jsonOk({ ok: true, run_id, status: "failed" });
  }

  // Upsert alignments
  let inserted = 0;
  for (const r of results || []) {
    const { error } = await supabase
      .from("grant_alignment")
      .upsert(
        {
          org_id: r.org_id,
          grant_id: r.grant_id,
          score: Math.round(r.score),
          rationale: r.rationale || null,
          run_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,grant_id" }
      );

    if (!error) inserted++;
    else if (error.code !== "23505") {
      console.error(`Failed to upsert alignment: ${error.message}`);
    }
  }

  // Update automation run
  await supabase
    .from("automation_runs")
    .update({ status: "completed", processed_at: new Date().toISOString() })
    .eq("run_id", run_id)
    .in("status", ["dispatched", "pending", "queued"]);

  return jsonOk({ ok: true, run_id, inserted, total: results?.length || 0 });
}

Deno.serve(handleRequest);
