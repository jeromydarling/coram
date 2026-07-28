import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

interface Signal {
  id: string;
  source_type: string;
  signal_reason: string;
  confidence: number;
  organization_id: string | null;
  contact_id: string | null;
  created_at: string;
}

interface Edge {
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  edge_reason: string;
}

interface FeedItem {
  id: string;
  signal_id: string;
  priority_score: number;
  title: string;
  summary: string;
}

interface ActionCandidate {
  org_id: string;
  contact_id: string | null;
  action_type: string;
  summary: string;
  reasoning: string;
  confidence: number;
  severity: number;
  score: number;
  source_type: string;
  source_id: string;
}

/**
 * generate-next-best-actions
 *
 * Deterministic NBA engine — NO AI, NO hallucination.
 * All reasoning is assembled from stored data.
 *
 * Rules:
 * 1. New grant + org exists + no outreach last 30d → grant_followup
 * 2. New person added + org enriched → email_intro
 * 3. Event discovered + org already exists → event_outreach
 * 4. Priority score increased >20% → follow_up
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST accepted");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const workerSecret = Deno.env.get("N8N_SHARED_SECRET") ?? "";
  const scheduleSecret = Deno.env.get("N8N_SCHEDULE_SECRET") ?? "";

  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  else if (apiKeyHeader) token = apiKeyHeader.trim();

  const isWorker = (workerSecret && token === workerSecret) || (scheduleSecret && token === scheduleSecret);

  if (!isWorker) {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return jsonError(401, "UNAUTHORIZED", "Invalid auth");
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Reactivate snoozed + dismiss expired before generating
  await admin.rpc("reactivate_snoozed_actions");
  await admin.rpc("dismiss_expired_actions");

  // Fetch recent signals (last 7 days)
  const { data: signals } = await admin
    .from("opportunity_signals")
    .select("id, source_type, signal_reason, confidence, organization_id, contact_id, created_at")
    .gte("created_at", sevenDaysAgo)
    .order("confidence", { ascending: false })
    .limit(200);

  if (!signals || signals.length === 0) {
    return jsonOk({ ok: true, actions_created: 0, message: "No recent signals" });
  }

  // Fetch relationship edges for context
  const { data: edges } = await admin
    .from("relationship_edges")
    .select("source_type, source_id, target_type, target_id, edge_reason")
    .limit(500);

  // Fetch recent intelligence feed items
  const { data: feedItems } = await admin
    .from("intelligence_feed_items")
    .select("id, signal_id, priority_score, title, summary")
    .gte("created_at", sevenDaysAgo)
    .order("priority_score", { ascending: false })
    .limit(100);

  // Fetch orgs with recent outreach (to detect "no outreach last 30 days")
  const { data: recentCampaigns } = await admin
    .from("email_campaign_audience")
    .select("opportunity_id")
    .gte("created_at", thirtyDaysAgo)
    .not("opportunity_id", "is", null);

  const recentlyOutreachedOrgIds = new Set(
    (recentCampaigns || []).map((c: { opportunity_id: string }) => c.opportunity_id),
  );

  // Fetch enriched orgs
  const { data: enrichedOrgs } = await admin
    .from("org_knowledge_snapshots")
    .select("org_id")
    .limit(1000);

  const enrichedOrgIds = new Set(
    (enrichedOrgs || []).map((o: { org_id: string }) => o.org_id),
  );

  // Build action candidates
  const candidates: ActionCandidate[] = [];

  for (const signal of signals as Signal[]) {
    const orgId = signal.organization_id;
    if (!orgId) continue;

    // Find related edges for reasoning context
    const relatedEdges = (edges || []).filter(
      (e: Edge) => e.source_id === orgId || e.target_id === orgId,
    );
    const edgeContext = relatedEdges.length > 0
      ? ` Related: ${relatedEdges.slice(0, 3).map((e: Edge) => e.edge_reason).join("; ")}.`
      : "";

    // Find related feed items
    const relatedFeed = (feedItems || []).filter(
      (f: FeedItem) => f.signal_id === signal.id,
    );
    const feedContext = relatedFeed.length > 0
      ? ` Feed: ${relatedFeed[0].title}.`
      : "";

    // Rule 1: Grant signal + org exists + no recent outreach → grant_followup
    if (signal.source_type === "grant" && !recentlyOutreachedOrgIds.has(orgId)) {
      candidates.push({
        org_id: orgId,
        contact_id: signal.contact_id || null,
        action_type: "grant_followup",
        summary: `Grant opportunity detected for org — no outreach in 30 days`,
        reasoning: `Signal: ${signal.signal_reason}. No campaign sent to this org in the last 30 days.${edgeContext}${feedContext}`,
        confidence: signal.confidence || 0.7,
        severity: 4,
        score: (signal.confidence || 0.7) * 20,
        source_type: "signal",
        source_id: signal.id,
      });
    }

    // Rule 2: New person + org enriched → email_intro
    if (signal.source_type === "person" && enrichedOrgIds.has(orgId)) {
      candidates.push({
        org_id: orgId,
        contact_id: signal.contact_id || null,
        action_type: "email_intro",
        summary: `New contact found at enriched org — intro opportunity`,
        reasoning: `Signal: ${signal.signal_reason}. Org has been enriched with knowledge data.${edgeContext}${feedContext}`,
        confidence: signal.confidence || 0.6,
        severity: 3,
        score: (signal.confidence || 0.6) * 15,
        source_type: "signal",
        source_id: signal.id,
      });
    }

    // Rule 3: Event discovered + org exists → event_outreach
    if (signal.source_type === "event") {
      candidates.push({
        org_id: orgId,
        contact_id: signal.contact_id || null,
        action_type: "event_outreach",
        summary: `Event discovered connected to org — outreach opportunity`,
        reasoning: `Signal: ${signal.signal_reason}. Event may be an engagement opportunity.${edgeContext}${feedContext}`,
        confidence: signal.confidence || 0.65,
        severity: 3,
        score: (signal.confidence || 0.65) * 15,
        source_type: "signal",
        source_id: signal.id,
      });
    }

    // Rule 4: High confidence signal → follow_up
    if (signal.confidence >= 0.8) {
      candidates.push({
        org_id: orgId,
        contact_id: signal.contact_id || null,
        action_type: "follow_up",
        summary: `High-confidence signal — follow up to capitalize on momentum`,
        reasoning: `Signal: ${signal.signal_reason} (confidence: ${(signal.confidence * 100).toFixed(0)}%).${edgeContext}${feedContext}`,
        confidence: signal.confidence,
        severity: signal.confidence >= 0.9 ? 5 : 4,
        score: signal.confidence * 25,
        source_type: "signal",
        source_id: signal.id,
      });
    }
  }

  // Upsert candidates (dedup via unique constraint)
  let created = 0;
  for (const c of candidates) {
    const { error } = await admin
      .from("org_next_actions")
      .upsert(
        {
          org_id: c.org_id,
          contact_id: c.contact_id,
          source_type: c.source_type,
          source_id: c.source_id,
          action_type: c.action_type,
          summary: c.summary,
          reasoning: c.reasoning,
          severity: c.severity,
          confidence: c.confidence,
          score: c.score,
          status: "open",
          expires_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          last_evaluated_at: now.toISOString(),
        },
        {
          onConflict: "COALESCE(contact_id, org_id),action_type",
          ignoreDuplicates: true,
        },
      );

    if (!error) {
      created++;
    } else if (error.code !== "23505") {
      console.error("NBA upsert error:", error.message);
    }
  }

  // Emit notification for high-score actions
  const internalNotifyKey = Deno.env.get("INTERNAL_NOTIFY_KEY") ?? "";
  const highScoreActions = candidates.filter((c) => c.score >= 12);

  for (const action of highScoreActions.slice(0, 5)) {
    try {
      // Insert user_alert for all users (broadcast via notification system)
      await fetch(`${supabaseUrl}/functions/v1/notification-dispatcher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "x-internal-key": internalNotifyKey,
        },
        body: JSON.stringify({
          mode: "emit",
          event_type: "next_best_action",
          fingerprint: `nba_${action.source_id}_${action.action_type}`,
          title: `⚡ ${action.summary}`,
          body: action.reasoning.slice(0, 200),
          deep_link: `/organizations/${action.org_id}`,
          priority: action.score >= 20 ? "high" : "normal",
          user_id: null,
          metadata: { action_type: action.action_type, score: action.score },
          tier: "T2",
          bundle_key: `nba_batch_${now.toISOString().slice(0, 13)}`,
        }),
      }).then((r) => r.text());
    } catch {
      // Non-blocking
    }
  }

  return jsonOk({
    ok: true,
    signals_evaluated: signals.length,
    candidates_generated: candidates.length,
    actions_created: created,
    high_score_alerts: highScoreActions.length,
  });
});
