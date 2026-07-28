/**
 * narrative-build-outline — Deterministic story scaffold builder.
 *
 * WHAT: Assembles lightweight story outlines from narrative_value_moments.
 * WHERE: Called on-demand from NarrativeStudio or weekly cron.
 * WHY: Creates structured narrative drafts without LLM calls.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { tenant_id } = body;
    if (!tenant_id) {
      return new Response(JSON.stringify({ ok: false, error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recent value moments (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const { data: moments, error: mErr } = await svc
      .from("narrative_value_moments")
      .select("id, moment_type, summary, source, metro_id, occurred_at")
      .eq("tenant_id", tenant_id)
      .gte("occurred_at", thirtyDaysAgo.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(100);

    if (mErr) throw mErr;

    if (!moments || moments.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, drafts_created: 0, message: "No moments to build from yet." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group moments by theme
    const byType = new Map<string, typeof moments>();
    for (const m of moments) {
      if (!byType.has(m.moment_type)) byType.set(m.moment_type, []);
      byType.get(m.moment_type)!.push(m);
    }

    // Chapter templates
    const chapterMap: Record<string, string> = {
      community_presence: "Where we showed up",
      growth: "Who we strengthened",
      momentum: "What moved forward",
      reconnection: "Relationships renewed",
      collaboration: "What we're learning together",
    };

    // Build outline
    const chapters: Array<{ title: string; moment_count: number; highlights: string[] }> = [];
    const momentIds: string[] = [];

    for (const [type, items] of byType) {
      const title = chapterMap[type] || type;
      chapters.push({
        title,
        moment_count: items.length,
        highlights: items.slice(0, 3).map((i) => i.summary),
      });
      momentIds.push(...items.map((i) => i.id));
    }

    // Determine title from dominant theme
    const dominant = Array.from(byType.entries()).sort((a, b) => b[1].length - a[1].length)[0];
    const titleParts: Record<string, string> = {
      growth: "A season of growth",
      momentum: "Building momentum",
      community_presence: "Showing up in community",
      reconnection: "Renewing connections",
      collaboration: "Growing together",
    };
    const storyTitle = titleParts[dominant[0]] || "Our emerging story";

    // Check existing draft for this tenant (avoid duplicating weekly)
    const weekStart = new Date();
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    weekStart.setUTCHours(0, 0, 0, 0);

    const { data: existingDrafts } = await svc
      .from("narrative_story_drafts")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("status", "emerging")
      .gte("created_at", weekStart.toISOString())
      .limit(1);

    let draftId: string | null = null;

    if (existingDrafts && existingDrafts.length > 0) {
      // Update existing draft
      draftId = existingDrafts[0].id;
      await svc
        .from("narrative_story_drafts")
        .update({
          title: storyTitle,
          outline: { chapters },
          sources: momentIds,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId);
    } else {
      // Create new draft
      const { data: newDraft, error: dErr } = await svc
        .from("narrative_story_drafts")
        .insert({
          tenant_id,
          title: storyTitle,
          outline: { chapters },
          sources: momentIds,
          status: "emerging",
        })
        .select("id")
        .single();
      if (dErr) throw dErr;
      draftId = newDraft.id;
    }

    return new Response(
      JSON.stringify({ ok: true, draft_id: draftId, chapters: chapters.length, moments_referenced: momentIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
