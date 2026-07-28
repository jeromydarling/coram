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

// ── Auth helper ──
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function authenticateServiceRequest(req: Request): boolean {
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  // Check Authorization: Bearer <SERVICE_ROLE_KEY> (internal edge-function-to-edge-function)
  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken === serviceRoleKey) return true;
  }

  // Check x-api-key or Bearer for shared secrets
  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();

  if (!token) return false;
  if (!enrichmentSecret && !sharedSecret) return false;

  return (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);
}

// ── Alert Rules ──
const ALERT_COOLDOWN_DAYS = 7;
const THRESHOLD_SCORE = 75;
const SPIKE_DELTA = 12;
const EVENT_THRESHOLD_SCORE = 60;

export interface AlertInput {
  opportunity_ids?: string[];
  organization_ids?: string[]; // backward compat
  force?: boolean;
}

export interface AlertResult {
  org_id: string;
  alert_type: string;
  intel_feed_created: boolean;
  next_action_created: boolean;
  notification_created: boolean;
}

export function validateInput(body: unknown): { valid: true; data: AlertInput } | { valid: false; error: string } {
  if (!body || typeof body !== "object") return { valid: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  // Accept either opportunity_ids or organization_ids (backward compat)
  const ids = b.opportunity_ids ?? b.organization_ids;
  if (ids !== undefined && !Array.isArray(ids)) {
    return { valid: false, error: "opportunity_ids must be an array of UUIDs" };
  }

  const data: AlertInput = { ...b as AlertInput };
  if (b.organization_ids && !b.opportunity_ids) {
    data.opportunity_ids = b.organization_ids as string[];
  }

  return { valid: true, data };
}

export function shouldAlert(
  momentum: {
    score: number;
    trend: string;
    score_delta: number;
    last_alerted_at: string | null;
    last_alert_score: number | null;
    drivers: Array<{ type: string; ts: string | null }>;
  },
  hasUpcomingEvent: boolean,
  force: boolean,
): { shouldAlert: boolean; alertType: string; reason: string } {
  const now = Date.now();
  const cooldownMs = ALERT_COOLDOWN_DAYS * 86400000;

  const lastAlerted = momentum.last_alerted_at ? new Date(momentum.last_alerted_at).getTime() : 0;
  const withinCooldown = lastAlerted > 0 && (now - lastAlerted) < cooldownMs;

  // Rule 1: Threshold crossing (bypasses cooldown)
  if (momentum.score >= THRESHOLD_SCORE && (momentum.last_alert_score === null || momentum.last_alert_score < THRESHOLD_SCORE)) {
    return { shouldAlert: true, alertType: "threshold_crossing", reason: `Score crossed ${THRESHOLD_SCORE} threshold (${momentum.score})` };
  }

  // Apply cooldown for remaining rules
  if (withinCooldown && !force) {
    return { shouldAlert: false, alertType: "", reason: "Within cooldown period" };
  }

  // Rule 2: Spike
  if (momentum.trend === "rising" && momentum.score_delta >= SPIKE_DELTA) {
    return { shouldAlert: true, alertType: "momentum_spike", reason: `Momentum spike: +${momentum.score_delta} points` };
  }

  // Rule 3: Upcoming event + good score
  if (momentum.score >= EVENT_THRESHOLD_SCORE && hasUpcomingEvent) {
    return { shouldAlert: true, alertType: "upcoming_event", reason: `Score ${momentum.score} with upcoming event` };
  }

  // Rule 4: Leadership change + good score
  const hasRecentLeadershipChange = momentum.drivers.some((d) => {
    if (d.type !== "leadership_change") return false;
    if (!d.ts) return false;
    return (now - new Date(d.ts).getTime()) / 86400000 < 14;
  });

  if (momentum.score >= EVENT_THRESHOLD_SCORE && hasRecentLeadershipChange) {
    return { shouldAlert: true, alertType: "leadership_change", reason: `Leadership change detected with score ${momentum.score}` };
  }

  return { shouldAlert: false, alertType: "", reason: "No alert rules triggered" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  if (!authenticateServiceRequest(req)) {
    return jsonError(401, "UNAUTHORIZED", "Missing or invalid service credentials");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const validation = validateInput(body);
  if (!validation.valid) return jsonError(400, "VALIDATION_ERROR", validation.error);

  const input = validation.data;
  const force = input.force === true;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Get momentum records to evaluate
  let query = supabase
    .from("relationship_momentum")
    .select("opportunity_id, score, trend, score_delta, last_alerted_at, last_alert_score, drivers")
    .gte("score", 50);

  if (input.opportunity_ids && input.opportunity_ids.length > 0) {
    query = query.in("opportunity_id", input.opportunity_ids);
  }

  const { data: momentumRecords, error: fetchErr } = await query.limit(200);
  if (fetchErr) return jsonError(500, "DB_ERROR", `Failed to fetch momentum: ${fetchErr.message}`);

  const results: AlertResult[] = [];
  const oppIds = (momentumRecords || []).map((m: { opportunity_id: string }) => m.opportunity_id);

  // Batch fetch upcoming events
  const { data: allUpcomingEvents } = await supabase
    .from("events")
    .select("host_opportunity_id, event_date")
    .in("host_opportunity_id", oppIds.length > 0 ? oppIds : ["00000000-0000-0000-0000-000000000000"])
    .gte("event_date", new Date().toISOString().slice(0, 10))
    .lte("event_date", new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));

  const upcomingByOpp = new Set(
    (allUpcomingEvents || []).map((e: { host_opportunity_id: string }) => e.host_opportunity_id),
  );

  // Batch fetch opportunity names
  const { data: oppNames } = await supabase
    .from("opportunities")
    .select("id, organization, owner_id")
    .in("id", oppIds.length > 0 ? oppIds : ["00000000-0000-0000-0000-000000000000"]);

  const oppMap = new Map(
    (oppNames || []).map((o: { id: string; organization: string; owner_id: string | null }) => [o.id, o]),
  );

  for (const momentum of (momentumRecords || [])) {
    const hasUpcomingEvent = upcomingByOpp.has(momentum.opportunity_id);
    const alertCheck = shouldAlert(
      {
        score: momentum.score,
        trend: momentum.trend,
        score_delta: momentum.score_delta,
        last_alerted_at: momentum.last_alerted_at,
        last_alert_score: momentum.last_alert_score,
        drivers: (momentum.drivers || []) as Array<{ type: string; ts: string | null }>,
      },
      hasUpcomingEvent,
      force,
    );

    if (!alertCheck.shouldAlert) continue;

    const opp = oppMap.get(momentum.opportunity_id);
    const orgName = opp?.organization || "Unknown Organization";
    const ownerId = opp?.owner_id;
    const topDrivers = ((momentum.drivers || []) as Array<{ label: string }>).slice(0, 3);
    const driverSummary = topDrivers.map((d) => d.label).join("; ");

    const result: AlertResult = {
      org_id: momentum.opportunity_id,
      alert_type: alertCheck.alertType,
      intel_feed_created: false,
      next_action_created: false,
      notification_created: false,
    };

    // A) Create intel_feed_item
    if (ownerId) {
      const { error: feedErr } = await supabase
        .from("intelligence_feed_items")
        .insert({
          user_id: ownerId,
          title: `Momentum ${alertCheck.alertType === "threshold_crossing" ? "breakthrough" : alertCheck.alertType === "momentum_spike" ? "spike" : alertCheck.alertType}: ${orgName}`,
          summary: `${alertCheck.reason}. Key drivers: ${driverSummary}`,
          priority_score: Math.round(momentum.score / 10),
        });
      result.intel_feed_created = !feedErr;
      if (feedErr) console.error("Intel feed insert error:", feedErr.message);
    }

    // B) Create next_best_action
    const actionType = momentum.score >= THRESHOLD_SCORE ? "strategic_outreach" : "follow_up";
    const { error: actionErr } = await supabase
      .from("org_next_actions")
      .insert({
        org_id: momentum.opportunity_id,
        user_id: ownerId || "00000000-0000-0000-0000-000000000000",
        source_type: "momentum_engine",
        source_id: momentum.opportunity_id,
        action_type: actionType,
        summary: `${actionType === "strategic_outreach" ? "Strategic outreach recommended" : "Follow-up recommended"}: ${orgName}`,
        reasoning: `${alertCheck.reason}. Top signals: ${driverSummary}`,
        severity: momentum.score >= THRESHOLD_SCORE ? 4 : 3,
        confidence: momentum.score / 100,
        score: momentum.score,
        status: "open",
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      });
    result.next_action_created = !actionErr;
    if (actionErr) console.error("Next action insert error:", actionErr.message);

    // C) Create proactive_notification
    if (ownerId) {
      const { error: notifErr } = await supabase
        .from("proactive_notifications")
        .insert({
          user_id: ownerId,
          org_id: momentum.opportunity_id,
          notification_type: alertCheck.alertType,
          payload: {
            score: momentum.score,
            trend: momentum.trend,
            score_delta: momentum.score_delta,
            top_drivers: topDrivers,
            reason: alertCheck.reason,
          },
        });
      result.notification_created = !notifErr;
      if (notifErr) console.error("Notification insert error:", notifErr.message);
    }

    // Update last_alerted_at
    await supabase
      .from("relationship_momentum")
      .update({
        last_alerted_at: new Date().toISOString(),
        last_alert_score: momentum.score,
      })
      .eq("opportunity_id", momentum.opportunity_id);

    results.push(result);
  }

  return jsonOk({
    ok: true,
    evaluated: (momentumRecords || []).length,
    alerts_created: results.length,
    results,
  });
});
