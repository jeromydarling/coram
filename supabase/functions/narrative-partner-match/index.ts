import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

// ── Constants ──
const MAX_SUGGESTIONS = 5;
const URGENCY_WORDS = /\b(urgent|critical|act now|immediately|asap|emergency|deadline|hurry|don't miss|last chance|breaking|high priority|action required)\b/gi;

function removeUrgencyLanguage(text: string): string {
  return text.replace(URGENCY_WORDS, "").replace(/\s{2,}/g, " ").trim();
}

// ── Theme detection from narrative_json ──

interface NarrativeThemes {
  education: boolean;
  housing: boolean;
  funding: boolean;
  policy: boolean;
  health: boolean;
  technology: boolean;
  employment: boolean;
  rawThemes: string[];
}

function extractThemes(narrativeJson: Record<string, unknown>): NarrativeThemes {
  // Combine all narrative text for keyword scanning
  const parts: string[] = [];
  if (narrativeJson.community_story) parts.push(String(narrativeJson.community_story));
  if (narrativeJson.partner_story) parts.push(String(narrativeJson.partner_story));
  if (narrativeJson.gentle_outlook) parts.push(String(narrativeJson.gentle_outlook));
  if (narrativeJson.headline) parts.push(String(narrativeJson.headline));
  const patterns = (narrativeJson.emerging_patterns ?? narrativeJson.detected_patterns ?? []) as string[];
  parts.push(...patterns);

  const blob = parts.join(" ").toLowerCase();

  const rawThemes: string[] = [];
  const education = /\b(school|student|learning|education|enrollment|classroom|teacher|remote learning|literacy|tutoring)\b/.test(blob);
  if (education) rawThemes.push("education");

  const housing = /\b(housing|shelter|displacement|eviction|homeless|rent|affordable housing|housing instability)\b/.test(blob);
  if (housing) rawThemes.push("housing");

  const funding = /\b(fund|grant|appropriat|budget|allocation|investment|capital|philanthrop)\b/.test(blob);
  if (funding) rawThemes.push("funding");

  const policy = /\b(policy|regulation|legislation|ordinance|zoning|compliance|mandate|executive order)\b/.test(blob);
  if (policy) rawThemes.push("policy");

  const health = /\b(health|mental health|clinic|hospital|wellness|nutrition|food|hunger)\b/.test(blob);
  if (health) rawThemes.push("health");

  const technology = /\b(technology|digital|broadband|internet|device|computer|connectivity|wifi)\b/.test(blob);
  if (technology) rawThemes.push("technology");

  const employment = /\b(employment|workforce|job|hiring|layoff|unemployment|career|labor)\b/.test(blob);
  if (employment) rawThemes.push("employment");

  return { education, housing, funding, policy, health, technology, employment, rawThemes };
}

// ── Deterministic matching ──

interface OrgProfile {
  opportunity_id: string;
  organization: string;
  ecosystem_scope: Record<string, unknown> | null;
  grant_alignment_vectors: Record<string, unknown> | null;
  geo_reach_profile: Record<string, unknown> | null;
}

interface MatchResult {
  opportunity_id: string;
  organization: string;
  suggestion_type: "check_in" | "offer_support" | "introduce_partner" | "share_resource";
  reasoning: string;
  confidence: number;
}

function deterministicMatch(themes: NarrativeThemes, profiles: OrgProfile[]): MatchResult[] {
  const matches: MatchResult[] = [];

  for (const prof of profiles) {
    const eco = prof.ecosystem_scope ?? {};
    const sectors = ((eco.sectors ?? eco.focus_areas ?? []) as string[]).map(s => s.toLowerCase());
    const grant = prof.grant_alignment_vectors ?? {};
    const grantFocus = ((grant.focus_areas ?? []) as string[]).map(s => s.toLowerCase());

    // Education match
    if (themes.education && sectors.some(s => /education|school|student|learning|youth/.test(s))) {
      matches.push({
        opportunity_id: prof.opportunity_id,
        organization: prof.organization,
        suggestion_type: "check_in",
        reasoning: `Recent community shifts related to education may be affecting ${prof.organization}'s work with students and schools.`,
        confidence: 72,
      });
    }

    // Housing match
    if (themes.housing && sectors.some(s => /housing|shelter|homeless|displacement/.test(s))) {
      matches.push({
        opportunity_id: prof.opportunity_id,
        organization: prof.organization,
        suggestion_type: "offer_support",
        reasoning: `Housing-related developments in the community may be impacting families ${prof.organization} serves.`,
        confidence: 68,
      });
    }

    // Funding / grant alignment
    if (themes.funding && grantFocus.length > 0) {
      const overlappingAreas = grantFocus.filter(f =>
        themes.rawThemes.some(t => f.includes(t) || t.includes(f))
      );
      if (overlappingAreas.length > 0) {
        matches.push({
          opportunity_id: prof.opportunity_id,
          organization: prof.organization,
          suggestion_type: "share_resource",
          reasoning: `New funding developments may align with ${prof.organization}'s focus on ${overlappingAreas.slice(0, 2).join(" and ")}.`,
          confidence: 65,
        });
      }
    }

    // Policy match
    if (themes.policy && sectors.some(s => /policy|advocacy|government|civic/.test(s))) {
      matches.push({
        opportunity_id: prof.opportunity_id,
        organization: prof.organization,
        suggestion_type: "check_in",
        reasoning: `Policy changes in the community may relate to ${prof.organization}'s advocacy work.`,
        confidence: 60,
      });
    }

    // Health match
    if (themes.health && sectors.some(s => /health|wellness|nutrition|food|mental/.test(s))) {
      matches.push({
        opportunity_id: prof.opportunity_id,
        organization: prof.organization,
        suggestion_type: "check_in",
        reasoning: `Health-related community developments may be relevant to ${prof.organization}'s programs.`,
        confidence: 64,
      });
    }

    // Technology/digital divide match
    if (themes.technology && sectors.some(s => /technology|digital|broadband|device|computer/.test(s))) {
      matches.push({
        opportunity_id: prof.opportunity_id,
        organization: prof.organization,
        suggestion_type: "check_in",
        reasoning: `Technology access developments in the community connect to ${prof.organization}'s digital equity work.`,
        confidence: 70,
      });
    }
  }

  // Dedupe by opportunity_id + suggestion_type, keep highest confidence
  const deduped = new Map<string, MatchResult>();
  for (const m of matches) {
    const key = `${m.opportunity_id}::${m.suggestion_type}`;
    const existing = deduped.get(key);
    if (!existing || m.confidence > existing.confidence) {
      deduped.set(key, m);
    }
  }

  // Sort by confidence desc, cap at MAX_SUGGESTIONS
  return Array.from(deduped.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_SUGGESTIONS);
}

// ── AI message generation ──

async function generateSuggestedMessages(
  matches: MatchResult[],
  metroName: string,
): Promise<Map<string, string>> {
  const messageMap = new Map<string, string>();
  const apiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!apiKey || matches.length === 0) {
    // Deterministic fallback messages
    for (const m of matches) {
      messageMap.set(m.opportunity_id, buildFallbackMessage(m, metroName));
    }
    return messageMap;
  }

  const partnerList = matches.map(m =>
    `- ${m.organization} (${m.suggestion_type}): ${m.reasoning}`
  ).join("\n");

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You write gentle, relationship-first check-in emails for a community partnership manager.
Tone: warm, observational, supportive. NEVER urgent, never pushy, never salesy.
Avoid: "urgent", "critical", "act now", "immediately", "don't miss", "action required".
Each message should be 3-5 sentences. Use the partner name and the reasoning provided.
Format: Start with "Subject: " line, then blank line, then body. End warmly.

Return a JSON array of objects: [{"organization": "Name", "message_md": "Subject: ...\\n\\n..."}]`
          },
          {
            role: "user",
            content: `Metro: ${metroName}\n\nPartners to write gentle check-ins for:\n${partnerList}`
          },
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!resp.ok) {
      console.error("AI gateway error:", resp.status, await resp.text());
      for (const m of matches) messageMap.set(m.opportunity_id, buildFallbackMessage(m, metroName));
      return messageMap;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{ organization: string; message_md: string }>;
      for (const p of parsed) {
        const match = matches.find(m => m.organization === p.organization);
        if (match) {
          messageMap.set(match.opportunity_id, removeUrgencyLanguage(p.message_md));
        }
      }
    }
  } catch (e) {
    console.error("AI message generation failed:", e);
  }

  // Fill any missing with fallback
  for (const m of matches) {
    if (!messageMap.has(m.opportunity_id)) {
      messageMap.set(m.opportunity_id, buildFallbackMessage(m, metroName));
    }
  }

  return messageMap;
}

function buildFallbackMessage(match: MatchResult, metroName: string): string {
  const typeLabels: Record<string, string> = {
    check_in: "Thinking of you",
    offer_support: "Checking in on how we can help",
    introduce_partner: "A connection that might be helpful",
    share_resource: "Something that might be relevant",
  };
  const subject = `${typeLabels[match.suggestion_type] ?? "Thinking of you"} — ${metroName}`;
  return `Subject: ${subject}\n\nHi,\n\nWe've been following some of the recent developments in ${metroName} and it made us think of the work ${match.organization} is doing. ${match.reasoning}\n\nJust wanted to reach out and see how things are going. If there's anything we can support or explore together, we'd love to hear from you.\n\nWarmly,\n[Your Name]`;
}

// ── Auth helper ──

function authenticateServiceRequest(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  if (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) return true;

  const token = apiKeyHeader || (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "");
  if (!token) return false;

  if (enrichmentSecret && token === enrichmentSecret) return true;
  if (sharedSecret && token === sharedSecret) return true;

  return false;
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!authenticateServiceRequest(req)) {
    return jsonError(401, "unauthorized", "Service auth required");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const metroId = body.metro_id as string;
    const narrativeId = body.narrative_id as string;

    if (!metroId || !narrativeId) {
      return jsonError(400, "missing_field", "metro_id and narrative_id are required");
    }

    // 1) Load narrative
    const { data: narrative, error: narErr } = await supabase
      .from("metro_narratives")
      .select("id, narrative_json, headline")
      .eq("id", narrativeId)
      .single();

    if (narErr || !narrative) return jsonError(404, "not_found", "Narrative not found");

    const narrativeJson = (narrative.narrative_json ?? {}) as Record<string, unknown>;
    const themes = extractThemes(narrativeJson);

    if (themes.rawThemes.length === 0) {
      return jsonOk({ ok: true, suggestions_created: 0, reason: "no_themes_detected" });
    }

    // 2) Load metro name
    const { data: metroRow } = await supabase
      .from("metros")
      .select("metro")
      .eq("id", metroId)
      .single();
    const metroName = metroRow?.metro ?? "your area";

    // 3) Load org_knowledge_profiles for this metro's opportunities
    const { data: opps } = await supabase
      .from("opportunities")
      .select("id, organization, metro_id")
      .eq("metro_id", metroId)
      .eq("status", "Active")
      .limit(100);

    if (!opps || opps.length === 0) {
      return jsonOk({ ok: true, suggestions_created: 0, reason: "no_active_opportunities" });
    }

    const oppIds = opps.map(o => o.id);
    const { data: profiles } = await supabase
      .from("org_knowledge_profiles")
      .select("organization_id, ecosystem_scope, grant_alignment_vectors, geo_reach_profile")
      .in("organization_id", oppIds);

    const profileMap = new Map(
      (profiles ?? []).map(p => [p.organization_id, p])
    );

    const orgProfiles: OrgProfile[] = opps
      .filter(o => profileMap.has(o.id))
      .map(o => {
        const prof = profileMap.get(o.id)!;
        return {
          opportunity_id: o.id,
          organization: o.organization,
          ecosystem_scope: prof.ecosystem_scope as Record<string, unknown> | null,
          grant_alignment_vectors: prof.grant_alignment_vectors as Record<string, unknown> | null,
          geo_reach_profile: prof.geo_reach_profile as Record<string, unknown> | null,
        };
      });

    // 4) Deterministic matching
    const matches = deterministicMatch(themes, orgProfiles);

    if (matches.length === 0) {
      return jsonOk({ ok: true, suggestions_created: 0, reason: "no_matches" });
    }

    // 5) Generate suggested messages (AI with fallback)
    const messages = await generateSuggestedMessages(matches, metroName);

    // 6) Upsert suggestions (dedupe on narrative_id + opportunity_id + suggestion_type)
    const rows = matches.map(m => ({
      metro_id: metroId,
      narrative_id: narrativeId,
      opportunity_id: m.opportunity_id,
      suggestion_type: m.suggestion_type,
      reasoning: removeUrgencyLanguage(m.reasoning),
      ai_confidence: m.confidence,
      suggested_message_md: messages.get(m.opportunity_id) ?? null,
      dismissed: false,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("narrative_partner_suggestions")
      .upsert(rows, { onConflict: "narrative_id,opportunity_id,suggestion_type" })
      .select("id");

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return jsonError(500, "db_error", insertErr.message);
    }

    return jsonOk({
      ok: true,
      suggestions_created: (inserted ?? []).length,
      themes_detected: themes.rawThemes,
      matches: matches.map(m => ({
        organization: m.organization,
        suggestion_type: m.suggestion_type,
        confidence: m.confidence,
      })),
    });
  } catch (e) {
    console.error("narrative-partner-match error:", e);
    return jsonError(500, "internal_error", e instanceof Error ? e.message : String(e));
  }
});
