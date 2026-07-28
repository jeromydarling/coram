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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: n8n shared secret only
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  let token = apiKeyHeader.trim();
  if (!token && authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();

  if (!token || !sharedSecret || !constantTimeCompare(token, sharedSecret)) {
    return jsonError(401, "unauthorized", "Invalid credentials");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const metroId = String(body.metro_id ?? "");
    const results = body.results as Array<{
      title: string;
      summary: string;
      source_url: string | null;
      published_date: string | null;
      community_impact_tags: string[];
    }> ?? [];

    if (!metroId) return jsonError(400, "missing_field", "metro_id required");

    // Ingest external signals as discovery highlights
    let ingested = 0;
    for (const item of results) {
      // Use discovery_highlights for metro-level external signals
      const { error } = await supabase.from("discovery_highlights").insert({
        run_id: body.run_id ?? metroId,
        module: "metro_news",
        kind: "external_signal",
        payload: {
          title: item.title,
          snippet: item.summary,
          source_url: item.source_url,
          published_date: item.published_date,
          community_impact_tags: item.community_impact_tags ?? [],
          metro_id: metroId,
        },
      });
      if (!error) ingested++;
    }

    return jsonOk({
      ok: true,
      metro_id: metroId,
      ingested,
      total: results.length,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("Metro narrative callback error:", errMsg);
    return jsonError(500, "internal_error", errMsg);
  }
});
