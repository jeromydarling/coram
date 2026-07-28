/**
 * gardener-insight-generator — Scans app_event_stream for friction/curiosity patterns.
 *
 * WHAT: Analyzes non-error behavioral events → generates calm insight cards for the Gardener.
 * WHERE: Called daily via pg_cron. Zone: MACHINA.
 * WHY: Translates anonymous usage patterns into human suggestions without charts or GA jargon.
 *
 * Auth: Service-role key or N8N_SHARED_SECRET via X-Api-Key/Bearer.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
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

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function authenticateServiceRequest(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    if (authHeader.slice(7).trim() === serviceRoleKey) return true;
  }

  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();

  if (!token) return false;
  if (sharedSecret && constantTimeCompare(token, sharedSecret)) return true;
  return false;
}

// ── Insight Generators ──

interface InsightCandidate {
  type: string;
  severity: "low" | "medium" | "high";
  title: string;
  body: string;
  suggested_next_steps: Array<{ label: string; url: string }>;
  dedupe_key: string;
  source_refs: Record<string, unknown>;
}

const monthKey = () => new Date().toISOString().slice(0, 7);

async function detectDiscoveryInterest(
  admin: ReturnType<typeof createClient>,
): Promise<InsightCandidate[]> {
  // Find pages that received unusual attention (non-error clicks) in the last 24h
  const { data: events } = await admin
    .from("app_event_stream")
    .select("page_path, event_name")
    .eq("is_error", false)
    .is("tenant_id", null) // marketing-only events
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(500);

  if (!events?.length) return [];

  // Count visits per page
  const pageCounts: Record<string, number> = {};
  for (const e of events) {
    const path = e.page_path || "unknown";
    pageCounts[path] = (pageCounts[path] || 0) + 1;
  }

  // Find pages with notable traffic (>5 visits in 24h)
  const candidates: InsightCandidate[] = [];
  const featureLabels: Record<string, string> = {
    "/features/signum": "Signum Discovery",
    "/features/civitas": "Civitas Community",
    "/features/relatio": "Relatio Integrations",
    "/features/provisio": "Prōvīsiō",
    "/features/voluntarium": "Voluntārium",
    "/features/impulsus": "Impulsus Journal",
    "/features/testimonium": "Testimonium Stories",
    "/people": "See People",
    "/imagine": "Imagine This",
    "/essays": "Living Library",
    "/pricing": "Pricing",
  };

  for (const [path, count] of Object.entries(pageCounts)) {
    if (count < 5) continue;
    const label = featureLabels[path];
    if (!label) continue;

    candidates.push({
      type: "discovery_interest",
      severity: count > 15 ? "medium" : "low",
      title: `Visitors seem drawn to ${label}`,
      body: `Over the past day, people have been exploring the ${label} page with curiosity. ${count} visitors lingered there. Consider strengthening the journey from this page to related features.`,
      suggested_next_steps: [
        { label: `Review ${label} page`, url: path },
        { label: "View marketing insights", url: "/operator/nexus/discovery-insights" },
      ],
      dedupe_key: `discovery_interest:${path}:${monthKey()}`,
      source_refs: { page_path: path, visit_count: count, period: "24h" },
    });
  }

  return candidates.slice(0, 2); // max 2 discovery insights per run
}

async function detectAdoptionFriction(
  admin: ReturnType<typeof createClient>,
): Promise<InsightCandidate[]> {
  // Look for patterns suggesting friction in the app (non-error only)
  const { data: events } = await admin
    .from("app_event_stream")
    .select("page_path, event_name, session_hash, metadata")
    .eq("is_error", false)
    .not("tenant_id", "is", null) // app users only
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1000);

  if (!events?.length) return [];

  // Detect repeated page visits by same session (navigation loops)
  const sessionPages: Record<string, Record<string, number>> = {};
  for (const e of events) {
    const sess = e.session_hash || "unknown";
    const path = e.page_path || "unknown";
    if (!sessionPages[sess]) sessionPages[sess] = {};
    sessionPages[sess][path] = (sessionPages[sess][path] || 0) + 1;
  }

  const frictionPages: Record<string, number> = {};
  for (const pages of Object.values(sessionPages)) {
    for (const [path, count] of Object.entries(pages)) {
      if (count >= 4) { // same page 4+ times in one session = possible friction
        frictionPages[path] = (frictionPages[path] || 0) + 1;
      }
    }
  }

  const candidates: InsightCandidate[] = [];
  const friendlyNames: Record<string, string> = {
    "/visits": "Visits",
    "/reflections": "Reflections",
    "/contacts": "People",
    "/opportunities": "Relationships",
    "/events": "Events",
    "/volunteers": "Voluntārium",
    "/provisions": "Prōvīsiō",
    "/settings": "Settings",
  };

  for (const [path, sessionCount] of Object.entries(frictionPages)) {
    if (sessionCount < 2) continue; // need multiple sessions showing same friction

    const pageName = Object.entries(friendlyNames).find(([p]) => path.startsWith(p))?.[1] || path;

    candidates.push({
      type: "adoption_friction",
      severity: sessionCount > 4 ? "medium" : "low",
      title: `Companions may be searching for something on ${pageName}`,
      body: `Several companions visited the ${pageName} page repeatedly within a single session, which sometimes suggests they're looking for something that isn't quite visible yet. Consider adding a gentle guidance nudge or simplifying the layout.`,
      suggested_next_steps: [
        { label: `Review ${pageName} experience`, url: path },
      ],
      dedupe_key: `adoption_friction:${path}:${monthKey()}`,
      source_refs: { page_path: path, sessions_affected: sessionCount, period: "24h" },
    });
  }

  return candidates.slice(0, 1); // max 1 friction insight per run
}

// ── Main ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST only");
  if (!authenticateServiceRequest(req)) return jsonError(401, "UNAUTHORIZED", "Invalid auth");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log("[gardener-insight-generator] starting");

  // Check daily cap: max 3 insights per day
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayCount } = await admin
    .from("gardener_insights")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());

  if ((todayCount || 0) >= 3) {
    console.log("[gardener-insight-generator] daily cap reached");
    return jsonOk({ ok: true, message: "Daily insight cap reached (3/day)", insights_created: 0 });
  }

  const remaining = 3 - (todayCount || 0);

  // Gather candidates from all detectors
  const [discoveryInsights, frictionInsights] = await Promise.all([
    detectDiscoveryInterest(admin),
    detectAdoptionFriction(admin),
  ]);

  const allCandidates = [...discoveryInsights, ...frictionInsights].slice(0, remaining);
  let insightsCreated = 0;
  const results: Array<{ type: string; title: string; status: string }> = [];

  for (const candidate of allCandidates) {
    const { error } = await admin.from("gardener_insights").insert({
      type: candidate.type,
      severity: candidate.severity,
      title: candidate.title,
      body: candidate.body,
      suggested_next_steps: candidate.suggested_next_steps,
      related_links: [],
      source_refs: candidate.source_refs,
      dedupe_key: candidate.dedupe_key,
    });

    if (error) {
      if (error.code === "23505") {
        results.push({ type: candidate.type, title: candidate.title, status: "dedupe_skipped" });
      } else {
        console.error("[gardener-insight-generator] insert error:", error);
        results.push({ type: candidate.type, title: candidate.title, status: "error" });
      }
    } else {
      insightsCreated++;
      results.push({ type: candidate.type, title: candidate.title, status: "created" });
    }
  }

  console.log(`[gardener-insight-generator] complete: ${insightsCreated} insights created`);
  return jsonOk({ ok: true, insights_created: insightsCreated, results });
});
