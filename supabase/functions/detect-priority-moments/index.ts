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

/**
 * detect-priority-moments
 *
 * Runs hourly via n8n cron.
 * Detects spikes:
 *   1. Multiple grants in same metro within 48h
 *   2. Org appearing in events + grants + people searches within 48h
 *   3. New org enrichment with strong neighborhood need score
 *
 * When detected: inserts high-confidence strategic_outreach action.
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

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  else if (apiKeyHeader) token = apiKeyHeader.trim();

  const isWorker =
    (workerSecret && token === workerSecret) ||
    (scheduleSecret && token === scheduleSecret);

  if (!isWorker) {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return jsonError(401, "UNAUTHORIZED", "Invalid auth");
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  // Fetch recent signals (48h window)
  const { data: signals } = await admin
    .from("opportunity_signals")
    .select("id, source_type, signal_reason, confidence, organization_id, metro_id, created_at")
    .gte("created_at", fortyEightHoursAgo)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!signals || signals.length === 0) {
    return jsonOk({ ok: true, moments_detected: 0, message: "No recent signals" });
  }

  interface MomentCandidate {
    org_id: string;
    action_type: string;
    summary: string;
    reasoning: string;
    confidence: number;
    severity: number;
    score: number;
    source_id: string;
  }

  const moments: MomentCandidate[] = [];

  // === Spike 1: Multiple grants in same metro ===
  const grantsByMetro: Record<string, typeof signals> = {};
  for (const s of signals) {
    if (s.source_type === "grant" && s.metro_id) {
      if (!grantsByMetro[s.metro_id]) grantsByMetro[s.metro_id] = [];
      grantsByMetro[s.metro_id].push(s);
    }
  }

  for (const [metroId, metroGrants] of Object.entries(grantsByMetro)) {
    if (metroGrants.length >= 3) {
      // Get org IDs from these grants
      const orgIds = [...new Set(metroGrants.map((g) => g.organization_id).filter(Boolean))];
      for (const orgId of orgIds) {
        if (!orgId) continue;
        moments.push({
          org_id: orgId,
          action_type: "strategic_outreach",
          summary: `Grant cluster detected: ${metroGrants.length} grants in same metro within 48h`,
          reasoning: `${metroGrants.length} grant signals detected in metro ${metroId} within 48 hours. Signals: ${metroGrants.slice(0, 3).map((g) => g.signal_reason).join("; ")}. This concentration indicates heightened funding activity — prioritize outreach now.`,
          confidence: 0.85,
          severity: 5,
          score: metroGrants.length * 8,
          source_id: metroGrants[0].id,
        });
      }
    }
  }

  // === Spike 2: Org appearing across multiple signal types within 48h ===
  const signalsByOrg: Record<string, Set<string>> = {};
  const signalDetailsByOrg: Record<string, typeof signals> = {};
  for (const s of signals) {
    if (!s.organization_id) continue;
    if (!signalsByOrg[s.organization_id]) {
      signalsByOrg[s.organization_id] = new Set();
      signalDetailsByOrg[s.organization_id] = [];
    }
    signalsByOrg[s.organization_id].add(s.source_type);
    signalDetailsByOrg[s.organization_id].push(s);
  }

  for (const [orgId, types] of Object.entries(signalsByOrg)) {
    if (types.size >= 3) {
      const typeList = [...types].join(", ");
      const details = signalDetailsByOrg[orgId];
      moments.push({
        org_id: orgId,
        action_type: "strategic_outreach",
        summary: `Multi-signal convergence: org appeared in ${typeList} within 48h`,
        reasoning: `Organization detected across ${types.size} signal types (${typeList}) within 48 hours. This convergence pattern strongly indicates heightened activity. Signals: ${details.slice(0, 4).map((d) => d.signal_reason).join("; ")}.`,
        confidence: 0.9,
        severity: 5,
        score: types.size * 10,
        source_id: details[0].id,
      });
    }
  }

  // === Spike 3: Enrichment with strong neighborhood need score ===
  const { data: recentEnrichments } = await admin
    .from("org_knowledge_snapshots")
    .select("org_id, neighborhood_need_score, updated_at")
    .gte("updated_at", fortyEightHoursAgo)
    .gte("neighborhood_need_score", 70)
    .order("neighborhood_need_score", { ascending: false })
    .limit(20);

  for (const enrichment of (recentEnrichments || [])) {
    moments.push({
      org_id: enrichment.org_id,
      action_type: "strategic_outreach",
      summary: `High neighborhood need score (${enrichment.neighborhood_need_score}) detected`,
      reasoning: `Organization was recently enriched and has a neighborhood need score of ${enrichment.neighborhood_need_score}/100. High scores indicate strong alignment with PCs for People's mission — prioritize outreach.`,
      confidence: 0.8,
      severity: 4,
      score: (enrichment.neighborhood_need_score / 100) * 20,
      source_id: enrichment.org_id,
    });
  }

  // Upsert moments
  let created = 0;
  for (const m of moments) {
    const { error } = await admin
      .from("org_next_actions")
      .upsert(
        {
          org_id: m.org_id,
          contact_id: null,
          source_type: "priority_moment",
          source_id: m.source_id,
          action_type: m.action_type,
          summary: m.summary,
          reasoning: m.reasoning,
          severity: m.severity,
          confidence: m.confidence,
          score: m.score,
          status: "open",
          expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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
      console.error("Priority moment upsert error:", error.message);
    }
  }

  return jsonOk({
    ok: true,
    signals_scanned: signals.length,
    moments_detected: moments.length,
    actions_created: created,
  });
});
