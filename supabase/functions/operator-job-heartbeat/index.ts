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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Accept service-role or admin JWT
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await anonClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { job_key, tenant_id, status, stats, error: errPayload } = body;

    if (!job_key || !status) {
      return new Response(JSON.stringify({ error: "job_key and status required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["ok", "warning", "error"].includes(status)) {
      return new Response(JSON.stringify({ error: "Invalid status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      tenant_id: tenant_id || null,
      job_key,
      cadence: body.cadence || "daily",
      last_run_at: now,
      last_status: status,
      last_stats: stats || {},
      last_error: status === "error" ? (errPayload || { message: "Unknown error" }) : null,
    };

    if (status === "ok") {
      updatePayload.last_ok_at = now;
    }

    // Upsert - for global jobs (tenant_id IS NULL), use the unique index
    const { error: upsertErr } = await svc
      .from("operator_job_health")
      .upsert(updatePayload, { onConflict: "tenant_id,job_key" });

    if (upsertErr) throw upsertErr;

    // Also log to system_health_events
    await svc.from("system_health_events").insert({
      schedule_key: job_key,
      tenant_id: tenant_id || null,
      status,
      stats: stats || {},
      error: status === "error" ? errPayload : null,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
