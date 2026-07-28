/**
 * generate-providence — Edge function for Providence report generation.
 *
 * WHAT: Fetches tenant signals, runs deterministic arc analysis, then AI-polishes narrative.
 * WHERE: Called from Compass "Generate Providence" button or scheduled trigger.
 * WHY: Single AI call per report — structural reasoning is fully deterministic.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { callLlmJson } from "../_shared/llmGateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ArcSummary {
  directionMatrix: Record<string, Record<string, number>>;
  dominantDirection: string;
  shiftDetected: boolean;
  priorDominant: string | null;
  lifeEventClusters: { eventType: string; count: number; isFirstOccurrence: boolean }[];
  relationshipPatterns: Record<string, number>;
  territoryPatterns: Record<string, number>;
  rhythmPatterns: Record<string, number | boolean>;
}

// ── Direction inference (mirror of client-side) ────────────
const ACTIVITY_DIR: Record<string, string> = {
  visit: "care", meeting: "care", phone_call: "care", site_visit: "care", note: "care",
  email: "expansion", referral: "expansion", event: "expansion",
  task: "steadfastness", follow_up: "steadfastness", proposal: "steadfastness",
  reconnect: "restoration", check_in: "restoration",
};

function emptyMatrix() {
  return { care: 0, expansion: 0, restoration: 0, steadfastness: 0 };
}

function dominant(m: Record<string, number>) {
  let best = "care", max = 0;
  for (const [k, v] of Object.entries(m)) {
    if (v > max) { max = v; best = k; }
  }
  return best;
}

// ── Season classifier ──────────────────────────────────────
function classifySeason(arc: ArcSummary) {
  const d = arc.dominantDirection;
  const d90 = arc.directionMatrix.d90 as Record<string, number>;
  const total = Object.values(d90).reduce((s, v) => s + v, 0);
  const pct = total > 0 ? (d90[d] || 0) / total : 0;

  if (arc.shiftDetected && arc.priorDominant) {
    return {
      seasonLabel: `From ${cap(arc.priorDominant)} toward ${cap(d)}`,
      classification: "Threshold Crossing",
    };
  }
  if (d === "restoration" && pct > 0.5) {
    return { seasonLabel: "A Season of Restoration", classification: "Restorative Season" };
  }
  if (d === "expansion" && (arc.territoryPatterns.activations > 0 || arc.relationshipPatterns.newEntities >= 3)) {
    return { seasonLabel: "An Expansion Cycle", classification: "Expansion Cycle" };
  }
  if (d === "steadfastness" && pct > 0.45 && arc.rhythmPatterns.steadyCadence) {
    return { seasonLabel: "Quiet Faithfulness", classification: "Quiet Faithfulness" };
  }
  if (d === "care" && pct > 0.55) {
    return { seasonLabel: "A Season of Deep Care", classification: "Deep Care" };
  }
  if (arc.relationshipPatterns.dormantReactivations >= 2) {
    return { seasonLabel: "A Time of Reawakening", classification: "Reawakening" };
  }
  return { seasonLabel: `A Season of ${cap(d)}`, classification: "Steady Movement" };
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { tenant_id, trigger_type = "manual" } = body;
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFoundational = trigger_type === "foundational";
    // DB constraint currently allows: quarterly | arc_shift | manual.
    // Keep foundational semantics in dedicated `foundational` boolean column,
    // while normalizing trigger_type for compatibility.
    const normalizedTriggerType = isFoundational ? "manual" : trigger_type;
    if (!["manual", "quarterly", "arc_shift"].includes(normalizedTriggerType)) {
      return new Response(JSON.stringify({ error: `Invalid trigger_type: ${trigger_type}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify membership
    const { data: membership } = await adminClient
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .limit(1);
    if (!membership?.length) {
      return new Response(JSON.stringify({ error: "Not a tenant member" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tenant metadata
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("archetype, relational_orientation, slug, created_at")
      .eq("id", tenant_id)
      .single();

    const now = new Date();
    const y1ago = new Date(now.getTime() - 365 * 86400000).toISOString();

    // Fetch signals in parallel
    const [activitiesRes, lifeEventsRes, reflectionsRes, oppsRes] = await Promise.all([
      adminClient.from("activities").select("activity_type, activity_date_time")
        .eq("tenant_id", tenant_id).gte("activity_date_time", y1ago).limit(2000),
      adminClient.from("life_events").select("event_type, event_date, entity_type")
        .eq("tenant_id", tenant_id).gte("event_date", y1ago).limit(500),
      adminClient.from("reflections").select("created_at")
        .eq("tenant_id", tenant_id).gte("created_at", y1ago).limit(500),
      adminClient.from("opportunities").select("id, created_at, stage, last_activity_date")
        .eq("tenant_id", tenant_id).limit(500),
    ]);

    const activities = activitiesRes.data || [];
    const lifeEvents = lifeEventsRes.data || [];
    const reflections = reflectionsRes.data || [];
    const opps = oppsRes.data || [];

    // ── Stage 1: Direction matrix ──
    const msPerDay = 86400000;
    const endMs = now.getTime();
    const d30 = emptyMatrix(), d90 = emptyMatrix(), d180 = emptyMatrix(), d365 = emptyMatrix();

    for (const a of activities) {
      const dir = ACTIVITY_DIR[a.activity_type] || "care";
      const age = (endMs - new Date(a.activity_date_time).getTime()) / msPerDay;
      if (age <= 365) d365[dir]++;
      if (age <= 180) d180[dir]++;
      if (age <= 90) d90[dir]++;
      if (age <= 30) d30[dir]++;
    }
    for (const r of reflections) {
      const age = (endMs - new Date(r.created_at).getTime()) / msPerDay;
      if (age <= 365) d365.care++;
      if (age <= 180) d180.care++;
      if (age <= 90) d90.care++;
      if (age <= 30) d30.care++;
    }

    const dominantDir = dominant(d90);
    const priorDom = dominant(d365);
    const total90 = Object.values(d90).reduce((s, v) => s + v, 0);
    const shiftDetected = dominantDir !== priorDom && total90 > 0 && (d90[dominantDir] / total90) > 0.4;

    // Life event clusters
    const eCounts: Record<string, number> = {};
    for (const le of lifeEvents) {
      const age = (endMs - new Date(le.event_date).getTime()) / msPerDay;
      if (age <= 30) eCounts[le.event_type] = (eCounts[le.event_type] || 0) + 1;
    }
    const olderTypes = new Set(
      lifeEvents.filter(le => (endMs - new Date(le.event_date).getTime()) / msPerDay > 30).map(le => le.event_type)
    );
    const lifeEventClusters = Object.entries(eCounts)
      .filter(([, c]) => c >= 3)
      .map(([t, c]) => ({ eventType: t, count: c, isFirstOccurrence: !olderTypes.has(t) }));

    // Rhythm
    const dailyBuckets: Record<string, number> = {};
    for (const a of activities) {
      const day = a.activity_date_time.slice(0, 10);
      dailyBuckets[day] = (dailyBuckets[day] || 0) + 1;
    }
    const counts = Object.values(dailyBuckets);
    const burstDays = counts.filter(c => c >= 5).length;
    const mean = counts.length ? counts.reduce((s, c) => s + c, 0) / counts.length : 0;
    const variance = counts.length ? counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length : 0;
    const steadyCadence = counts.length >= 14 && variance < mean * 2;

    const newEntities = opps.filter(o => (endMs - new Date(o.created_at).getTime()) / msPerDay <= 90).length;

    const arcSummary: ArcSummary = {
      directionMatrix: { d30, d90, d180, d365 },
      dominantDirection: dominantDir,
      shiftDetected,
      priorDominant: shiftDetected ? priorDom : null,
      lifeEventClusters,
      relationshipPatterns: {
        newEntities,
        dormantReactivations: 0,
        closures: 0,
        richnessUpgrades: 0,
        journeyTransitions: 0,
      },
      territoryPatterns: { activations: 0, firstSignalRegions: 0, contractions: 0 },
      rhythmPatterns: { burstDays, silenceDays: 0, steadyCadence },
    };

    // ── Stage 2: Season classification ──
    const season = isFoundational
      ? { seasonLabel: "A Season of Beginning", classification: "Foundational" }
      : classifySeason(arcSummary);

    // ── Stage 2.5: Revelation window determination (rule-based, no AI) ──
    let revelationStart: string | null = null;
    let revelationEnd: string | null = null;
    let revelationType: string | null = null;

    const qualifiesForRevelation = (cls: string): string | null => {
      if (cls === 'Threshold Crossing') return 'threshold_crossing';
      if (cls === 'Reawakening') return 're_emergence';
      if (cls === 'Expansion Cycle' && arcSummary.territoryPatterns.activations > 0) return 'first_activation';
      if (cls === 'Restorative Season' && arcSummary.lifeEventClusters.some(c => c.eventType === 'death')) return 'restorative_shift';
      return null;
    };

    const revType = qualifiesForRevelation(season.classification);
    if (revType) {
      // Check no active revelation window already exists for this tenant
      const { data: activeWindow } = await adminClient
        .from('providence_reports')
        .select('id')
        .eq('tenant_id', tenant_id)
        .not('revelation_end', 'is', null)
        .gte('revelation_end', now.toISOString())
        .limit(1);

      if (!activeWindow?.length) {
        revelationStart = now.toISOString();
        revelationEnd = new Date(now.getTime() + 30 * msPerDay).toISOString();
        revelationType = revType;
      }
    }

    // ── Stage 3: AI narrative polish (single call) ──
    const orientation = tenant?.relational_orientation || "hybrid";
    const archetype = tenant?.archetype || "general";

    const aiResult = await callLlmJson<{
      privateNarrative: string;
      shareableNarrative: string;
    }>(
      [
        {
          role: "system",
          content: isFoundational
            ? `You are a contemplative narrative writer in the Ignatian tradition. You write a warm, grounded, gently encouraging first reflection for an organization that is just beginning.

STRICT GUARDRAILS:
1. NEVER invent names, numbers, or dates not in the data.
2. Do NOT classify seasons. This is a foundational moment, not a pattern.
3. Be brief: 2 paragraphs private, 1 paragraph shareable.
4. Tone: affirming, grounded, gentle. "In these first weeks…" style.
5. Do NOT use urgency, performance, or metric language.
6. Do NOT reference "the data" or "the system."

Orientation: ${orientation === "human_focused" ? "deeply personal, relational" : orientation === "institution_focused" ? "strategic yet warm" : "balanced"}

Return JSON: { privateNarrative: string, shareableNarrative: string }`
            : `You are a contemplative narrative writer in the Ignatian tradition. You write warm, layered reflections about an organization's relational movement over the past quarter.

STRICT GUARDRAILS — you MUST follow these:
1. NEVER invent, fabricate, or hallucinate any names (people, organizations, places) that are NOT explicitly provided in the data below.
2. NEVER invent specific numbers, dates, or statistics beyond what is explicitly stated.
3. ONLY phrase the structural truths provided — do not embellish with fictional examples.
4. If the data is sparse, write a shorter reflection. Do NOT pad with invented details.
5. NEVER use alarm, urgency, or crisis language. Be gentle, dignified, and human.
6. Do NOT reference "the data" or "the system" — write as if reflecting alongside the reader.

Tone: ${orientation === "human_focused" ? "deeply personal, relational" : orientation === "institution_focused" ? "strategic yet warm" : "balanced, bridging personal and organizational"}
Archetype: ${archetype}

Return a JSON object with:
- privateNarrative: A 3-4 paragraph Ignatian reflection for the tenant's private use. Use "you/your" language. Reference the season, movement patterns, and any life event clusters. End with an invitation for discernment.
- shareableNarrative: A 2-3 paragraph version suitable for sharing with leadership or funders. Slightly broader tone, no internal-only language. Export-ready.

Do not include raw numbers. Do not exaggerate. Do not invent events that aren't in the data.`,
        },
        {
          role: "user",
          content: `Season: ${season.seasonLabel} (${season.classification})
Dominant Direction: ${arcSummary.dominantDirection}
Shift Detected: ${arcSummary.shiftDetected ? `Yes, from ${arcSummary.priorDominant}` : "No"}
Life Event Clusters: ${lifeEventClusters.length > 0 ? lifeEventClusters.map(c => `${c.eventType} (${c.count}x${c.isFirstOccurrence ? ", first time" : ""})`).join(", ") : "None"}
Relationship Movement: ${newEntities} new relationships in 90 days
Rhythm: ${steadyCadence ? "Steady cadence" : burstDays >= 5 ? "Burst pattern" : "Variable rhythm"}
90-day direction breakdown: Care ${d90.care}, Expansion ${d90.expansion}, Restoration ${d90.restoration}, Steadfastness ${d90.steadfastness}`,
        },
      ],
      { model: "google/gemini-2.5-flash", temperature: 0.6, timeoutMs: 45_000 }
    );

    let privateNarrative = "";
    let shareableNarrative = "";

    if (aiResult.ok && aiResult.data) {
      privateNarrative = aiResult.data.privateNarrative || "";
      shareableNarrative = aiResult.data.shareableNarrative || "";
    } else {
      // Fallback — structural description only
      privateNarrative = `This quarter has been characterized by ${season.seasonLabel.toLowerCase()}. Your dominant movement has been toward ${arcSummary.dominantDirection}. ${arcSummary.shiftDetected ? `A shift was noticed from ${arcSummary.priorDominant}.` : "The direction has remained steady."} Take a moment to notice what this season is teaching you.`;
      shareableNarrative = `The past quarter reflects ${season.seasonLabel.toLowerCase()}, with primary energy flowing toward ${arcSummary.dominantDirection}. ${newEntities > 0 ? `${newEntities} new relationships emerged.` : "Existing relationships were tended."}`;
    }

    // ── Version check ──
    const periodStart = new Date(now.getTime() - 90 * msPerDay).toISOString().slice(0, 10);
    const periodEnd = now.toISOString().slice(0, 10);

    const { data: existing } = await adminClient
      .from("providence_reports")
      .select("version")
      .eq("tenant_id", tenant_id)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .order("version", { ascending: false })
      .limit(1);

    const version = existing?.length ? existing[0].version + 1 : 1;

    // ── Insert report ──
    const { data: report, error: insertErr } = await adminClient
      .from("providence_reports")
      .insert({
        tenant_id,
        season_label: season.seasonLabel,
        dominant_direction: arcSummary.dominantDirection,
        classification: season.classification,
        arc_summary_json: arcSummary,
        narrative_private: privateNarrative,
        narrative_shareable: shareableNarrative,
        period_start: periodStart,
        period_end: periodEnd,
        trigger_type: normalizedTriggerType,
        version,
        created_by: user.id,
        revelation_start: revelationStart,
        revelation_end: revelationEnd,
        revelation_type: revelationType,
        foundational: isFoundational,
      })
      .select("id, season_label, classification, dominant_direction, version, generated_at, revelation_type, foundational")
      .single();

    if (insertErr) {
      console.error("Providence insert error:", insertErr);
      return new Response(JSON.stringify({ ok: false, error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Constellation signal (anonymized) ──
    // Derive region_key from tenant's primary metro, falling back to archetype
    let regionKey = "unknown";
    const { data: metroLink } = await adminClient
      .from("opportunities")
      .select("metro_id, metros!inner(name)")
      .eq("tenant_id", tenant_id)
      .not("metro_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (metroLink?.metros && typeof metroLink.metros === 'object' && 'name' in metroLink.metros) {
      regionKey = String((metroLink.metros as any).name).toLowerCase().replace(/\s+/g, '-');
    } else if (tenant?.archetype) {
      regionKey = tenant.archetype;
    }

    await adminClient.from("providence_constellation_signals").insert({
      region_key: regionKey,
      archetype: archetype,
      dominant_direction: arcSummary.dominantDirection,
      classification: season.classification,
      intensity: total90 > 0 ? (d90[dominantDir] / total90) : 0,
    });

    return new Response(JSON.stringify({ ok: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Providence error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
