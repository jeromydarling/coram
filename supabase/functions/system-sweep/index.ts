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

/** Determine health status from last run */
export function computeHealthStatus(
  lastCompletedAt: string | null,
  articlesPersisted: number,
  thresholdDays = 8,
): "healthy" | "quiet" | "stale" {
  if (!lastCompletedAt) return "stale";
  const daysSince = (Date.now() - new Date(lastCompletedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > thresholdDays) return "stale";
  return articlesPersisted > 0 ? "healthy" : "quiet";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth: service secret OR admin JWT ──
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const scheduleSecret = Deno.env.get("N8N_SCHEDULE_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  let isServiceAuth = false;

  if (authHeader.startsWith("Bearer ") && authHeader.slice(7).trim() === serviceRoleKey) {
    isServiceAuth = true;
  } else if (apiKeyHeader) {
    const token = apiKeyHeader.trim();
    if (
      (sharedSecret && constantTimeCompare(token, sharedSecret)) ||
      (enrichmentSecret && constantTimeCompare(token, enrichmentSecret)) ||
      (scheduleSecret && constantTimeCompare(token, scheduleSecret))
    ) {
      isServiceAuth = true;
    }
  } else if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (
      (sharedSecret && constantTimeCompare(token, sharedSecret)) ||
      (enrichmentSecret && constantTimeCompare(token, enrichmentSecret)) ||
      (scheduleSecret && constantTimeCompare(token, scheduleSecret))
    ) {
      isServiceAuth = true;
    } else {
      // Check JWT for admin role
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) {
        return jsonError(401, "unauthorized", "Invalid token");
      }
      const userId = claimsData.claims.sub as string;
      const svc = createClient(supabaseUrl, serviceRoleKey);
      const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", userId);
      const userRoles = (roles ?? []).map((r: { role: string }) => r.role);
      if (!userRoles.includes("admin")) {
        return jsonError(403, "forbidden", "Admin role required");
      }
      isServiceAuth = true; // treat admin as service-level for this function
    }
  }

  if (!isServiceAuth) {
    return jsonError(401, "unauthorized", "Missing credentials");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const t0 = Date.now();

  try {
    // ── Fetch all metros ──
    const { data: metros, error: metroErr } = await supabase
      .from("metros")
      .select("id, metro")
      .order("metro");
    if (metroErr) throw new Error(`Failed to fetch metros: ${metroErr.message}`);

    const sweepRunId = crypto.randomUUID();
    const sweepErrors: Array<{ metro?: string; phase: string; error: string }> = [];
    let totalSuggestionsCreated = 0;
    let totalSuggestionsDeduped = 0;
    let staleMetros = 0;
    let quietMetros = 0;

    const metroResults: Array<{
      metro_id: string;
      metro_name: string;
      news_status: string;
      events_status: string;
      narrative_status: string;
      drift_status: string;
      suggestions_created: number;
    }> = [];

    // ── Per-metro sweep ──
    for (const metro of metros ?? []) {
      try {
        const metroRunId = crypto.randomUUID();
        const metroT0 = Date.now();

        // 1. Check last news run
        const { data: lastNewsRun } = await supabase
          .from("metro_news_runs")
          .select("id, ran_at, articles_persisted, status")
          .eq("metro_id", metro.id)
          .eq("status", "completed")
          .order("ran_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const newsStatus = computeHealthStatus(
          lastNewsRun?.ran_at ?? null,
          lastNewsRun?.articles_persisted ?? 0,
        );

        // 2. Check last local pulse run
        const { data: lastPulseRun } = await supabase
          .from("discovery_runs")
          .select("id, completed_at, stats, status")
          .eq("module", "local_pulse")
          .eq("scope", "metro")
          .eq("metro_id", metro.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const pulseStats = (lastPulseRun?.stats ?? {}) as Record<string, number>;
        const eventsStatus = computeHealthStatus(
          lastPulseRun?.completed_at ?? null,
          pulseStats.events_persisted ?? pulseStats.unique_results ?? 0,
        );

        // 3. Check last narrative build
        const { data: lastNarrative } = await supabase
          .from("metro_narratives")
          .select("id, updated_at, news_signal_strength")
          .eq("metro_id", metro.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const narrativeStatus = computeHealthStatus(
          lastNarrative?.updated_at ?? null,
          1, // narratives are always "content" if they exist
        );

        // 4. Check last drift score
        const { data: lastDrift } = await supabase
          .from("metro_drift_scores")
          .select("id, computed_at, drift_score")
          .eq("metro_id", metro.id)
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const driftStatus = computeHealthStatus(
          lastDrift?.computed_at ?? null,
          1,
        );

        // Track stale/quiet
        if (newsStatus === "stale" || eventsStatus === "stale") staleMetros++;
        if (newsStatus === "quiet" || eventsStatus === "quiet") quietMetros++;

        // 5. Generate gentle suggestions (deduped by week)
        const weekStart = getWeekStart();
        let suggestionsCreated = 0;

        // 5a. Community signal suggestion from news
        if (lastNewsRun && (lastNewsRun.articles_persisted ?? 0) > 0) {
          const dedupeKey = `community_signal:${metro.id}:${weekStart}`;
          const { error: sugErr } = await supabase
            .from("system_suggestions")
            .insert({
              scope: "metro",
              metro_id: metro.id,
              suggestion_type: "local_pulse_signal",
              title: `Community news active in ${metro.metro}`,
              summary: `${lastNewsRun.articles_persisted} articles ingested this cycle. News is feeding the ${metro.metro} narrative.`,
              rationale: { news_run_id: lastNewsRun.id, articles_persisted: lastNewsRun.articles_persisted },
              confidence: 70,
              source_refs: [{ kind: "news_run", id: lastNewsRun.id }],
              dedupe_key: dedupeKey,
            })
            .select("id")
            .single();

          if (sugErr && sugErr.code === "23505") {
            // duplicate — expected
            totalSuggestionsDeduped++;
          } else if (!sugErr) {
            suggestionsCreated++;
          }
        }

        // 5b. Stale warning suggestion
        if (newsStatus === "stale") {
          const dedupeKey = `stale_news:${metro.id}:${weekStart}`;
          const { error: sugErr } = await supabase
            .from("system_suggestions")
            .insert({
              scope: "metro",
              metro_id: metro.id,
              suggestion_type: "partner_check_in",
              title: `No recent news ingestion for ${metro.metro}`,
              summary: `News pipeline hasn't completed a run in over 8 days. The narrative may be relying on older data.`,
              rationale: { last_run_at: lastNewsRun?.ran_at ?? null },
              confidence: 40,
              source_refs: [],
              dedupe_key: dedupeKey,
            })
            .select("id")
            .single();

          if (sugErr && sugErr.code === "23505") {
            totalSuggestionsDeduped++;
          } else if (!sugErr) {
            suggestionsCreated++;
          }
        }

        totalSuggestionsCreated += suggestionsCreated;

        // Write per-metro job run
        await supabase.from("system_job_runs").insert({
          id: metroRunId,
          job_key: "system_sweep",
          scope: "metro",
          metro_id: metro.id,
          status: "completed",
          started_at: new Date(metroT0).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - metroT0,
          stats: {
            news_status: newsStatus,
            events_status: eventsStatus,
            narrative_status: narrativeStatus,
            drift_status: driftStatus,
            suggestions_created: suggestionsCreated,
          },
          outputs: {
            last_news_run_id: lastNewsRun?.id ?? null,
            last_pulse_run_id: lastPulseRun?.id ?? null,
            last_narrative_id: lastNarrative?.id ?? null,
            last_drift_id: lastDrift?.id ?? null,
          },
        });

        metroResults.push({
          metro_id: metro.id,
          metro_name: metro.metro,
          news_status: newsStatus,
          events_status: eventsStatus,
          narrative_status: narrativeStatus,
          drift_status: driftStatus,
          suggestions_created: suggestionsCreated,
        });
      } catch (metroErr) {
        const errMsg = metroErr instanceof Error ? metroErr.message : String(metroErr);
        sweepErrors.push({ metro: metro.metro, phase: "metro_sweep", error: errMsg });
      }
    }

    // ── System-level summary run ──
    await supabase.from("system_job_runs").insert({
      id: sweepRunId,
      job_key: "system_sweep",
      scope: "system",
      status: sweepErrors.length > 0 ? "partial" : "completed",
      started_at: new Date(t0).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - t0,
      stats: {
        metros_processed: (metros ?? []).length,
        stale_metros: staleMetros,
        quiet_metros: quietMetros,
        suggestions_created: totalSuggestionsCreated,
        suggestions_deduped: totalSuggestionsDeduped,
        errors_count: sweepErrors.length,
      },
      outputs: { metro_results: metroResults },
      errors: sweepErrors,
    });

    return jsonOk({
      ok: true,
      run_id: sweepRunId,
      metros_processed: (metros ?? []).length,
      stale_metros: staleMetros,
      quiet_metros: quietMetros,
      suggestions_created: totalSuggestionsCreated,
      suggestions_deduped: totalSuggestionsDeduped,
      errors: sweepErrors,
      duration_ms: Date.now() - t0,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("System sweep error:", errMsg);
    return jsonError(500, "internal_error", errMsg);
  }
});

function getWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff));
  return monday.toISOString().slice(0, 10);
}
