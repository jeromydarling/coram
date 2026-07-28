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

function jsonError(status: number, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "Only POST");

  // User JWT auth
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonError(401, "Auth required");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
  if (authErr || !claimsData?.claims) return jsonError(401, "Invalid token");
  const user = { id: claimsData.claims.sub as string };

  try {
    const body = await req.json();
    const scope = body.scope as string; // "opportunity" | "metro"
    const id = body.id as string;

    if (!scope || !id) return jsonError(400, "scope and id required");

    const serviceClient = createClient(supabaseUrl, serviceKey);

    // ── P0 FIX: Verify user has access before returning data ──

    if (scope === "opportunity") {
      // Check user can access this opportunity's metro
      const { data: opp } = await serviceClient
        .from("opportunities")
        .select("id, metro_id")
        .eq("id", id)
        .single();

      if (!opp) return jsonError(404, "Opportunity not found");

      // Verify metro access using the helper function
      const { data: hasAccess } = await serviceClient.rpc("has_metro_access", {
        _user_id: user.id,
        _metro_id: opp.metro_id,
      });

      if (!hasAccess) return jsonError(403, "Access denied");

      const { data, error } = await serviceClient
        .from("opportunity_memory_threads")
        .select("*")
        .eq("opportunity_id", id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return jsonError(500, error.message);
      return jsonOk({ ok: true, memory: data?.memory_json || null, computed_at: data?.computed_at || null });
    }

    if (scope === "metro") {
      // Verify metro access
      const { data: hasAccess } = await serviceClient.rpc("has_metro_access", {
        _user_id: user.id,
        _metro_id: id,
      });

      if (!hasAccess) return jsonError(403, "Access denied");

      const { data, error } = await serviceClient
        .from("metro_memory_threads")
        .select("*")
        .eq("metro_id", id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return jsonError(500, error.message);
      return jsonOk({ ok: true, memory: data?.memory_json || null, computed_at: data?.computed_at || null });
    }

    return jsonError(400, "scope must be 'opportunity' or 'metro'");
  } catch (err) {
    console.error("memory-suggestions error:", err);
    return jsonError(500, err instanceof Error ? err.message : "Unknown error");
  }
});
