import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_ENTITY_TYPES = ["event", "opportunity", "grant"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URL_RE = /^https?:\/\/.+/;

// ── Types ──

export interface EnqueueBody {
  run_id?: string;
  entity_type: string;
  entity_id: string;
  source_url: string;
}

// ── Exported for testing ──

export async function authenticateRequest(req: Request): Promise<{ ok: true } | { ok: false; response: Response }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  // Check if any auth mechanism is configured
  const secret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!secret && (!supabaseUrl || !anonKey)) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ok: false, error: "Server misconfigured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  if (!token) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  // Path 1: Worker secret (service-to-service)
  if (secret && token === secret) {
    return { ok: true };
  }

  // Path 2: Authenticated user JWT (frontend calls)
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.57.2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ ok: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        ),
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }
}

export function validateBody(body: unknown): { valid: true; data: EnqueueBody } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== "object") return { valid: false, errors: ["Body must be a JSON object"] };

  const b = body as Record<string, unknown>;

  // run_id is optional; if provided must be valid UUID
  if (b.run_id !== undefined && b.run_id !== null) {
    if (typeof b.run_id !== "string" || !UUID_RE.test(b.run_id)) {
      errors.push("run_id: must be a valid UUID if provided");
    }
  }

  if (!VALID_ENTITY_TYPES.includes(b.entity_type as typeof VALID_ENTITY_TYPES[number])) {
    errors.push(`entity_type: must be one of ${VALID_ENTITY_TYPES.join(", ")}`);
  }

  if (typeof b.entity_id !== "string" || !UUID_RE.test(b.entity_id)) {
    errors.push("entity_id: required valid UUID");
  }

  if (typeof b.source_url !== "string" || !URL_RE.test(b.source_url)) {
    errors.push("source_url: required valid http(s) URL");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: b as unknown as EnqueueBody };
}

export function buildDuplicateResponse(job: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ ok: true, duplicate: true, job }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export function buildCreatedResponse(job: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ ok: true, duplicate: false, job }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ── Handler ──

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const validation = validateBody(body);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({ ok: false, errors: validation.errors }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const envelope = validation.data;
  const runId = envelope.run_id ?? crypto.randomUUID();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Idempotency: check if run_id already exists
    const { data: existing } = await supabase
      .from("enrichment_jobs")
      .select("id, run_id, entity_type, entity_id, source_url, status, attempts, created_at")
      .eq("run_id", runId)
      .maybeSingle();

    if (existing) {
      return buildDuplicateResponse(existing);
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("enrichment_jobs")
      .insert({
        run_id: runId,
        entity_type: envelope.entity_type,
        entity_id: envelope.entity_id,
        source_url: envelope.source_url,
      })
      .select("id, run_id, entity_type, entity_id, source_url, status, attempts, created_at")
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr.message);
      return new Response(
        JSON.stringify({ ok: false, error: "Database write failed" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return buildCreatedResponse(inserted);
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Internal error" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

Deno.serve(handleRequest);
