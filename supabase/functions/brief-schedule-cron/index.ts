/**
 * brief-schedule-cron — Daily cron that triggers Leadership Brief generation
 * for tenants whose brief_report_day matches today's day of week.
 *
 * WHAT: Checks each tenant's preferred report day and generates briefs.
 * WHERE: Scheduled via pg_cron to run daily at 6:00 AM UTC.
 * WHY: Tenants choose their own reporting cadence and day.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // What day is today? (0=Sunday..6=Saturday)
    const todayDow = new Date().getDay();

    // Find tenants whose report day is today
    const { data: tenants, error: tErr } = await supabase
      .from("tenants")
      .select("id, name, brief_report_day")
      .eq("brief_report_day", todayDow)
      .eq("status", "active");

    if (tErr) throw tErr;

    if (!tenants || tenants.length === 0) {
      return new Response(
        JSON.stringify({ message: `No tenants scheduled for day ${todayDow}`, triggered: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For each tenant, find users with leadership/admin roles and trigger generation
    const results: Array<{ tenant_id: string; tenant_name: string; users_triggered: number }> = [];

    for (const tenant of tenants) {
      const { data: tenantUsers } = await supabase
        .from("tenant_users")
        .select("user_id, role")
        .eq("tenant_id", tenant.id)
        .in("role", ["admin", "steward"]);

      if (!tenantUsers || tenantUsers.length === 0) continue;

      // Trigger report generation for the first admin/steward (report is tenant-scoped)
      const firstUser = tenantUsers[0];
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-weekly-report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ user_id: firstUser.user_id }),
          signal: AbortSignal.timeout(90000),
        });

        if (!response.ok) {
          console.error(`Brief generation failed for tenant ${tenant.name}:`, await response.text());
        }

        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          users_triggered: tenantUsers.length,
        });
      } catch (e) {
        console.error(`Brief generation error for tenant ${tenant.name}:`, e);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Brief schedule cron completed for day ${todayDow}`,
        triggered: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("brief-schedule-cron error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
