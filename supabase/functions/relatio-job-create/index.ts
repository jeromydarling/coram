/**
 * relatio-job-create — Creates a new import job (admin-only).
 * POST { tenant_id, connector_key, scope, settings? }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { tenant_id, connector_key, scope, settings } = body;

    if (!tenant_id || !connector_key) {
      return new Response(
        JSON.stringify({ error: "tenant_id and connector_key are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin membership
    const { data: membership } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member of this tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify connector exists and is active
    const { data: connector } = await supabase
      .from("relatio_connectors")
      .select("key")
      .eq("key", connector_key)
      .eq("active", true)
      .maybeSingle();

    if (!connector) {
      return new Response(JSON.stringify({ error: "Connector not found or disabled" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check no already-running job for this connector
    const { data: running } = await supabase
      .from("relatio_import_jobs")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("connector_key", connector_key)
      .in("status", ["queued", "running"])
      .maybeSingle();

    if (running) {
      return new Response(
        JSON.stringify({ error: "An import is already queued or running for this connector." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create job
    const { data: job, error: insertError } = await supabase
      .from("relatio_import_jobs")
      .insert({
        tenant_id,
        connector_key,
        status: "queued",
        scope: scope || {},
        progress: { phase: "waiting", counts: {} },
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ job }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
