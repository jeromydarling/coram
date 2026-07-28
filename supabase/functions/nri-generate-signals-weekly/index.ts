/**
 * nri-generate-signals-weekly — Deterministic NRI story signal generation.
 *
 * WHAT: Reads testimonium rollups/flags and generates gentle "Story Signals" for staff.
 * WHERE: Runs weekly after testimonium-rollup-weekly (Monday ~6:15 UTC).
 * WHY: Surfaces connections, check-ins, and celebrations without urgency or PII.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Signal {
  tenant_id: string;
  metro_id: string | null;
  opportunity_id: string | null;
  kind: string;
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  dedupe_key: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const tenantFilter: string | null = body.tenant_id || null;

    // Determine week window
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() - mondayOffset - 7);
    lastMonday.setUTCHours(0, 0, 0, 0);
    const weekStart = body.week_start || lastMonday.toISOString().slice(0, 10);

    // 1) Read rollups for this week
    let rollupQ = svc
      .from("testimonium_rollups")
      .select("*")
      .eq("week_start", weekStart);
    if (tenantFilter) rollupQ = rollupQ.eq("tenant_id", tenantFilter);
    const { data: rollups, error: rErr } = await rollupQ.limit(2000);
    if (rErr) throw rErr;

    // 2) Read flags for this week
    let flagQ = svc
      .from("testimonium_flags")
      .select("*")
      .gte("created_at", weekStart + "T00:00:00Z");
    if (tenantFilter) flagQ = flagQ.eq("tenant_id", tenantFilter);
    const { data: flags } = await flagQ.limit(2000);

    // 3) Read previous week rollups for comparison
    const prevDate = new Date(lastMonday);
    prevDate.setUTCDate(prevDate.getUTCDate() - 7);
    const prevWeekStart = prevDate.toISOString().slice(0, 10);
    let prevQ = svc
      .from("testimonium_rollups")
      .select("*")
      .eq("week_start", prevWeekStart);
    if (tenantFilter) prevQ = prevQ.eq("tenant_id", tenantFilter);
    const { data: prevRollups } = await prevQ.limit(2000);

    const prevMap = new Map<string, any>();
    for (const r of prevRollups || []) {
      prevMap.set(`${r.tenant_id}:${r.metro_id || "null"}`, r);
    }

    // 4) Generate signals deterministically
    const signals: Signal[] = [];

    for (const rollup of rollups || []) {
      const key = `${rollup.tenant_id}:${rollup.metro_id || "null"}`;
      const prev = prevMap.get(key);

      // CHECK-IN: had touches before but none this week, while metro activity exists
      if (
        prev &&
        (prev.email_touch_count > 0 || prev.reflection_count > 0) &&
        rollup.email_touch_count === 0 &&
        rollup.reflection_count === 0 &&
        (rollup.event_presence_count > 0 || rollup.volunteer_activity > 0)
      ) {
        signals.push({
          tenant_id: rollup.tenant_id,
          metro_id: rollup.metro_id,
          opportunity_id: null,
          kind: "check_in",
          title: "A quiet moment worth noticing",
          summary:
            "Outreach has paused while community activity continues. This might be a good time to reconnect with relationships in this area.",
          evidence: {
            prev_email_touches: prev.email_touch_count,
            prev_reflections: prev.reflection_count,
            current_events: rollup.event_presence_count,
            current_volunteers: rollup.volunteer_activity,
          },
          dedupe_key: `check_in:${rollup.tenant_id}:${rollup.metro_id || "global"}:${weekStart}`,
        });
      }

      // CELEBRATION: journey moves + supporting activity (voluntarium or provisio)
      if (
        rollup.journey_moves >= 2 &&
        (rollup.volunteer_activity > 0 || rollup.provisions_created > 0)
      ) {
        signals.push({
          tenant_id: rollup.tenant_id,
          metro_id: rollup.metro_id,
          opportunity_id: null,
          kind: "celebration",
          title: "Something beautiful is happening",
          summary: `${rollup.journey_moves} relationships moved forward this week, supported by ${
            rollup.volunteer_activity > 0
              ? `${rollup.volunteer_activity} volunteer moments`
              : `${rollup.provisions_created} new provisions`
          }. Worth celebrating.`,
          evidence: {
            journey_moves: rollup.journey_moves,
            volunteer_activity: rollup.volunteer_activity,
            provisions_created: rollup.provisions_created,
          },
          dedupe_key: `celebration:${rollup.tenant_id}:${rollup.metro_id || "global"}:${weekStart}`,
        });
      }

      // CONNECTION: if both email and event activity are high in same metro
      if (
        rollup.email_touch_count >= 3 &&
        rollup.event_presence_count >= 2 &&
        rollup.metro_id
      ) {
        signals.push({
          tenant_id: rollup.tenant_id,
          metro_id: rollup.metro_id,
          opportunity_id: null,
          kind: "connection",
          title: "A thread worth holding",
          summary:
            "Multiple touchpoints are converging in this metro — emails and event presence suggest deepening engagement. There might be connections worth exploring.",
          evidence: {
            email_touches: rollup.email_touch_count,
            event_presence: rollup.event_presence_count,
          },
          dedupe_key: `connection:${rollup.tenant_id}:${rollup.metro_id}:${weekStart}`,
        });
      }
    }

    // ── EVENT ATTENDANCE → JOURNEY CHAPTER SIGNALS ──
    // Group registrations by tenant to detect gathering momentum
    const weekStartTs = weekStart + "T00:00:00Z";
    const weekEndTs = new Date(new Date(weekStart).getTime() + 7 * 86400000).toISOString();

    let regQ = svc
      .from("event_registrations")
      .select("tenant_id, event_id")
      .gte("created_at", weekStartTs)
      .lt("created_at", weekEndTs);
    if (tenantFilter) regQ = regQ.eq("tenant_id", tenantFilter);
    const { data: regs } = await regQ.limit(2000);

    // Aggregate registrations per tenant
    const regsByTenant = new Map<string, Set<string>>();
    for (const r of regs || []) {
      if (!regsByTenant.has(r.tenant_id)) regsByTenant.set(r.tenant_id, new Set());
      regsByTenant.get(r.tenant_id)!.add(r.event_id);
    }

    for (const [tid, eventIds] of regsByTenant) {
      const regCount = (regs || []).filter((r: any) => r.tenant_id === tid).length;

      // Celebration: 5+ registrations across multiple events
      if (regCount >= 5 && eventIds.size >= 2) {
        signals.push({
          tenant_id: tid,
          metro_id: null,
          opportunity_id: null,
          kind: "celebration",
          title: "Your community is gathering",
          summary: `${regCount} people registered for ${eventIds.size} events this week. Your community is showing up — that's worth noticing.`,
          evidence: {
            registration_count: regCount,
            event_count: eventIds.size,
            time_window: "7 days",
          },
          dedupe_key: `event_gathering:${tid}:${weekStart}`,
        });
      }

      // Connection: first-ever paid event registrations
      let paidEventQ = svc
        .from("events")
        .select("id")
        .eq("tenant_id", tid)
        .eq("is_paid", true)
        .in("id", Array.from(eventIds));
      const { data: paidEvents } = await paidEventQ;
      if (paidEvents && paidEvents.length > 0) {
        const paidRegCount = (regs || []).filter(
          (r: any) => r.tenant_id === tid && paidEvents.some((pe: any) => pe.id === r.event_id)
        ).length;
        if (paidRegCount >= 1) {
          signals.push({
            tenant_id: tid,
            metro_id: null,
            opportunity_id: null,
            kind: "connection",
            title: "Participation payments are connecting",
            summary: `${paidRegCount} paid event registration${paidRegCount > 1 ? "s" : ""} this week. People are investing in being part of what you're building.`,
            evidence: {
              paid_registration_count: paidRegCount,
              paid_event_count: paidEvents.length,
              time_window: "7 days",
            },
            dedupe_key: `paid_event_attendance:${tid}:${weekStart}`,
          });
        }
      }
    }

    // ── GENEROSITY RHYTHM (ORG-LEVEL ONLY — FIREWALL: NO PER-PERSON DATA) ──
    // Quarter window: last 90 days
    const quarterAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    const tenantIds = tenantFilter
      ? [tenantFilter]
      : [...new Set((rollups || []).map((r: any) => r.tenant_id))];

    for (const tid of tenantIds) {
      const { count: totalGifts } = await svc
        .from("generosity_records")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .gte("gift_date", quarterAgo.slice(0, 10));

      if (totalGifts && totalGifts >= 3) {
        const { count: recurringCount } = await svc
          .from("generosity_records")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tid)
          .eq("is_recurring", true)
          .gte("gift_date", quarterAgo.slice(0, 10));

        const recurringPct = Math.round(((recurringCount ?? 0) / totalGifts) * 100);

        signals.push({
          tenant_id: tid,
          metro_id: null,
          opportunity_id: null,
          kind: "celebration",
          title: "Generosity rhythm is steady",
          summary: recurringPct > 40
            ? `Your community's generosity continues faithfully this quarter — ${recurringPct}% recurring. A beautiful rhythm.`
            : `${totalGifts} expressions of generosity this quarter. Your community is holding this work together.`,
          evidence: {
            total_gifts_quarter: totalGifts,
            recurring_pct: recurringPct,
            time_window: "90 days",
            // FIREWALL: no per-person data, amounts, or rankings
          },
          dedupe_key: `generosity_rhythm:${tid}:${weekStart}`,
        });
      }
    }

    // HEADS-UP from flags: drift signals
    for (const flag of flags || []) {
      if (flag.flag_type === "drift") {
        signals.push({
          tenant_id: flag.tenant_id,
          metro_id: flag.metro_id,
          opportunity_id: null,
          kind: "heads_up",
          title: "A gentle heads-up",
          summary:
            flag.description ||
            "Reflection activity has quieted. This could be intentional — or it might be worth a gentle check-in.",
          evidence: { flag_type: flag.flag_type, flag_id: flag.id },
          dedupe_key: `heads_up:${flag.tenant_id}:${flag.metro_id || "global"}:drift:${weekStart}`,
        });
      }

      // Reconnection → celebration-ish signal
      if (flag.flag_type === "reconnection") {
        signals.push({
          tenant_id: flag.tenant_id,
          metro_id: flag.metro_id,
          opportunity_id: null,
          kind: "celebration",
          title: "Reconnection in motion",
          summary:
            flag.description ||
            "Outreach has resumed after a quiet period. Connections are being renewed.",
          evidence: { flag_type: flag.flag_type, flag_id: flag.id },
          dedupe_key: `celebration:${flag.tenant_id}:${flag.metro_id || "global"}:reconnection:${weekStart}`,
        });
      }
    }

    // 5) Upsert signals with deduplication
    let inserted = 0;
    let skipped = 0;
    for (const sig of signals) {
      const { error: insErr } = await svc.from("nri_story_signals").upsert(
        sig,
        { onConflict: "tenant_id,dedupe_key", ignoreDuplicates: true }
      );
      if (insErr) {
        // Unique constraint violation = already exists, skip
        if (insErr.code === "23505") {
          skipped++;
        } else {
          console.error("Signal insert error:", insErr);
        }
      } else {
        inserted++;
      }
    }

    const duration = Date.now() - startTime;
    const stats = {
      rollups_read: rollups?.length || 0,
      flags_read: flags?.length || 0,
      signals_generated: signals.length,
      signals_inserted: inserted,
      signals_deduped: skipped,
      duration_ms: duration,
    };

    // 6) Write schedule health
    await svc
      .from("operator_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: "ok",
        last_stats: stats,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("key", "nri_generate_signals_weekly");

    await svc.from("system_health_events").insert({
      schedule_key: "nri_generate_signals_weekly",
      status: "ok",
      stats,
    });

    return new Response(JSON.stringify({ ok: true, ...stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const duration = Date.now() - startTime;

    // Try to record failure
    try {
      const svc = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await svc
        .from("operator_schedules")
        .update({
          last_run_at: new Date().toISOString(),
          last_status: "error",
          last_error: { message: err.message, duration_ms: duration },
          updated_at: new Date().toISOString(),
        })
        .eq("key", "nri_generate_signals_weekly");

      await svc.from("system_health_events").insert({
        schedule_key: "nri_generate_signals_weekly",
        status: "error",
        error: { message: err.message },
      });
    } catch (_) {
      // best effort
    }

    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
