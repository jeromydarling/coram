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

export function authenticateServiceRequest(req: Request): boolean {
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

// ── Priority scoring rules ──

const LEADERSHIP_TITLES_RE = /chief|ceo|cfo|cto|coo|president|vice\s*president|vp|director|board|executive/i;

export interface ActionCandidate {
  action_type: string;
  title: string;
  summary: string;
  priority_score: number;
  suggested_timing: string | null;
  due_date: string | null;
  drivers: Record<string, unknown>[];
  evidence: Record<string, unknown>;
}

export function computePriorityLabel(score: number): string {
  if (score >= 70) return "high";
  if (score >= 40) return "normal";
  return "low";
}

export function buildActionsFromEvidence(params: {
  signals: Array<{ signal_type: string; signal_value: string; confidence: number; source_url: string | null; detected_at: string }>;
  momentum: { score: number; trend: string; score_delta: number; drivers: unknown[] } | null;
  discoveredItems: Array<{ id: string; module: string; title: string | null; snippet: string | null; canonical_url: string; event_date: string | null; first_seen_at?: string | null }>;
}): ActionCandidate[] {
  const { signals, momentum, discoveredItems } = params;
  const actions: ActionCandidate[] = [];
  const now = Date.now();
  const DAY_MS = 86400000;

  // Rule 1: Leadership change signals
  const leadershipSignals = signals.filter(
    (s) => s.signal_type === "leadership_change" &&
      (now - new Date(s.detected_at).getTime()) < 30 * DAY_MS,
  );
  for (const sig of leadershipSignals) {
    let score = 75;
    if (momentum?.trend === "rising") score += 10;
    score = Math.min(score, 100);
    actions.push({
      action_type: "reach_out",
      title: "Reach out after leadership change",
      summary: `${sig.signal_value}${sig.source_url ? ` — ${sig.source_url}` : ""}`,
      priority_score: score,
      suggested_timing: "this week",
      due_date: null,
      drivers: [{ type: "leadership_change", label: sig.signal_value, source_url: sig.source_url, weight: 8 }],
      evidence: { signal_ids: [sig] },
    });
  }

  // Rule 2: Upcoming events within 14 days
  const eventItems = discoveredItems.filter((d) => d.module === "events" && d.event_date);
  for (const ev of eventItems) {
    if (!ev.event_date || isNaN(new Date(ev.event_date).getTime())) continue;
    const eventDate = new Date(ev.event_date!);
    const daysUntil = (eventDate.getTime() - now) / DAY_MS;
    if (daysUntil < 0 || daysUntil > 14) continue;
    const score = daysUntil <= 7 ? 70 : 60;
    actions.push({
      action_type: "attend_event",
      title: `Attend upcoming event: ${(ev.title || "Event").slice(0, 80)}`,
      summary: `${ev.title || "Upcoming event"} on ${ev.event_date}${ev.canonical_url ? ` — ${ev.canonical_url}` : ""}`,
      priority_score: score,
      suggested_timing: "within 14 days",
      due_date: ev.event_date,
      drivers: [{ type: "upcoming_event", label: ev.title, source_url: ev.canonical_url, weight: 6 }],
      evidence: { discovered_item_ids: [ev.id] },
    });
  }

  // Rule 3: Grant opportunities within 30 days
  const grantItems = discoveredItems.filter((d) => d.module === "grants");
  for (const gr of grantItems) {
    if (!gr.first_seen_at) continue;
    const ageMs = now - new Date(gr.first_seen_at).getTime();
    if (isNaN(ageMs) || ageMs > 30 * DAY_MS) continue;
    actions.push({
      action_type: "apply_grant",
      title: `Consider grant: ${(gr.title || "Grant").slice(0, 80)}`,
      summary: `${gr.snippet || gr.title || "New grant opportunity"}${gr.canonical_url ? ` — ${gr.canonical_url}` : ""}`,
      priority_score: 55,
      suggested_timing: "this month",
      due_date: null,
      drivers: [{ type: "grant_opportunity", label: gr.title, source_url: gr.canonical_url, weight: 5 }],
      evidence: { discovered_item_ids: [gr.id] },
    });
  }

  // Rule 4: Momentum spike
  if (momentum && (momentum.score_delta >= 8 || momentum.trend === "rising")) {
    const topDrivers = (momentum.drivers as Array<{ label?: string }> || []).slice(0, 2);
    const driverSummary = topDrivers.map((d) => d.label || "signal").join(", ");
    actions.push({
      action_type: "follow_up",
      title: "Follow up — momentum rising",
      summary: `Momentum score ${momentum.score} (${momentum.trend}). Top drivers: ${driverSummary}`,
      priority_score: 65,
      suggested_timing: "this week",
      due_date: null,
      drivers: topDrivers.map((d) => ({ type: "momentum", label: d.label || "signal", weight: 5 })),
      evidence: { momentum: { score: momentum.score, trend: momentum.trend, delta: momentum.score_delta } },
    });
  }

  // Cap at 10 actions, sorted by priority
  actions.sort((a, b) => b.priority_score - a.priority_score);
  return actions.slice(0, 10);
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
  if (!["opportunity", "metro"].includes(scope)) {
    return jsonError(400, "INVALID_SCOPE", "scope must be 'opportunity' or 'metro'");
  }

  const opportunityId = body.opportunity_id as string | undefined;
  const metroId = body.metro_id as string | undefined;
  const weekWindowDays = (body.week_window_days as number) || 30;
  const limitOpportunities = (body.limit_opportunities as number) || 200;

  if (scope === "opportunity" && (!opportunityId || !UUID_RE.test(opportunityId))) {
    return jsonError(400, "INVALID_OPPORTUNITY_ID", "opportunity_id is required for scope=opportunity");
  }
  if (scope === "metro" && (!metroId || !UUID_RE.test(metroId))) {
    return jsonError(400, "INVALID_METRO_ID", "metro_id is required for scope=metro");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // Determine target opportunities
    let oppIds: string[] = [];
    if (scope === "opportunity") {
      oppIds = [opportunityId!];
    } else {
      const { data: opps, error: oppsErr } = await sb
        .from("opportunities")
        .select("id")
        .eq("metro_id", metroId!)
        .eq("status", "Active")
        .limit(limitOpportunities);
      if (oppsErr) throw oppsErr;
      oppIds = (opps || []).map((o: { id: string }) => o.id);
    }

    if (oppIds.length === 0) {
      return jsonOk({ ok: true, scope, generated: 0, updated: 0, opportunities_processed: 0, actions: [] });
    }

    const cutoffDate = new Date(Date.now() - weekWindowDays * 86400000).toISOString();
    let totalGenerated = 0;
    let totalUpdated = 0;
    const allActions: Record<string, unknown>[] = [];

    for (const oppId of oppIds) {
      // Gather evidence
      const [signalsRes, momentumRes, itemLinksRes] = await Promise.all([
        sb.from("opportunity_signals")
          .select("signal_type, signal_value, confidence, source_url, detected_at")
          .eq("opportunity_id", oppId)
          .gte("detected_at", cutoffDate)
          .order("detected_at", { ascending: false })
          .limit(50),
        sb.from("relationship_momentum")
          .select("score, trend, score_delta, drivers")
          .eq("opportunity_id", oppId)
          .maybeSingle(),
        sb.from("discovery_item_links")
          .select("discovered_item_id, discovered_items(id, module, title, snippet, canonical_url, event_date, first_seen_at)")
          .eq("opportunity_id", oppId)
          .limit(100),
      ]);

      const signals = (signalsRes.data || []) as Array<{
        signal_type: string; signal_value: string; confidence: number;
        source_url: string | null; detected_at: string;
      }>;

      const momentum = momentumRes.data as {
        score: number; trend: string; score_delta: number; drivers: unknown[];
      } | null;

      // Flatten discovered items from join
      const discoveredItems: Array<{
        id: string; module: string; title: string | null; snippet: string | null;
        canonical_url: string; event_date: string | null; first_seen_at?: string | null;
      }> = [];
      for (const link of (itemLinksRes.data || [])) {
        const item = (link as unknown as { discovered_items: Record<string, unknown> }).discovered_items;
        if (item) {
          discoveredItems.push(item as unknown as typeof discoveredItems[0]);
        }
      }

      const candidates = buildActionsFromEvidence({ signals, momentum, discoveredItems });

      // Upsert actions
      for (const c of candidates) {
        const label = computePriorityLabel(c.priority_score);
        const normalizedTitle = c.title.trim().replace(/\s+/g, ' ');
        const { data: upserted, error: upsertErr } = await sb
          .from("relationship_actions")
          .upsert(
            {
              opportunity_id: oppId,
              action_type: c.action_type,
              title: normalizedTitle,
              summary: c.summary,
              priority_score: c.priority_score,
              priority_label: label,
              suggested_timing: c.suggested_timing,
              due_date: c.due_date,
              drivers: c.drivers,
              evidence: c.evidence,
              status: "open",
            },
            { onConflict: "opportunity_id,action_type,title", ignoreDuplicates: false },
          )
          .select("id, action_type, title, priority_score, priority_label, status, created_at, updated_at")
          .single();

        if (upsertErr) {
          // Handle 23505 race gracefully
          if (upsertErr.code === "23505") {
            totalUpdated++;
            continue;
          }
          console.error("Upsert error:", upsertErr);
          continue;
        }

        if (upserted) {
          // Detect true new insert: created_at ≈ updated_at (within 2s) means fresh row
          const createdMs = new Date(upserted.created_at as string).getTime();
          const updatedMs = new Date(upserted.updated_at as string).getTime();
          const isNewInsert = Math.abs(updatedMs - createdMs) < 2000;

          if (isNewInsert) {
            totalGenerated++;
          } else {
            totalUpdated++;
          }

          allActions.push({
            opportunity_id: oppId,
            ...upserted,
          });

          // Push notification hook — only on NEW high priority actions
          if (isNewInsert && label === "high") {
            try {
              const dedupeKey = `action_high:${oppId}:${c.action_type}:${normalizedTitle}`;
              // Resolve users: 1) opportunity owner, 2) metro assignments, 3) admin fallback
              const { data: oppRow } = await sb.from("opportunities").select("owner_id, metro_id").eq("id", oppId).maybeSingle();
              const userIdSet = new Set<string>();

              // Priority 1: Opportunity owner
              if (oppRow?.owner_id) {
                userIdSet.add(oppRow.owner_id);
              }

              // Priority 2: Metro assignments
              const metroIdForNotif = oppRow?.metro_id;
              if (metroIdForNotif && userIdSet.size < 5) {
                const { data: assigns } = await sb.from("user_metro_assignments").select("user_id").eq("metro_id", metroIdForNotif).limit(5);
                for (const a of (assigns || [])) userIdSet.add((a as { user_id: string }).user_id);
              }

              // Priority 3: Fallback to admins/regional_leads
              if (userIdSet.size === 0) {
                const { data: admins } = await sb.from("user_roles").select("user_id").in("role", ["admin", "regional_lead"]).limit(5);
                for (const a of (admins || [])) userIdSet.add((a as { user_id: string }).user_id);
              }

              const userIds = Array.from(userIdSet);
              for (const uid of userIds.slice(0, 5)) {
                await sb.from("proactive_notifications").insert({
                  user_id: uid,
                  notification_type: "relationship_action_high_priority",
                  payload: {
                    opportunity_id: oppId,
                    title: normalizedTitle,
                    action_type: c.action_type,
                    dedupe_key: dedupeKey,
                  },
                }).maybeSingle();
              }
            } catch {
              // Best-effort notification; don't fail the action generation
            }
          }
        }
      }
    }

    return jsonOk({
      ok: true,
      scope,
      generated: totalGenerated,
      updated: totalUpdated,
      opportunities_processed: oppIds.length,
      actions: allActions,
    });
  } catch (err) {
    console.error("relationship-actions-generate error:", err);
    return jsonError(500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
});
