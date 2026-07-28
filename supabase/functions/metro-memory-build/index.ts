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
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    if (authHeader.slice(7).trim() === serviceRoleKey) return true;
  }

  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  if (!token) return false;

  return (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);
}

const URGENCY_RE = /\b(urgent|critical|act now|immediately|asap|emergency|deadline|hurry|don't miss|last chance|breaking|high priority|action required|must)\b/gi;
function cleanTone(text: string): string {
  return text.replace(URGENCY_RE, "").replace(/\s{2,}/g, " ").trim();
}

interface MemoryJson {
  headline: string;
  chapters: Array<{
    title: string; window_start: string; window_end: string; themes: string[];
    highlights: Array<{ type: string; text: string; source_url?: string }>;
    partners_involved: Array<{ opportunity_id: string; name: string }>;
  }>;
  echoes: Array<{ title: string; text: string; lookback_window: string; evidence: Array<{ type: string; date?: string; source_url?: string }> }>;
  checkins: Array<{ opportunity_id: string; reason: string; suggested_subject: string; suggested_body: string }>;
  metrics: { provisions_count: number; signals_count: number; events_count: number; grants_count: number };
}

function emptyMemoryJson(): MemoryJson {
  return { headline: "", chapters: [], echoes: [], checkins: [], metrics: { provisions_count: 0, signals_count: 0, events_count: 0, grants_count: 0 } };
}

function validateMemoryJson(obj: unknown): MemoryJson {
  const fallback = emptyMemoryJson();
  if (!obj || typeof obj !== "object") return fallback;
  const o = obj as Record<string, unknown>;
  return {
    headline: typeof o.headline === "string" ? cleanTone(o.headline) : "",
    chapters: Array.isArray(o.chapters) ? (o.chapters as MemoryJson["chapters"]).slice(0, 6).map(c => ({
      ...c, highlights: (c.highlights || []).slice(0, 5), themes: (c.themes || []).slice(0, 3),
    })) : [],
    echoes: Array.isArray(o.echoes) ? (o.echoes as MemoryJson["echoes"]).slice(0, 3).map(e => ({
      ...e, title: cleanTone(e.title || ""), text: cleanTone(e.text || ""),
    })) : [],
    checkins: Array.isArray(o.checkins) ? (o.checkins as MemoryJson["checkins"]).slice(0, 3).map(ci => ({
      ...ci,
      reason: cleanTone(ci.reason || ""),
      suggested_subject: cleanTone(ci.suggested_subject || ""),
      suggested_body: cleanTone(ci.suggested_body || ""),
    })) : [],
    metrics: {
      provisions_count: Number((o.metrics as Record<string, unknown>)?.provisions_count) || 0,
      signals_count: Number((o.metrics as Record<string, unknown>)?.signals_count) || 0,
      events_count: Number((o.metrics as Record<string, unknown>)?.events_count) || 0,
      grants_count: Number((o.metrics as Record<string, unknown>)?.grants_count) || 0,
    },
  };
}

// ── Deterministic fallback check-in generator ──
function buildFallbackCheckins(
  journalThemes: string[],
  opps: Array<{ id: string; organization: string }>,
  knowledgeFocusAreas: Map<string, string[]>,
): MemoryJson["checkins"] {
  if (journalThemes.length === 0 || opps.length === 0) return [];

  const checkins: MemoryJson["checkins"] = [];
  const themesLower = journalThemes.map(t => t.toLowerCase());

  for (const opp of opps) {
    if (checkins.length >= 1) break; // cap at 1 for fallback

    const focusAreas = knowledgeFocusAreas.get(opp.id) || [];
    const focusLower = focusAreas.map(f => f.toLowerCase());

    // Simple keyword overlap check
    const matchingTheme = themesLower.find(theme =>
      focusLower.some(focus =>
        focus.includes(theme) || theme.includes(focus) ||
        theme.split(/\s+/).some(word => word.length > 3 && focusLower.some(f => f.includes(word)))
      )
    );

    if (matchingTheme) {
      const originalTheme = journalThemes[themesLower.indexOf(matchingTheme)];
      checkins.push({
        opportunity_id: opp.id,
        reason: `Recent community themes around "${originalTheme}" may connect to ${opp.organization}'s work — might be worth a gentle check-in.`,
        suggested_subject: `Thinking of you — ${originalTheme}`,
        suggested_body: `Hi there,\n\nI've been following some developments in our community around ${originalTheme}, and it made me think of the work ${opp.organization} is doing.\n\nWould love to catch up when you have a moment — no rush at all.\n\nWarmly,`,
      });
    }
  }

  return checkins;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST");
  if (!authenticateServiceRequest(req)) return jsonError(401, "UNAUTHORIZED", "Invalid credentials");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const mode = body.mode || "single";
    const windowDays = body.window_days || 120;

    let metroIds: string[] = [];
    if (mode === "single" && body.metro_id) {
      metroIds = [body.metro_id];
    } else if (mode === "batch") {
      const { data: metros } = await supabase.from("metros").select("id").limit(100);
      metroIds = (metros || []).map((m: { id: string }) => m.id);
    } else if (body.metro_id) {
      metroIds = [body.metro_id];
    }

    if (metroIds.length === 0) return jsonOk({ ok: true, processed: 0 });

    const windowEnd = new Date();
    const windowStart = new Date(Date.now() - windowDays * 86400000);
    const wsStr = windowStart.toISOString().slice(0, 10);
    const weStr = windowEnd.toISOString().slice(0, 10);
    const results: Array<{ metro_id: string; chapters_count: number; echoes_count: number; checkins_count: number }> = [];

    for (const metroId of metroIds) {
      try {
        const { data: metro } = await supabase.from("metros").select("id, name").eq("id", metroId).single();
        if (!metro) continue;

        // Fetch opportunity IDs for this metro first (avoid nested awaits in Promise.all)
        const { data: metroOpps } = await supabase.from("opportunities").select("id").eq("metro_id", metroId).limit(50);
        const metroOppIds = (metroOpps || []).map((o: { id: string }) => o.id);

        // Fetch journal entry IDs for this metro
        const { data: journalEntryRows } = await supabase
          .from("journal_entries")
          .select("id")
          .eq("metro_id", metroId)
          .gte("created_at", windowStart.toISOString())
          .limit(30);
        const journalEntryIds = (journalEntryRows || []).map((j: { id: string }) => j.id);

        const [narrativesRes, highlightsRes, oppsRes, provisionsRes, signalsRes, journalRes, knowledgeRes] = await Promise.all([
          supabase.from("metro_narratives").select("headline, narrative_json, period_start, period_end, created_at")
            .eq("metro_id", metroId).order("created_at", { ascending: false }).limit(5),
          supabase.from("discovery_highlights").select("kind, payload, created_at, module")
            .gte("created_at", windowStart.toISOString()).limit(20),
          supabase.from("opportunities").select("id, organization, metro_id")
            .eq("metro_id", metroId).limit(50),
          supabase.from("provisions").select("id, total_quantity, total_cents, delivered_at, opportunity_id")
            .eq("metro_id", metroId).gte("created_at", windowStart.toISOString()).limit(30),
          metroOppIds.length > 0
            ? supabase.from("opportunity_signals").select("signal_type, signal_value, detected_at, opportunity_id")
                .in("opportunity_id", metroOppIds)
                .gte("detected_at", windowStart.toISOString()).limit(40)
            : Promise.resolve({ data: [] }),
          journalEntryIds.length > 0
            ? supabase.from("journal_extractions").select("extracted_json")
                .in("journal_entry_id", journalEntryIds).limit(20)
            : Promise.resolve({ data: [] }),
          // Fetch org knowledge for fallback check-in matching
          metroOppIds.length > 0
            ? supabase.from("org_knowledge_snapshots").select("org_id, structured_json")
                .in("org_id", metroOppIds.slice(0, 20)).eq("active", true).limit(20)
            : Promise.resolve({ data: [] }),
        ]);

        const narratives = narrativesRes.data || [];
        const highlights = highlightsRes.data || [];
        const opps = oppsRes.data || [];
        const provisions = provisionsRes.data || [];
        const signals = (signalsRes as any).data || [];

        // Extract journal themes (topics/signals only)
        const journalThemes: string[] = [];
        for (const je of ((journalRes as any).data || [])) {
          const ej = je.extracted_json as Record<string, unknown> | null;
          if (ej?.topics && Array.isArray(ej.topics)) {
            for (const t of (ej.topics as string[]).slice(0, 3)) {
              if (!journalThemes.includes(t)) journalThemes.push(t);
            }
          }
        }

        // Build knowledge focus areas map for fallback check-ins
        const knowledgeFocusAreas = new Map<string, string[]>();
        for (const k of ((knowledgeRes as any).data || [])) {
          const sj = k.structured_json as Record<string, unknown> || {};
          const areas: string[] = [];
          if (Array.isArray(sj.focus_areas)) areas.push(...(sj.focus_areas as string[]));
          if (Array.isArray(sj.programs)) areas.push(...(sj.programs as string[]));
          if (typeof sj.mission === "string" || typeof sj.mission_statement === "string") {
            areas.push(String(sj.mission || sj.mission_statement || ""));
          }
          if (areas.length > 0) knowledgeFocusAreas.set(k.org_id, areas);
        }

        // Build deterministic fallback
        const partnersInvolved = opps.slice(0, 10).map((o: any) => ({ opportunity_id: o.id, name: o.organization }));
        const fallbackHighlights: MemoryJson["chapters"][0]["highlights"] = [];
        for (const n of narratives.slice(0, 2)) {
          fallbackHighlights.push({ type: "narrative", text: n.headline || "Community story" });
        }
        for (const h of highlights.slice(0, 3)) {
          const payload = h.payload as Record<string, unknown> || {};
          fallbackHighlights.push({ type: h.kind, text: String(payload.summary || payload.title || h.module) });
        }

        const grantsCount = highlights.filter(h => h.module === "grants").length;
        const eventsCount = highlights.filter(h => h.module === "events").length;

        // Generate fallback check-ins from theme/knowledge overlap
        const fallbackCheckins = buildFallbackCheckins(
          journalThemes,
          opps.map((o: any) => ({ id: o.id, organization: o.organization })),
          knowledgeFocusAreas,
        );

        let memoryJson: MemoryJson = {
          headline: `What's unfolding in ${metro.name}`,
          chapters: [{
            title: "Recent Chapter",
            window_start: wsStr,
            window_end: weStr,
            themes: journalThemes.slice(0, 3).length > 0 ? journalThemes.slice(0, 3) : ["Community evolution"],
            highlights: fallbackHighlights.slice(0, 5),
            partners_involved: partnersInvolved,
          }],
          echoes: [],
          checkins: fallbackCheckins,
          metrics: { provisions_count: provisions.length, signals_count: signals.length, events_count: eventsCount, grants_count: grantsCount },
        };

        // Try AI
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY && (signals.length + provisions.length + narratives.length) > 0) {
          try {
            const prompt = [
              `Build a metro-level memory thread for "${metro.name}" (metro_id: ${metroId}).`,
              `Window: ${wsStr} to ${weStr}.`,
              `\nNarratives (${narratives.length}):`,
              ...narratives.slice(0, 3).map(n => `- ${n.headline || 'Story'}: ${n.period_start || ''} to ${n.period_end || ''}`),
              `\nPartners in metro (${opps.length}):`,
              ...opps.slice(0, 10).map((o: any) => `- ${o.organization} (${o.id})`),
              `\nProvisions delivered: ${provisions.filter(p => p.delivered_at).length} of ${provisions.length}`,
              `\nSignals: ${signals.length} total`,
              ...signals.slice(0, 10).map((s: any) => `- [${s.signal_type}] ${s.signal_value}`),
              journalThemes.length > 0 ? `\nField note themes: ${journalThemes.join(", ")}` : "",
              `\nRules:
- Max 6 chapters, max 3 echoes, max 3 check-ins
- Check-ins should identify specific partners (by opportunity_id and name) who might benefit from a gentle touchpoint based on metro-level patterns
- Tone: reflective, supportive, never urgent
- No raw user IDs or journal entry IDs`,
            ].filter(Boolean).join("\n");

            const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: "You are a reflective storyteller for a nonprofit community platform. Frame everything as continuity and care. NEVER use urgency language." },
                  { role: "user", content: prompt },
                ],
                tools: [{
                  type: "function",
                  function: {
                    name: "build_memory",
                    description: "Build a metro memory thread",
                    parameters: {
                      type: "object",
                      properties: {
                        headline: { type: "string" },
                        chapters: { type: "array", items: { type: "object", properties: { title: { type: "string" }, window_start: { type: "string" }, window_end: { type: "string" }, themes: { type: "array", items: { type: "string" } }, highlights: { type: "array", items: { type: "object", properties: { type: { type: "string" }, text: { type: "string" }, source_url: { type: "string" } }, required: ["type", "text"] } }, partners_involved: { type: "array", items: { type: "object", properties: { opportunity_id: { type: "string" }, name: { type: "string" } }, required: ["opportunity_id", "name"] } } }, required: ["title", "window_start", "window_end", "themes", "highlights", "partners_involved"] } },
                        echoes: { type: "array", items: { type: "object", properties: { title: { type: "string" }, text: { type: "string" }, lookback_window: { type: "string" }, evidence: { type: "array", items: { type: "object", properties: { type: { type: "string" }, date: { type: "string" }, source_url: { type: "string" } }, required: ["type"] } } }, required: ["title", "text", "lookback_window", "evidence"] } },
                        checkins: { type: "array", items: { type: "object", properties: { opportunity_id: { type: "string" }, reason: { type: "string" }, suggested_subject: { type: "string" }, suggested_body: { type: "string" } }, required: ["opportunity_id", "reason", "suggested_subject", "suggested_body"] } },
                        metrics: { type: "object", properties: { provisions_count: { type: "number" }, signals_count: { type: "number" }, events_count: { type: "number" }, grants_count: { type: "number" } }, required: ["provisions_count", "signals_count", "events_count", "grants_count"] },
                      },
                      required: ["headline", "chapters", "echoes", "checkins", "metrics"],
                    },
                  },
                }],
                tool_choice: { type: "function", function: { name: "build_memory" } },
              }),
            });

            if (aiRes.ok) {
              const aiData = await aiRes.json();
              const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
              if (toolCall?.function?.arguments) {
                memoryJson = validateMemoryJson(JSON.parse(toolCall.function.arguments));
              }
            }
          } catch (aiErr) {
            console.error("AI error for metro:", aiErr);
          }
        }

        // Upsert
        await supabase.from("metro_memory_threads").upsert({
          metro_id: metroId, window_start: wsStr, window_end: weStr,
          memory_json: memoryJson, computed_at: new Date().toISOString(),
        }, { onConflict: "metro_id,window_start,window_end" });

        results.push({
          metro_id: metroId,
          chapters_count: memoryJson.chapters.length,
          echoes_count: memoryJson.echoes.length,
          checkins_count: memoryJson.checkins.length,
        });
      } catch (metroErr) {
        console.error(`Error processing metro ${metroId}:`, metroErr);
      }
    }

    return jsonOk({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error("metro-memory-build error:", err);
    return jsonError(500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
});
