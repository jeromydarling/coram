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

// ── Dedupe key helpers ──

export function weekBucket(d: Date = new Date()): string {
  const year = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function dateBucket(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

const MAX_NOTIFICATIONS_PER_CALL = 20;
const MAX_NOTIFICATIONS_PER_USER_PER_DAY = 5;

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

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const mode = body.mode as string;
  if (!["run", "daily_soon", "weekly_digest"].includes(mode)) {
    return jsonError(400, "VALIDATION_ERROR", "mode must be run, daily_soon, or weekly_digest");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const notifications: Array<Record<string, unknown>> = [];
  let skippedDeduped = 0;
  let skippedCapped = 0;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  // Helper: check per-user daily cap
  async function userDailyCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from("proactive_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", todayIso);
    return count || 0;
  }

  // Helper: get target users for metro
  async function getMetroUsers(metroId: string): Promise<string[]> {
    const { data } = await supabase
      .from("user_metro_assignments")
      .select("user_id")
      .eq("metro_id", metroId)
      .limit(10);
    return (data || []).map((a: { user_id: string }) => a.user_id);
  }

  // Helper: get opportunity owner
  async function getOppOwner(oppId: string): Promise<string | null> {
    const { data } = await supabase
      .from("opportunities")
      .select("owner_id")
      .eq("id", oppId)
      .maybeSingle();
    return data?.owner_id || null;
  }

  if (mode === "run") {
    const runId = body.run_id as string;
    if (!runId) return jsonError(400, "VALIDATION_ERROR", "run_id required for mode=run");

    // Get run info
    const { data: run } = await supabase
      .from("discovery_runs")
      .select("id, module, scope, metro_id, opportunity_id")
      .eq("id", runId)
      .maybeSingle();

    if (!run) return jsonError(404, "NOT_FOUND", "Run not found");

    // Get highlights
    const { data: highlights } = await supabase
      .from("discovery_highlights")
      .select("kind, payload, module")
      .eq("run_id", runId);

    // Get people diffs
    const { data: diffs } = await supabase
      .from("people_roster_diffs")
      .select("diff, opportunity_id")
      .eq("run_id", runId);

    // Find target users
    let targetUserIds: string[] = [];
    if (run.opportunity_id) {
      const owner = await getOppOwner(run.opportunity_id);
      if (owner) targetUserIds.push(owner);
    }
    if (run.metro_id && targetUserIds.length === 0) {
      targetUserIds = await getMetroUsers(run.metro_id);
    }

    const wb = weekBucket();

    for (const userId of targetUserIds) {
      if (notifications.length >= MAX_NOTIFICATIONS_PER_CALL) break;
      const dailyCount = await userDailyCount(userId);
      if (dailyCount >= MAX_NOTIFICATIONS_PER_USER_PER_DAY) {
        skippedCapped++;
        continue;
      }

      // Leadership change notifications from diffs
      if (diffs) {
        for (const d of diffs) {
          const diff = d.diff as Record<string, unknown>;
          const changed = diff.changed as Array<Record<string, unknown>> | undefined;
          const added = diff.added as Array<Record<string, unknown>> | undefined;
          if (changed && changed.length > 0) {
            notifications.push({
              user_id: userId,
              org_id: d.opportunity_id,
              notification_type: "leadership_change",
              payload: {
                dedupe_key: `leadership:${d.opportunity_id}:${wb}`,
                run_id: runId,
                summary: diff.summary,
                changes: changed.slice(0, 3),
              },
            });
          }
          if (added && added.length > 0) {
            const leaderAdds = (added as Array<{ title?: string }>).filter(p =>
              /\b(chief|ceo|cfo|cto|coo|president|vp|director|board|executive)\b/i.test(p.title || "")
            );
            if (leaderAdds.length > 0 && !notifications.find(n => (n.payload as Record<string, unknown>)?.dedupe_key === `leadership:${d.opportunity_id}:${wb}`)) {
              notifications.push({
                user_id: userId,
                org_id: d.opportunity_id,
                notification_type: "leadership_change",
                payload: {
                  dedupe_key: `leadership:${d.opportunity_id}:${wb}`,
                  run_id: runId,
                  summary: `${leaderAdds.length} new leadership member(s)`,
                  added: leaderAdds.slice(0, 3),
                },
              });
            }
          }
        }
      }

      // Urgent highlights
      if (highlights) {
        for (const h of highlights) {
          if (h.kind === "urgent") {
            const p = h.payload as Record<string, unknown>;
            const itemId = (p.url as string || "").slice(-36);
            notifications.push({
              user_id: userId,
              org_id: run.opportunity_id || null,
              notification_type: `upcoming_${h.module}`,
              payload: {
                dedupe_key: `${h.module}soon:${itemId || runId}:${wb}`,
                run_id: runId,
                ...p,
              },
            });
          }
        }
      }
    }
  }

  if (mode === "daily_soon") {
    // Find events happening within next 14 days
    const now = new Date();
    const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const { data: soonEvents } = await supabase
      .from("discovered_items")
      .select("id, title, event_date, canonical_url")
      .eq("module", "events")
      .eq("is_active", true)
      .gte("event_date", now.toISOString().slice(0, 10))
      .lte("event_date", twoWeeks.toISOString().slice(0, 10))
      .limit(50);

    if (soonEvents && soonEvents.length > 0) {
      const wb = weekBucket();
      for (const event of soonEvents) {
        // Find linked opportunities via discovery_item_links
        const { data: links } = await supabase
          .from("discovery_item_links")
          .select("opportunity_id, metro_id")
          .eq("discovered_item_id", event.id);

        const targetUsers = new Set<string>();

        for (const link of (links || [])) {
          if (link.opportunity_id) {
            const owner = await getOppOwner(link.opportunity_id);
            if (owner) targetUsers.add(owner);
          }
          if (link.metro_id) {
            const users = await getMetroUsers(link.metro_id);
            users.forEach(u => targetUsers.add(u));
          }
        }

        for (const userId of targetUsers) {
          if (notifications.length >= MAX_NOTIFICATIONS_PER_CALL) break;
          const dc = await userDailyCount(userId);
          if (dc >= MAX_NOTIFICATIONS_PER_USER_PER_DAY) {
            skippedCapped++;
            continue;
          }

          notifications.push({
            user_id: userId,
            org_id: null,
            notification_type: "upcoming_event",
            payload: {
              dedupe_key: `eventsoon:${event.id}:${wb}`,
              title: event.title,
              event_date: event.event_date,
              url: event.canonical_url,
              why: "Happening within next 14 days",
            },
          });
        }
      }
    }
  }

  if (mode === "weekly_digest") {
    const metroId = body.metro_id as string | undefined;
    const wb = weekBucket();

    // Get metros to process
    let metroIds: string[] = [];
    if (metroId) {
      metroIds = [metroId];
    } else {
      const { data: metros } = await supabase
        .from("metros")
        .select("id")
        .limit(50);
      metroIds = (metros || []).map((m: { id: string }) => m.id);
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    // Enrich digest: count event registrations, living signals, communio activity
    const { count: eventRegCount } = await supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    const { count: livingSignalCount } = await supabase
      .from("living_system_signals")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    // Fetch living signal narratives for the digest
    const { data: livingSignalNarratives } = await supabase
      .from("living_system_signals")
      .select("signal_type, context_json")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(5);

    const { count: communioActivityCount } = await supabase
      .from("communio_activity_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    for (const mId of metroIds) {
      if (notifications.length >= MAX_NOTIFICATIONS_PER_CALL) break;

      // Recent discoveries for this metro
      const { data: recentLinks } = await supabase
        .from("discovery_item_links")
        .select("discovered_item_id, reason")
        .eq("metro_id", mId)
        .gte("created_at", sevenDaysAgo)
        .limit(20);

      const itemIds = (recentLinks || []).map((l: { discovered_item_id: string }) => l.discovered_item_id);

      let recentItems: Array<Record<string, unknown>> = [];
      if (itemIds.length > 0) {
        const { data } = await supabase
          .from("discovered_items")
          .select("id, module, title, event_date, canonical_url")
          .in("id", itemIds);
        recentItems = data || [];
      }

      // Upcoming events
      const happeningSoon = recentItems.filter(
        (i) => i.module === "events" && i.event_date && i.event_date >= today && i.event_date <= twoWeeksFromNow
      );

      const users = await getMetroUsers(mId);

      for (const userId of users) {
        if (notifications.length >= MAX_NOTIFICATIONS_PER_CALL) break;
        const dc = await userDailyCount(userId);
        if (dc >= MAX_NOTIFICATIONS_PER_USER_PER_DAY) {
          skippedCapped++;
          continue;
        }

        notifications.push({
          user_id: userId,
          org_id: null,
          notification_type: "weekly_digest",
          payload: {
            dedupe_key: `digest:${mId}:${wb}`,
            metro_id: mId,
            summary: `${recentItems.length} new items this week`,
            happening_soon: happeningSoon.map(e => ({
              title: e.title,
              event_date: e.event_date,
              url: e.canonical_url,
            })),
            by_module: {
              grants: recentItems.filter(i => i.module === "grants").length,
              events: recentItems.filter(i => i.module === "events").length,
              people: recentItems.filter(i => i.module === "people").length,
            },
            event_registrations: eventRegCount ?? 0,
            living_signals: livingSignalCount ?? 0,
            living_signal_narratives: (livingSignalNarratives || []).map((s: any) => ({
              type: s.signal_type,
              narrative: s.context_json?.narrative || '',
            })),
            communio_activity: communioActivityCount ?? 0,
          },
        });
      }
    }
  }

  // Insert notifications (with dedupe via unique index on dedupe_key)
  const notifSlice = notifications.slice(0, MAX_NOTIFICATIONS_PER_CALL);
  let createdCount = 0;

  for (const notif of notifSlice) {
    const { error: insertErr } = await supabase
      .from("proactive_notifications")
      .insert(notif);

    if (insertErr) {
      if (insertErr.code === "23505") {
        skippedDeduped++;
      } else {
        console.error("[notifications-generate] Insert error:", insertErr.message);
      }
    } else {
      createdCount++;
    }
  }

  console.log(`[notifications-generate] mode=${mode}: created=${createdCount}, deduped=${skippedDeduped}, capped=${skippedCapped}`);

  return jsonOk({
    ok: true,
    mode,
    created_count: createdCount,
    skipped_deduped: skippedDeduped,
    skipped_capped: skippedCapped,
  });
});
