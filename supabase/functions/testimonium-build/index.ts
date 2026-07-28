import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, metro_id, period_start, period_end } = await req.json();
    if (!tenant_id || !period_start || !period_end) {
      return new Response(
        JSON.stringify({ error: "Missing tenant_id, period_start, or period_end" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify membership
    const { data: membership } = await admin
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a tenant member" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify role
    const { data: roleCheck } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "leadership", "regional_lead"]);
    if (!roleCheck || roleCheck.length === 0) {
      return new Response(
        JSON.stringify({ error: "Requires admin/leadership/regional_lead role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Aggregate from existing sources (metadata only, never raw text) ──

    // 1) Impulsus entries — entry_type + tags only
    let impulsusQuery = admin
      .from("impulsus_entries")
      .select("entry_type, tags, created_at")
      .eq("tenant_id", tenant_id)
      .gte("created_at", period_start)
      .lte("created_at", period_end)
      .order("created_at", { ascending: false })
      .limit(50);
    if (metro_id) impulsusQuery = impulsusQuery.eq("metro_id", metro_id);
    const { data: impulsusEntries } = await impulsusQuery;

    // 2) Metro narratives (Civitas) — themes only
    let civitasQuery = admin
      .from("metro_narratives")
      .select("themes, narrative_type, created_at")
      .gte("created_at", period_start)
      .lte("created_at", period_end)
      .order("created_at", { ascending: false })
      .limit(10);
    if (metro_id) civitasQuery = civitasQuery.eq("metro_id", metro_id);
    const { data: civitasNarratives } = await civitasQuery;

    // 3) Discovery briefings (Signum) — scope + module only
    let briefingQuery = admin
      .from("discovery_briefings")
      .select("module, scope, created_at")
      .gte("created_at", period_start)
      .lte("created_at", period_end)
      .limit(20);
    if (metro_id) briefingQuery = briefingQuery.eq("metro_id", metro_id);
    const { data: briefings } = await briefingQuery;

    // 4) Journey stage transitions
    let oppQuery = admin
      .from("opportunities")
      .select("stage, updated_at")
      .eq("tenant_id", tenant_id)
      .gte("updated_at", period_start)
      .lte("updated_at", period_end);
    if (metro_id) oppQuery = oppQuery.eq("metro_id", metro_id);
    const { data: opportunities } = await oppQuery;

    // 5) Events attended count
    let eventsQuery = admin
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .gte("event_date", period_start)
      .lte("event_date", period_end);
    if (metro_id) eventsQuery = eventsQuery.eq("metro_id", metro_id);
    const { count: eventsCount } = await eventsQuery;

    // 6) Reflections count (never body text)
    const { count: reflectionsCount } = await admin
      .from("opportunity_reflections")
      .select("*", { count: "exact", head: true })
      .gte("created_at", period_start)
      .lte("created_at", period_end);

    // ── Build narrative structure ──

    const themes = extractThemes(impulsusEntries, civitasNarratives);
    const chapters = buildChapters(
      impulsusEntries,
      civitasNarratives,
      briefings,
      opportunities,
      eventsCount || 0,
      reflectionsCount || 0
    );
    const driftSummary = detectDrift(civitasNarratives, briefings);

    const metrics = {
      relationships_grown: opportunities?.length || 0,
      events_attended: eventsCount || 0,
      reflections_written: reflectionsCount || 0,
    };

    const narrativeJson = {
      headline: buildHeadline(period_start, period_end, metro_id),
      themes,
      chapters,
      community_movements: extractCommunityMovements(civitasNarratives),
      quiet_progress: extractQuietProgress(impulsusEntries, opportunities),
      narrative_drift_summary: driftSummary,
      metrics,
    };

    const title = metro_id
      ? `Community Narrative — ${period_start} to ${period_end}`
      : `Organization Narrative — ${period_start} to ${period_end}`;

    const { data: report, error: reportErr } = await admin
      .from("testimonium_reports")
      .insert({
        tenant_id,
        metro_id: metro_id || null,
        title,
        narrative_json: narrativeJson,
        period_start,
        period_end,
        generated_by: user.id,
        ai_generated: true,
      })
      .select("id")
      .single();
    if (reportErr) throw reportErr;

    // Also insert sections for backward compat with existing detail page
    const sectionRows = chapters.map((ch: any, i: number) => ({
      report_id: report.id,
      section_key: ch.title.toLowerCase().replace(/\s+/g, "_"),
      order_index: i + 1,
      title: ch.title,
      content: { summary: ch.summary, signals: ch.signals },
    }));
    if (sectionRows.length > 0) {
      await admin.from("testimonium_sections").insert(sectionRows);
    }

    return new Response(
      JSON.stringify({ ok: true, report_id: report.id, metrics }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("testimonium-build error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Helpers ──

function buildHeadline(start: string, end: string, metroId?: string): string {
  const scope = metroId ? "this community" : "your organization";
  return `A season of quiet growth across ${scope} — ${start} to ${end}.`;
}

function extractThemes(
  impulsus: any[] | null,
  civitas: any[] | null
): string[] {
  const themes = new Set<string>();
  for (const entry of impulsus || []) {
    if (Array.isArray(entry.tags)) {
      for (const tag of entry.tags) themes.add(tag);
    }
    if (entry.entry_type) themes.add(entry.entry_type);
  }
  for (const narrative of civitas || []) {
    if (Array.isArray(narrative.themes)) {
      for (const t of narrative.themes) themes.add(t);
    }
  }
  return Array.from(themes).slice(0, 8);
}

function buildChapters(
  impulsus: any[] | null,
  civitas: any[] | null,
  briefings: any[] | null,
  opportunities: any[] | null,
  eventsCount: number,
  reflectionsCount: number
): Array<{ title: string; summary: string; signals: string[] }> {
  const chapters: Array<{ title: string; summary: string; signals: string[] }> = [];

  // Community Movement
  const civitasSignals: string[] = [];
  if (civitas && civitas.length > 0) {
    civitasSignals.push(`${civitas.length} narrative moments captured`);
  }
  if (briefings && briefings.length > 0) {
    civitasSignals.push(`${briefings.length} discovery briefings generated`);
  }
  chapters.push({
    title: "Community Movement",
    summary:
      civitasSignals.length > 0
        ? "The community is expressing itself through new signals and narrative threads."
        : "Community signals are still gathering — presence builds narrative over time.",
    signals: civitasSignals,
  });

  // Relationship Growth
  const oppSignals: string[] = [];
  if (opportunities && opportunities.length > 0) {
    oppSignals.push(`${opportunities.length} relationships showed movement`);
  }
  if (reflectionsCount > 0) {
    oppSignals.push(`${reflectionsCount} reflections written`);
  }
  chapters.push({
    title: "Relationship Growth",
    summary:
      oppSignals.length > 0
        ? "Relationships deepened through intentional engagement and reflection."
        : "Relationships are being tended — growth often happens beneath the surface.",
    signals: oppSignals,
  });

  // Local Presence
  const presenceSignals: string[] = [];
  if (eventsCount > 0) {
    presenceSignals.push(`${eventsCount} events attended`);
  }
  chapters.push({
    title: "Local Presence",
    summary:
      eventsCount > 0
        ? "Your presence in the community was felt through consistent participation."
        : "Attending local events deepens trust — consider upcoming gatherings.",
    signals: presenceSignals,
  });

  // Impulsus Reflections
  const impulsusSignals: string[] = [];
  const typeGroups: Record<string, number> = {};
  for (const entry of impulsus || []) {
    typeGroups[entry.entry_type] = (typeGroups[entry.entry_type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(typeGroups)) {
    impulsusSignals.push(`${count} ${type} entries`);
  }
  chapters.push({
    title: "Personal Memory",
    summary:
      impulsusSignals.length > 0
        ? "Your personal journal captures the texture of this season's work."
        : "Impulsus is ready whenever you want to capture a moment.",
    signals: impulsusSignals,
  });

  return chapters;
}

function extractCommunityMovements(civitas: any[] | null): string[] {
  if (!civitas || civitas.length === 0) return [];
  const movements: string[] = [];
  for (const n of civitas) {
    if (n.narrative_type) {
      movements.push(`${n.narrative_type} narrative emerged`);
    }
  }
  return movements.slice(0, 5);
}

function extractQuietProgress(
  impulsus: any[] | null,
  opportunities: any[] | null
): string[] {
  const progress: string[] = [];
  if (impulsus && impulsus.length > 0) {
    progress.push(`${impulsus.length} personal memories recorded`);
  }
  if (opportunities && opportunities.length > 0) {
    const stages = new Set(opportunities.map((o: any) => o.stage));
    progress.push(`Relationships span ${stages.size} different journey stages`);
  }
  return progress;
}

function detectDrift(
  civitas: any[] | null,
  briefings: any[] | null
): string | null {
  if (!civitas || civitas.length < 2) return null;

  // Compare themes from oldest vs newest narratives
  const sorted = [...civitas].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const oldThemes = new Set<string>(sorted[0].themes || []);
  const newThemes = new Set<string>(sorted[sorted.length - 1].themes || []);

  const emerging: string[] = [];
  for (const t of newThemes) {
    if (!oldThemes.has(t)) emerging.push(t);
  }

  if (emerging.length > 0) {
    return `This season shows a subtle shift toward ${emerging.slice(0, 3).join(", ")}.`;
  }
  return null;
}
