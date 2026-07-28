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

interface SignalInput {
  organization_id: string;
  contact_id?: string;
  source_type: string;
  source_id: string;
  signal_reason: string;
  confidence: number;
  user_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST accepted");
  }

  // Auth: accept user JWT or worker secret
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const workerSecret = Deno.env.get("N8N_SHARED_SECRET") ?? "";

  let token = "";
  if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  else if (apiKeyHeader) token = apiKeyHeader.trim();

  // Service-role auth for n8n callbacks
  const isWorker = workerSecret && token === workerSecret;

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let userId: string | null = null;

  if (!isWorker) {
    // Verify user JWT
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) {
      return jsonError(401, "UNAUTHORIZED", "Invalid or missing auth");
    }
    userId = user.id;
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  // Accept either a single signal or batch from n8n
  const signals: SignalInput[] = [];

  if (Array.isArray(body.signals)) {
    for (const s of body.signals) {
      if (!s.organization_id || !s.source_type || !s.source_id || !s.signal_reason) continue;
      signals.push({
        organization_id: s.organization_id,
        contact_id: s.contact_id ?? null,
        source_type: s.source_type,
        source_id: s.source_id,
        signal_reason: s.signal_reason,
        confidence: typeof s.confidence === "number" ? Math.min(1, Math.max(0, s.confidence)) : 0.5,
        user_id: s.user_id ?? userId ?? body.user_id as string,
      });
    }
  } else if (body.organization_id && body.source_type && body.source_id) {
    signals.push({
      organization_id: body.organization_id as string,
      contact_id: (body.contact_id as string) ?? null,
      source_type: body.source_type as string,
      source_id: body.source_id as string,
      signal_reason: (body.signal_reason as string) ?? "Auto-detected signal",
      confidence: typeof body.confidence === "number" ? Math.min(1, Math.max(0, body.confidence)) : 0.5,
      user_id: userId ?? (body.user_id as string),
    });
  }

  if (signals.length === 0) {
    return jsonError(400, "NO_SIGNALS", "No valid signals provided");
  }

  // Idempotent insert using ON CONFLICT
  const { data, error } = await admin
    .from("opportunity_signals")
    .upsert(
      signals.map(s => ({
        organization_id: s.organization_id,
        contact_id: s.contact_id,
        source_type: s.source_type,
        source_id: s.source_id,
        signal_reason: s.signal_reason,
        confidence: s.confidence,
        user_id: s.user_id,
      })),
      { onConflict: "source_id,organization_id", ignoreDuplicates: true }
    );

  if (error) {
    console.error("Signal insert error:", error.message);
    return jsonError(500, "DB_ERROR", error.message);
  }

  return jsonOk({ ok: true, signals_processed: signals.length });
});
