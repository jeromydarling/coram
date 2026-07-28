import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CommandCenterData {
  staleOpportunities: number;
  pipelineNearConversion: number;
  grantsDeadlineSoon: number;
  overdueFollowups: number;
  anchorsInRamp: number;
  anchorsInScale: number;
  daysSinceLastAnchor: number;
  metroGaps: { metro: string; gap: string }[];
  topFocusItems: { type: string; name: string; reason: string; urgency: string }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user info
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's region assignments for filtering
    const { data: regionAssignments } = await supabase
      .from("user_region_assignments")
      .select("region_id")
      .eq("user_id", user.id);

    const regionIds = regionAssignments?.map(r => r.region_id) || [];

    // Fetch command center data
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fortyFiveDaysFromNow = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Stale opportunities (no activity in 30+ days)
    const { data: staleOpps } = await supabase
      .from("opportunities")
      .select("id, organization, stage, last_contact_date, metro_id, metros(metro)")
      .eq("status", "Active")
      .lt("last_contact_date", thirtyDaysAgo)
      .not("stage", "in", '("Stable Producer","Closed - Not a Fit")')
      .limit(10);

    // Pipeline near conversion (Agreement Pending/Signed with high probability)
    const { data: pipelineNear } = await supabase
      .from("anchor_pipeline")
      .select("id, stage, probability, opportunity_id, opportunities(organization), metros(metro)")
      .in("stage", ["Agreement Pending", "Agreement Signed"])
      .gte("probability", 60)
      .limit(10);

    // Grants with deadlines in next 45 days
    const { data: grantDeadlines } = await supabase
      .from("grants")
      .select("id, grant_name, stage, grant_term_start, funder_name, metros(metro)")
      .eq("status", "Active")
      .in("stage", ["LOI Submitted", "Full Proposal Submitted", "Cultivating"])
      .limit(10);

    // Overdue follow-ups
    const { data: overdueActions } = await supabase
      .from("opportunities")
      .select("id, organization, next_action_due, next_step, metros(metro)")
      .eq("status", "Active")
      .lt("next_action_due", today)
      .not("next_action_due", "is", null)
      .limit(10);

    // Anchor stats
    const { data: anchors } = await supabase
      .from("anchors")
      .select("id, first_volume_date, stable_producer_date, opportunities(organization), metros(metro)")
      .not("first_volume_date", "is", null);

    const rampAnchors = anchors?.filter(a => a.first_volume_date && !a.stable_producer_date) || [];
    const scaleAnchors = anchors?.filter(a => a.stable_producer_date) || [];
    
    // Days since last anchor
    const sortedAnchors = [...(anchors || [])].sort((a, b) => 
      new Date(b.first_volume_date!).getTime() - new Date(a.first_volume_date!).getTime()
    );
    const latestAnchorDate = sortedAnchors[0]?.first_volume_date;
    const daysSinceLastAnchor = latestAnchorDate 
      ? Math.floor((Date.now() - new Date(latestAnchorDate).getTime()) / (1000 * 60 * 60 * 24))
      : -1; // -1 indicates no anchors with orders yet

    // Metro gaps - metros with low anchor coverage
    const { data: metros } = await supabase
      .from("metros")
      .select("id, metro, region_id");

    const metroGaps: { metro: string; gap: string }[] = [];
    for (const metro of metros || []) {
      const metroAnchors = anchors?.filter(a => (a as any).metros?.metro === metro.metro) || [];
      const { data: metroGrants } = await supabase
        .from("grants")
        .select("id, strategic_focus")
        .eq("metro_id", metro.id)
        .eq("status", "Active");
      
      if (metroAnchors.length < 2) {
        metroGaps.push({ metro: metro.metro, gap: "Low anchor coverage" });
      }
      
      // Check grant alignment gaps
      const grantFocus = metroGrants?.flatMap(g => g.strategic_focus || []) || [];
      if (!grantFocus.includes("Workforce Development") && metroAnchors.length > 0) {
        metroGaps.push({ metro: metro.metro, gap: "No Workforce grant coverage" });
      }
    }

    // Build top focus items
    const topFocusItems: { type: string; name: string; reason: string; urgency: string }[] = [];

    // Add stale opportunities
    for (const opp of (staleOpps || []).slice(0, 2)) {
      const daysSince = Math.floor((Date.now() - new Date(opp.last_contact_date).getTime()) / (1000 * 60 * 60 * 24));
      topFocusItems.push({
        type: "opportunity",
        name: opp.organization,
        reason: `No contact in ${daysSince} days`,
        urgency: daysSince > 45 ? "high" : "medium"
      });
    }

    // Add pipeline near conversion
    for (const p of (pipelineNear || []).slice(0, 2)) {
      topFocusItems.push({
        type: "pipeline",
        name: (p.opportunities as any)?.organization || "Unknown",
        reason: `${p.stage} at ${p.probability}% probability`,
        urgency: "high"
      });
    }

    // Add overdue actions
    for (const action of (overdueActions || []).slice(0, 2)) {
      const daysOverdue = Math.floor((Date.now() - new Date(action.next_action_due!).getTime()) / (1000 * 60 * 60 * 24));
      topFocusItems.push({
        type: "followup",
        name: action.organization,
        reason: `Overdue by ${daysOverdue} days: ${action.next_step || 'Follow up'}`,
        urgency: daysOverdue > 7 ? "high" : "medium"
      });
    }

    const data: CommandCenterData = {
      staleOpportunities: staleOpps?.length || 0,
      pipelineNearConversion: pipelineNear?.length || 0,
      grantsDeadlineSoon: grantDeadlines?.length || 0,
      overdueFollowups: overdueActions?.length || 0,
      anchorsInRamp: rampAnchors.length,
      anchorsInScale: scaleAnchors.length,
      daysSinceLastAnchor,
      metroGaps: metroGaps.slice(0, 3),
      topFocusItems: topFocusItems.slice(0, 5)
    };

    // Generate AI insight
    const systemPrompt = `You are NRI (Narrative Relational Intelligence) — the weekly reflection voice inside CROS, a relationship operating system for mission-driven organizations.

Your tone is warm, grounded, and professional — like a thoughtful colleague offering a brief observation over coffee. You are NOT a spiritual director. You do not use devotional, mystical, or poetic language. You are human and kind, but practical.

VOICE RULES (MANDATORY):
- Never use words like: aggressive, prospecting, pipeline, conversion, close, capitalize, leverage, optimize, hustle, target, crush, revenue
- Never use spiritual/devotional language like: stillness, stirring in your heart, invitation to listen, hold space, wonder, unfolding, planting season, sacred
- Do NOT sound like a meditation app or retreat facilitator
- Use plain, warm, professional language: "It's been a while since…", "You might want to check in with…", "This could be a good week to…", "Nothing urgent — a good time to…"
- Frame gaps as simple observations, not cosmic invitations
- When there is little activity, keep it brief and practical: "Quiet week — a good chance to reconnect with someone you've been meaning to reach."
- Always center people and relationships, never metrics or KPIs
- One to two sentences maximum. Warm, specific, never clinical or mystical.

GOOD EXAMPLES:
- "You haven't connected with the team in Detroit in a few weeks — might be worth a quick check-in."
- "Two partnerships are close to a next step. A follow-through this week could keep things moving."
- "Quiet week — good time to revisit a relationship that's been on the back burner."
- "Nothing pressing. Sometimes the best thing is to just be available."

BAD EXAMPLES (NEVER generate anything like these):
- "With zero active anchors, this week should be dedicated to aggressive outbound prospecting."
- "This quiet week may be an invitation to simply listen to the stillness and notice what is beginning to stir in your heart."
- "You might find space to wonder about the people who are waiting to be known when the time feels right."
- "Hold space for what is unfolding in your community."`;

    const userPrompt = `Here is a gentle snapshot of this person's relational landscape:

RELATIONSHIPS THAT MAY NEED ATTENTION:
${data.topFocusItems.map(f => `- ${f.name}: ${f.reason}`).join('\n') || 'Nothing urgent — a calm week.'}

CONTEXT:
- Relationships that have been quiet (30+ days): ${data.staleOpportunities}
- Partnerships nearing a meaningful next step: ${data.pipelineNearConversion}
- Community commitments with upcoming moments: ${data.grantsDeadlineSoon}
- Follow-ups that may have slipped: ${data.overdueFollowups}
- Relationships in early growth: ${data.anchorsInRamp}
- Stable, rooted partnerships: ${data.anchorsInScale}
- Time since a new partnership began bearing fruit: ${data.daysSinceLastAnchor === -1 ? 'Still in the planting season' : data.daysSinceLastAnchor + ' days'}

COMMUNITY LANDSCAPE:
${data.metroGaps.map(g => `- ${g.metro}: ${g.gap}`).join('\n') || 'All communities feel tended.'}

Offer ONE gentle, NRI-voiced insight (1-2 sentences) to help this person discern where to place their attention this week.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 150,
        temperature: 0.7
      }),
    });

    let aiInsight = "Unable to generate insight at this time.";
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      aiInsight = aiData.choices?.[0]?.message?.content || aiInsight;
    } else {
      console.error("AI response error:", await aiResponse.text());
    }

    return new Response(JSON.stringify({
      ...data,
      aiInsight,
      generatedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-ai-insights:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
