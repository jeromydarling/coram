import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { normalizeUrl } from "../_shared/normalizeUrl.ts";

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

interface CallbackItem {
  canonical_url: string;
  source_url?: string;
  title?: string;
  snippet?: string;
  extracted?: Record<string, unknown>;
  event_date?: string;
  published_date?: string;
  organization_name?: string;
}

interface CallbackBody {
  run_id: string;
  status: "completed" | "failed";
  module: string;
  scope: string;
  metro_id?: string;
  opportunity_id?: string;
  items: CallbackItem[];
  briefing_json: Record<string, unknown>;
  briefing_md: string;
  stats?: Record<string, unknown>;
  error?: Record<string, unknown>;
}

export function validateBody(body: unknown): { valid: true; data: CallbackBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") return { valid: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  if (typeof b.run_id !== "string" || !UUID_RE.test(b.run_id)) {
    return { valid: false, error: `run_id: required valid UUID` };
  }
  if (b.status !== "completed" && b.status !== "failed") {
    return { valid: false, error: "status: must be 'completed' or 'failed'" };
  }
  if (!["grants", "events", "people"].includes(b.module as string)) {
    return { valid: false, error: "module: must be grants, events, or people" };
  }
  if (!["metro", "opportunity"].includes(b.scope as string)) {
    return { valid: false, error: "scope: must be metro or opportunity" };
  }

  if (b.status === "completed") {
    if (!Array.isArray(b.items)) {
      return { valid: false, error: "items: required array when status is completed" };
    }
    if (typeof b.briefing_md !== "string") {
      return { valid: false, error: "briefing_md: required string when status is completed" };
    }
    if (!b.briefing_json || typeof b.briefing_json !== "object") {
      return { valid: false, error: "briefing_json: required object when status is completed" };
    }
  }

  return {
    valid: true,
    data: {
      run_id: b.run_id as string,
      status: b.status as "completed" | "failed",
      module: b.module as string,
      scope: b.scope as string,
      metro_id: typeof b.metro_id === "string" ? b.metro_id : undefined,
      opportunity_id: typeof b.opportunity_id === "string" ? b.opportunity_id : undefined,
      items: (Array.isArray(b.items) ? b.items : []) as CallbackItem[],
      briefing_json: (b.briefing_json || {}) as Record<string, unknown>,
      briefing_md: (b.briefing_md || "") as string,
      stats: b.stats as Record<string, unknown> | undefined,
      error: b.error as Record<string, unknown> | undefined,
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const validation = validateBody(body);
  if (!validation.valid) {
    return jsonError(400, "VALIDATION_ERROR", validation.error);
  }

  const {
    run_id, status, module, scope, metro_id, opportunity_id,
    items, briefing_json, briefing_md, stats, error,
  } = validation.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Verify run exists
  const { data: existingRun, error: fetchErr } = await supabase
    .from("discovery_runs")
    .select("id, status")
    .eq("id", run_id)
    .maybeSingle();

  if (fetchErr) {
    return jsonError(500, "DB_ERROR", `Failed to look up run: ${fetchErr.message}`);
  }
  if (!existingRun) {
    return jsonError(404, "NOT_FOUND", `No discovery run found for id ${run_id}`);
  }

  // Idempotency
  if (existingRun.status === "completed" || existingRun.status === "failed") {
    return jsonOk({ ok: true, duplicate: true, run_id, status: existingRun.status });
  }

  const now = new Date().toISOString();

  if (status === "failed") {
    await supabase
      .from("discovery_runs")
      .update({
        status: "failed",
        error: error || { message: "Unknown error from n8n" },
        stats: stats || {},
        completed_at: now,
      })
      .eq("id", run_id);

    return jsonOk({ ok: true, run_id, status: "failed" });
  }

  // ── Status = completed ──

  // 1) Upsert discovered_items
  let newItemCount = 0;
  const upsertedItemIds: string[] = [];

  for (const item of items) {
    if (!item.canonical_url) continue;

    const canonical = normalizeUrl(item.canonical_url);
    if (!canonical) continue;

    // Try insert first, then update on conflict
    const { data: existing } = await supabase
      .from("discovered_items")
      .select("id, first_seen_at")
      .eq("module", module)
      .eq("canonical_url", canonical)
      .maybeSingle();

    if (existing) {
      // Update
      await supabase
        .from("discovered_items")
        .update({
          last_seen_at: now,
          last_run_id: run_id,
          title: item.title || undefined,
          snippet: item.snippet || undefined,
          source_url: item.source_url || undefined,
          extracted: item.extracted || {},
          event_date: item.event_date || undefined,
          published_date: item.published_date || undefined,
          organization_name: item.organization_name || undefined,
          is_active: true,
        })
        .eq("id", existing.id);

      upsertedItemIds.push(existing.id);
    } else {
      // Insert
      const { data: inserted, error: insertErr } = await supabase
        .from("discovered_items")
        .insert({
          module,
          canonical_url: canonical,
          source_url: item.source_url || null,
          title: item.title || null,
          snippet: item.snippet || null,
          extracted: item.extracted || {},
          event_date: item.event_date || null,
          published_date: item.published_date || null,
          organization_name: item.organization_name || null,
          first_seen_at: now,
          last_seen_at: now,
          last_run_id: run_id,
        })
        .select("id")
        .single();

      if (insertErr) {
        // Unique violation race → fetch and update
        if (insertErr.code === "23505") {
          const { data: raced } = await supabase
            .from("discovered_items")
            .select("id")
            .eq("module", module)
            .eq("canonical_url", canonical)
            .maybeSingle();
          if (raced) upsertedItemIds.push(raced.id);
        } else {
          console.error(`[discovery-callback] Item insert error:`, insertErr.message);
        }
        continue;
      }

      if (inserted) {
        upsertedItemIds.push(inserted.id);
        newItemCount++;
      }
    }
  }

  // 2) Insert discovery_item_links (dedupe via unique index, catch 23505)
  for (const itemId of upsertedItemIds) {
    const { error: linkErr } = await supabase
      .from("discovery_item_links")
      .insert({
        discovered_item_id: itemId,
        metro_id: metro_id || null,
        opportunity_id: opportunity_id || null,
        relevance_score: 50,
        reason: `Discovered via ${module}/${scope} run`,
      });

    if (linkErr && linkErr.code !== "23505") {
      console.error(`[discovery-callback] Link insert error:`, linkErr.message);
    }
  }

  // 3) Insert discovery_briefing
  const { error: briefingErr } = await supabase
    .from("discovery_briefings")
    .insert({
      run_id,
      module,
      scope,
      metro_id: metro_id || null,
      opportunity_id: opportunity_id || null,
      briefing_md: briefing_md,
      briefing_json: briefing_json,
    });

  if (briefingErr) {
    console.error(`[discovery-callback] Briefing insert error:`, briefingErr.message);
  }

  // 4) Create discovery_highlights
  const highlights: Array<{ run_id: string; module: string; kind: string; payload: Record<string, unknown> }> = [];

  // Urgent: events within 14 days or briefing_json.urgent
  const urgentItems = (briefing_json as Record<string, unknown>).urgent;
  if (Array.isArray(urgentItems)) {
    for (const u of urgentItems) {
      highlights.push({
        run_id,
        module,
        kind: "urgent",
        payload: u as Record<string, unknown>,
      });
    }
  }

  // Also check event_date for items within 14 days
  if (module === "events") {
    const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    for (const item of items) {
      if (item.event_date) {
        const eventDate = new Date(item.event_date);
        if (eventDate <= twoWeeksFromNow && eventDate >= new Date()) {
          highlights.push({
            run_id,
            module,
            kind: "urgent",
            payload: { title: item.title, event_date: item.event_date, url: item.canonical_url, why_this_week: "Event within next 14 days" },
          });
        }
      }
    }
  }

  // New items
  if (newItemCount > 0) {
    const newItems = (briefing_json as Record<string, unknown>).new_items;
    if (Array.isArray(newItems)) {
      for (const n of newItems) {
        highlights.push({
          run_id,
          module,
          kind: "new",
          payload: n as Record<string, unknown>,
        });
      }
    }
  }

  // Changed items
  const changedItems = (briefing_json as Record<string, unknown>).what_changed;
  if (Array.isArray(changedItems)) {
    for (const c of changedItems) {
      highlights.push({
        run_id,
        module,
        kind: "changed",
        payload: c as Record<string, unknown>,
      });
    }
  }

  // Recommended sources
  const helpfulSources = (briefing_json as Record<string, unknown>).helpful_sources;
  if (Array.isArray(helpfulSources)) {
    for (const s of helpfulSources) {
      highlights.push({
        run_id,
        module,
        kind: "recommended_source",
        payload: s as Record<string, unknown>,
      });
    }
  }

  if (highlights.length > 0) {
    const { error: hlErr } = await supabase
      .from("discovery_highlights")
      .insert(highlights);

    if (hlErr) {
      console.error(`[discovery-callback] Highlights insert error:`, hlErr.message);
    }
  }

  // 5) People module: call people-roster-diff for opportunity scope
  if (module === "people" && scope === "opportunity" && opportunity_id) {
    const peoplePayload = items.map(item => ({
      name: item.title || item.organization_name || null,
      title: (item.extracted as Record<string, unknown>)?.title as string || null,
      organization_name: item.organization_name || null,
      email: (item.extracted as Record<string, unknown>)?.email as string || null,
      phone: (item.extracted as Record<string, unknown>)?.phone as string || null,
      source_url: item.source_url || item.canonical_url || null,
      evidence: item.snippet || null,
      confidence: (item.extracted as Record<string, unknown>)?.confidence as number || 0.5,
    }));

    try {
      const rosterResp = await fetch(`${supabaseUrl}/functions/v1/people-roster-diff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          run_id,
          opportunity_id,
          people: peoplePayload,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const rosterData = await rosterResp.json().catch(() => ({}));
      console.log(`[discovery-callback] people-roster-diff result:`, JSON.stringify(rosterData));
    } catch (err) {
      console.error(`[discovery-callback] people-roster-diff call failed:`, err instanceof Error ? err.message : err);
    }
  }

  // 6) Create proactive_notifications
  const notifications: Array<Record<string, unknown>> = [];

  // Find relevant user(s) — get opportunity owner or metro users
  let targetUserIds: string[] = [];

  if (opportunity_id) {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("owner_id")
      .eq("id", opportunity_id)
      .maybeSingle();

    if (opp?.owner_id) targetUserIds.push(opp.owner_id);
  }

  if (metro_id && targetUserIds.length === 0) {
    // Get users with metro access (simplified: get metro assignments)
    const { data: assignments } = await supabase
      .from("user_metro_assignments")
      .select("user_id")
      .eq("metro_id", metro_id)
      .limit(10);

    if (assignments) {
      targetUserIds = assignments.map((a: { user_id: string }) => a.user_id);
    }
  }

  const notificationType = `discovery_${module}` as string;

  for (const userId of targetUserIds) {
    // Events within 14 days
    if (module === "events") {
      const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      for (const item of items) {
        if (item.event_date) {
          const eventDate = new Date(item.event_date);
          if (eventDate <= twoWeeksFromNow && eventDate >= new Date()) {
            notifications.push({
              user_id: userId,
              org_id: opportunity_id || null,
              notification_type: notificationType,
              payload: {
                run_id,
                module,
                scope,
                title: item.title,
                event_date: item.event_date,
                url: item.canonical_url,
                why: "Upcoming event within 14 days",
              },
            });
          }
        }
      }
    }

    // Grants with deadline within 30 days
    if (module === "grants") {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      for (const item of items) {
        const deadline = item.extracted?.deadline as string | undefined;
        if (deadline) {
          try {
            const deadlineDate = new Date(deadline);
            if (deadlineDate <= thirtyDaysFromNow && deadlineDate >= new Date()) {
              notifications.push({
                user_id: userId,
                org_id: opportunity_id || null,
                notification_type: notificationType,
                payload: {
                  run_id,
                  module,
                  scope,
                  title: item.title,
                  deadline,
                  url: item.canonical_url,
                  why: "Grant deadline within 30 days",
                },
              });
            }
          } catch {
            // Invalid date, skip
          }
        }
      }
    }

    // People: leadership change
    if (module === "people") {
      for (const item of items) {
        const isLeadership = item.extracted?.is_leadership_change as boolean | undefined;
        if (isLeadership) {
          notifications.push({
            user_id: userId,
            org_id: opportunity_id || null,
            notification_type: notificationType,
            payload: {
              run_id,
              module,
              scope,
              title: item.title,
              url: item.canonical_url,
              why: "Potential leadership change detected",
            },
          });
        }
      }
    }
  }

  // Limit notifications per run to avoid spam
  const notifSlice = notifications.slice(0, 20);
  if (notifSlice.length > 0) {
    const { error: notifErr } = await supabase
      .from("proactive_notifications")
      .insert(notifSlice);

    if (notifErr) {
      console.error(`[discovery-callback] Notification insert error:`, notifErr.message);
    }
  }

  // 6) Mark discovery_run completed
  const finalStats = {
    ...(stats || {}),
    items_received: items.length,
    items_upserted: upsertedItemIds.length,
    new_items: newItemCount,
    highlights_created: highlights.length,
    notifications_created: notifSlice.length,
  };

  await supabase
    .from("discovery_runs")
    .update({
      status: "completed",
      stats: finalStats,
      completed_at: now,
    })
    .eq("id", run_id);

  console.log(`[discovery-callback] Run ${run_id} completed: ${upsertedItemIds.length} items, ${newItemCount} new, ${highlights.length} highlights, ${notifSlice.length} notifications`);

  return jsonOk({
    ok: true,
    run_id,
    status: "completed",
    items_upserted: upsertedItemIds.length,
    new_items: newItemCount,
    highlights: highlights.length,
    notifications: notifSlice.length,
  });
});
