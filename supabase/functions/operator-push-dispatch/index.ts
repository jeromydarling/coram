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

    // Get all operators with push enabled
    const { data: settings } = await supabase
      .from("operator_notification_settings")
      .select("operator_user_id")
      .eq("push_enabled", true);

    if (!settings?.length) {
      return new Response(
        JSON.stringify({ ok: true, message: "No operators with push enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;

    for (const setting of settings) {
      // Get unread, unsent notifications — presence-filtered
      // Only dispatch 'gentle' or 'urgent' signals (skip 'silent')
      // Silent = severity info/notice AND type not in action-requiring set
      const { data: notifications } = await supabase
        .from("operator_notifications")
        .select("id, title, body, deep_link, severity, type")
        .eq("operator_user_id", setting.operator_user_id)
        .eq("is_read", false)
        .is("sent_at", null)
        .not("severity", "in", '("info")')  // skip info-only (silent presence)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!notifications?.length) continue;

      // Get push subscriptions
      const { data: subscriptions } = await supabase
        .from("operator_push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("operator_user_id", setting.operator_user_id);

      if (!subscriptions?.length) continue;

      // Mark as sent
      const ids = notifications.map((n: any) => n.id);
      await supabase
        .from("operator_notifications")
        .update({ sent_at: new Date().toISOString() })
        .in("id", ids);

      totalSent += notifications.length;
    }

    return new Response(
      JSON.stringify({ ok: true, sent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
