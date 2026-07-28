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
  if (!enrichmentSecret && !sharedSecret) return false;

  return (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getMondayOfWeek(d: Date): Date {
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
}

export function formatBriefingMd(briefing: Record<string, unknown>): string {
  const lines: string[] = [];
  const headline = (briefing.headline as string) || "Weekly Briefing";
  lines.push(`# ${headline}\n`);

  const topMoves = (briefing.top_moves as Array<Record<string, unknown>>) || [];
  if (topMoves.length > 0) {
    lines.push("## Top Moves\n");
    for (const m of topMoves) {
      lines.push(`- **${m.title}**: ${m.why}${m.when ? ` _(${m.when})_` : ""}`);
      const urls = (m.evidence_urls as string[]) || [];
      for (const u of urls) lines.push(`  - [Source](${u})`);
    }
    lines.push("");
  }

  const upcoming = (briefing.upcoming_soon as Array<Record<string, unknown>>) || [];
  if (upcoming.length > 0) {
    lines.push("## 🔥 Happening Soon\n");
    for (const u of upcoming) {
      lines.push(`- **${u.title}**${u.date ? ` (${u.date})` : ""}: ${u.why_it_matters || ""}`);
      if (u.url) lines.push(`  - [Link](${u.url})`);
    }
    lines.push("");
  }

  const watchlist = (briefing.watchlist as Array<Record<string, unknown>>) || [];
  if (watchlist.length > 0) {
    lines.push("## Watchlist\n");
    for (const w of watchlist) {
      lines.push(`- **${w.title}**: ${w.note || ""}`);
      if (w.url) lines.push(`  - [Link](${w.url})`);
    }
    lines.push("");
  }

  const metrics = (briefing.metrics as Record<string, number>) || {};
  if (Object.keys(metrics).length > 0) {
    lines.push("## Metrics\n");
    for (const [k, v] of Object.entries(metrics)) {
      lines.push(`- ${k.replace(/_/g, " ")}: **${v}**`);
    }
  }

  return lines.join("\n");
}

export function buildDeterministicBriefing(
  actions: Array<Record<string, unknown>>,
  upcomingEvents: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const highPriority = actions.filter((a) => (a.priority_score as number) >= 70);

  return {
    headline: `${actions.length} relationship action${actions.length !== 1 ? "s" : ""} this week`,
    top_moves: actions.slice(0, 5).map((a) => ({
      title: a.title,
      why: a.summary,
      when: a.suggested_timing || null,
      evidence_urls: ((a.drivers as Array<Record<string, unknown>>) || [])
        .map((d) => d.source_url)
        .filter(Boolean)
        .slice(0, 2),
    })),
    upcoming_soon: upcomingEvents.slice(0, 5).map((e) => ({
      title: e.title || "Event",
      date: e.event_date || null,
      why_it_matters: "Happening within 14 days",
      url: e.canonical_url || null,
    })),
    watchlist: [],
    metrics: {
      open_actions: actions.length,
      high_priority: highPriority.length,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }
  if (!authenticateServiceRequest(req)) {
    return jsonError(401, "UNAUTHORIZED", "Invalid or missing authentication");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const scope = body.scope as string;
  if (!["metro", "opportunity"].includes(scope)) {
    return jsonError(400, "INVALID_SCOPE", "scope must be 'metro' or 'opportunity'");
  }

  const metroId = body.metro_id as string | undefined;
  const opportunityId = body.opportunity_id as string | undefined;
  const maxActions = (body.max_actions as number) || 20;

  if (scope === "metro" && (!metroId || !UUID_RE.test(metroId))) {
    return jsonError(400, "INVALID_METRO_ID", "metro_id is required for scope=metro");
  }
  if (scope === "opportunity" && (!opportunityId || !UUID_RE.test(opportunityId))) {
    return jsonError(400, "INVALID_OPPORTUNITY_ID", "opportunity_id is required for scope=opportunity");
  }

  const weekStartInput = body.week_start as string | undefined;
  let weekStart: Date;
  if (weekStartInput && /^\d{4}-\d{2}-\d{2}$/.test(weekStartInput)) {
    weekStart = new Date(weekStartInput + "T00:00:00Z");
  } else {
    weekStart = getMondayOfWeek(new Date());
  }
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // Fetch actions
    let actionsQuery = sb
      .from("relationship_actions")
      .select("id, opportunity_id, action_type, title, summary, priority_score, priority_label, suggested_timing, drivers, evidence, status")
      .eq("status", "open")
      .order("priority_score", { ascending: false })
      .limit(maxActions);

    if (scope === "opportunity") {
      actionsQuery = actionsQuery.eq("opportunity_id", opportunityId!);
    } else {
      // For metro scope, get all actions for opportunities in this metro
      const { data: metroOpps } = await sb
        .from("opportunities")
        .select("id")
        .eq("metro_id", metroId!)
        .eq("status", "Active")
        .limit(200);
      const oppIds = (metroOpps || []).map((o: { id: string }) => o.id);
      if (oppIds.length > 0) {
        actionsQuery = actionsQuery.in("opportunity_id", oppIds);
      } else {
        actionsQuery = actionsQuery.eq("opportunity_id", "00000000-0000-0000-0000-000000000000");
      }
    }

    const { data: actions } = await actionsQuery;
    const actionsList = (actions || []) as Array<Record<string, unknown>>;

    // Fetch upcoming events within 14 days
    const nowStr = new Date().toISOString().slice(0, 10);
    const in14Str = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

    const { data: upcomingEvents } = await sb
      .from("discovered_items")
      .select("id, title, canonical_url, event_date, snippet")
      .eq("module", "events")
      .eq("is_active", true)
      .gte("event_date", nowStr)
      .lte("event_date", in14Str)
      .order("event_date", { ascending: true })
      .limit(10);

    const eventsList = (upcomingEvents || []) as Array<Record<string, unknown>>;

    // Try OpenAI briefing, fall back to deterministic
    let briefingJson: Record<string, unknown>;
    let usedAi = false;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey && actionsList.length > 0) {
      try {
        const contextParts: string[] = [
          `Scope: ${scope}`,
          `Week: ${weekStartStr} to ${weekEndStr}`,
          `\n## Actions (${actionsList.length}):`,
        ];
        for (const a of actionsList.slice(0, 15)) {
          contextParts.push(`- [${a.priority_label}] ${a.action_type}: ${a.title}\n  ${a.summary}`);
        }
        if (eventsList.length > 0) {
          contextParts.push(`\n## URGENT — Events within 14 days:`);
          for (const e of eventsList) {
            contextParts.push(`- ${e.title} (${e.event_date}) ${e.canonical_url || ""}`);
          }
        }

        const contextStr = contextParts.join("\n").slice(0, 12000);

        const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `You are an internal briefing writer. Use ONLY the provided context. Do not add facts. Produce a concise weekly briefing for a Relationship/Impact Manager. Output strict JSON with this schema: {"headline":string,"top_moves":[{"title":string,"why":string,"when":string|null,"evidence_urls":string[]}],"upcoming_soon":[{"title":string,"date":string|null,"why_it_matters":string,"url":string|null}],"watchlist":[{"title":string,"note":string,"url":string|null}],"metrics":{"open_actions":number,"high_priority":number}}`,
              },
              { role: "user", content: contextStr },
            ],
          }),
          signal: AbortSignal.timeout(55000),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            try {
              const parsed = JSON.parse(content);
              const requiredKeys = ["headline", "top_moves", "upcoming_soon", "metrics"];
              const hasAll = requiredKeys.every((k) => k in parsed);
              if (hasAll) {
                briefingJson = parsed;
                usedAi = true;
              } else {
                console.warn("AI response missing required keys, falling back to deterministic briefing");
                briefingJson = buildDeterministicBriefing(actionsList, eventsList);
              }
            } catch {
              console.warn("AI response not valid JSON, falling back to deterministic briefing");
              briefingJson = buildDeterministicBriefing(actionsList, eventsList);
            }
          } else {
            briefingJson = buildDeterministicBriefing(actionsList, eventsList);
          }
        } else {
          briefingJson = buildDeterministicBriefing(actionsList, eventsList);
        }
      } catch {
        briefingJson = buildDeterministicBriefing(actionsList, eventsList);
      }
    } else {
      briefingJson = buildDeterministicBriefing(actionsList, eventsList);
    }

    const briefingMd = formatBriefingMd(briefingJson);
    const statsObj = {
      actions_count: actionsList.length,
      events_soon: eventsList.length,
      used_ai: usedAi,
    };

    // Upsert briefing
    const { data: upserted, error: upsertErr } = await sb
      .from("relationship_briefings")
      .upsert(
        {
          scope,
          metro_id: scope === "metro" ? metroId : null,
          opportunity_id: scope === "opportunity" ? opportunityId : null,
          week_start: weekStartStr,
          week_end: weekEndStr,
          briefing_json: briefingJson,
          briefing_md: briefingMd,
          stats: statsObj,
        },
        { onConflict: "scope,metro_id,opportunity_id,week_start" },
      )
      .select("id")
      .maybeSingle();

    if (upsertErr) {
      // Handle race: 23505
      if (upsertErr.code === "23505") {
        return jsonOk({ ok: true, id: null, scope, week_start: weekStartStr, week_end: weekEndStr, metrics: statsObj, duplicate: true });
      }
      throw upsertErr;
    }

    return jsonOk({
      ok: true,
      id: upserted?.id ?? null,
      scope,
      week_start: weekStartStr,
      week_end: weekEndStr,
      metrics: statsObj,
    });
  } catch (err) {
    console.error("relationship-briefings-generate error:", err);
    return jsonError(500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
});
