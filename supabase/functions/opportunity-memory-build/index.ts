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

// ── Urgency filter ──
const URGENCY_RE = /\b(urgent|critical|act now|immediately|asap|emergency|deadline|hurry|don't miss|last chance|breaking|high priority|action required|must)\b/gi;
function cleanTone(text: string): string {
  return text.replace(URGENCY_RE, "").replace(/\s{2,}/g, " ").trim();
}

// ── Types ──
interface MemoryJson {
  headline: string;
  chapters: Array<{
    title: string;
    window_start: string;
    window_end: string;
    themes: string[];
    highlights: Array<{ type: string; text: string; source_url?: string }>;
    partners_involved: Array<{ opportunity_id: string; name: string }>;
  }>;
  echoes: Array<{
    title: string;
    text: string;
    lookback_window: string;
    evidence: Array<{ type: string; date?: string; source_url?: string }>;
  }>;
  checkins: Array<{
    opportunity_id: string;
    reason: string;
    suggested_subject: string;
    suggested_body: string;
  }>;
  metrics: { provisions_count: number; signals_count: number; events_count: number; grants_count: number };
}

function emptyMemoryJson(): MemoryJson {
  return {
    headline: "",
    chapters: [],
    echoes: [],
    checkins: [],
    metrics: { provisions_count: 0, signals_count: 0, events_count: 0, grants_count: 0 },
  };
}

function validateMemoryJson(obj: unknown): MemoryJson {
  const fallback = emptyMemoryJson();
  if (!obj || typeof obj !== "object") return fallback;
  const o = obj as Record<string, unknown>;
  return {
    headline: typeof o.headline === "string" ? cleanTone(o.headline) : "",
    chapters: Array.isArray(o.chapters) ? (o.chapters as MemoryJson["chapters"]).slice(0, 6).map(c => ({
      ...c,
      highlights: (c.highlights || []).slice(0, 5),
      themes: (c.themes || []).slice(0, 3),
    })) : [],
    echoes: Array.isArray(o.echoes) ? (o.echoes as MemoryJson["echoes"]).slice(0, 3).map(e => ({
      ...e,
      title: cleanTone(e.title || ""),
      text: cleanTone(e.text || ""),
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

// ── Deterministic fallback builder ──
function buildFallbackMemory(
  orgName: string,
  oppId: string,
  windowStart: string,
  windowEnd: string,
  signals: Array<{ signal_type: string; signal_value: string; detected_at: string; source_url?: string }>,
  provisions: Array<{ total_quantity: number; total_cents: number; delivered_at: string | null }>,
  discoveries: Array<{ title: string; module: string; source_url: string | null; event_date: string | null }>,
  journalThemes: string[],
  knowledgeFocusAreas?: string[],
): MemoryJson {
  const highlights: MemoryJson["chapters"][0]["highlights"] = [];

  for (const s of signals.slice(0, 3)) {
    highlights.push({ type: "signal", text: s.signal_value, source_url: s.source_url });
  }
  for (const p of provisions.filter(p => p.delivered_at).slice(0, 2)) {
    highlights.push({ type: "provision", text: `${p.total_quantity} devices provided` });
  }
  for (const d of discoveries.slice(0, 2)) {
    highlights.push({ type: d.module, text: d.title || "Discovery item", source_url: d.source_url || undefined });
  }

  const themes = journalThemes.slice(0, 3);
  if (themes.length === 0 && signals.length > 0) themes.push("Relationship signals");
  if (themes.length === 0) themes.push("Ongoing partnership");

  const grantsCount = discoveries.filter(d => d.module === "grants").length;
  const eventsCount = discoveries.filter(d => d.module === "events").length;

  // Deterministic fallback check-in: generate 0-1 based on theme/knowledge overlap
  const checkins: MemoryJson["checkins"] = [];
  if (knowledgeFocusAreas && knowledgeFocusAreas.length > 0 && journalThemes.length > 0) {
    const themesLower = journalThemes.map(t => t.toLowerCase());
    const focusLower = knowledgeFocusAreas.map(f => f.toLowerCase());
    const matchingTheme = themesLower.find(theme =>
      focusLower.some(focus =>
        focus.includes(theme) || theme.includes(focus) ||
        theme.split(/\s+/).some(word => word.length > 3 && focusLower.some(f => f.includes(word)))
      )
    );
    if (matchingTheme) {
      const originalTheme = journalThemes[themesLower.indexOf(matchingTheme)];
      checkins.push({
        opportunity_id: oppId,
        reason: `Recent themes around "${originalTheme}" connect to ${orgName}'s work — might be worth a gentle check-in.`,
        suggested_subject: `Thinking of you — ${originalTheme}`,
        suggested_body: `Hi there,\n\nI've been following some developments in our community around ${originalTheme}, and it made me think of the work ${orgName} is doing.\n\nWould love to catch up when you have a moment — no rush at all.\n\nWarmly,`,
      });
    }
  }

  return {
    headline: `What we've learned together with ${orgName}`,
    chapters: [{
      title: "Recent Chapter",
      window_start: windowStart,
      window_end: windowEnd,
      themes,
      highlights: highlights.slice(0, 5),
      partners_involved: [{ opportunity_id: oppId, name: orgName }],
    }],
    echoes: [],
    checkins,
    metrics: {
      provisions_count: provisions.length,
      signals_count: signals.length,
      events_count: eventsCount,
      grants_count: grantsCount,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST");

  if (!authenticateServiceRequest(req)) {
    return jsonError(401, "UNAUTHORIZED", "Invalid or missing authentication");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const mode = body.mode || "single";
    const windowDays = body.window_days || 120;
    const chapterSizeDays = body.chapter_size_days || 30;

    let oppIds: string[] = [];

    if (mode === "single" && body.opportunity_id) {
      oppIds = [body.opportunity_id];
    } else if (mode === "batch") {
      // Get active opportunities with recent activity
      const cutoff = new Date(Date.now() - windowDays * 86400000).toISOString();
      const { data: opps } = await supabase
        .from("opportunities")
        .select("id")
        .gte("updated_at", cutoff)
        .limit(200);
      oppIds = (opps || []).map((o: { id: string }) => o.id);
    } else if (body.opportunity_id) {
      oppIds = [body.opportunity_id];
    }

    if (oppIds.length === 0) return jsonOk({ ok: true, processed: 0 });

    const results: Array<{ opportunity_id: string; chapters_count: number; echoes_count: number; checkins_count: number }> = [];
    const windowEnd = new Date();
    const windowStart = new Date(Date.now() - windowDays * 86400000);
    const wsStr = windowStart.toISOString().slice(0, 10);
    const weStr = windowEnd.toISOString().slice(0, 10);

    for (const oppId of oppIds) {
      try {
        // 1. Get opportunity info
        const { data: opp } = await supabase
          .from("opportunities")
          .select("id, organization, website, metro_id, owner_id")
          .eq("id", oppId)
          .single();
        if (!opp) continue;

        const orgName = opp.organization || "Partner";

        // 2. Gather evidence (all parallel)
        const [signalsRes, provisionsRes, discoveryRes, journalRes, knowledgeRes] = await Promise.all([
          supabase
            .from("opportunity_signals")
            .select("signal_type, signal_value, detected_at, source_url, confidence")
            .eq("opportunity_id", oppId)
            .gte("detected_at", windowStart.toISOString())
            .order("detected_at", { ascending: false })
            .limit(30),
          supabase
            .from("provisions")
            .select("id, total_quantity, total_cents, delivered_at, status, created_at")
            .eq("opportunity_id", oppId)
            .gte("created_at", windowStart.toISOString())
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("discovery_item_links")
            .select("discovered_items!inner(title, module, source_url, event_date, snippet)")
            .eq("opportunity_id", oppId)
            .limit(20),
          // Journal extractions — topics/signals ONLY, never note_text
          supabase
            .from("journal_extractions")
            .select("extracted_json, journal_entry_id")
            .in("journal_entry_id", (
              await supabase
                .from("journal_entries")
                .select("id")
                .or(`metro_id.eq.${opp.metro_id}`)
                .gte("created_at", windowStart.toISOString())
                .limit(20)
            ).data?.map((j: { id: string }) => j.id) || [])
            .limit(10),
          supabase
            .from("org_knowledge_snapshots")
            .select("structured_json, source_url")
            .eq("org_id", oppId)
            .eq("active", true)
            .limit(3),
        ]);

        const signals = signalsRes.data || [];
        const provisions = provisionsRes.data || [];
        const discoveries = (discoveryRes.data || []).map((d: any) => d.discovered_items);
        const journalExtractions = journalRes.data || [];

        // Extract themes from journal extractions (topics/signals only, never note_text)
        const journalThemes: string[] = [];
        for (const je of journalExtractions) {
          const ej = je.extracted_json as Record<string, unknown> | null;
          if (ej?.topics && Array.isArray(ej.topics)) {
            for (const t of (ej.topics as string[]).slice(0, 3)) {
              if (!journalThemes.includes(t)) journalThemes.push(t);
            }
          }
          if (ej?.signals && Array.isArray(ej.signals)) {
            for (const s of (ej.signals as string[]).slice(0, 2)) {
              if (!journalThemes.includes(s)) journalThemes.push(s);
            }
          }
        }

        // Knowledge context
        const knowledgeContext = (knowledgeRes.data || []).map((k: any) => {
          const sj = k.structured_json as Record<string, unknown> || {};
          return {
            mission: sj.mission_statement || sj.mission || "",
            focus_areas: sj.focus_areas || sj.programs || [],
            source_url: k.source_url,
          };
        });

        // Extract focus areas for deterministic fallback check-ins
        const knowledgeFocusAreas: string[] = [];
        for (const kc of knowledgeContext) {
          if (typeof kc.mission === "string" && kc.mission) knowledgeFocusAreas.push(kc.mission);
          if (Array.isArray(kc.focus_areas)) knowledgeFocusAreas.push(...(kc.focus_areas as string[]));
        }

        // 3. Try AI generation
        let memoryJson: MemoryJson;
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        if (LOVABLE_API_KEY && (signals.length + provisions.length + discoveries.length) > 0) {
          try {
            const prompt = buildAIPrompt(
              orgName, oppId, wsStr, weStr, chapterSizeDays,
              signals, provisions, discoveries, journalThemes, knowledgeContext,
            );

            const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: SYSTEM_PROMPT },
                  { role: "user", content: prompt },
                ],
                tools: [{
                  type: "function",
                  function: {
                    name: "build_memory",
                    description: "Build a relationship memory thread",
                    parameters: {
                      type: "object",
                      properties: {
                        headline: { type: "string" },
                        chapters: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              title: { type: "string" },
                              window_start: { type: "string" },
                              window_end: { type: "string" },
                              themes: { type: "array", items: { type: "string" } },
                              highlights: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    type: { type: "string" },
                                    text: { type: "string" },
                                    source_url: { type: "string" },
                                  },
                                  required: ["type", "text"],
                                },
                              },
                              partners_involved: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    opportunity_id: { type: "string" },
                                    name: { type: "string" },
                                  },
                                  required: ["opportunity_id", "name"],
                                },
                              },
                            },
                            required: ["title", "window_start", "window_end", "themes", "highlights", "partners_involved"],
                          },
                        },
                        echoes: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              title: { type: "string" },
                              text: { type: "string" },
                              lookback_window: { type: "string" },
                              evidence: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    type: { type: "string" },
                                    date: { type: "string" },
                                    source_url: { type: "string" },
                                  },
                                  required: ["type"],
                                },
                              },
                            },
                            required: ["title", "text", "lookback_window", "evidence"],
                          },
                        },
                        checkins: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              opportunity_id: { type: "string" },
                              reason: { type: "string" },
                              suggested_subject: { type: "string" },
                              suggested_body: { type: "string" },
                            },
                            required: ["opportunity_id", "reason", "suggested_subject", "suggested_body"],
                          },
                        },
                        metrics: {
                          type: "object",
                          properties: {
                            provisions_count: { type: "number" },
                            signals_count: { type: "number" },
                            events_count: { type: "number" },
                            grants_count: { type: "number" },
                          },
                          required: ["provisions_count", "signals_count", "events_count", "grants_count"],
                        },
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
                const parsed = JSON.parse(toolCall.function.arguments);
                memoryJson = validateMemoryJson(parsed);
              } else {
                memoryJson = buildFallbackMemory(orgName, oppId, wsStr, weStr, signals, provisions, discoveries, journalThemes, knowledgeFocusAreas);
              }
            } else {
              console.error("AI gateway error:", aiRes.status);
              memoryJson = buildFallbackMemory(orgName, oppId, wsStr, weStr, signals, provisions, discoveries, journalThemes, knowledgeFocusAreas);
            }
          } catch (aiErr) {
            console.error("AI error:", aiErr);
            memoryJson = buildFallbackMemory(orgName, oppId, wsStr, weStr, signals, provisions, discoveries, journalThemes, knowledgeFocusAreas);
          }
        } else {
          memoryJson = buildFallbackMemory(orgName, oppId, wsStr, weStr, signals, provisions, discoveries, journalThemes, knowledgeFocusAreas);
        }

        // 4. Upsert
        const { error: upsertErr } = await supabase
          .from("opportunity_memory_threads")
          .upsert({
            opportunity_id: oppId,
            window_start: wsStr,
            window_end: weStr,
            memory_json: memoryJson,
            computed_at: new Date().toISOString(),
          }, { onConflict: "opportunity_id,window_start,window_end" });

        if (upsertErr) console.error("Upsert error:", upsertErr);

        results.push({
          opportunity_id: oppId,
          chapters_count: memoryJson.chapters.length,
          echoes_count: memoryJson.echoes.length,
          checkins_count: memoryJson.checkins.length,
        });
      } catch (oppErr) {
        console.error(`Error processing ${oppId}:`, oppErr);
      }
    }

    return jsonOk({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error("opportunity-memory-build error:", err);
    return jsonError(500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
});

// ── AI Prompt ──

const SYSTEM_PROMPT = `You are a reflective storyteller for a nonprofit partnership platform.
Your job is to create gentle, human-centered memory threads about relationships between organizations.
NEVER use urgency language (urgent, critical, ASAP, immediately, must, action required).
Frame everything as continuity, reflection, and care.
Use phrases like "what we've learned together", "an echo of", "a thread that continues", "worth a gentle check-in".
Keep check-in suggestions warm and supportive, never demanding.
Never include raw user IDs, journal entry IDs, or internal system identifiers.`;

function buildAIPrompt(
  orgName: string, oppId: string, wsStr: string, weStr: string, chapterSizeDays: number,
  signals: any[], provisions: any[], discoveries: any[], journalThemes: string[], knowledge: any[],
): string {
  const parts: string[] = [
    `Build a relationship memory thread for "${orgName}" (ID: ${oppId}).`,
    `Time window: ${wsStr} to ${weStr}. Split into chapters of ~${chapterSizeDays} days.`,
    `\nRelationship signals (${signals.length}):`,
    ...signals.slice(0, 15).map(s => `- [${s.signal_type}] ${s.signal_value} (${s.detected_at?.slice(0, 10)})`),
    `\nProvisions (${provisions.length}):`,
    ...provisions.slice(0, 10).map(p => `- ${p.total_quantity} devices, $${(p.total_cents / 100).toFixed(2)}, status: ${p.status}${p.delivered_at ? ', delivered ' + p.delivered_at.slice(0, 10) : ''}`),
    `\nDiscovery items (${discoveries.length}):`,
    ...discoveries.slice(0, 10).map((d: any) => `- [${d.module}] ${d.title || d.snippet?.slice(0, 80)}`),
  ];

  if (journalThemes.length > 0) {
    parts.push(`\nThemes from field notes: ${journalThemes.slice(0, 10).join(", ")}`);
  }

  if (knowledge.length > 0) {
    parts.push(`\nOrganization context:`);
    for (const k of knowledge) {
      if (k.mission) parts.push(`- Mission: ${String(k.mission).slice(0, 200)}`);
      if (Array.isArray(k.focus_areas) && k.focus_areas.length > 0) {
        parts.push(`- Focus areas: ${k.focus_areas.slice(0, 5).join(", ")}`);
      }
    }
  }

  parts.push(`\nRules:
- Max 6 chapters, max 3 echoes, max 3 check-ins
- Echoes should reference patterns from earlier in the window or historically
- Check-ins: only suggest if there's a genuine connection; include opportunity_id "${oppId}" and partner name "${orgName}"
- Tone: reflective, warm, supportive. Never urgent.
- Compute metrics from the evidence counts provided.`);

  return parts.join("\n");
}
