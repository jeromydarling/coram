import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * generate-discernment-observations — NRI daily observation generator.
 *
 * WHAT: Analyzes anonymous marketing_discernment_signals and writes human-language summaries.
 * WHERE: Runs daily via cron or manual trigger.
 * WHY: Converts aggregate patterns into narrative insights for the Operator Console.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SignalRow {
  page_key: string;
  event_key: string;
  content_key: string | null;
}

/** Human-readable labels */
const PAGE_LABELS: Record<string, string> = {
  "see-people": "the See People reflection",
  archetypes: "the Archetypes page",
  roles: "the Roles page",
  pricing: "the Pricing page",
  manifesto: "the Manifesto",
  essays: "published essays",
  libraries: "the Living Library",
};

const EVENT_LABELS: Record<string, string> = {
  reflection_card_opened: "opening reflection cards",
  question_expanded: "expanding questions",
  essay_read_start: "beginning to read essays",
  essay_read_complete: "completing essay reads",
  cta_clicked: "clicking calls to action",
  archetype_story_opened: "exploring archetype stories",
  page_view: "visiting",
};

function generateObservations(
  signals: SignalRow[],
  periodStart: string,
  periodEnd: string
): Array<{
  title: string;
  body: string;
  suggested_action: string | null;
  signal_count: number;
  observation_type: string;
  period_start: string;
  period_end: string;
}> {
  if (signals.length < 3) return []; // Too few signals to observe anything meaningful

  // Aggregate by page
  const pageCounts: Record<string, number> = {};
  const eventCounts: Record<string, number> = {};
  const contentCounts: Record<string, number> = {};

  for (const s of signals) {
    pageCounts[s.page_key] = (pageCounts[s.page_key] || 0) + 1;
    eventCounts[s.event_key] = (eventCounts[s.event_key] || 0) + 1;
    if (s.content_key) {
      contentCounts[s.content_key] = (contentCounts[s.content_key] || 0) + 1;
    }
  }

  const observations: Array<{
    title: string;
    body: string;
    suggested_action: string | null;
    signal_count: number;
    observation_type: string;
    period_start: string;
    period_end: string;
  }> = [];

  // Top page observation
  const topPage = Object.entries(pageCounts).sort((a, b) => b[1] - a[1])[0];
  if (topPage && topPage[1] >= 3) {
    const label = PAGE_LABELS[topPage[0]] || topPage[0];
    observations.push({
      title: "Where attention gathers",
      body: `Most visitors this period were drawn to ${label}. This page received ${topPage[1]} interactions — more than any other marketing surface.`,
      suggested_action:
        topPage[1] >= 10
          ? `Consider expanding the content on ${label} — it appears to resonate.`
          : null,
      signal_count: topPage[1],
      observation_type: "discernment",
      period_start: periodStart,
      period_end: periodEnd,
    });
  }

  // Reflection engagement
  const reflectionCount =
    (eventCounts["reflection_card_opened"] || 0) +
    (eventCounts["question_expanded"] || 0);
  if (reflectionCount >= 3) {
    observations.push({
      title: "Reflection questions draw pause",
      body: `Visitors paused on reflection prompts ${reflectionCount} times this period. People are taking time to sit with these questions — not just scanning.`,
      suggested_action:
        reflectionCount >= 8
          ? "The reflection language is resonating. Perhaps similar questions could appear in onboarding or the team guide."
          : null,
      signal_count: reflectionCount,
      observation_type: "discernment",
      period_start: periodStart,
      period_end: periodEnd,
    });
  }

  // Essay engagement
  const essayStarts = eventCounts["essay_read_start"] || 0;
  const essayCompletes = eventCounts["essay_read_complete"] || 0;
  if (essayStarts >= 2) {
    const completionRate =
      essayStarts > 0 ? Math.round((essayCompletes / essayStarts) * 100) : 0;
    observations.push({
      title: "Essays drawing readers",
      body: `${essayStarts} essay reads began this period${essayCompletes > 0 ? `, with ${completionRate}% reading to completion` : ""}. The written word continues to carry weight.`,
      suggested_action:
        completionRate < 40 && essayStarts >= 5
          ? "Some readers may not be finishing. Consider shorter essays or adding reflection prompts mid-way."
          : null,
      signal_count: essayStarts,
      observation_type: "discernment",
      period_start: periodStart,
      period_end: periodEnd,
    });
  }

  // CTA engagement
  const ctaCount = eventCounts["cta_clicked"] || 0;
  if (ctaCount >= 2) {
    observations.push({
      title: "Invitations being accepted",
      body: `${ctaCount} calls to action were clicked this period. Visitors are moving from reflection into exploration.`,
      suggested_action: null,
      signal_count: ctaCount,
      observation_type: "discernment",
      period_start: periodStart,
      period_end: periodEnd,
    });
  }

  // Top content key if any
  const topContent = Object.entries(contentCounts).sort(
    (a, b) => b[1] - a[1]
  )[0];
  if (topContent && topContent[1] >= 3) {
    observations.push({
      title: "A particular theme resonates",
      body: `The content "${topContent[0].replace(/-/g, " ")}" received ${topContent[1]} interactions — more than other individual pieces. This theme appears to carry meaning for visitors.`,
      suggested_action:
        "Consider developing this theme further in upcoming essays or marketing copy.",
      signal_count: topContent[1],
      observation_type: "discernment",
      period_start: periodStart,
      period_end: periodEnd,
    });
  }

  return observations;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const periodEnd = now.toISOString();
    const periodStart = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch signals from last 7 days
    const { data: signals, error: fetchErr } = await sb
      .from("marketing_discernment_signals")
      .select("page_key, event_key, content_key")
      .gte("created_at", periodStart)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (fetchErr) throw fetchErr;

    const observations = generateObservations(
      signals || [],
      periodStart,
      periodEnd
    );

    if (observations.length > 0) {
      const { error: insertErr } = await sb
        .from("operator_nri_observations")
        .insert(observations);
      if (insertErr) throw insertErr;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        signals_analyzed: signals?.length || 0,
        observations_created: observations.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
