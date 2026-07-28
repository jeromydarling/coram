import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_ENTITY_TYPES = ["event", "opportunity", "grant"];

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

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { entity_type, entity_id } = body;

  if (!entity_type || !VALID_ENTITY_TYPES.includes(entity_type as string)) {
    return new Response(
      JSON.stringify({ ok: false, error: "entity_type must be one of: event, opportunity, grant" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!entity_id || typeof entity_id !== "string") {
    return new Response(
      JSON.stringify({ ok: false, error: "entity_id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Verify user can access (read via RLS)
  const { data: rows, error: fetchErr } = await userClient
    .from("contact_suggestions")
    .select("id, status")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id);

  if (fetchErr) {
    return new Response(
      JSON.stringify({ ok: false, error: "Database query failed" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!rows || rows.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, dismissed: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const adminClient = createClient(supabaseUrl, serviceKey);
  const ids = rows.map((r) => r.id);

  const { error: updateErr } = await adminClient
    .from("contact_suggestions")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .in("id", ids);

  if (updateErr) {
    console.error("Dismiss error:", updateErr.message);
    return new Response(
      JSON.stringify({ ok: false, error: "Failed to dismiss suggestions" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, dismissed: ids.length }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(handleRequest);
