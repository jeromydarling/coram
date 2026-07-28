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

// ── Weight constants ──
const WEIGHTS = {
  SIGNALS_MAX: 40,
  GRAPH_MAX: 25,
  FIT_MAX: 20,
  RECENCY_MAX: 15,
} as const;

// Signal type importance
const SIGNAL_WEIGHTS: Record<string, number> = {
  leadership_change: 8,
  expansion: 7,
  funding: 7,
  partnership: 6,
  hiring: 5,
  event_attendance: 4,
  grant_alignment: 6,
  info: 2,
};

const DEFAULT_SIGNAL_WEIGHT = 3;

// Edge type caps
const EDGE_CAPS: Record<string, number> = {
  person: 8,
  contact: 8,
  organization: 6,
  grant: 5,
  event: 5,
  campaign: 3,
};

const DEFAULT_EDGE_CAP = 4;

// ── Interfaces ──
export interface MomentumInput {
  organization_id?: string; // kept for backward compat; treated as opportunity_id
  opportunity_id?: string;
  mode?: "single" | "batch";
  windows?: { signals_days?: number; edges_days?: number };
}

export interface Driver {
  type: string;
  label: string;
  evidence_url: string | null;
  evidence_snippet: string | null;
  weight: number;
  ts: string | null;
}

export interface ComputedMomentum {
  opportunity_id: string;
  score: number;
  trend: string;
  score_delta: number;
  drivers: Driver[];
}

export function validateInput(body: unknown): { valid: true; data: MomentumInput } | { valid: false; error: string } {
  if (!body || typeof body !== "object") return { valid: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  // Accept either opportunity_id or organization_id (backward compat)
  const oppId = b.opportunity_id ?? b.organization_id;
  if (oppId !== undefined && (typeof oppId !== "string" || !oppId)) {
    return { valid: false, error: "opportunity_id must be a non-empty string UUID" };
  }

  if (b.mode !== undefined && b.mode !== "single" && b.mode !== "batch") {
    return { valid: false, error: "mode must be 'single' or 'batch'" };
  }

  // Normalize to opportunity_id
  const data: MomentumInput = { ...b as MomentumInput };
  if (b.organization_id && !b.opportunity_id) {
    data.opportunity_id = b.organization_id as string;
  }

  return { valid: true, data };
}

export function computeTrend(scoreDelta: number): string {
  if (scoreDelta >= 8) return "rising";
  if (scoreDelta <= -8) return "falling";
  return "stable";
}

export function computeSignalScore(
  signals: Array<{ signal_type: string; confidence: number | null; source_url: string | null; signal_value: string | null; detected_at: string | null }>,
  windowDays: number,
): { score: number; drivers: Driver[] } {
  const now = Date.now();
  const cutoff = now - windowDays * 86400000;
  const drivers: Driver[] = [];
  let rawScore = 0;

  for (const sig of signals) {
    const sigTime = sig.detected_at ? new Date(sig.detected_at).getTime() : now;
    if (sigTime < cutoff) continue;

    const baseWeight = SIGNAL_WEIGHTS[sig.signal_type] ?? DEFAULT_SIGNAL_WEIGHT;
    const confidence = typeof sig.confidence === "number" ? Math.min(1, Math.max(0, sig.confidence)) : 0.5;

    // Time decay: more recent = higher weight
    const daysSince = Math.max(0, (now - sigTime) / 86400000);
    const decay = Math.max(0.2, Math.exp(-daysSince / 30));

    const points = baseWeight * confidence * decay;
    rawScore += points;

    drivers.push({
      type: sig.signal_type,
      label: sig.signal_value || sig.signal_type,
      evidence_url: sig.source_url || null,
      evidence_snippet: sig.signal_value ? sig.signal_value.slice(0, 200) : null,
      weight: Math.round(points * 10) / 10,
      ts: sig.detected_at || null,
    });
  }

  // Normalize to 0..SIGNALS_MAX
  const score = Math.min(WEIGHTS.SIGNALS_MAX, Math.round((rawScore / 20) * WEIGHTS.SIGNALS_MAX));
  return { score, drivers };
}

export function computeGraphScore(
  edges: Array<{ source_type: string; target_type: string; edge_reason: string | null }>,
): { score: number; drivers: Driver[] } {
  const drivers: Driver[] = [];
  const typeCounts: Record<string, number> = {};

  for (const edge of edges) {
    const edgeType = edge.target_type || edge.source_type;
    typeCounts[edgeType] = (typeCounts[edgeType] || 0) + 1;
  }

  let rawScore = 0;
  for (const [type, count] of Object.entries(typeCounts)) {
    const cap = EDGE_CAPS[type] ?? DEFAULT_EDGE_CAP;
    const capped = Math.min(count, cap);
    rawScore += capped;

    if (capped > 0) {
      drivers.push({
        type: "graph_" + type,
        label: `${capped} ${type} connections`,
        evidence_url: null,
        evidence_snippet: null,
        weight: capped,
        ts: null,
      });
    }
  }

  const score = Math.min(WEIGHTS.GRAPH_MAX, Math.round((rawScore / 20) * WEIGHTS.GRAPH_MAX));
  return { score, drivers };
}

export function computeFitScore(
  org: { partner_tiers?: string[] | null; grant_alignment?: string[] | null; mission_snapshot?: string[] | null; best_partnership_angle?: string[] | null },
): { score: number; drivers: Driver[] } {
  const drivers: Driver[] = [];
  let rawScore = 0;

  const tiers = org.partner_tiers || [];
  if (tiers.length > 0) {
    rawScore += Math.min(tiers.length * 3, 8);
    drivers.push({
      type: "fit_partner_tier",
      label: `Partner tiers: ${tiers.join(", ")}`,
      evidence_url: null,
      evidence_snippet: null,
      weight: Math.min(tiers.length * 3, 8),
      ts: null,
    });
  }

  const grants = org.grant_alignment || [];
  if (grants.length > 0) {
    rawScore += Math.min(grants.length * 2, 6);
    drivers.push({
      type: "fit_grant_alignment",
      label: `Grant alignment: ${grants.slice(0, 3).join(", ")}`,
      evidence_url: null,
      evidence_snippet: null,
      weight: Math.min(grants.length * 2, 6),
      ts: null,
    });
  }

  const missions = org.mission_snapshot || [];
  if (missions.length > 0) {
    rawScore += Math.min(missions.length * 2, 6);
  }

  const score = Math.min(WEIGHTS.FIT_MAX, Math.round((rawScore / 20) * WEIGHTS.FIT_MAX));
  return { score, drivers };
}

export function computeRecencyScore(
  org: { last_contact_date?: string | null; next_action_due?: string | null },
  upcomingEvents: Array<{ event_date: string | null }>,
  signals: Array<{ signal_type: string; detected_at: string | null }>,
): { score: number; drivers: Driver[] } {
  const drivers: Driver[] = [];
  let score = 0;
  const now = Date.now();

  // Upcoming event within 14 days
  for (const evt of upcomingEvents) {
    if (!evt.event_date) continue;
    const eventTime = new Date(evt.event_date).getTime();
    if (isNaN(eventTime)) continue; // skip invalid dates
    const daysUntil = (eventTime - now) / 86400000;
    if (daysUntil >= 0 && daysUntil <= 14) {
      score += 10;
      drivers.push({
        type: "recency_upcoming_event",
        label: `Event in ${Math.ceil(daysUntil)} days`,
        evidence_url: null,
        evidence_snippet: null,
        weight: 10,
        ts: evt.event_date,
      });
      break;
    }
  }

  // No outreach in 30 days + high signals → urgency
  const lastContactMs = org.last_contact_date ? new Date(org.last_contact_date).getTime() : 0;
  const daysSinceContact = lastContactMs ? (now - lastContactMs) / 86400000 : 999;
  const hasRecentSignals = signals.some((s) => {
    const t = s.detected_at ? new Date(s.detected_at).getTime() : 0;
    return (now - t) / 86400000 < 14;
  });

  if (daysSinceContact > 30 && hasRecentSignals && score < WEIGHTS.RECENCY_MAX) {
    score += 5;
    drivers.push({
      type: "recency_stale_with_signals",
      label: `No outreach in ${Math.floor(daysSinceContact)} days but active signals`,
      evidence_url: null,
      evidence_snippet: null,
      weight: 5,
      ts: null,
    });
  }

  return { score: Math.min(WEIGHTS.RECENCY_MAX, score), drivers };
}

export function computeMomentum(
  signals: Array<{ signal_type: string; confidence: number | null; source_url: string | null; signal_value: string | null; detected_at: string | null }>,
  edges: Array<{ source_type: string; target_type: string; edge_reason: string | null }>,
  org: { partner_tiers?: string[] | null; grant_alignment?: string[] | null; mission_snapshot?: string[] | null; best_partnership_angle?: string[] | null; last_contact_date?: string | null; next_action_due?: string | null },
  upcomingEvents: Array<{ event_date: string | null }>,
  lastScore: number,
  windowDays: number,
): ComputedMomentum {
  const sigResult = computeSignalScore(signals, windowDays);
  const graphResult = computeGraphScore(edges);
  const fitResult = computeFitScore(org);
  const recencyResult = computeRecencyScore(org, upcomingEvents, signals);

  const totalScore = Math.min(100, sigResult.score + graphResult.score + fitResult.score + recencyResult.score);
  const scoreDelta = totalScore - lastScore;
  const trend = computeTrend(scoreDelta);

  const allDrivers = [
    ...sigResult.drivers,
    ...graphResult.drivers,
    ...fitResult.drivers,
    ...recencyResult.drivers,
  ].sort((a, b) => b.weight - a.weight).slice(0, 10);

  return {
    opportunity_id: "",
    score: totalScore,
    trend,
    score_delta: scoreDelta,
    drivers: allDrivers,
  };
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

  // Check Authorization: Bearer <SERVICE_ROLE_KEY> (for internal edge-function-to-edge-function calls)
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
  const oppId = input.opportunity_id;
  const mode = input.mode || (oppId ? "single" : "batch");
  const signalsDays = input.windows?.signals_days ?? 30;
  const edgesDays = input.windows?.edges_days ?? 90;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const computed: ComputedMomentum[] = [];
  const errors: Array<{ opportunity_id: string; error_code: string; message: string }> = [];

  // Get opportunity IDs to compute
  let oppIds: string[] = [];
  if (mode === "single" && oppId) {
    oppIds = [oppId];
  } else {
    // Batch: active, non-archived opportunities, limit 500
    const { data: activeOrgs, error: orgErr } = await supabase
      .from("opportunities")
      .select("id")
      .eq("status", "Active")
      .limit(500);

    if (orgErr) return jsonError(500, "DB_ERROR", `Failed to fetch opportunities: ${orgErr.message}`);
    oppIds = (activeOrgs || []).map((o: { id: string }) => o.id);
  }

  const windowStart = new Date(Date.now() - Math.max(signalsDays, edgesDays) * 86400000).toISOString();
  const windowEnd = new Date().toISOString();

  for (const id of oppIds) {
    try {
      // Fetch signals
      const signalsCutoff = new Date(Date.now() - signalsDays * 86400000).toISOString();
      const { data: signals } = await supabase
        .from("opportunity_signals")
        .select("signal_type, confidence, source_url, signal_value, detected_at")
        .eq("opportunity_id", id)
        .gte("detected_at", signalsCutoff)
        .limit(100);

      // Fetch edges (org as source or target)
      const edgesCutoff = new Date(Date.now() - edgesDays * 86400000).toISOString();
      const { data: edgesSource } = await supabase
        .from("relationship_edges")
        .select("source_type, target_type, edge_reason")
        .eq("source_id", id)
        .gte("created_at", edgesCutoff)
        .limit(100);

      const { data: edgesTarget } = await supabase
        .from("relationship_edges")
        .select("source_type, target_type, edge_reason")
        .eq("target_id", id)
        .gte("created_at", edgesCutoff)
        .limit(100);

      const allEdges = [...(edgesSource || []), ...(edgesTarget || [])];

      // Fetch org details for fit
      const { data: org } = await supabase
        .from("opportunities")
        .select("partner_tiers, grant_alignment, mission_snapshot, best_partnership_angle, last_contact_date, next_action_due")
        .eq("id", id)
        .single();

      if (!org) {
        errors.push({ opportunity_id: id, error_code: "NOT_FOUND", message: "Opportunity not found" });
        continue;
      }

      // Fetch upcoming events linked to this opportunity
      const { data: upcomingEvents } = await supabase
        .from("events")
        .select("event_date")
        .eq("host_opportunity_id", id)
        .gte("event_date", new Date().toISOString().slice(0, 10))
        .limit(10);

      // Get previous score
      const { data: prevMomentum } = await supabase
        .from("relationship_momentum")
        .select("score")
        .eq("opportunity_id", id)
        .maybeSingle();

      const lastScore = prevMomentum?.score ?? 0;

      const result = computeMomentum(
        signals || [],
        allEdges,
        org,
        upcomingEvents || [],
        lastScore,
        signalsDays,
      );
      result.opportunity_id = id;

      // Upsert
      const { error: upsertErr } = await supabase
        .from("relationship_momentum")
        .upsert({
          opportunity_id: id,
          score: result.score,
          trend: result.trend,
          drivers: result.drivers,
          computed_at: windowEnd,
          window_start: windowStart,
          window_end: windowEnd,
          version: "v1",
          last_score: lastScore,
          last_trend: prevMomentum ? computeTrend(result.score_delta) : "stable",
          score_delta: result.score_delta,
        }, { onConflict: "opportunity_id" });

      if (upsertErr) {
        errors.push({ opportunity_id: id, error_code: "UPSERT_ERROR", message: upsertErr.message });
      } else {
        computed.push(result);
      }
    } catch (err) {
      errors.push({ opportunity_id: id, error_code: "UNEXPECTED", message: String(err) });
    }
  }

  return jsonOk({
    ok: true,
    mode,
    computed: computed.map((c) => ({
      opportunity_id: c.opportunity_id,
      score: c.score,
      trend: c.trend,
      score_delta: c.score_delta,
    })),
    errors,
    total_computed: computed.length,
    total_errors: errors.length,
  });
});
