/**
 * operator-presence-rollup-weekly — Weekly presence intelligence aggregation.
 *
 * WHAT: Aggregates Visit Note activities and voice_notes into operator_presence_rollups.
 * WHERE: Called via cron or manual operator trigger.
 * WHY: Provides the Presence Intelligence layer without exposing raw transcripts.
 *
 * Data contracts:
 * - activities: activity_type='Visit Note', tenant_id, opportunity_id, metro_id, activity_date_time, created_at
 * - voice_notes: source_activity_id (FK → activities.id), user_id, audio_path, tenant_id
 * - tenant_voice_settings: tenant_id, store_audio (boolean)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Check admin role using service client
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleCheck } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse input
    const body = await req.json().catch(() => ({}));
    const scope: string = body.scope || "all";
    const inputTenantId: string | undefined = body.tenant_id;

    // Calculate week_start (Monday UTC)
    const now = new Date();
    const weekStart = body.week_start
      ? new Date(body.week_start)
      : getMonday(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString();
    const weekStartISO = weekStart.toISOString();

    // Get tenants to process
    let tenantIds: string[] = [];
    if (scope === "tenant" && inputTenantId) {
      tenantIds = [inputTenantId];
    } else {
      const { data: tenants } = await admin
        .from("tenants")
        .select("id")
        .limit(500);
      tenantIds = (tenants || []).map((t: any) => t.id);
    }

    // Get voice settings for all tenants
    const { data: voiceSettings } = await admin
      .from("tenant_voice_settings")
      .select("tenant_id, store_audio");
    const audioRetainedMap = new Map(
      (voiceSettings || []).map((v: any) => [v.tenant_id, v.store_audio])
    );

    let processedCount = 0;
    const signalsCreated: string[] = [];

    for (const tenantId of tenantIds) {
      // Fetch visit note activities for this tenant + week
      const { data: activities } = await admin
        .from("activities")
        .select("id, opportunity_id, metro_id, activity_date_time, created_at")
        .eq("tenant_id", tenantId)
        .eq("activity_type", "Visit Note")
        .gte("activity_date_time", weekStartISO)
        .lt("activity_date_time", weekEndStr);

      if (!activities || activities.length === 0) continue;

      const activityIds = activities.map((a: any) => a.id);

      // Fetch voice_notes linked to these activities
      const { data: voiceNotes } = await admin
        .from("voice_notes")
        .select("source_activity_id, user_id, audio_path")
        .in("source_activity_id", activityIds);

      const voiceActivityIds = new Set(
        (voiceNotes || []).map((v: any) => v.source_activity_id)
      );
      const allUserIds = new Set(
        (voiceNotes || []).map((v: any) => v.user_id)
      );

      const voiceCount = voiceActivityIds.size;
      const typedCount = activities.length - voiceCount;

      // Audio retained count
      const storeAudio = audioRetainedMap.get(tenantId) ?? false;
      const audioRetainedCount = storeAudio
        ? (voiceNotes || []).filter((v: any) => v.audio_path).length
        : 0;

      // Unique opportunities
      const uniqueOpps = new Set(
        activities
          .filter((a: any) => a.opportunity_id)
          .map((a: any) => a.opportunity_id)
      );

      // Last activity
      const lastActivityAt = activities.reduce(
        (max: string, a: any) =>
          a.created_at > max ? a.created_at : max,
        activities[0].created_at
      );

      // Group by metro for per-metro rollups
      const metroGroups = new Map<string | null, typeof activities>();
      for (const a of activities) {
        const key = a.metro_id || null;
        if (!metroGroups.has(key)) metroGroups.set(key, []);
        metroGroups.get(key)!.push(a);
      }

      // Overall tenant rollup (metro_id = null)
      await upsertRollup(admin, {
        tenant_id: tenantId,
        week_start: weekStartStr,
        metro_id: null,
        visit_notes_count: activities.length,
        visit_notes_voice_count: voiceCount,
        visit_notes_typed_count: typedCount,
        visit_notes_with_audio_retained_count: audioRetainedCount,
        unique_opportunities_touched: uniqueOpps.size,
        unique_users_contributed: allUserIds.size,
        last_activity_at: lastActivityAt,
      });

      // Generate signals
      await generateSignals(admin, tenantId, weekStartStr, {
        total: activities.length,
        voice: voiceCount,
        typed: typedCount,
        uniqueOpps: uniqueOpps.size,
      });

      processedCount++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed_tenants: processedCount,
        week_start: weekStartStr,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Presence rollup error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function getMonday(d: Date): Date {
  const dt = new Date(d);
  const day = dt.getUTCDay();
  const diff = dt.getUTCDate() - day + (day === 0 ? -6 : 1);
  dt.setUTCDate(diff);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

async function upsertRollup(admin: any, row: any) {
  // Use service role to bypass RLS for write
  const { error } = await admin.from("operator_presence_rollups").upsert(
    {
      ...row,
      id: undefined, // let DB generate
    },
    {
      onConflict: "tenant_id,week_start",
      ignoreDuplicates: false,
    }
  );

  if (error) {
    // Fallback: try delete + insert for unique index with COALESCE
    await admin
      .from("operator_presence_rollups")
      .delete()
      .eq("tenant_id", row.tenant_id)
      .eq("week_start", row.week_start)
      .is("metro_id", row.metro_id === null ? null : undefined);

    if (row.metro_id !== null) {
      await admin
        .from("operator_presence_rollups")
        .delete()
        .eq("tenant_id", row.tenant_id)
        .eq("week_start", row.week_start)
        .eq("metro_id", row.metro_id);
    }

    await admin.from("operator_presence_rollups").insert(row);
  }
}

async function generateSignals(
  admin: any,
  tenantId: string,
  weekStart: string,
  counts: {
    total: number;
    voice: number;
    typed: number;
    uniqueOpps: number;
  }
) {
  const signals: Array<{
    tenant_id: string;
    week_start: string;
    signal_type: string;
    severity: string;
    summary: string;
    evidence: Record<string, unknown>;
  }> = [];

  const { total, voice, typed, uniqueOpps } = counts;
  const voiceRatio = total > 0 ? voice / total : 0;
  const typedRatio = total > 0 ? typed / total : 0;
  const oppRatio = total > 0 ? uniqueOpps / total : 0;

  if (voiceRatio >= 0.6) {
    signals.push({
      tenant_id: tenantId,
      week_start: weekStart,
      signal_type: "voice_first",
      severity: "low",
      summary:
        "Most visit notes were captured by voice this week — the system is staying lightweight for field work.",
      evidence: { voice_count: voice, total: total, ratio: Math.round(voiceRatio * 100) },
    });
  }

  if (typedRatio >= 0.6) {
    signals.push({
      tenant_id: tenantId,
      week_start: weekStart,
      signal_type: "typed_first",
      severity: "low",
      summary:
        "Most visit notes were typed this week — steady desk-based documentation.",
      evidence: { typed_count: typed, total: total, ratio: Math.round(typedRatio * 100) },
    });
  }

  if (total >= 3 && total <= 12) {
    signals.push({
      tenant_id: tenantId,
      week_start: weekStart,
      signal_type: "healthy_cadence",
      severity: "low",
      summary:
        "A healthy cadence of visits was recorded this week.",
      evidence: { total },
    });
  }

  if (oppRatio >= 0.5) {
    signals.push({
      tenant_id: tenantId,
      week_start: weekStart,
      signal_type: "low_followup_risk",
      severity: "low",
      summary:
        "Visits were spread across multiple partners — good breadth of presence.",
      evidence: { unique_opps: uniqueOpps, total, ratio: Math.round(oppRatio * 100) },
    });
  }

  // Week-over-week comparison for rising/falling
  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const prevWeekStr = prevWeek.toISOString().split("T")[0];

  const { data: prevRollup } = await admin
    .from("operator_presence_rollups")
    .select("visit_notes_count")
    .eq("tenant_id", tenantId)
    .eq("week_start", prevWeekStr)
    .is("metro_id", null)
    .maybeSingle();

  const prevCount = prevRollup?.visit_notes_count ?? 0;

  if (prevCount > 0 && total >= prevCount * 1.5) {
    signals.push({
      tenant_id: tenantId,
      week_start: weekStart,
      signal_type: "presence_rising",
      severity: "low",
      summary:
        "Presence increased this week — more visits were recorded than last week.",
      evidence: { this_week: total, last_week: prevCount },
    });
  }

  if (prevCount >= 6 && total <= prevCount * 0.5) {
    signals.push({
      tenant_id: tenantId,
      week_start: weekStart,
      signal_type: "presence_falling",
      severity: "medium",
      summary:
        "Presence quieted this week — fewer visit notes were recorded than last week.",
      evidence: { this_week: total, last_week: prevCount },
    });
  }

  // Upsert each signal
  for (const signal of signals) {
    // Delete existing then insert (unique index on tenant_id, week_start, signal_type)
    await admin
      .from("operator_presence_signals")
      .delete()
      .eq("tenant_id", signal.tenant_id)
      .eq("week_start", signal.week_start)
      .eq("signal_type", signal.signal_type);

    await admin.from("operator_presence_signals").insert(signal);
  }
}
