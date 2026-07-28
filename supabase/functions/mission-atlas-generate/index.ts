/**
 * mission-atlas-generate — Generates Mission Atlas drafts using Perplexity + Lovable AI.
 *
 * WHAT: Receives archetype + metro_type, researches via Perplexity, drafts narrative via Gemini,
 *       applies NRI voice filter, and writes a pending draft to mission_atlas_drafts.
 * WHERE: Called from Gardener Studio → Atlas tab.
 * WHY: Automates atlas content generation while keeping Gardener in the review loop.
 */
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

// ── NRI Voice Filter ──
const URGENCY_RE = /\b(urgent|critical|act now|immediately|asap|emergency|deadline|hurry|don't miss|last chance|breaking|high priority|action required|must)\b/gi;
const BANNED_CRM = /\b(aggressive|pipeline|conversion|prospecting|hustle|close the deal|leads|funnel|churn)\b/gi;
const BANNED_DEVOTIONAL = /\b(stillness|stirring in your heart|invitation to listen|hold space|unfolding|sacred)\b/gi;

function cleanNriVoice(text: string): string {
  return text
    .replace(URGENCY_RE, "")
    .replace(BANNED_CRM, "")
    .replace(BANNED_DEVOTIONAL, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Archetype display names ──
const ARCHETYPE_DISPLAY: Record<string, string> = {
  church: "Church / Faith Community",
  catholic_outreach: "Catholic Outreach",
  digital_inclusion: "Digital Inclusion",
  social_enterprise: "Social Enterprise",
  workforce: "Workforce Development",
  refugee_support: "Refugee Support",
  education_access: "Education Access",
  library_system: "Library System",
  community_network: "Community Network",
  ministry_outreach: "Ministry Outreach",
  caregiver_solo: "Caregiver (Solo)",
  caregiver_agency: "Caregiver Agency",
};

const METRO_DISPLAY: Record<string, string> = {
  urban: "Urban",
  suburban: "Suburban",
  rural: "Rural",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) return jsonError(500, "CONFIG_ERROR", "PERPLEXITY_API_KEY not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonError(500, "CONFIG_ERROR", "LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate via JWT
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return jsonError(401, "AUTH_ERROR", "Not authenticated");

    // Parse input
    const { archetype, metro_type } = await req.json();
    if (!archetype || !metro_type) return jsonError(400, "INVALID_INPUT", "archetype and metro_type required");
    if (!["urban", "suburban", "rural"].includes(metro_type)) return jsonError(400, "INVALID_INPUT", "metro_type must be urban, suburban, or rural");

    const archetypeLabel = ARCHETYPE_DISPLAY[archetype] || archetype;
    const metroLabel = METRO_DISPLAY[metro_type] || metro_type;

    // ── Step 1: Perplexity Research ──
    const researchPrompt = `Research how ${archetypeLabel} organizations operate in ${metroLabel} communities in the United States. Focus on:
1. The real-world challenges they face
2. The types of relationships they maintain (pastoral, professional, volunteer)
3. Common community signals or patterns (events, partnerships, seasonal rhythms)
4. What makes their work distinctive in ${metroLabel} settings vs other contexts
5. The roles people play in these organizations (shepherds, companions, visitors, stewards)

Provide specific, grounded details — not abstract generalizations. Include real patterns you can identify from community development, faith-based organizing, or social service delivery.`;

    const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "You are a community research assistant. Provide detailed, factual information about how mission-driven organizations operate in different geographic contexts." },
          { role: "user", content: researchPrompt },
        ],
      }),
    });

    if (!perplexityRes.ok) {
      const errText = await perplexityRes.text();
      console.error("Perplexity error:", perplexityRes.status, errText);
      return jsonError(502, "RESEARCH_ERROR", "Perplexity research failed");
    }

    const perplexityData = await perplexityRes.json();
    const researchContent = perplexityData.choices?.[0]?.message?.content || "";
    const citations = perplexityData.citations || [];

    // ── Step 2: Gemini Narrative Draft ──
    const draftPrompt = `You are writing a Mission Atlas entry for the CROS platform. CROS is a Communal Relationship Operating System for human-centered organizations.

Based on this research about ${archetypeLabel} organizations in ${metroLabel} communities:

---
${researchContent}
---

Generate a Mission Atlas entry with the following JSON structure:
{
  "themes": ["3-5 short theme phrases"],
  "signals": ["3-5 signal type keywords like presence, reconnection, care_momentum, partnership, momentum, engagement"],
  "roles": ["relevant CROS roles from: shepherd, companion, visitor, steward"],
  "narrative": "A 3-5 sentence narrative paragraph describing how this archetype operates in this metro context. Focus on relationships, not programs. Use warm-professional tone. Be specific and grounded, not abstract."
}

TONE RULES:
- Warm-professional: like a thoughtful colleague, not a spiritual director or sales manager
- Use words like: notice, tend, reconnect, revisit, accompany
- NEVER use: aggressive, pipeline, conversion, prospecting, hustle, close
- NEVER use: stillness, stirring in your heart, invitation to listen, hold space, unfolding, sacred
- NEVER use urgency language: urgent, critical, act now, immediately, asap

Return ONLY the JSON object, no markdown fences.`;

    const geminiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You generate structured content for mission-driven community platforms. Always respond with valid JSON only." },
          { role: "user", content: draftPrompt },
        ],
      }),
    });

    if (!geminiRes.ok) {
      const status = geminiRes.status;
      const errText = await geminiRes.text();
      console.error("Gemini error:", status, errText);
      if (status === 429) return jsonError(429, "RATE_LIMITED", "AI rate limit reached. Please try again shortly.");
      if (status === 402) return jsonError(402, "CREDITS_EXHAUSTED", "AI credits exhausted. Please add credits.");
      return jsonError(502, "DRAFT_ERROR", "AI narrative generation failed");
    }

    const geminiData = await geminiRes.json();
    const rawContent = geminiData.choices?.[0]?.message?.content || "{}";

    // Parse JSON from response (handle markdown fences)
    let parsed: { themes?: string[]; signals?: string[]; roles?: string[]; narrative?: string };
    try {
      const jsonStr = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse Gemini response:", rawContent);
      return jsonError(500, "PARSE_ERROR", "Could not parse AI draft output");
    }

    // ── Step 3: NRI Voice Filter ──
    const narrative = cleanNriVoice(parsed.narrative || "");
    const themes = (parsed.themes || []).map(t => cleanNriVoice(t));
    const signals = parsed.signals || [];
    const roles = parsed.roles || [];

    // ── Step 4: Write Draft ──
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: draft, error: insertErr } = await admin
      .from("mission_atlas_drafts")
      .upsert({
        archetype,
        metro_type,
        themes,
        signals,
        roles,
        narrative,
        status: "pending_review",
        generated_by: "edge_function",
        research_context: {
          research_summary: researchContent.slice(0, 2000),
          citations,
          generated_at: new Date().toISOString(),
          model_research: "sonar-pro",
          model_draft: "google/gemini-2.5-flash",
        },
      }, { onConflict: "archetype,metro_type,status" })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return jsonError(500, "DB_ERROR", insertErr.message);
    }

    return jsonOk({ ok: true, draft });
  } catch (err) {
    console.error("mission-atlas-generate error:", err);
    return jsonError(500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
});
