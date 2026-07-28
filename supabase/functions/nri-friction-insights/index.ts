/**
 * nri-friction-insights — Friction Insight Engine.
 *
 * WHAT: Collects friction patterns (idle, nav loops, abandons, help opens),
 *       filters out error-adjacent sessions, classifies DESIGN vs LEARNING,
 *       and upserts results into nri_design_suggestions / nri_playbook_drafts.
 * WHERE: Called from Operator Nexus or scheduled daily.
 * WHY: Transforms clean friction into actionable UX improvements or learning playbooks.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FRICTION_KINDS = [
  "friction_idle",
  "friction_repeat_nav",
  "friction_abandon_flow",
  "friction_help_open",
  "friction_rage_click",
] as const;

const ERROR_KINDS = [
  "error",
  "console_error",
  "network_failure",
  "unhandled_exception",
];

// Max outputs per run
const MAX_DESIGN_SUGGESTIONS = 10;
const MAX_PLAYBOOK_DRAFTS = 3;

// Minimum cluster size to act on
const MIN_CLUSTER_SIZE = 3;

interface FrictionEvent {
  id: string;
  tenant_id: string;
  user_id: string | null;
  event_kind: string;
  source_module: string;
  summary: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

interface FrictionCluster {
  pattern_key: string;
  route: string;
  role: string;
  event_kind: string;
  count: number;
  tenant_ids: Set<string>;
  user_ids: Set<string>;
  summaries: string[];
  metadata_samples: Record<string, unknown>[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Auth check — operator only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing auth" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Role check
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isOperator = roles?.some(
      (r: { role: string }) => r.role === "admin" || r.role === "leadership",
    );
    if (!isOperator) {
      return new Response(
        JSON.stringify({ ok: false, error: "Operator role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const sinceHours = body.since_hours ?? 168; // default 7 days
    const scope = body.scope ?? "all";
    const tenantFilter = body.tenant_id ?? null;

    const sinceTs = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

    // ── 1. Cooldown check via automation-gate pattern ──
    const { data: cooldownResult } = await adminClient.rpc(
      "check_automation_cooldown",
      {
        p_workflow_key: "nri_friction_insights",
        p_dedupe_key: `nri_friction_insights:${scope}:${tenantFilter || "all"}`,
        p_cooldown_seconds: 43200, // 12 hours
      },
    );
    if (cooldownResult && !cooldownResult.allowed) {
      return new Response(
        JSON.stringify({
          ok: false,
          reason: "cooldown_active",
          seconds_remaining: cooldownResult.seconds_remaining,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Collect friction events ──
    let query = adminClient
      .from("testimonium_events")
      .select("id, tenant_id, user_id, event_kind, source_module, summary, metadata, occurred_at")
      .in("event_kind", [...FRICTION_KINDS])
      .gte("occurred_at", sinceTs)
      .order("occurred_at", { ascending: false })
      .limit(1000);

    if (scope === "tenant" && tenantFilter) {
      query = query.eq("tenant_id", tenantFilter);
    }

    const { data: frictionEvents, error: fetchError } = await query;
    if (fetchError) {
      console.error("[nri-friction-insights] Fetch error:", fetchError.message);
      return new Response(
        JSON.stringify({ ok: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!frictionEvents || frictionEvents.length === 0) {
      // Record the run even if no data
      await recordRun(adminClient, scope, tenantFilter);
      return new Response(
        JSON.stringify({ ok: true, design_suggestions: 0, playbook_drafts: 0, message: "No friction events found — that is perfectly fine." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 3. Build error index for filtering ──
    const uniqueTenantUserPairs = new Set<string>();
    for (const ev of frictionEvents as FrictionEvent[]) {
      if (ev.user_id) uniqueTenantUserPairs.add(`${ev.tenant_id}:${ev.user_id}`);
    }

    // Check for recent errors in the same tenant+user combos
    const errorTenantUserSet = new Set<string>();
    // Query error events in same window
    const { data: errorEvents } = await adminClient
      .from("testimonium_events")
      .select("tenant_id, user_id")
      .in("event_kind", ERROR_KINDS)
      .gte("occurred_at", sinceTs)
      .limit(500);

    if (errorEvents) {
      for (const ee of errorEvents) {
        if (ee.user_id) errorTenantUserSet.add(`${ee.tenant_id}:${ee.user_id}`);
      }
    }

    // ── 4. Filter out error-adjacent friction ──
    const cleanFriction = (frictionEvents as FrictionEvent[]).filter((ev) => {
      if (!ev.user_id) return true; // anonymous events pass through
      const key = `${ev.tenant_id}:${ev.user_id}`;
      return !errorTenantUserSet.has(key);
    });

    if (cleanFriction.length === 0) {
      await recordRun(adminClient, scope, tenantFilter);
      return new Response(
        JSON.stringify({ ok: true, design_suggestions: 0, playbook_drafts: 0, message: "All friction was error-adjacent — filtered out." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 5. Cluster by pattern_key ──
    const clusters = new Map<string, FrictionCluster>();

    for (const ev of cleanFriction) {
      const route = (ev.metadata?.page as string) || (ev.metadata?.route as string) || "unknown";
      const role = (ev.metadata?.role as string) || "unknown";
      const patternKey = `${ev.event_kind}:${route}:${role}`;

      if (!clusters.has(patternKey)) {
        clusters.set(patternKey, {
          pattern_key: patternKey,
          route,
          role,
          event_kind: ev.event_kind,
          count: 0,
          tenant_ids: new Set(),
          user_ids: new Set(),
          summaries: [],
          metadata_samples: [],
        });
      }

      const cluster = clusters.get(patternKey)!;
      cluster.count++;
      cluster.tenant_ids.add(ev.tenant_id);
      if (ev.user_id) cluster.user_ids.add(ev.user_id);
      if (cluster.summaries.length < 3) cluster.summaries.push(ev.summary);
      if (cluster.metadata_samples.length < 2) cluster.metadata_samples.push(ev.metadata);
    }

    // ── 6. Classify and upsert ──
    const sortedClusters = [...clusters.values()]
      .filter((c) => c.count >= MIN_CLUSTER_SIZE)
      .sort((a, b) => b.count - a.count);

    let designCount = 0;
    let playbookCount = 0;

    for (const cluster of sortedClusters) {
      if (designCount >= MAX_DESIGN_SUGGESTIONS && playbookCount >= MAX_PLAYBOOK_DRAFTS) break;

      const classification = classifyCluster(cluster);

      if (classification === "DESIGN" && designCount < MAX_DESIGN_SUGGESTIONS) {
        const severity = cluster.count >= 20 ? "high" : cluster.count >= 8 ? "medium" : "low";
        const { error: upsertErr } = await adminClient
          .from("nri_design_suggestions")
          .upsert(
            {
              pattern_key: cluster.pattern_key,
              tenant_id: cluster.tenant_ids.size === 1 ? [...cluster.tenant_ids][0] : null,
              severity,
              suggestion_summary: buildDesignSummary(cluster).slice(0, 220),
              narrative_detail: buildDesignNarrative(cluster).slice(0, 2000),
              affected_routes: [cluster.route],
              roles_affected: cluster.role !== "unknown" ? [cluster.role] : [],
              evidence: {
                event_count: cluster.count,
                unique_users: cluster.user_ids.size,
                unique_tenants: cluster.tenant_ids.size,
                sample_summaries: cluster.summaries,
              },
              status: "open",
            },
            { onConflict: "pattern_key" },
          );
        if (!upsertErr) designCount++;
        else console.error("[nri-friction-insights] Design upsert error:", upsertErr.message);
      } else if (classification === "LEARNING" && playbookCount < MAX_PLAYBOOK_DRAFTS) {
        const { error: upsertErr } = await adminClient
          .from("nri_playbook_drafts")
          .upsert(
            {
              pattern_key: cluster.pattern_key,
              tenant_id: cluster.tenant_ids.size === 1 ? [...cluster.tenant_ids][0] : null,
              title: buildPlaybookTitle(cluster),
              role: cluster.role !== "unknown" ? cluster.role : null,
              related_feature_key: cluster.route,
              draft_markdown: buildPlaybookMarkdown(cluster),
              evidence: {
                event_count: cluster.count,
                unique_users: cluster.user_ids.size,
                unique_tenants: cluster.tenant_ids.size,
                sample_summaries: cluster.summaries,
              },
              status: "draft",
            },
            { onConflict: "pattern_key" },
          );
        if (!upsertErr) playbookCount++;
        else console.error("[nri-friction-insights] Playbook upsert error:", upsertErr.message);
      }
    }

    // Record the run
    await recordRun(adminClient, scope, tenantFilter);

    console.log(
      `[nri-friction-insights] Complete: ${designCount} design, ${playbookCount} playbooks from ${cleanFriction.length} clean events`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        design_suggestions: designCount,
        playbook_drafts: playbookCount,
        total_friction_events: frictionEvents.length,
        clean_friction_events: cleanFriction.length,
        clusters_found: sortedClusters.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[nri-friction-insights] Error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ── Helpers ──────────────────────────────────────────────────

function classifyCluster(cluster: FrictionCluster): "DESIGN" | "LEARNING" {
  // DESIGN indicators: rage clicks, high abandonment, repeated nav loops across many users
  if (cluster.event_kind === "friction_rage_click") return "DESIGN";
  if (cluster.event_kind === "friction_abandon_flow" && cluster.user_ids.size >= 3) return "DESIGN";
  if (cluster.event_kind === "friction_repeat_nav" && cluster.count >= 10) return "DESIGN";
  if (cluster.event_kind === "friction_idle" && cluster.count >= 15) return "DESIGN";

  // LEARNING indicators: help opens, role-specific idle, lower volume
  if (cluster.event_kind === "friction_help_open") return "LEARNING";
  if (cluster.role !== "unknown" && cluster.event_kind === "friction_idle") return "LEARNING";

  // Default: if many unique users hit same thing, it's design
  if (cluster.user_ids.size >= 5) return "DESIGN";
  return "LEARNING";
}

function buildDesignSummary(cluster: FrictionCluster): string {
  const kindLabel: Record<string, string> = {
    friction_idle: "People pause here",
    friction_repeat_nav: "Navigation loops detected",
    friction_abandon_flow: "Flow abandonments noticed",
    friction_rage_click: "Repeated clicking detected",
    friction_help_open: "Help frequently requested",
  };
  const label = kindLabel[cluster.event_kind] || "Friction observed";
  return `${label} on ${cluster.route} (${cluster.count} events from ${cluster.user_ids.size} people). The ${cluster.role !== "unknown" ? cluster.role + " " : ""}experience may benefit from gentler guidance.`;
}

function buildDesignNarrative(cluster: FrictionCluster): string {
  return [
    `NRI noticed a moment where people hesitate.`,
    ``,
    `**Pattern:** ${cluster.event_kind.replace(/_/g, " ")}`,
    `**Route:** \`${cluster.route}\``,
    `**Role:** ${cluster.role !== "unknown" ? cluster.role : "all roles"}`,
    `**Observed:** ${cluster.count} times across ${cluster.user_ids.size} unique people`,
    ``,
    `**What we noticed:**`,
    ...cluster.summaries.map((s) => `- ${s}`),
    ``,
    `No blame. No urgency. This is simply a place where the system could become gentler or clearer.`,
    ``,
    `**Possible approaches:**`,
    `- Simplify the flow at this step`,
    `- Add contextual guidance or tooltip`,
    `- Review mobile layout at this route`,
    `- Consider reducing cognitive load`,
  ].join("\n");
}

function buildPlaybookTitle(cluster: FrictionCluster): string {
  const route = cluster.route.replace(/^\//, "").replace(/\//g, " › ");
  return `How to navigate: ${route}${cluster.role !== "unknown" ? ` (${cluster.role})` : ""}`;
}

function buildPlaybookMarkdown(cluster: FrictionCluster): string {
  const route = cluster.route;
  return [
    `# ${buildPlaybookTitle(cluster)}`,
    ``,
    `> This playbook was drafted by NRI after noticing people sometimes take detours on this page.`,
    ``,
    `## What this page does`,
    ``,
    `The \`${route}\` page is where you can [describe the primary action]. If you find yourself going back and forth, here is a gentle guide.`,
    ``,
    `## Step-by-step`,
    ``,
    `1. Navigate to \`${route}\``,
    `2. Look for the primary action area`,
    `3. Complete the form or selection`,
    `4. Confirm and move forward`,
    ``,
    `## Tips`,
    ``,
    `- If something feels unclear, the help icon (?) at the top right of each section provides context`,
    `- You do not need to complete everything at once — your progress is saved`,
    `- If you are in a ${cluster.role !== "unknown" ? cluster.role : "specific"} role, some options may appear differently`,
    ``,
    `## Still stuck?`,
    ``,
    `Reach out to your organization's steward or use the feedback button to let us know. We are always listening.`,
  ].join("\n");
}

async function recordRun(
  client: ReturnType<typeof createClient>,
  scope: string,
  tenantId: string | null,
) {
  const runId = crypto.randomUUID();
  await client.from("automation_runs").insert({
    run_id: runId,
    workflow_key: "nri_friction_insights",
    dedupe_key: `nri_friction_insights:${scope}:${tenantId || "all"}`,
    status: "processed",
    processed_at: new Date().toISOString(),
    triggered_by: "operator",
  });
}
