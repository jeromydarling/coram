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

export interface ProspectPackPayload {
  run_id: string;
  entity_id: string;
  entity_type?: string;
  status: "completed" | "failed";
  error_message?: string;
  pack?: {
    org_summary?: string;
    mission_snapshot?: string;
    partnership_angles?: string[];
    grant_alignments?: string[];
    suggested_outreach_angle?: string;
    risks_notes?: string[];
    [key: string]: unknown;
  };
}

export function validateBody(body: unknown): { valid: true; data: ProspectPackPayload } | { valid: false; error: string } {
  if (!body || typeof body !== "object") return { valid: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  // Defensive coercion
  if (b.run_id !== undefined && b.run_id !== null) b.run_id = String(b.run_id).trim();
  if (b.entity_id !== undefined && b.entity_id !== null) b.entity_id = String(b.entity_id).trim();

  if (typeof b.run_id !== "string" || !UUID_RE.test(b.run_id)) {
    return { valid: false, error: `run_id: required valid UUID (got: ${JSON.stringify(b.run_id)})` };
  }
  if (typeof b.entity_id !== "string" || !UUID_RE.test(b.entity_id)) {
    return { valid: false, error: `entity_id: required valid UUID (got: ${JSON.stringify(b.entity_id)})` };
  }
  if (b.entity_type !== undefined && b.entity_type !== null && typeof b.entity_type !== "string") {
    return { valid: false, error: "entity_type: must be a string" };
  }
  if (b.status !== "completed" && b.status !== "failed") {
    return { valid: false, error: "status: must be 'completed' or 'failed'" };
  }
  if (b.status === "failed" && typeof b.error_message !== "string") {
    return { valid: false, error: "error_message required when status is 'failed'" };
  }
  if (b.status === "completed" && (!b.pack || typeof b.pack !== "object")) {
    return { valid: false, error: "pack: required object when status is 'completed'" };
  }

  return { valid: true, data: b as unknown as ProspectPackPayload };
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
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  } else if (apikeyHeader) {
    token = apikeyHeader.trim();
  }

  if (!token) {
    return jsonError(401, "UNAUTHORIZED", "Missing authentication header");
  }

  const authenticated =
    (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);

  if (!authenticated) {
    return jsonError(401, "UNAUTHORIZED", "Invalid authentication");
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

  const { run_id, entity_id, entity_type, status, error_message, pack } = validation.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Idempotency: check if run_id already exists
  const { data: existing } = await supabase
    .from("prospect_packs")
    .select("id, run_id")
    .eq("run_id", run_id)
    .maybeSingle();

  if (existing) {
    return jsonOk({ ok: true, duplicate: true, run_id, id: existing.id });
  }

  if (status === "failed") {
    // Log failure to automation_runs if applicable
    console.error(`Prospect pack generation failed for entity ${entity_id}: ${error_message}`);
    await supabase
      .from("automation_runs")
      .update({ status: "failed", error_message: error_message?.slice(0, 2000), processed_at: new Date().toISOString() })
      .eq("run_id", run_id)
      .in("status", ["dispatched", "pending"]);

    return jsonOk({ ok: true, run_id, status: "failed" });
  }

  // Insert prospect pack
  const { data: inserted, error: insertErr } = await supabase
    .from("prospect_packs")
    .insert({
      entity_type: entity_type || "opportunity",
      entity_id,
      run_id,
      pack_json: pack,
    })
    .select("id")
    .single();

  if (insertErr) {
    // Handle unique constraint violation (duplicate run_id)
    if (insertErr.code === "23505") {
      return jsonOk({ ok: true, duplicate: true, run_id });
    }
    return jsonError(500, "DB_ERROR", `Insert failed: ${insertErr.message}`);
  }

  // Update automation_runs
  await supabase
    .from("automation_runs")
    .update({ status: "completed", processed_at: new Date().toISOString() })
    .eq("run_id", run_id)
    .in("status", ["dispatched", "pending"]);

  return jsonOk({ ok: true, run_id, id: inserted.id, status: "completed" });
}

Deno.serve(handleRequest);
