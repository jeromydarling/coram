import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { stripPrivateFields } from "../_shared/sanitize-story-inputs.ts";
import { normalizeTopicCounts, computeDrift } from "../_shared/drift-engine.ts";

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

function authenticateServiceRequest(req: Request): { authenticated: boolean; isUser: boolean; token: string } {
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    if (authHeader.slice(7).trim() === serviceRoleKey) return { authenticated: true, isUser: false, token: "" };
  }

  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();

  if (!token) return { authenticated: false, isUser: false, token: "" };

  const isServerSecret =
    (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);
  if (isServerSecret) return { authenticated: true, isUser: false, token: "" };

  return { authenticated: true, isUser: true, token };
}

// ── Constants ──
const MAX_METROS = 50;

// ── Urgency filter ──
const URGENCY_WORDS = /\b(urgent|critical|act now|immediately|asap|emergency|deadline|hurry|don't miss|last chance|breaking|high priority|action required)\b/gi;

function removeUrgencyLanguage(text: string): string {
  return text.replace(URGENCY_WORDS, "").replace(/\s{2,}/g, " ").trim();
}

// ── Types ──

interface OrgStorySummary {
  org_name: string;
  momentum_trend: string | null;
  recent_story_points: string[];
  partner_responses: string[];
}

interface MetroStoryInputs {
  metro_context: { metro_id: string; metro_name: string };
  org_story_summaries: OrgStorySummary[];
  ecosystem_patterns: string[];
  external_signals: Array<{ title: string; snippet: string; source_url: string | null; published_date: string | null }>;
  relationship_highlights: string[];
  on_the_ground: string[];
  pulse_signals: string[];
  reflection_contribution_count: number;
}

// ── Internal story aggregation (balanced sources + journal fragments) ──

async function buildMetroStoryInputs(
  supabase: ReturnType<typeof createClient>,
  metroId: string,
): Promise<MetroStoryInputs> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: metro } = await supabase
    .from("metros")
    .select("id, metro")
    .eq("id", metroId)
    .single();

  const metroName = metro?.metro ?? "this metro";

  // Parallel data collection — balanced across all source types + journal
  const [briefingsRes, momentumRes, highlightsRes, signalsRes, opportunitiesRes, storyUpdatesRes, journalRes] = await Promise.all([
    supabase
      .from("relationship_briefings")
      .select("briefing_json, metro_id, opportunity_id, week_start")
      .eq("scope", "metro")
      .eq("metro_id", metroId)
      .gte("week_start", thirtyDaysAgo.slice(0, 10))
      .order("week_start", { ascending: false })
      .limit(4),
    supabase
      .from("relationship_momentum")
      .select("opportunity_id, score, trend, score_delta, drivers")
      .order("score", { ascending: false })
      .limit(200),
    supabase
      .from("discovery_highlights")
      .select("kind, payload, created_at")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("opportunity_signals")
      .select("id, signal_type, signal_value, detected_at, source_url, opportunity_id")
      .gte("detected_at", thirtyDaysAgo)
      .order("detected_at", { ascending: false })
      .limit(200),
    supabase
      .from("opportunities")
      .select("id, organization, metro_id, partner_tiers, mission_snapshot")
      .eq("metro_id", metroId)
      .eq("status", "Active")
      .limit(100),
    supabase
      .from("relationship_story_updates")
      .select("summary_md, delta_type, opportunity_id, generated_at, chapter_id")
      .gte("generated_at", thirtyDaysAgo)
      .order("generated_at", { ascending: false })
      .limit(100),
    // Journal fragments — only IDs needed; we use extractions, never raw note_text
    supabase
      .from("journal_entries")
      .select("id, created_at")
      .eq("metro_id", metroId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const opportunities = opportunitiesRes.data ?? [];
  const oppIds = new Set(opportunities.map(o => o.id));
  const oppNameMap = new Map(opportunities.map(o => [o.id, o.organization]));

  // Filter to this metro
  const momentumData = (momentumRes.data ?? []).filter(m => oppIds.has(m.opportunity_id));
  const metroSignals = (signalsRes.data ?? []).filter(s => s.opportunity_id && oppIds.has(s.opportunity_id));

  // Build org story summaries — enriched with Phase 4A story fragments
  const storyUpdatesByOpp = new Map<string, string[]>();
  for (const su of storyUpdatesRes.data ?? []) {
    if (su.opportunity_id && oppIds.has(su.opportunity_id) && su.delta_type !== "noop") {
      const existing = storyUpdatesByOpp.get(su.opportunity_id) ?? [];
      existing.push(su.summary_md?.slice(0, 200) ?? "");
      storyUpdatesByOpp.set(su.opportunity_id, existing);
    }
  }

  const orgSummaries: OrgStorySummary[] = [];
  for (const opp of opportunities.slice(0, 20)) {
    const mom = momentumData.find(m => m.opportunity_id === opp.id);
    const orgSignals = metroSignals.filter(s => s.opportunity_id === opp.id).slice(0, 3);
    const storyFragments = storyUpdatesByOpp.get(opp.id) ?? [];

    orgSummaries.push({
      org_name: opp.organization,
      momentum_trend: mom?.trend ?? null,
      recent_story_points: [
        ...orgSignals.map(s => `${s.signal_type}: ${s.signal_value}`),
        ...storyFragments.slice(0, 2),
      ],
      partner_responses: (opp.partner_tiers ?? []) as string[],
    });
  }

  // Ecosystem patterns from briefings
  const ecosystemPatterns: string[] = [];
  for (const b of briefingsRes.data ?? []) {
    const json = b.briefing_json as Record<string, unknown> | null;
    if (json?.headline) ecosystemPatterns.push(json.headline as string);
    const topMoves = (json?.top_moves ?? []) as Array<{ title: string }>;
    for (const m of topMoves.slice(0, 2)) {
      ecosystemPatterns.push(m.title);
    }
  }

  // External signals from discovery highlights (deduplicated by title)
  const seenTitles = new Set<string>();
  const externalSignals: MetroStoryInputs["external_signals"] = [];
  for (const h of highlightsRes.data ?? []) {
    const p = h.payload as Record<string, unknown>;
    const title = ((p.title ?? h.kind) as string).trim();
    if (seenTitles.has(title.toLowerCase())) continue;
    seenTitles.add(title.toLowerCase());
    externalSignals.push({
      title,
      snippet: (p.snippet ?? p.summary ?? "") as string,
      source_url: (p.url ?? p.source_url ?? null) as string | null,
      published_date: (p.published_date ?? null) as string | null,
    });
  }

  // Relationship highlights — meaningful shifts from momentum + story updates
  const relationshipHighlights: string[] = [];
  const risingOrgs = orgSummaries.filter(o => o.momentum_trend === "rising");
  if (risingOrgs.length > 0) {
    relationshipHighlights.push(
      `${risingOrgs.length} partner${risingOrgs.length > 1 ? "s" : ""} showing rising momentum: ${risingOrgs.slice(0, 3).map(o => o.org_name).join(", ")}`,
    );
  }
  const decliningOrgs = orgSummaries.filter(o => o.momentum_trend === "declining");
  if (decliningOrgs.length > 0) {
    relationshipHighlights.push(
      `${decliningOrgs.length} relationship${decliningOrgs.length > 1 ? "s" : ""} may need attention`,
    );
  }
  for (const [oppId, fragments] of storyUpdatesByOpp) {
    if (fragments.length > 0) {
      const name = oppNameMap.get(oppId) ?? "A partner";
      relationshipHighlights.push(`${name}: ${fragments[0].slice(0, 120)}`);
      if (relationshipHighlights.length >= 5) break;
    }
  }

    // Journal fragments → blend as "on-the-ground" color (never quote verbatim)
  // Cap: max 10 entries per metro per build window
  const journalEntries = (journalRes.data ?? []).slice(0, 10);
  if (journalEntries.length > 0) {
    // Fetch extractions for these entries
    const entryIds = journalEntries.map(j => j.id);
    const { data: extractions } = await supabase
      .from("journal_extractions")
      .select("journal_entry_id, extracted_json")
      .in("journal_entry_id", entryIds);

    const extractionMap = new Map(
      (extractions ?? []).map(e => [e.journal_entry_id, e.extracted_json as Record<string, unknown>]),
    );

    // Surface only extracted topics/signals — NEVER raw note_text
    // Cap: max 2 topics + 1 signal per entry
    for (const je of journalEntries) {
      const ext = extractionMap.get(je.id);
      if (ext) {
        const topics = (ext.topics as string[]) ?? [];
        for (const t of topics.slice(0, 2)) {
          if (!ecosystemPatterns.includes(t)) ecosystemPatterns.push(`On the ground: ${t}`);
        }
        const signals = (ext.signals as Array<{ type: string }>) ?? [];
        for (const s of signals.slice(0, 1)) {
          relationshipHighlights.push(`Field observation: ${s.type.replace(/_/g, " ")}`);
        }
      }
    }
  }

  // ── Event Reflection Extractions (team-visible, attended in last 30 days) ──
  // PRIVACY: Fetch ONLY extractions (topics/signals), NEVER raw reflection bodies
  const onTheGround: string[] = [];
  let teamReflectionCount = 0;
  const { data: attendedEvents } = await supabase
    .from("events")
    .select("id")
    .eq("metro_id", metroId)
    .not("attended_at", "is", null)
    .gte("attended_at", thirtyDaysAgo)
    .limit(50);

  if (attendedEvents && attendedEvents.length > 0) {
    const attendedEventIds = attendedEvents.map(e => e.id);
    const { data: teamReflections } = await supabase
      .from("event_reflections")
      .select("id")
      .in("event_id", attendedEventIds)
      .eq("visibility", "team")
      .limit(30);

    if (teamReflections && teamReflections.length > 0) {
      teamReflectionCount = teamReflections.length;
      const reflectionIds = teamReflections.map(r => r.id);
      const { data: refExtractions } = await supabase
        .from("event_reflection_extractions")
        .select("topics, signals, summary_safe")
        .in("reflection_id", reflectionIds);

      const topicCounts = new Map<string, number>();
      const signalLabels: string[] = [];

      for (const ext of (refExtractions ?? []) as Array<{ topics: string[]; signals: Array<{ type: string }>; summary_safe: string }>) {
        for (const t of (ext.topics ?? [])) {
          topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
        }
        for (const s of (ext.signals ?? []).slice(0, 1)) {
          if (signalLabels.length < 5) {
            signalLabels.push(s.type.replace(/_/g, " "));
          }
        }
      }

      // Top topics by frequency (max 8)
      const sortedTopics = [...topicCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([topic]) => topic);

      for (const topic of sortedTopics) {
        onTheGround.push(topic);
      }
      for (const signal of signalLabels.slice(0, 5)) {
        if (!onTheGround.includes(signal)) {
          onTheGround.push(signal);
        }
      }
    }
  }

  // Local Pulse community signals (capped, no urgency)
  // Boost signals where narrative_weight='high'
  const { data: localPulseEvents } = await supabase
    .from("events")
    .select("event_name, metadata")
    .eq("metro_id", metroId)
    .eq("is_local_pulse", true)
    .gte("event_date", thirtyDaysAgo.slice(0, 10))
    .order("event_date", { ascending: false })
    .limit(20);

  const pulseSignals: string[] = [];
  const highWeightSignals: string[] = [];
  for (const lpe of (localPulseEvents ?? []).slice(0, 15)) {
    const meta = lpe.metadata as Record<string, unknown> | null;
    const weight = meta?.narrative_weight as string | undefined;
    if (weight === "high") {
      highWeightSignals.push(lpe.event_name);
    } else {
      pulseSignals.push(lpe.event_name);
    }
  }
  // High-weight signals go first
  const orderedPulseSignals = [...highWeightSignals.slice(0, 6), ...pulseSignals.slice(0, 4)];

  return {
    metro_context: { metro_id: metroId, metro_name: metroName },
    org_story_summaries: orgSummaries,
    ecosystem_patterns: ecosystemPatterns,
    external_signals: externalSignals.slice(0, 15),
    relationship_highlights: relationshipHighlights,
    on_the_ground: onTheGround,
    pulse_signals: orderedPulseSignals,
    reflection_contribution_count: teamReflectionCount,
  };
}

// ── Deterministic narrative builder (fallback) ──

function buildDeterministicNarrative(inputs: MetroStoryInputs): {
  headline: string;
  community_story: string;
  partner_story: string;
  emerging_patterns: string[];
  gentle_outlook: string;
  on_the_ground: string[];
} {
  const { metro_context, org_story_summaries, ecosystem_patterns, external_signals, relationship_highlights, on_the_ground, pulse_signals } = inputs;
  const metroName = metro_context.metro_name;
  const hasExternalSignals = external_signals.length > 0;
  const hasOrgStories = org_story_summaries.length > 0;
  const hasRelHighlights = relationship_highlights.length > 0;

  // Headline — story-driven, not metric-driven
  let headline: string;
  if (hasExternalSignals && hasOrgStories) {
    headline = `${metroName}: Community shifts and partner stories interweaving`;
  } else if (hasOrgStories) {
    headline = `${metroName}: Quiet progress across ${org_story_summaries.length} partnerships`;
  } else if (hasExternalSignals) {
    headline = `${metroName}: New developments in the community landscape`;
  } else {
    headline = `${metroName}: A steady season for relationships`;
  }

  // Community story — thin data fallback to org signals instead of filler
  let communityStory: string;
  if (hasExternalSignals) {
    const topSignals = external_signals.slice(0, 3).map(s =>
      `- ${s.title}${s.snippet ? `: ${s.snippet.slice(0, 120)}` : ""}`,
    ).join("\n");
    communityStory = `The community landscape in ${metroName} continues to evolve.\n\n${topSignals}`;
  } else if (hasRelHighlights) {
    // Fall back to relationship highlights instead of generating filler
    communityStory = `While no new external community developments have surfaced recently, the relationships within ${metroName} tell their own story of steady work and quiet impact.`;
  } else {
    communityStory = `${metroName} is in a quiet period. The current environment remains stable, giving space for deeper partnership work.`;
  }

  // Partner story — narrative-focused, not report-style
  let partnerStory: string;
  if (hasOrgStories) {
    const highlights = org_story_summaries.slice(0, 5).map(o => {
      const trend = o.momentum_trend ? ` (${o.momentum_trend})` : "";
      const point = o.recent_story_points[0] ?? "";
      return `- **${o.org_name}**${trend}${point ? `: ${point.slice(0, 150)}` : ""}`;
    }).join("\n");
    partnerStory = `Across ${metroName}, ${org_story_summaries.length} partner relationships continue to shape the community.\n\n${highlights}`;
  } else {
    partnerStory = `No active partner relationships are currently tracked in ${metroName}. As connections form, their stories will appear here.`;
  }

  // Emerging patterns — blend ecosystem + relationship highlights
  const emerging: string[] = [];
  for (const ep of ecosystemPatterns.slice(0, 3)) {
    emerging.push(ep);
  }
  for (const rh of relationship_highlights.slice(0, 2)) {
    if (emerging.length < 5) emerging.push(rh);
  }

  // Gentle outlook
  const gentle_outlook = hasOrgStories
    ? `${metroName} continues to grow as a connected ecosystem. The relationships here suggest steady, grounded progress.`
    : `${metroName} is an emerging space with room for new partnerships and community connections.`;

  // On the ground — from event reflection extractions + pulse
  const onTheGroundOutput = [
    ...on_the_ground.slice(0, 8),
    ...pulse_signals.slice(0, 5).map(s => `Local event: ${s}`),
  ].slice(0, 10);

  return { headline, community_story: communityStory, partner_story: partnerStory, emerging_patterns: emerging, gentle_outlook, on_the_ground: onTheGroundOutput };
}

// ── AI narrative generation ──

async function generateAINarrative(
  inputs: MetroStoryInputs,
): Promise<{
  headline: string;
  community_story: string;
  partner_story: string;
  emerging_patterns: string[];
  gentle_outlook: string;
} | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;

  const systemPrompt = `You are NRI (Narrative Relational Intelligence), writing a community narrative for a metro area. You are a WITNESS to unfolding work — curious and attentive, never authoritative.

OBSERVER POSTURE:
- Never say: "This reveals…", "This demonstrates…", "This proves…", "We must…"
- Instead use: "Taken together, these moments begin to suggest…", "Some communities are discovering…", "Perhaps…", "It may be that…"

CONCRETE IMAGERY (MANDATORY):
- Every narrative section must include at least one grounded image (shared meals, volunteers arriving, families settling in, conversations at tables).
- If a paragraph has 3+ abstract nouns, inject concrete imagery.

TONE: Calm, present, grounded, hopeful without hype. Never promotional, triumphalistic, or overly poetic.
SECTOR LANGUAGE: Use "lived moments", "relational observations", "community rhythms" — never "nonprofit sector analysis" or "faith-based industry trends".
Blend external metro changes with how partner organizations are responding.
Do NOT expose internal CRM notes or metrics. Do NOT generate directives or calls to action.
Do NOT use words like: urgent, critical, immediately, action required, high priority, breaking.
If data is thin, write a shorter narrative rather than generating filler text.

Return ONLY valid JSON with exactly these keys:
{
  "headline": "A warm, descriptive headline (1 sentence)",
  "community_story": "1-2 paragraphs about what's changing in the community",
  "partner_story": "1-2 paragraphs about how partners are responding and evolving",
  "emerging_patterns": ["pattern1", "pattern2"],
  "gentle_outlook": "1 short paragraph looking ahead"
}`;

  const userPrompt = `Metro: ${inputs.metro_context.metro_name}

External community signals (${inputs.external_signals.length}):
${inputs.external_signals.slice(0, 10).map(s => `- ${s.title}: ${s.snippet?.slice(0, 150) ?? ""}${s.source_url ? ` (${s.source_url})` : ""}`).join("\n") || "None available — focus on partner stories instead."}

Partner organizations (${inputs.org_story_summaries.length}):
${inputs.org_story_summaries.slice(0, 10).map(o => `- ${o.org_name} [trend: ${o.momentum_trend ?? "steady"}]: ${o.recent_story_points.slice(0, 2).join("; ") || "quiet period"}`).join("\n") || "None tracked yet."}

Relationship highlights:
${inputs.relationship_highlights.slice(0, 5).join("\n") || "No notable shifts this period."}

Ecosystem patterns observed:
${inputs.ecosystem_patterns.slice(0, 5).join("\n") || "None yet."}

Write the narrative now. If data is thin, keep it brief and grounded.`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      console.error("AI gateway error:", resp.status, await resp.text());
      return null;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.headline || !parsed.community_story || !parsed.partner_story || !parsed.gentle_outlook) {
      console.error("AI response missing required keys");
      return null;
    }

    return {
      headline: removeUrgencyLanguage(parsed.headline),
      community_story: removeUrgencyLanguage(parsed.community_story),
      partner_story: removeUrgencyLanguage(parsed.partner_story),
      emerging_patterns: (parsed.emerging_patterns ?? []).map((p: string) => removeUrgencyLanguage(p)),
      gentle_outlook: removeUrgencyLanguage(parsed.gentle_outlook),
    };
  } catch (e) {
    console.error("AI narrative generation failed:", e);
    return null;
  }
}

// ── Compose markdown ──

function composeNarrativeMarkdown(narrative: {
  headline: string;
  community_story: string;
  partner_story: string;
  emerging_patterns: string[];
  gentle_outlook: string;
}): string {
  const sections = [
    `# ${narrative.headline}`,
    "",
    "## What's changing in our city",
    "",
    narrative.community_story,
    "",
    "## From our partners",
    "",
    narrative.partner_story,
  ];

  if (narrative.emerging_patterns.length > 0) {
    sections.push("", "## Emerging patterns", "");
    for (const p of narrative.emerging_patterns) {
      sections.push(`- ${p}`);
    }
  }

  sections.push("", "## Looking ahead", "", narrative.gentle_outlook);

  return sections.join("\n");
}

// ── Notification (soft mode) ──

async function notifyMetroNarrative(
  supabase: ReturnType<typeof createClient>,
  metroId: string,
  metroName: string,
): Promise<void> {
  const dateBucket = new Date().toISOString().slice(0, 10);
  const dedupeKey = `metro-narrative:${metroId}:${dateBucket}`;

  const userIds = new Set<string>();

  const { data: metroUsers } = await supabase
    .from("user_metro_assignments")
    .select("user_id")
    .eq("metro_id", metroId)
    .limit(10);
  for (const u of metroUsers ?? []) userIds.add(u.user_id);

  if (userIds.size === 0) {
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "regional_lead"])
      .limit(5);
    for (const a of admins ?? []) userIds.add(a.user_id);
  }

  if (userIds.size === 0) return;

  const rows = Array.from(userIds).map(userId => ({
    user_id: userId,
    org_id: null,
    notification_type: "metro_narrative_update",
    payload: {
      dedupe_key: dedupeKey,
      metro_id: metroId,
      metro_name: metroName,
      message: `New story available for ${metroName} — see how your partnerships are shaping the community.`,
    },
  }));

  await supabase.from("proactive_notifications").insert(rows).throwOnError().catch(() => {});
}

// ── Drift snapshot + computation ──

async function buildDriftSnapshot(
  supabase: ReturnType<typeof createClient>,
  metroId: string,
  narrativeJson: Record<string, unknown>,
  inputs: MetroStoryInputs,
  periodStart: string,
  periodEnd: string,
): Promise<void> {
  // Derive topic_counts from narrative emerging_patterns + ecosystem_patterns
  const rawTopics: Record<string, number> = {};
  for (const p of (narrativeJson.detected_patterns as string[]) ?? []) {
    const slug = p.toLowerCase().trim();
    if (slug) rawTopics[slug] = (rawTopics[slug] ?? 0) + 1;
  }
  for (const p of inputs.ecosystem_patterns) {
    const slug = p.toLowerCase().trim();
    if (slug) rawTopics[slug] = (rawTopics[slug] ?? 0) + 1;
  }
  for (const s of inputs.pulse_signals) {
    const slug = s.toLowerCase().trim();
    if (slug) rawTopics[slug] = (rawTopics[slug] ?? 0) + 1;
  }

  const topicCounts = normalizeTopicCounts(rawTopics);

  // Signal counts from external signals
  const rawSignals: Record<string, number> = {};
  for (const s of inputs.external_signals) {
    const slug = (s.title ?? "").toLowerCase().trim();
    if (slug) rawSignals[slug] = (rawSignals[slug] ?? 0) + 1;
  }
  const signalCounts = normalizeTopicCounts(rawSignals);

  // Source mix
  const sourceMix = {
    news: inputs.external_signals.length,
    reflections: inputs.reflection_contribution_count,
    partners: inputs.org_story_summaries.length,
    pulse_events: inputs.pulse_signals.length,
  };

  // Hash for dedup
  const narrativeHash = btoa(JSON.stringify(narrativeJson)).slice(0, 64);

  // Upsert snapshot
  const { data: snapshot, error: snapErr } = await supabase
    .from("metro_narrative_snapshots")
    .upsert({
      metro_id: metroId,
      period_start: periodStart,
      period_end: periodEnd,
      narrative_hash: narrativeHash,
      topic_counts: topicCounts,
      signal_counts: signalCounts,
      source_mix: sourceMix,
    }, { onConflict: "metro_id,period_start,period_end" })
    .select("id")
    .single();

  if (snapErr || !snapshot) {
    console.error("Snapshot upsert failed:", snapErr?.message);
    return;
  }

  // Fetch previous snapshot
  const { data: prevSnap } = await supabase
    .from("metro_narrative_snapshots")
    .select("id, topic_counts, signal_counts, source_mix")
    .eq("metro_id", metroId)
    .lt("period_start", periodStart)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Compute drift
  const previous = prevSnap ? {
    topic_counts: (prevSnap.topic_counts ?? {}) as Record<string, number>,
    signal_counts: (prevSnap.signal_counts ?? {}) as Record<string, number>,
    source_mix: (prevSnap.source_mix ?? {}) as Record<string, number>,
  } : null;

  const current = { topic_counts: topicCounts, signal_counts: signalCounts, source_mix: sourceMix };
  const drift = computeDrift(previous, current);

  // Insert drift record
  await supabase.from("metro_narrative_drifts").insert({
    metro_id: metroId,
    current_snapshot_id: snapshot.id,
    previous_snapshot_id: prevSnap?.id ?? null,
    period_start: periodStart,
    period_end: periodEnd,
    drift_score: drift.drift_score,
    emerging_topics: drift.emerging_topics,
    fading_topics: drift.fading_topics,
    accelerating_topics: drift.accelerating_topics,
    stable_themes: drift.stable_themes,
    divergence: drift.divergence,
    summary_md: drift.summary_md,
  });
}

// ── Build + insert a single narrative ──

async function buildSingleNarrative(
  supabase: ReturnType<typeof createClient>,
  metroId: string,
): Promise<{ ok: boolean; narrative_id?: string; ai_generated?: boolean; source_summary?: Record<string, unknown>; error?: string }> {
  const inputs = await buildMetroStoryInputs(supabase, metroId);

  let narrative = await generateAINarrative(inputs);
  const aiGenerated = !!narrative;
  if (!narrative) {
    narrative = buildDeterministicNarrative(inputs);
  }

  const narrativeMd = composeNarrativeMarkdown(narrative);

  const sourceSummary = {
    org_count: inputs.org_story_summaries.length,
    external_signal_count: inputs.external_signals.length,
    ecosystem_pattern_count: inputs.ecosystem_patterns.length,
    relationship_highlight_count: inputs.relationship_highlights.length,
    rising_orgs: inputs.org_story_summaries.filter(o => o.momentum_trend === "rising").length,
  };

  const rawNarrativeJson = {
    ...narrative,
    detected_patterns: narrative.emerging_patterns,
    on_the_ground: narrative.on_the_ground ?? inputs.on_the_ground ?? [],
    reflection_contribution_count: inputs.reflection_contribution_count,
    cross_metro_signals: [],
    partner_response_clusters: inputs.org_story_summaries
      .filter(o => o.momentum_trend)
      .map(o => ({ org_name: o.org_name, trend: o.momentum_trend })),
  };

  // Privacy guard: strip any banned keys before persisting narrative_json
  const narrativeJson = stripPrivateFields(rawNarrativeJson);

  const now = new Date();
  const periodEnd = now.toISOString().slice(0, 10);
  const periodStart = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);

  const { data: inserted, error: insertErr } = await supabase
    .from("metro_narratives")
    .insert({
      metro_id: metroId,
      headline: narrative.headline,
      narrative_md: narrativeMd,
      narrative_json: narrativeJson,
      source_summary: sourceSummary,
      ai_generated: aiGenerated,
      period_start: periodStart,
      period_end: periodEnd,
    })
    .select("id")
    .single();

  if (insertErr) return { ok: false, error: insertErr.message };

  // ── Drift snapshot + computation (best-effort, non-blocking) ──
  try {
    await buildDriftSnapshot(supabase, metroId, narrativeJson, inputs, periodStart, periodEnd);
  } catch (e) {
    console.error("Drift snapshot error (non-blocking):", e);
  }

  // Fire partner matching (best-effort, non-blocking)
  try {
    await notifyMetroNarrative(supabase, metroId, inputs.metro_context.metro_name);
  } catch (e) {
    console.error("Notification error:", e);
  }

  // Dispatch narrative-partner-match (best-effort, non-blocking)
  try {
    const fnUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (fnUrl && serviceKey) {
      fetch(`${fnUrl}/functions/v1/narrative-partner-match`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ metro_id: metroId, narrative_id: inserted.id }),
      }).catch(e => console.error("Partner match dispatch error:", e));
    }
  } catch (e) {
    console.error("Partner match dispatch error:", e);
  }

  return { ok: true, narrative_id: inserted.id, ai_generated: aiGenerated, source_summary: sourceSummary };
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = authenticateServiceRequest(req);
  if (!auth.authenticated) {
    return jsonError(401, "unauthorized", "Invalid or missing credentials");
  }

  let supabase: ReturnType<typeof createClient>;
  if (auth.isUser) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${auth.token}` } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonError(401, "unauthorized", "Invalid token");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const userRoles = (roles ?? []).map((r: { role: string }) => r.role);
    if (!userRoles.some(r => ["admin", "regional_lead", "leadership"].includes(r))) {
      return jsonError(403, "forbidden", "Requires admin or regional_lead role");
    }
    supabase = serviceClient;
  } else {
    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const metroId = body.metro_id as string | undefined;
    const mode = (body.mode as string) || (metroId ? "single" : "batch");

    if (mode === "single") {
      if (!metroId) return jsonError(400, "missing_field", "metro_id required");

      const result = await buildSingleNarrative(supabase, metroId);
      if (!result.ok) return jsonError(500, "db_error", result.error ?? "Unknown error");

      return jsonOk({
        ok: true,
        metro_id: metroId,
        narrative_id: result.narrative_id,
        ai_generated: result.ai_generated,
        source_summary: result.source_summary,
      });
    }

    // Batch mode — capped
    const { data: metros, error: metrosErr } = await supabase
      .from("metros")
      .select("id, metro")
      .order("metro")
      .limit(MAX_METROS);

    if (metrosErr) return jsonError(500, "db_error", metrosErr.message);

    const results: Array<{ metro_id: string; metro_name: string; narrative_id?: string; error?: string }> = [];

    for (const m of metros ?? []) {
      try {
        const result = await buildSingleNarrative(supabase, m.id);
        if (!result.ok) {
          results.push({ metro_id: m.id, metro_name: m.metro, error: result.error });
        } else {
          results.push({ metro_id: m.id, metro_name: m.metro, narrative_id: result.narrative_id });
        }
      } catch (e) {
        results.push({ metro_id: m.id, metro_name: m.metro, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return jsonOk({
      ok: true,
      mode: "batch",
      total: (metros ?? []).length,
      results,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("Metro narrative build error:", errMsg);
    return jsonError(500, "internal_error", errMsg);
  }
});
