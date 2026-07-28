/**
 * lumen-detect — Nightly deterministic foresight signal detection.
 *
 * WHAT: Scans Testimonium, Signum, Praeceptum, and operational data to detect
 *       emerging patterns BEFORE friction or drift fully manifests.
 * WHERE: Runs nightly via cron or manual Operator trigger.
 * WHY: Powers Lumen — quiet foresight for human-centered stewardship.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LumenSignal {
  tenant_id: string;
  metro_id?: string;
  signal_type: string;
  severity: string;
  confidence: number;
  source_summary: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(supabaseUrl, serviceKey);

    let filterTenantId: string | null = null;
    try {
      const body = await req.json();
      filterTenantId = body?.tenant_id || null;
    } catch { /* no body is fine */ }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString();
    const twentyOneDaysAgo = new Date(now.getTime() - 21 * 86400000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 86400000).toISOString();

    const signals: LumenSignal[] = [];

    // ─── 1) drift_risk: reflections drop >40% WoW + friction increase ───
    const { data: thisWeekReflections } = await svc
      .from("testimonium_events")
      .select("tenant_id")
      .in("event_kind", ["reflection_created", "reflection_updated"])
      .gte("occurred_at", sevenDaysAgo)
      .limit(5000);

    const { data: lastWeekReflections } = await svc
      .from("testimonium_events")
      .select("tenant_id")
      .in("event_kind", ["reflection_created", "reflection_updated"])
      .gte("occurred_at", fourteenDaysAgo)
      .lt("occurred_at", sevenDaysAgo)
      .limit(5000);

    const { data: frictionEvents } = await svc
      .from("testimonium_events")
      .select("tenant_id")
      .in("event_kind", ["friction_idle", "friction_repeat_nav", "friction_abandon_flow"])
      .gte("occurred_at", sevenDaysAgo)
      .limit(5000);

    const countByTenant = (rows: any[] | null) => {
      const m = new Map<string, number>();
      for (const r of rows || []) m.set(r.tenant_id, (m.get(r.tenant_id) || 0) + 1);
      return m;
    };

    const thisWeekMap = countByTenant(thisWeekReflections);
    const lastWeekMap = countByTenant(lastWeekReflections);
    const frictionMap = countByTenant(frictionEvents);

    for (const [tid, lastCount] of lastWeekMap) {
      if (filterTenantId && tid !== filterTenantId) continue;
      const thisCount = thisWeekMap.get(tid) || 0;
      const drop = lastCount > 0 ? (lastCount - thisCount) / lastCount : 0;
      const hasFriction = (frictionMap.get(tid) || 0) > 2;
      if (drop > 0.4 && hasFriction) {
        signals.push({
          tenant_id: tid,
          signal_type: "drift_risk",
          severity: drop > 0.7 ? "high" : "medium",
          confidence: Math.min(0.95, drop * 0.8 + (hasFriction ? 0.2 : 0)),
          source_summary: { reflection_drop_pct: Math.round(drop * 100), friction_count: frictionMap.get(tid) || 0 },
        });
      }
    }

    // ─── 2) activation_delay: checklist incomplete >7 days ───
    const { data: checklists } = await svc
      .from("activation_checklists")
      .select("tenant_id, status, created_at")
      .neq("status", "complete")
      .limit(1000);

    for (const cl of checklists || []) {
      if (filterTenantId && cl.tenant_id !== filterTenantId) continue;
      const age = now.getTime() - new Date(cl.created_at).getTime();
      if (age > 7 * 86400000) {
        signals.push({
          tenant_id: cl.tenant_id,
          signal_type: "activation_delay",
          severity: age > 14 * 86400000 ? "high" : "medium",
          confidence: Math.min(0.9, 0.5 + (age / (30 * 86400000)) * 0.4),
          source_summary: { days_since_created: Math.floor(age / 86400000), status: cl.status },
        });
      }
    }

    // ─── 3) volunteer_dropoff: 3 consecutive weeks of decline ───
    const weekBuckets = [sevenDaysAgo, fourteenDaysAgo, twentyOneDaysAgo];
    const { data: volShifts } = await svc
      .from("volunteer_shifts")
      .select("tenant_id, shift_date")
      .gte("shift_date", twentyOneDaysAgo)
      .limit(5000);

    const volWeekly = new Map<string, [number, number, number]>();
    for (const s of volShifts || []) {
      const tid = (s as any).tenant_id;
      if (!tid || (filterTenantId && tid !== filterTenantId)) continue;
      if (!volWeekly.has(tid)) volWeekly.set(tid, [0, 0, 0]);
      const d = new Date(s.shift_date).toISOString();
      const bucket = volWeekly.get(tid)!;
      if (d >= sevenDaysAgo) bucket[0]++;
      else if (d >= fourteenDaysAgo) bucket[1]++;
      else bucket[2]++;
    }

    for (const [tid, [w1, w2, w3]] of volWeekly) {
      if (w1 < w2 && w2 < w3 && w3 > 0) {
        signals.push({
          tenant_id: tid,
          signal_type: "volunteer_dropoff",
          severity: w1 === 0 ? "high" : "medium",
          confidence: Math.min(0.85, 0.4 + ((w3 - w1) / w3) * 0.45),
          source_summary: { week_counts: [w1, w2, w3] },
        });
      }
    }

    // ─── 4) migration_fragility: >3 failures in 24h ───
    const { data: migrationRuns } = await svc
      .from("automation_runs")
      .select("org_id, status")
      .eq("workflow_key", "migration_commit")
      .eq("status", "error")
      .gte("created_at", twentyFourHoursAgo)
      .limit(1000);

    const migFailMap = countByTenant(
      (migrationRuns || []).map((r: any) => ({ tenant_id: r.org_id }))
    );

    for (const [tid, failCount] of migFailMap) {
      if (filterTenantId && tid !== filterTenantId) continue;
      if (failCount >= 3) {
        signals.push({
          tenant_id: tid,
          signal_type: "migration_fragility",
          severity: failCount >= 5 ? "high" : "medium",
          confidence: Math.min(0.9, 0.5 + failCount * 0.08),
          source_summary: { failure_count_24h: failCount },
        });
      }
    }

    // ─── 5) expansion_ready: expansion moments + rising testimonium ───
    const { data: expMoments } = await svc
      .from("expansion_moments")
      .select("tenant_id, score")
      .eq("acknowledged", false)
      .limit(500);

    for (const em of expMoments || []) {
      if (filterTenantId && em.tenant_id !== filterTenantId) continue;
      if (em.score >= 10) {
        signals.push({
          tenant_id: em.tenant_id,
          signal_type: "expansion_ready",
          severity: em.score >= 20 ? "high" : "medium",
          confidence: Math.min(0.95, 0.5 + em.score * 0.02),
          source_summary: { expansion_score: em.score },
        });
      }
    }

    // ─── 6) narrative_surge: reflections + journey moves spike >60% ───
    const { data: thisWeekAll } = await svc
      .from("testimonium_events")
      .select("tenant_id")
      .in("event_kind", ["reflection_created", "journey_stage_change", "journey_chapter_added"])
      .gte("occurred_at", sevenDaysAgo)
      .limit(5000);

    const { data: lastWeekAll } = await svc
      .from("testimonium_events")
      .select("tenant_id")
      .in("event_kind", ["reflection_created", "journey_stage_change", "journey_chapter_added"])
      .gte("occurred_at", fourteenDaysAgo)
      .lt("occurred_at", sevenDaysAgo)
      .limit(5000);

    const surgeThis = countByTenant(thisWeekAll);
    const surgeLast = countByTenant(lastWeekAll);

    for (const [tid, thisCount] of surgeThis) {
      if (filterTenantId && tid !== filterTenantId) continue;
      const lastCount = surgeLast.get(tid) || 0;
      if (lastCount > 0 && thisCount > lastCount * 1.6) {
        const spike = (thisCount - lastCount) / lastCount;
        signals.push({
          tenant_id: tid,
          signal_type: "narrative_surge",
          severity: spike > 1.0 ? "high" : "low",
          confidence: Math.min(0.9, 0.4 + spike * 0.3),
          source_summary: { this_week: thisCount, last_week: lastCount, spike_pct: Math.round(spike * 100) },
        });
      }
    }

    // ─── Upsert signals ───
    let created = 0;
    let updated = 0;

    for (const sig of signals) {
      // Check for existing unresolved signal of same type for tenant
      const { data: existing } = await svc
        .from("lumen_signals")
        .select("id")
        .eq("tenant_id", sig.tenant_id)
        .eq("signal_type", sig.signal_type)
        .eq("resolved", false)
        .maybeSingle();

      if (existing) {
        await svc.from("lumen_signals").update({
          severity: sig.severity,
          confidence: sig.confidence,
          source_summary: sig.source_summary,
          last_updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
        updated++;
      } else {
        await svc.from("lumen_signals").insert(sig);
        created++;
      }
    }

    // ─── Health telemetry ───
    const stats = { signals_detected: signals.length, created, updated };

    await svc.from("system_health_events").insert({
      schedule_key: "lumen_detect",
      status: "ok",
      stats,
    });

    return new Response(JSON.stringify({ ok: true, ...stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    try {
      const svc2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await svc2.from("system_health_events").insert({
        schedule_key: "lumen_detect",
        status: "error",
        error: { message: err.message },
      });
    } catch (_) { /* best effort */ }

    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
