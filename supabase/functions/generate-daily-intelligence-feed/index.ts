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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST accepted");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";
  const workerSecret = Deno.env.get("N8N_SHARED_SECRET") ?? "";

  let token = "";
  if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  else if (apiKeyHeader) token = apiKeyHeader.trim();

  const isWorker = workerSecret && token === workerSecret;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body ok for cron */ }

  // Determine target user(s)
  let userIds: string[] = [];

  if (body.user_id) {
    userIds = [body.user_id as string];
  } else if (isWorker) {
    // Cron mode: generate for all active users with signals
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: activeUsers } = await admin
      .from("opportunity_signals")
      .select("user_id")
      .gte("created_at", sevenDaysAgo);

    if (activeUsers) {
      userIds = [...new Set(activeUsers.map((r: { user_id: string }) => r.user_id))];
    }
  } else {
    // User JWT mode
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return jsonError(401, "UNAUTHORIZED", "Invalid auth");
    userIds = [user.id];
  }

  if (userIds.length === 0) {
    return jsonOk({ ok: true, message: "No users with signals", feed_items_created: 0 });
  }

  let totalCreated = 0;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const uid of userIds) {
    // Get recent signals for this user
    const { data: signals } = await admin
      .from("opportunity_signals")
      .select("id, source_type, signal_reason, confidence, organization_id, created_at")
      .eq("user_id", uid)
      .gte("created_at", sevenDaysAgo)
      .order("confidence", { ascending: false })
      .limit(50);

    if (!signals || signals.length === 0) continue;

    // Group by source_type for summary generation
    const byType: Record<string, typeof signals> = {};
    for (const s of signals) {
      if (!byType[s.source_type]) byType[s.source_type] = [];
      byType[s.source_type].push(s);
    }

    const feedItems: {
      user_id: string;
      signal_id: string;
      title: string;
      summary: string;
      priority_score: number;
    }[] = [];

    // Generate grouped feed items
    for (const [type, typeSignals] of Object.entries(byType)) {
      const topSignal = typeSignals[0];
      const count = typeSignals.length;
      const avgConfidence = typeSignals.reduce((acc, s) => acc + (s.confidence || 0), 0) / count;

      const typeLabels: Record<string, string> = {
        grant: "Grant Opportunities",
        event: "Events",
        person: "People",
        neighborhood: "Neighborhood Updates",
        org_update: "Organization Updates",
      };

      feedItems.push({
        user_id: uid,
        signal_id: topSignal.id,
        title: `${count} new ${typeLabels[type] || type} signal${count > 1 ? "s" : ""} detected`,
        summary: count > 1
          ? `${count} ${type} signals found this week with avg confidence ${(avgConfidence * 100).toFixed(0)}%. Top: ${topSignal.signal_reason}`
          : topSignal.signal_reason,
        priority_score: avgConfidence * count * 10,
      });
    }

    if (feedItems.length > 0) {
      const { error: insertErr } = await admin
        .from("intelligence_feed_items")
        .insert(feedItems);

      if (!insertErr) {
        totalCreated += feedItems.length;

        // Phase 2.5: Auto-insert next_best_actions for high-priority feed items
        for (const fi of feedItems) {
          if (fi.priority_score >= 12) {
            await admin.from("org_next_actions").upsert(
              {
                user_id: fi.user_id,
                source_type: "signal",
                source_id: fi.signal_id,
                action_type: "follow_up",
                summary: fi.title,
                reasoning: `Intelligence feed: ${fi.summary}. Priority score ${fi.priority_score.toFixed(1)} exceeds threshold.`,
                severity: fi.priority_score >= 20 ? 5 : 4,
                confidence: Math.min(fi.priority_score / 30, 1),
                score: fi.priority_score,
                status: "open",
                expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                last_evaluated_at: new Date().toISOString(),
              },
              { onConflict: "COALESCE(contact_id, org_id),action_type", ignoreDuplicates: true },
            ).then(() => {});
          }
        }
      } else {
        console.error("Feed insert error:", insertErr.message);
      }
    }
  }

  return jsonOk({ ok: true, users_processed: userIds.length, feed_items_created: totalCreated });
});
