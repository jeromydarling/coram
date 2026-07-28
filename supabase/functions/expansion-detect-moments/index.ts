/**
 * expansion-detect-moments — Daily deterministic expansion moment detection.
 *
 * WHAT: Groups expansion_signals by tenant_id, sums weights over 30 days,
 *       and creates expansion_moments when score >= 10.
 * WHERE: Runs daily via cron or manual admin trigger.
 * WHY: Powers Civitas expansion awareness without AI generation.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(supabaseUrl, serviceKey);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // 1. Get all signals from last 30 days
    const { data: signals, error: sigErr } = await svc
      .from("expansion_signals")
      .select("tenant_id, weight")
      .gte("created_at", thirtyDaysAgo)
      .limit(5000);

    if (sigErr) throw sigErr;

    // 2. Group by tenant_id and sum weights
    const tenantScores = new Map<string, number>();
    for (const s of signals || []) {
      tenantScores.set(s.tenant_id, (tenantScores.get(s.tenant_id) || 0) + s.weight);
    }

    // 3. Get tenants that already have active (unacknowledged) moments
    const { data: existingMoments } = await svc
      .from("expansion_moments")
      .select("tenant_id")
      .eq("acknowledged", false);

    const existingSet = new Set((existingMoments || []).map((m: any) => m.tenant_id));

    // 4. Create moments for qualifying tenants
    const newMoments: Array<{ tenant_id: string; score: number }> = [];
    for (const [tenantId, score] of tenantScores) {
      if (score >= 10 && !existingSet.has(tenantId)) {
        newMoments.push({ tenant_id: tenantId, score });
      }
    }

    if (newMoments.length > 0) {
      const { error: insertErr } = await svc
        .from("expansion_moments")
        .insert(newMoments);
      if (insertErr) throw insertErr;
    }

    const stats = {
      signals_scanned: (signals || []).length,
      tenants_scored: tenantScores.size,
      moments_created: newMoments.length,
    };

    // Health telemetry
    await svc.from("system_health_events").insert({
      schedule_key: "expansion_detect_moments",
      status: "ok",
      stats,
    });

    return new Response(JSON.stringify({ ok: true, ...stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    try {
      const svc2 = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await svc2.from("system_health_events").insert({
        schedule_key: "expansion_detect_moments",
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
