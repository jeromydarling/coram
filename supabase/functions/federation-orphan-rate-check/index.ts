/**
 * federation-orphan-rate-check — Attribution health monitor for federation events.
 *
 * WHAT: Counts orphaned vs. matched federation events over the last 24h and
 *       raises a Sentry warning if the orphan rate exceeds a healthy threshold.
 *       Also raises Sentry if orphan count itself is high in absolute terms.
 * WHERE: Invoked by pg_cron every 6 hours. Never called from the UI.
 * WHY:  Attribution can quietly break (bad cros_sid, schema drift, downstream
 *       hash mismatch) without any HTTP error surface. This is the only signal
 *       that catches "events are landing, but not on the right sends."
 *
 * verify_jwt = false (invoked internally with the apikey header by pg_cron).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { captureEdgeException, captureEdgeMessage } from "../_shared/sentryCapture.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Thresholds — tuned to avoid noise on low-volume days.
const MIN_TOTAL_FOR_RATE_ALERT = 10; // ignore rate if total < 10 events
const ORPHAN_RATE_THRESHOLD = 0.25; // warn when orphans / total > 25%
const ABSOLUTE_ORPHAN_ALERT = 25; // warn if >25 orphans in 24h regardless of rate

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Per-app breakdown so a single misbehaving app doesn't get lost in the average.
    const { data: apps } = await supabase
      .from("federation_apps")
      .select("slug, display_name");

    const perApp: Array<Record<string, unknown>> = [];
    let anyAlert = false;

    for (const app of apps ?? []) {
      const slug = (app as { slug: string }).slug;

      const { count: matched } = await supabase
        .from("gardener_tracked_events")
        .select("id", { count: "exact", head: true })
        .eq("federation_app_slug", slug)
        .in("event_type", ["signup", "customer"])
        .gte("occurred_at", since);

      const { count: orphans } = await supabase
        .from("gardener_federation_signup_orphans")
        .select("id", { count: "exact", head: true })
        .eq("federation_app_slug", slug)
        .gte("received_at", since);

      const matchedN = matched ?? 0;
      const orphansN = orphans ?? 0;
      const total = matchedN + orphansN;
      const rate = total > 0 ? orphansN / total : 0;

      const highRate = total >= MIN_TOTAL_FOR_RATE_ALERT && rate > ORPHAN_RATE_THRESHOLD;
      const highAbsolute = orphansN >= ABSOLUTE_ORPHAN_ALERT;
      const alert = highRate || highAbsolute;

      if (alert) {
        anyAlert = true;
        await captureEdgeMessage(
          `Federation attribution anomaly for ${slug}: ${orphansN} orphans / ${total} total (${Math.round(rate * 100)}%) in 24h`,
          "federation-orphan-rate-check",
          {
            level: "warning",
            tags: { app_slug: slug, kind: highAbsolute ? "absolute" : "rate" },
            fingerprint: ["federation-orphan-rate", slug],
            extra: {
              window_hours: 24,
              matched: matchedN,
              orphans: orphansN,
              total,
              orphan_rate: rate,
              threshold_rate: ORPHAN_RATE_THRESHOLD,
              threshold_absolute: ABSOLUTE_ORPHAN_ALERT,
            },
          },
        );
      }

      perApp.push({
        app_slug: slug,
        matched: matchedN,
        orphans: orphansN,
        total,
        orphan_rate: Number(rate.toFixed(3)),
        alert,
      });
    }

    return json({ ok: true, checked_at: new Date().toISOString(), any_alert: anyAlert, apps: perApp });
  } catch (e) {
    console.error("federation-orphan-rate-check error:", e);
    await captureEdgeException(e, "federation-orphan-rate-check");
    return json({ ok: false, error: "Server error" }, 500);
  }
});
