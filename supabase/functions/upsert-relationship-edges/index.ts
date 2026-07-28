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

interface EdgeInput {
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  edge_reason: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST accepted");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const workerSecret = Deno.env.get("N8N_SHARED_SECRET") ?? "";

  // Auth: worker secret only
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  else if (apiKeyHeader) token = apiKeyHeader.trim();

  const isWorker = workerSecret && token === workerSecret;
  if (!isWorker) {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return jsonError(401, "UNAUTHORIZED", "Invalid auth");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const rawEdges = Array.isArray(body.edges) ? body.edges : [];
  const validEdges: EdgeInput[] = [];

  for (const e of rawEdges) {
    if (!e.source_type || !e.source_id || !e.target_type || !e.target_id || !e.edge_reason) continue;
    validEdges.push({
      source_type: String(e.source_type).trim(),
      source_id: String(e.source_id).trim(),
      target_type: String(e.target_type).trim(),
      target_id: String(e.target_id).trim(),
      edge_reason: String(e.edge_reason).trim().slice(0, 500),
    });
  }

  if (validEdges.length === 0) {
    return jsonOk({ ok: true, edges_upserted: 0, message: "No valid edges provided" });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Idempotent upsert using ON CONFLICT unique constraint
  const { error } = await admin
    .from("relationship_edges")
    .upsert(validEdges, {
      onConflict: "source_type,source_id,target_type,target_id",
      ignoreDuplicates: true,
    });

  if (error) {
    console.error("Edge upsert error:", error.message);
    // Return 200 anyway to not block n8n callback flow
    return jsonOk({ ok: true, edges_upserted: 0, error: error.message });
  }

  return jsonOk({ ok: true, edges_upserted: validEdges.length });
});
