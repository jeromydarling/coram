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

  const url = new URL(req.url);

  try {
    // GET: List sources for n8n to crawl
    if (req.method === "GET") {
      const metroId = url.searchParams.get("metro_id");
      const enabledOnly = url.searchParams.get("enabled") !== "false";

      let query = supabase
        .from("metro_news_sources")
        .select("id, metro_id, url, label, source_origin, detected_feed_type, last_crawled_at")
        .order("created_at", { ascending: true });

      if (metroId) query = query.eq("metro_id", metroId);
      if (enabledOnly) query = query.eq("enabled", true);

      const { data, error } = await query;
      if (error) throw error;

      return jsonOk({ ok: true, sources: data || [] });
    }

    // POST: Auto-discover and upsert sources
    if (req.method === "POST") {
      const body = await req.json();
      const metroId = String(body.metro_id ?? "");
      const sources = body.sources as Array<{
        url: string;
        label?: string;
        detected_feed_type?: string;
      }> ?? [];

      if (!metroId) return jsonError(400, "missing_field", "metro_id required");
      if (!Array.isArray(sources) || sources.length === 0) {
        return jsonError(400, "missing_field", "sources array required");
      }

      let added = 0;
      let skipped = 0;

      for (const src of sources) {
        if (!src.url) { skipped++; continue; }

        const { error } = await supabase
          .from("metro_news_sources")
          .upsert(
            {
              metro_id: metroId,
              url: src.url,
              label: src.label || null,
              source_origin: "auto_discovered",
              detected_feed_type: src.detected_feed_type || "unknown",
              enabled: true,
            },
            { onConflict: "metro_id,url", ignoreDuplicates: false }
          );

        if (error) {
          console.error("Upsert error for", src.url, error.message);
          skipped++;
        } else {
          added++;
        }
      }

      return jsonOk({ ok: true, metro_id: metroId, added, skipped, total: sources.length });
    }

    return jsonError(405, "method_not_allowed", "Use GET or POST");
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("Metro news sources error:", errMsg);
    return jsonError(500, "internal_error", errMsg);
  }
});
