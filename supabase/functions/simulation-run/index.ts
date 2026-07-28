/**
 * simulation-run — Deterministic 7-day usage simulation for demo tenants.
 *
 * WHAT: Simulates realistic tenant usage across all CROS modules.
 * WHERE: Admin Scenario Lab.
 * WHY: Proves user flows work end-to-end without manual testing.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

// Deterministic PRNG
class SeededRandom {
  private seed: number;
  constructor(seed: string) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    this.seed = Math.abs(h) || 1;
  }
  next(): number { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
}

const INTENSITY_MULTIPLIER: Record<string, number> = { light: 0.5, normal: 1, heavy: 2 };
const STAGES = ["Found", "Contacted", "Discovery Scheduled", "Discovery Held", "Proposal Sent", "Agreement Pending", "Agreement Signed"];
const REFLECTION_STARTERS = [
  "Met with the team today to discuss",
  "Encouraging conversation about",
  "They shared progress on",
  "Follow-up needed regarding",
  "Positive momentum around",
  "Exploring partnership possibilities in",
];

// deno-lint-ignore no-explicit-any
type SvcClient = any;

async function logEvent(
  svc: SvcClient,
  runId: string,
  occurredAt: Date,
  actorType: string,
  module: string,
  action: string,
  refs: Record<string, unknown>,
  outcome: string,
  warnings: unknown[] = [],
) {
  await svc.from("simulation_events").insert({
    simulation_run_id: runId,
    occurred_at: occurredAt.toISOString(),
    actor_type: actorType,
    module,
    action,
    internal_refs: refs,
    outcome,
    warnings,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth check — use getUser per edge function standards
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonError(401, "unauthorized", "Missing auth");

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return jsonError(401, "unauthorized", "Invalid token");

  const userId = user.id;
  const svc = createClient(supabaseUrl, serviceKey);
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", userId);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) return jsonError(403, "forbidden", "Admin only");

  const body = await req.json();
  const { tenant_id, demo_tenant_id, scenario_key, run_key, days = 7, intensity = 'normal' } = body;
  if (!tenant_id || !scenario_key || !run_key) {
    return jsonError(400, "bad_request", "tenant_id, scenario_key, run_key required");
  }

  // Verify demo tenant if provided
  if (demo_tenant_id) {
    const { data: demo } = await svc.from("demo_tenants").select("id, is_demo").eq("id", demo_tenant_id).single();
    if (!demo?.is_demo) return jsonError(400, "bad_request", "Tenant must be a demo tenant");
  }

  // Idempotency: check existing
  const { data: existing } = await svc
    .from("simulation_runs")
    .select("id, status, stats")
    .eq("tenant_id", tenant_id)
    .eq("scenario_key", scenario_key)
    .eq("run_key", run_key)
    .maybeSingle();

  if (existing && existing.status === "completed") {
    return jsonOk({ ok: true, simulation_run_id: existing.id, stats: existing.stats, idempotent: true });
  }

  // Create or update run
  const { data: run, error: runErr } = await svc
    .from("simulation_runs")
    .upsert({
      tenant_id,
      demo_tenant_id,
      scenario_key,
      run_key,
      days,
      intensity,
      status: "running",
      stats: {},
    }, { onConflict: "tenant_id,scenario_key,run_key" })
    .select("id")
    .single();

  if (runErr) return jsonError(500, "internal_error", runErr.message);
  const runId = run.id;

  try {
    const rng = new SeededRandom(`${run_key}-${scenario_key}-${tenant_id}`);
    const mult = INTENSITY_MULTIPLIER[intensity] ?? 1;
    const stats: Record<string, number> = {};
    const baseDate = new Date();

    // Fetch existing data for this tenant
    const { data: opps } = await svc.from("opportunities").select("id, stage").eq("tenant_id", tenant_id).limit(200);
    const { data: contacts } = await svc.from("contacts").select("id, name").eq("tenant_id", tenant_id).limit(500);
    const { data: events } = await svc.from("events").select("id, event_name").eq("tenant_id", tenant_id).limit(100);

    if (!opps?.length) {
      await svc.from("simulation_runs").update({ status: "failed", error: { message: "No seeded data found — seed the tenant first" }, completed_at: new Date().toISOString() }).eq("id", runId);
      return jsonError(400, "no_data", "No seeded opportunities found. Seed the demo tenant first.");
    }

    // 1) Journey moves
    const movesCount = Math.round(rng.int(3, 8) * mult);
    let movesDone = 0;
    for (let i = 0; i < movesCount && i < opps.length; i++) {
      const opp = opps[i];
      const currentIdx = STAGES.indexOf(opp.stage);
      if (currentIdx >= 0 && currentIdx < STAGES.length - 1) {
        const newStage = STAGES[currentIdx + 1];
        const { error } = await svc.from("opportunities").update({ stage: newStage, updated_at: new Date().toISOString() }).eq("id", opp.id);
        const simDay = new Date(baseDate.getTime() - rng.int(0, days) * 86400000);
        await logEvent(svc, runId, simDay, "rim", "journey", `advance_stage:${opp.stage}→${newStage}`, { opportunity_id: opp.id }, error ? "error" : "ok");
        if (!error) movesDone++;
      }
    }
    stats.journey_moves = movesDone;

    // 2) Reflections
    const reflCount = Math.round(rng.int(4, 12) * mult);
    let reflDone = 0;
    for (let i = 0; i < reflCount && i < opps.length; i++) {
      const opp = opps[i % opps.length];
      const simDay = new Date(baseDate.getTime() - rng.int(0, days) * 86400000);
      const { data: refl, error } = await svc.from("opportunity_reflections").insert({
        opportunity_id: opp.id,
        body: `${rng.pick(REFLECTION_STARTERS)} the community partnership. Simulation entry ${i + 1}.`,
        created_at: simDay.toISOString(),
      }).select("id").single();
      await logEvent(svc, runId, simDay, "rim", "reflections", { reflection_id: refl?.id, opportunity_id: opp.id }, error ? "error" : "ok");
      if (!error) reflDone++;
    }
    stats.reflections = reflDone;

    // 3) Activities (email metadata — no bodies)
    const actCount = Math.round(rng.int(5, 15) * mult);
    let actDone = 0;
    for (let i = 0; i < actCount; i++) {
      const contact = contacts?.[i % (contacts?.length || 1)];
      const opp = opps[i % opps.length];
      const simDay = new Date(baseDate.getTime() - rng.int(0, days) * 86400000);
      const actType = rng.pick(["Email", "Call", "Meeting"]);
      const { error } = await svc.from("activities").insert({
        activity_id: `sim-${runId.slice(0, 8)}-act-${i}`,
        activity_type: actType,
        activity_date_time: simDay.toISOString(),
        contact_id: contact?.id || null,
        opportunity_id: opp.id,
        tenant_id: tenant_id,
        notes: `Simulated ${actType} activity #${i + 1}`,
      });
      await logEvent(svc, runId, simDay, "rim", "email", `activity:${actType}`, { contact_id: contact?.id, opportunity_id: opp.id }, error ? "warning" : "ok");
      if (!error) actDone++;
    }
    stats.activities = actDone;

    // 4) Events attended
    let evtDone = 0;
    const evtCount = Math.round(rng.int(2, 5) * mult);
    for (let i = 0; i < evtCount && events && i < events.length; i++) {
      const evt = events[i];
      const simDay = new Date(baseDate.getTime() - rng.int(0, days) * 86400000);
      // Create an activity marking attendance
      const { error } = await svc.from("activities").insert({
        activity_id: `sim-${runId.slice(0, 8)}-evt-${i}`,
        activity_type: "Event",
        activity_date_time: simDay.toISOString(),
        tenant_id: tenant_id,
        attended: true,
        notes: `Attended: ${evt.event_name}`,
      });
      await logEvent(svc, runId, simDay, "rim", "events", "event_attended", { event_id: evt.id }, error ? "warning" : "ok");
      if (!error) evtDone++;
    }
    stats.events_attended = evtDone;

    // 5) Voluntārium shifts
    const volCount = Math.round(rng.int(1, 4) * mult);
    let volDone = 0;
    const { data: volunteers } = await svc.from("volunteers").select("id").eq("tenant_id", tenant_id).limit(10);
    for (let i = 0; i < volCount && volunteers && i < volunteers.length; i++) {
      const vol = volunteers[i];
      const simDay = new Date(baseDate.getTime() - rng.int(0, days) * 86400000);
      const { error } = await svc.from("volunteer_shifts").insert({
        volunteer_id: vol.id,
        shift_date: simDay.toISOString().split("T")[0],
        minutes: rng.int(60, 480),
        role: rng.pick(["Mentor", "Tutor", "Event Setup", "Outreach"]),
      });
      await logEvent(svc, runId, simDay, "staff", "voluntarium", "shift_logged", { volunteer_id: vol.id }, error ? "warning" : "ok");
      if (!error) volDone++;
    }
    stats.volunteer_shifts = volDone;

    // 6) NRI suggestions
    const nriCount = Math.round(rng.int(2, 6) * mult);
    let nriDone = 0;
    for (let i = 0; i < nriCount; i++) {
      const opp = opps[i % opps.length];
      const simDay = new Date(baseDate.getTime() - rng.int(0, days) * 86400000);
      const { data: sug, error } = await svc.from("system_suggestions").insert({
        scope: "tenant",
        metro_id: null,
        opportunity_id: opp.id,
        suggestion_type: rng.pick(["partner_check_in", "relationship_momentum", "community_signal"]),
        title: `Simulated suggestion for ${i + 1}`,
        summary: `Deterministic test suggestion generated by simulation run ${run_key}.`,
        rationale: { simulation_run_id: runId },
        confidence: rng.int(40, 90),
        source_refs: [{ kind: "simulation", run_id: runId }],
        dedupe_key: `sim-sug-${runId.slice(0, 8)}-${i}`,
      }).select("id").single();
      await logEvent(svc, runId, simDay, "system", "nri", "suggestion_created", { suggestion_id: sug?.id }, error ? "warning" : "ok");
      if (!error) nriDone++;
    }
    stats.nri_suggestions = nriDone;

    // 7) Testimonium witness events (if table exists)
    let testDone = 0;
    try {
      const testCount = Math.round(rng.int(2, 5) * mult);
      for (let i = 0; i < testCount; i++) {
        const simDay = new Date(baseDate.getTime() - rng.int(0, days) * 86400000);
        const { error } = await svc.from("testimonium_events").insert({
          tenant_id,
          module: rng.pick(["journey", "reflections", "events", "voluntarium"]),
          event_type: rng.pick(["stage_advance", "reflection_added", "event_attended", "shift_logged"]),
          payload: { simulation: true, run_id: runId },
          occurred_at: simDay.toISOString(),
        });
        await logEvent(svc, runId, simDay, "system", "testimonium", "witness_captured", {}, error ? "warning" : "ok");
        if (!error) testDone++;
      }
    } catch { /* testimonium_events may not exist yet */ }
    stats.testimonium_events = testDone;

    // 8) Communio shared signal (safe, no PII)
    let communioDone = 0;
    try {
      const { data: memberships } = await svc.from("communio_memberships").select("group_id").eq("tenant_id", tenant_id).limit(1);
      if (memberships?.length) {
        const simDay = new Date(baseDate.getTime() - rng.int(0, days) * 86400000);
        const { error } = await svc.from("communio_shared_signals").insert({
          tenant_id,
          group_id: memberships[0].group_id,
          signal_type: "community_momentum",
          signal_summary: `Simulated momentum signal: community engagement rising across partner network. Run ${run_key}.`,
        });
        await logEvent(svc, runId, simDay, "system", "communio", "signal_shared", { group_id: memberships[0].group_id }, error ? "warning" : "ok");
        if (!error) communioDone = 1;
      }
    } catch { /* communio tables may not exist */ }
    stats.communio_signals = communioDone;

    // 9) Connector sync simulation — fake import logs per coverage mode
    let connectorDone = 0;
    try {
      const connectorScenarios = [
        { key: "planning_center", name: "Planning Center", coverage: "full", contacts: rng.int(50, 200), activities: rng.int(20, 80) },
        { key: "hubspot", name: "HubSpot", coverage: "full", contacts: rng.int(100, 500), activities: rng.int(40, 150) },
        { key: "shelbynext", name: "ShelbyNext", coverage: "minimal", contacts: rng.int(30, 100), activities: 0 },
        { key: "breeze", name: "Breeze ChMS", coverage: "partial", contacts: rng.int(40, 120), activities: rng.int(10, 30) },
      ];
      const picked = connectorScenarios.slice(0, Math.round(rng.int(1, 3) * mult));
      for (const conn of picked) {
        const simDay = new Date(baseDate.getTime() - rng.int(0, days) * 86400000);
        const syncStatus = conn.coverage === "minimal" ? "migration_ready" : rng.next() > 0.15 ? "synced" : "needs_setup";
        const { error } = await svc.from("simulation_events").insert({
          simulation_run_id: runId,
          occurred_at: simDay.toISOString(),
          actor_type: "system",
          module: "relatio",
          action: `connector_sync:${conn.key}`,
          internal_refs: {
            connector_key: conn.key,
            connector_name: conn.name,
            coverage_mode: conn.coverage,
            sync_status: syncStatus,
            contacts_imported: conn.contacts,
            activities_imported: conn.activities,
          },
          outcome: syncStatus === "needs_setup" ? "warning" : "ok",
          warnings: syncStatus === "needs_setup" ? [{ msg: "Connector credentials not configured" }] : [],
        });
        if (!error) connectorDone++;
      }
    } catch { /* simulation_events may not exist */ }
    stats.connector_syncs = connectorDone;

    // Complete
    await svc.from("simulation_runs").update({
      status: "completed",
      stats,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return jsonOk({ ok: true, simulation_run_id: runId, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await svc.from("simulation_runs").update({
      status: "failed",
      error: { message: msg },
      completed_at: new Date().toISOString(),
    }).eq("id", runId);
    console.error("simulation-run error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});
