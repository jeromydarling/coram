import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
      return jsonError("Invalid token", 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { org_id, include_history } = body;

    if (!org_id) return jsonError("org_id required");

    // Check if this is an operator_opportunities ID (not in regular opportunities table)
    const { data: regularOrg } = await supabase
      .from("opportunities")
      .select("id")
      .eq("id", org_id)
      .maybeSingle();

    const isOperatorOrg = !regularOrg;

    // Build query filter based on org type
    const snapshotQuery = isOperatorOrg
      ? supabase.from("org_knowledge_snapshots")
          .select("id, org_id, version, source_type, source_url, structured_json, raw_excerpt, created_by, created_at, updated_at, notes")
          .eq("external_org_key", `operator:${org_id}`)
          .eq("active", true)
          .eq("is_authoritative", true)
      : supabase.from("org_knowledge_snapshots")
          .select("id, org_id, version, source_type, source_url, structured_json, raw_excerpt, created_by, created_at, updated_at, notes")
          .eq("org_id", org_id)
          .eq("active", true)
          .eq("is_authoritative", true);

    // Get current active snapshot
    const { data: current } = await snapshotQuery.maybeSingle();

    if (!current) {
      return jsonResponse({ ok: true, snapshot: null, history: [] });
    }

    // Get sources for current snapshot
    const { data: sources } = await supabase
      .from("org_knowledge_sources")
      .select("id, url, title, snippet, content_hash, retrieved_at")
      .eq("snapshot_id", current.id);

    let history: unknown[] = [];
    if (include_history) {
      const historyQuery = isOperatorOrg
        ? supabase.from("org_knowledge_snapshots")
            .select("id, version, source_type, created_at, created_by, notes")
            .eq("external_org_key", `operator:${org_id}`)
            .order("version", { ascending: false })
            .limit(20)
        : supabase.from("org_knowledge_snapshots")
            .select("id, version, source_type, created_at, created_by, notes")
            .eq("org_id", org_id)
            .order("version", { ascending: false })
            .limit(20);
      const { data: historyData } = await historyQuery;
      history = historyData || [];
    }

    return jsonResponse({
      ok: true,
      snapshot: {
        ...current,
        sources: sources || [],
      },
      history,
    });
  } catch (error) {
    console.error("org-knowledge-get error:", error);
    return jsonError(error instanceof Error ? error.message : "Internal error", 500);
  }
});
