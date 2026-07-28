import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get operators with email enabled
    const { data: settings } = await supabase
      .from("operator_notification_settings")
      .select("operator_user_id, daily_digest_time, timezone")
      .eq("email_enabled", true);

    if (!settings?.length) {
      return new Response(
        JSON.stringify({ ok: true, message: "No operators with email digest enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let digestsSent = 0;

    for (const setting of settings) {
      // Get unread notifications from last 24h — presence-filtered
      // Only include 'gentle' or 'urgent' signals (severity != 'info')
      const { data: notifications } = await supabase
        .from("operator_notifications")
        .select("type, severity, title, body, deep_link, created_at")
        .eq("operator_user_id", setting.operator_user_id)
        .eq("is_read", false)
        .not("severity", "in", '("info")')  // skip silent-presence signals
        .gte("created_at", new Date(Date.now() - 86400000).toISOString())
        .order("created_at", { ascending: false });

      if (!notifications?.length) continue;

      // Group by type
      const grouped: Record<string, number> = {};
      for (const n of notifications) {
        grouped[n.type] = (grouped[n.type] || 0) + 1;
      }

      // Build calm digest summary
      const summaryParts: string[] = [];
      if (grouped.draft_ready) summaryParts.push(`${grouped.draft_ready} draft${grouped.draft_ready > 1 ? 's' : ''} ready for review`);
      if (grouped.critical_error || grouped.error_spike) summaryParts.push(`${(grouped.critical_error || 0) + (grouped.error_spike || 0)} error signal${((grouped.critical_error || 0) + (grouped.error_spike || 0)) > 1 ? 's' : ''}`);
      if (grouped.qa_failure) summaryParts.push(`${grouped.qa_failure} QA issue${grouped.qa_failure > 1 ? 's' : ''}`);
      if (grouped.activation_stuck) summaryParts.push(`${grouped.activation_stuck} activation${grouped.activation_stuck > 1 ? 's' : ''} need presence`);
      if (grouped.migration_failed) summaryParts.push(`${grouped.migration_failed} migration${grouped.migration_failed > 1 ? 's' : ''} need attention`);

      // Store digest record (actual email sending via n8n or external service)
      console.log(`Digest for operator ${setting.operator_user_id}: ${summaryParts.join(', ')}`);
      digestsSent++;
    }

    return new Response(
      JSON.stringify({ ok: true, digests_prepared: digestsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
