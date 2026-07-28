import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { emitUsageEvents, type UsageEvent } from "../_shared/usageEvents.ts";

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

// ── SHA-256 helper ──
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Keyword sets for rule engine ──
const INSTABILITY_KEYWORDS = [
  "layoff", "closure", "closing", "restructur", "downsiz", "bankrupt",
  "merger", "acquisit", "shutdown", "staff reduct", "furlough", "dissolv",
];

const PROGRAM_AREAS = [
  "education", "workforce", "broadband", "housing", "health",
  "digital equity", "digital inclusion", "internet access",
  "computer", "device", "laptop", "technology",
];

// ── Deterministic insight type definitions ──
interface InsightRule {
  type: string;
  title: string;
  check: (ctx: RuleContext) => { match: boolean; severity: "low" | "medium" | "high"; confidence: number; summary: string; signalIds: string[] };
  actions: Array<{
    action_type: string;
    title: string;
    description: string;
    cta_label: string;
    cta_context: Record<string, unknown>;
  }>;
}

interface RuleContext {
  signals: Array<{ id: string; signal_type: string; summary: string; confidence: number }>;
  neighborhoodInsight: { summary: string; content_hash: string } | null;
  enrichmentFacts: Array<{ id: string; fact_type?: string; value?: string }>;
}

const INSIGHT_RULES: InsightRule[] = [
  {
    type: "momentum_increase",
    title: "Increased Activity Detected",
    check: (ctx) => {
      const changeSignals = ctx.signals.filter(s => s.signal_type === "watchlist_change");
      const highConfChanges = changeSignals.filter(s => s.confidence >= 0.7);
      const otherSignals = ctx.signals.filter(s => s.signal_type !== "watchlist_change");

      const match = changeSignals.length >= 2 ||
        (highConfChanges.length >= 1 && otherSignals.length >= 1);

      return {
        match,
        severity: changeSignals.length >= 3 ? "high" as const : "medium" as const,
        confidence: Math.min(0.9, 0.5 + changeSignals.length * 0.1),
        summary: `${changeSignals.length} website changes detected in the last 30 days, suggesting increased organizational activity. This may indicate new programs, leadership changes, or expansion — potential timing for outreach.`,
        signalIds: changeSignals.map(s => s.id),
      };
    },
    actions: [
      {
        action_type: "create_outreach_draft",
        title: "Create Outreach Draft",
        description: "Draft a personalized outreach campaign referencing recent changes.",
        cta_label: "Create Draft Campaign",
        cta_context: { flow: "campaign_draft" },
      },
      {
        action_type: "review_recent_changes",
        title: "Review Recent Changes",
        description: "Check the watchlist changes to understand what's happening at this organization.",
        cta_label: "View Changes",
        cta_context: { flow: "view_watchlist" },
      },
    ],
  },
  {
    type: "community_need_alignment",
    title: "Community Need Alignment Opportunity",
    check: (ctx) => {
      if (!ctx.neighborhoodInsight) return { match: false, severity: "medium" as const, confidence: 0, summary: "", signalIds: [] };

      const summaryLower = ctx.neighborhoodInsight.summary.toLowerCase();
      const matchingAreas = PROGRAM_AREAS.filter(area => summaryLower.includes(area));

      // Also check enrichment facts for program overlap
      const factValues = ctx.enrichmentFacts
        .map(f => (f.value || "").toLowerCase())
        .join(" ");
      const enrichmentMatches = PROGRAM_AREAS.filter(area => factValues.includes(area));

      const allMatches = [...new Set([...matchingAreas, ...enrichmentMatches])];
      const match = allMatches.length >= 1;

      return {
        match,
        severity: allMatches.length >= 3 ? "high" as const : "medium" as const,
        confidence: Math.min(0.9, 0.4 + allMatches.length * 0.15),
        summary: `Neighborhood data shows community needs in: ${allMatches.join(", ")}. These align with PCS program areas, creating a strong partnership angle for this organization.`,
        signalIds: [],
      };
    },
    actions: [
      {
        action_type: "tailor_pitch",
        title: "Tailor Pitch to Top Needs",
        description: "Customize your partnership pitch to highlight alignment with the community's top 2-3 needs.",
        cta_label: "Tailor Pitch",
        cta_context: { flow: "pitch_customization" },
      },
      {
        action_type: "find_local_partners",
        title: "Find Local Partners",
        description: "Identify other organizations in this community that could strengthen the partnership.",
        cta_label: "Find Partners",
        cta_context: { flow: "partner_search" },
      },
    ],
  },
  {
    type: "instability_risk",
    title: "Potential Instability Risk",
    check: (ctx) => {
      const riskSignals = ctx.signals.filter(s => {
        const summaryLower = s.summary.toLowerCase();
        return INSTABILITY_KEYWORDS.some(kw => summaryLower.includes(kw));
      });

      const match = riskSignals.length >= 1;

      return {
        match,
        severity: "high" as const,
        confidence: Math.min(0.85, 0.5 + riskSignals.length * 0.15),
        summary: `Watchlist signals indicate potential instability (${riskSignals.map(s => s.summary.slice(0, 60)).join("; ")}). Verify current operations and assess dependency risk.`,
        signalIds: riskSignals.map(s => s.id),
      };
    },
    actions: [
      {
        action_type: "verify_operations",
        title: "Verify Operations",
        description: "Confirm current operational status of this organization through direct contact or research.",
        cta_label: "Verify Status",
        cta_context: { flow: "verify_operations" },
      },
      {
        action_type: "adjust_expectations",
        title: "Reduce Dependency / Adjust Expectations",
        description: "Consider reducing reliance on this partner or adjusting pipeline expectations.",
        cta_label: "Review Pipeline",
        cta_context: { flow: "pipeline_review" },
      },
    ],
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  const correlationId = crypto.randomUUID().slice(0, 8);

  // ── Auth ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "UNAUTHORIZED", "Missing auth token");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return jsonError(401, "UNAUTHORIZED", "Invalid token");
  }

  const userId = claimsData.claims.sub as string;

  // ── Parse body ──
  let body: { org_id?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  if (!body.org_id || typeof body.org_id !== "string") {
    return jsonError(400, "MISSING_FIELD", "org_id is required");
  }

  const orgId = body.org_id;
  const force = body.force === true;

  console.log(`[${correlationId}] generate-org-insights for org ${orgId}, force=${force}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // ── Rate limit: max 20 insight generations per day per user ──
    const { data: rateLimitOk } = await supabase.rpc("check_and_increment_rate_limit", {
      p_user_id: userId,
      p_function_name: "generate_org_insights",
      p_window_minutes: 1440,
      p_max_requests: 20,
    });

    if (rateLimitOk === false) {
      return jsonError(429, "RATE_LIMITED", "Daily insight generation limit reached (20/day)");
    }

    // ── Load org ──
    const { data: org, error: orgErr } = await supabase
      .from("opportunities")
      .select("id, organization, metro_id")
      .eq("id", orgId)
      .maybeSingle();

    if (orgErr) throw new Error(`org fetch failed: ${orgErr.message}`);
    if (!org) return jsonError(404, "NOT_FOUND", "Organization not found");

    // ── Load signals (last 30 days) ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: signals } = await supabase
      .from("org_watchlist_signals")
      .select("id, signal_type, summary, confidence")
      .eq("org_id", orgId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(50);

    // ── Load latest neighborhood insight ──
    const { data: neighborhoodRow } = await supabase
      .from("org_neighborhood_insights")
      .select("summary, content_hash")
      .eq("org_id", orgId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── Load enrichment facts (if table exists; graceful fallback) ──
    let enrichmentFacts: Array<{ id: string; fact_type?: string; value?: string }> = [];
    try {
      const { data: facts } = await supabase
        .from("org_enrichment_facts")
        .select("id, fact_type, value")
        .eq("org_id", orgId)
        .limit(20);
      if (facts) enrichmentFacts = facts;
    } catch {
      // Table may not exist yet — safe to skip
    }

    // ── Compute inputs_hash ──
    const signalFingerprints = (signals || []).map(s => s.id).sort().join(",");
    const neighborhoodHash = neighborhoodRow?.content_hash || "";
    const enrichmentHash = enrichmentFacts.map(f => f.id).sort().join(",");
    const inputsHash = await sha256(`${signalFingerprints}|${neighborhoodHash}|${enrichmentHash}`);

    // ── Cache check ──
    if (!force) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: existingInsights } = await supabase
        .from("org_insights")
        .select("id, insight_type, title, severity, confidence, summary, explanation, source, generated_at, valid_until, status")
        .eq("org_id", orgId)
        .eq("generated_date", today)
        .eq("status", "open");

      if (existingInsights && existingInsights.length > 0) {
        // Check if inputs_hash matches
        const firstSource = existingInsights[0].source as Record<string, unknown>;
        if (firstSource?.inputs_hash === inputsHash) {
          // Load actions for these insights
          const insightIds = existingInsights.map(i => i.id);
          const { data: actions } = await supabase
            .from("org_recommended_actions")
            .select("*")
            .in("insight_id", insightIds);

          console.log(`[${correlationId}] cache hit — ${existingInsights.length} insights, same inputs_hash`);
          return jsonOk({
            ok: true,
            cached: true,
            insights: existingInsights,
            actions: actions || [],
          });
        }
      }
    }

    // ── Apply deterministic rule engine ──
    const ruleContext: RuleContext = {
      signals: (signals || []).map(s => ({
        id: s.id,
        signal_type: s.signal_type,
        summary: s.summary,
        confidence: s.confidence,
      })),
      neighborhoodInsight: neighborhoodRow
        ? { summary: neighborhoodRow.summary, content_hash: neighborhoodRow.content_hash }
        : null,
      enrichmentFacts,
    };

    const generatedInsights: Array<Record<string, unknown>> = [];
    const generatedActions: Array<Record<string, unknown>> = [];

    const today = new Date().toISOString().slice(0, 10);

    for (const rule of INSIGHT_RULES) {
      const result = rule.check(ruleContext);
      if (!result.match) continue;

      // Upsert insight (ON CONFLICT on org_id, insight_type, generated_date)
      const insightRow = {
        org_id: orgId,
        insight_type: rule.type,
        title: result.summary.length > 80 ? rule.title : rule.title,
        severity: result.severity,
        confidence: result.confidence,
        summary: result.summary,
        source: {
          signal_ids: result.signalIds,
          inputs_hash: inputsHash,
          neighborhood_hash: neighborhoodRow?.content_hash || null,
        },
        generated_at: new Date().toISOString(),
        generated_date: today,
        valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: "open",
        created_by: userId,
      };

      const { data: insight, error: insightErr } = await supabase
        .from("org_insights")
        .upsert(insightRow, { onConflict: "org_id,insight_type,generated_date" })
        .select("id, insight_type, title, severity, confidence, summary, source, generated_at, valid_until, status")
        .single();

      if (insightErr) {
        console.error(`[${correlationId}] insight upsert error: ${insightErr.message}`);
        continue;
      }

      generatedInsights.push(insight);

      // Upsert actions
      for (const actionDef of rule.actions) {
        const actionRow = {
          org_id: orgId,
          insight_id: insight.id,
          action_type: actionDef.action_type,
          title: actionDef.title,
          description: actionDef.description,
          cta_label: actionDef.cta_label,
          cta_context: { ...actionDef.cta_context, org_id: orgId, insight_type: rule.type },
          status: "open",
        };

        const { data: action, error: actionErr } = await supabase
          .from("org_recommended_actions")
          .upsert(actionRow, { onConflict: "insight_id,action_type" })
          .select("*")
          .single();

        if (actionErr) {
          console.error(`[${correlationId}] action upsert error: ${actionErr.message}`);
          continue;
        }

        generatedActions.push(action);
      }
    }

    // ── Usage metering ──
    if (generatedInsights.length > 0) {
      const usageEvents: UsageEvent[] = [
        {
          workflow_key: "org_insights",
          run_id: correlationId,
          event_type: "org_insights_generated",
          quantity: generatedInsights.length,
          unit: "count",
        },
      ];
      await emitUsageEvents(supabase, usageEvents);
    }

    console.log(`[${correlationId}] generated ${generatedInsights.length} insights, ${generatedActions.length} actions`);

    return jsonOk({
      ok: true,
      cached: false,
      insights: generatedInsights,
      actions: generatedActions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${correlationId}] error: ${message}`);
    return jsonError(500, "PROCESSING_ERROR", message);
  }
});
