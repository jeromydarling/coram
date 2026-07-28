import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * system-health-check — Public health endpoint for external monitoring.
 *
 * WHAT: Returns DB connectivity status, timestamp, and version info.
 * WHERE: Called by uptime monitors (e.g., UptimeRobot, Pingdom).
 * WHY: Enterprise systems need externally-verifiable health signals.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const started = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // DB connectivity check — lightweight query
    const { error: dbError } = await adminClient
      .from("tenants")
      .select("id")
      .limit(1);

    const dbOk = !dbError;
    const durationMs = Date.now() - started;

    const health = {
      ok: dbOk,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      checks: {
        database: {
          ok: dbOk,
          latency_ms: durationMs,
          ...(dbError ? { error: dbError.message } : {}),
        },
      },
    };

    return new Response(JSON.stringify(health), {
      status: dbOk ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        timestamp: new Date().toISOString(),
        error: err.message,
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
