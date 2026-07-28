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

export function parseParams(url: URL): { module: string; days: number } | { error: string } {
  const module = url.searchParams.get("module");
  if (!module || !["people", "events", "grants"].includes(module)) {
    return { error: "module query param required (people, events, grants)" };
  }
  const daysRaw = url.searchParams.get("days");
  let days = 30;
  if (daysRaw) {
    days = parseInt(daysRaw, 10);
    if (isNaN(days) || days < 1) days = 30;
    if (days > 30) days = 30;
  }
  return { module, days };
}

// Map module param to search_type column value
const MODULE_TO_SEARCH_TYPE: Record<string, string> = {
  people: "opportunity",
  events: "event",
  grants: "grant",
};

const isTest = Deno.env.get("DENO_TEST") === "1" || (globalThis as Record<string, unknown>).__test_mode === true;
if (!isTest) Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only GET is accepted");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "UNAUTHORIZED", "Missing Authorization header");
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData?.user) {
    return jsonError(401, "UNAUTHORIZED", "Invalid or expired token");
  }
  const userId = authData.user.id;

  const url = new URL(req.url);
  const parsed = parseParams(url);
  if ("error" in parsed) {
    return jsonError(400, "INVALID_PARAMS", parsed.error);
  }

  const { module, days } = parsed;
  const searchType = MODULE_TO_SEARCH_TYPE[module] || module;

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from("search_runs")
    .select("run_id, enforced_query, raw_query, metro_id, created_at, status, result_count, results_saved, people_added_count, opportunities_created_count")
    .eq("search_type", searchType)
    .eq("requested_by", userId)
    .gte("created_at", cutoff.toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return jsonError(500, "DB_ERROR", `Failed to query search history: ${error.message}`);
  }

  const runs = (data || []).map((r) => ({
    run_id: r.run_id,
    enforced_query: r.enforced_query,
    raw_query: r.raw_query,
    scope: r.metro_id ? "metro" : "national",
    metro_id: r.metro_id,
    created_at: r.created_at,
    status: r.status,
    results_saved: r.results_saved ?? r.result_count ?? 0,
    people_added_count: r.people_added_count ?? 0,
    opportunities_created_count: r.opportunities_created_count ?? 0,
  }));

  return jsonOk({ ok: true, runs });
});
