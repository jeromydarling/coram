import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * check-admin-alerts
 * Scheduled edge function (every 15 min) that checks 5 operational conditions
 * and sends T1 push notifications to admin/leadership users.
 *
 * Alert types:
 * 1. Gmail Send Quota Warning — daily sent count hits soft cap (500)
 * 2. Stale Enrichment Jobs — stuck in 'leased' for >15 min
 * 3. Search Run Failure Spike — >3 failed search_runs in 1 hour
 * 4. Watchlist Budget Exhausted — daily crawl count hits 50/50
 * 5. Campaign Delivery Health — campaign finishes with >20% failure rate
 */

interface AlertResult {
  type: string;
  fired: boolean;
  detail?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    // Auth: accept anon key (cron) or valid user JWT
    const token = authHeader.replace("Bearer ", "");
    if (token !== SUPABASE_ANON_KEY && token !== SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || "", {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !claims.user) {
        return new Response(JSON.stringify({ error: "Invalid authentication" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const alerts: AlertResult[] = [];
    let pushesSent = 0;

    // ── Get admin/leadership users for notifications ──
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "leadership"]);
    const adminUserIds = [...new Set((adminRoles || []).map((r) => r.user_id))];

    if (adminUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No admin/leadership users", alerts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Helper: send push to all admins with dedup ──
    async function sendAdminAlert(
      alertType: string,
      title: string,
      body: string,
      deepLink: string,
      refId: string
    ) {
      for (const userId of adminUserIds) {
        // Dedup: check if we already sent this alert type in last 30 min
        const { data: existing } = await supabase
          .from("user_alerts")
          .select("id")
          .eq("user_id", userId)
          .eq("ref_type", alertType)
          .eq("ref_id", refId)
          .is("read_at", null)
          .limit(1);

        if (existing && existing.length > 0) continue;

        // Create in-app alert
        await supabase.from("user_alerts").insert({
          user_id: userId,
          alert_type: "operational",
          ref_type: alertType,
          ref_id: refId,
          message: `${title}: ${body}`,
          deep_link: deepLink,
        });

        // Send push
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/profunda-notify`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mode: "send-notification",
              userId,
              title,
              body,
              data: { url: deepLink },
            }),
          });
          pushesSent++;
        } catch (e) {
          console.error(`[check-admin-alerts] Push failed for ${userId}:`, e);
        }
      }
    }

    // ════════════════════════════════════════════
    // 1. GMAIL SEND QUOTA WARNING
    // ════════════════════════════════════════════
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: campaignStats } = await supabase
        .from("email_campaign_audience")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("sent_at", todayStart.toISOString());

      const sentToday = campaignStats?.length ?? 0;
      // Use the actual count from the response
      const { count: sentCount } = await supabase
        .from("email_campaign_audience")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("sent_at", todayStart.toISOString());

      const SOFT_CAP = 500;
      if ((sentCount ?? 0) >= SOFT_CAP) {
        const dateKey = todayStart.toISOString().slice(0, 10);
        await sendAdminAlert(
          "gmail_quota_warning",
          "📧 Gmail Send Quota Warning",
          `${sentCount} emails sent today — approaching daily limit (${SOFT_CAP} soft cap)`,
          "/campaigns",
          `gmail_quota_${dateKey}`
        );
        alerts.push({ type: "gmail_quota_warning", fired: true, detail: `${sentCount} sent today` });
      } else {
        alerts.push({ type: "gmail_quota_warning", fired: false });
      }
    } catch (e) {
      console.error("[check-admin-alerts] Gmail quota check error:", e);
      alerts.push({ type: "gmail_quota_warning", fired: false, detail: "check error" });
    }

    // ════════════════════════════════════════════
    // 2. STALE ENRICHMENT JOBS
    // ════════════════════════════════════════════
    try {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: staleJobs } = await supabase
        .from("enrichment_jobs")
        .select("id, run_id, entity_type, entity_id, leased_by")
        .eq("status", "leased")
        .lt("lease_expires_at", fifteenMinAgo)
        .limit(10);

      if (staleJobs && staleJobs.length > 0) {
        await sendAdminAlert(
          "stale_enrichment_job",
          "⏳ Stale Enrichment Jobs",
          `${staleJobs.length} enrichment job${staleJobs.length > 1 ? "s" : ""} stuck in leased state >15 min`,
          "/admin/automations",
          `stale_enrich_${new Date().toISOString().slice(0, 13)}` // hourly dedup
        );
        alerts.push({ type: "stale_enrichment_job", fired: true, detail: `${staleJobs.length} stale` });
      } else {
        alerts.push({ type: "stale_enrichment_job", fired: false });
      }
    } catch (e) {
      console.error("[check-admin-alerts] Stale enrichment check error:", e);
      alerts.push({ type: "stale_enrichment_job", fired: false, detail: "check error" });
    }

    // ════════════════════════════════════════════
    // 3. SEARCH RUN FAILURE SPIKE
    // ════════════════════════════════════════════
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: failedCount } = await supabase
        .from("search_runs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", oneHourAgo);

      const FAILURE_THRESHOLD = 3;
      if ((failedCount ?? 0) > FAILURE_THRESHOLD) {
        await sendAdminAlert(
          "search_failure_spike",
          "🔍 Search Failure Spike",
          `${failedCount} search runs failed in the last hour — possible Perplexity or n8n connectivity issue`,
          "/admin/automations",
          `search_fail_${new Date().toISOString().slice(0, 13)}` // hourly dedup
        );
        alerts.push({ type: "search_failure_spike", fired: true, detail: `${failedCount} failed` });
      } else {
        alerts.push({ type: "search_failure_spike", fired: false });
      }
    } catch (e) {
      console.error("[check-admin-alerts] Search failure check error:", e);
      alerts.push({ type: "search_failure_spike", fired: false, detail: "check error" });
    }

    // ════════════════════════════════════════════
    // 4. WATCHLIST BUDGET EXHAUSTED
    // ════════════════════════════════════════════
    try {
      const todayStart2 = new Date();
      todayStart2.setHours(0, 0, 0, 0);

      const { count: crawlCount } = await supabase
        .from("automation_runs")
        .select("id", { count: "exact", head: true })
        .eq("workflow_key", "watchlist_ingest")
        .gte("created_at", todayStart2.toISOString())
        .neq("status", "error");

      const DAILY_CAP = 50;
      if ((crawlCount ?? 0) >= DAILY_CAP) {
        const dateKey = todayStart2.toISOString().slice(0, 10);
        await sendAdminAlert(
          "watchlist_budget_exhausted",
          "📊 Watchlist Budget Exhausted",
          `All ${DAILY_CAP} daily search slots used — remaining orgs won't be checked today`,
          "/operator/system",
          `watchlist_budget_${dateKey}`
        );
        alerts.push({ type: "watchlist_budget_exhausted", fired: true, detail: `${crawlCount}/${DAILY_CAP}` });
      } else {
        alerts.push({ type: "watchlist_budget_exhausted", fired: false });
      }
    } catch (e) {
      console.error("[check-admin-alerts] Watchlist budget check error:", e);
      alerts.push({ type: "watchlist_budget_exhausted", fired: false, detail: "check error" });
    }

    // ════════════════════════════════════════════
    // 5. CAMPAIGN DELIVERY HEALTH
    // ════════════════════════════════════════════
    try {
      // Find campaigns that completed (status = 'sent') in the last 30 min
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recentCampaigns } = await supabase
        .from("email_campaigns")
        .select("id, name, sent_count, failed_count, audience_count")
        .eq("status", "sent")
        .gte("last_sent_at", thirtyMinAgo)
        .gt("audience_count", 0);

      if (recentCampaigns && recentCampaigns.length > 0) {
        for (const campaign of recentCampaigns) {
          const total = campaign.sent_count + campaign.failed_count;
          if (total === 0) continue;
          const failureRate = campaign.failed_count / total;

          if (failureRate > 0.2) {
            const pct = Math.round(failureRate * 100);
            await sendAdminAlert(
              "campaign_delivery_health",
              "📧 Campaign Delivery Issue",
              `"${campaign.name}" finished with ${pct}% failure rate (${campaign.failed_count} of ${total} failed)`,
              `/campaigns/${campaign.id}`,
              `campaign_health_${campaign.id}`
            );
            alerts.push({
              type: "campaign_delivery_health",
              fired: true,
              detail: `${campaign.name}: ${pct}% failure`,
            });
          }
        }

        if (!alerts.some((a) => a.type === "campaign_delivery_health")) {
          alerts.push({ type: "campaign_delivery_health", fired: false });
        }
      } else {
        alerts.push({ type: "campaign_delivery_health", fired: false });
      }
    } catch (e) {
      console.error("[check-admin-alerts] Campaign health check error:", e);
      alerts.push({ type: "campaign_delivery_health", fired: false, detail: "check error" });
    }

    console.log(`[check-admin-alerts] Complete: ${alerts.filter((a) => a.fired).length} alerts fired, ${pushesSent} pushes sent`);

    return new Response(
      JSON.stringify({
        success: true,
        alerts,
        pushes_sent: pushesSent,
        admin_user_count: adminUserIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[check-admin-alerts] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
