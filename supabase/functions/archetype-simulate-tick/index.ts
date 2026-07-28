/**
 * archetype-simulate-tick — Deterministic activity burst generator.
 *
 * WHAT: Generates realistic narrative activity for demo tenants based on archetype behavior profiles.
 * WHERE: Admin Archetype Simulation page.
 * WHY: Makes the platform feel alive without real users or AI generation.
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

// Seeded PRNG for deterministic output
class SeededRandom {
  private seed: number;
  constructor(seed: string) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    }
    this.seed = Math.abs(h) || 1;
  }
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(rate: number): boolean {
    return this.next() < rate;
  }
  intBetween(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

// ── Deterministic content pools ──
const REFLECTION_BODIES = [
  "Noticed growing engagement from new community members this week.",
  "The partnership conversation is deepening — trust building quietly.",
  "Leadership transition underway; watching how the team adapts.",
  "Strong alignment between our mission and their neighborhood work.",
  "Quiet progress — sometimes the most important kind.",
  "Interesting tension between speed and depth in this relationship.",
  "They're ready for the next chapter. We should be too.",
  "This connection has more potential than initially assumed.",
  "Community feedback loop is strengthening organically.",
  "Worth noting: they mentioned expanding their volunteer program.",
];

const EVENT_NAMES = [
  "Community Roundtable", "Partner Breakfast", "Quarterly Review",
  "Leadership Forum", "Volunteer Appreciation", "Strategy Session",
  "Neighborhood Walk", "Town Hall", "Annual Gathering",
  "Digital Inclusion Workshop", "Youth Empowerment Day", "Health Fair",
];

const JOURNEY_STAGES = [
  "Found", "Contacted", "Discovery Scheduled", "Discovery Held",
  "Proposal Sent", "Agreement Pending", "Agreement Signed", "First Volume", "Stable Producer",
];

const VOLUNTEER_ROLES = [
  "Event Setup", "Mentoring", "Tech Support", "Outreach",
  "Data Entry", "Community Guide", "Workshop Facilitator",
];

const PROVISIO_ITEMS = [
  "Laptop", "Hotspot Device", "Tablet", "Monitor", "Keyboard & Mouse",
  "Webcam", "Headset", "Ethernet Cable Kit",
];

const ACTIVITY_TYPES = ["Call", "Email", "Meeting", "Event", "Site Visit", "Intro"] as const;

interface BehaviorProfile {
  reflection_rate: number;
  event_rate: number;
  volunteer_rate: number;
  provisio_rate: number;
  email_rate: number;
  journey_advance_rate: number;
  communio_share_rate: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonError(401, "unauthorized", "Missing auth");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return jsonError(401, "unauthorized", "Invalid token");

  const svc = createClient(supabaseUrl, serviceKey);

  // Admin check
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) {
    return jsonError(403, "forbidden", "Admin only");
  }

  const { tenant_id, archetype_key, tick_key } = await req.json();
  if (!tenant_id || !archetype_key || !tick_key) {
    return jsonError(400, "bad_request", "tenant_id, archetype_key, and tick_key required");
  }

  // Verify tenant is a demo tenant
  const { data: demoTenant } = await svc
    .from("demo_tenants")
    .select("id, tenant_id")
    .eq("tenant_id", tenant_id)
    .eq("is_demo", true)
    .single();
  if (!demoTenant) return jsonError(400, "bad_request", "Only demo tenants can be simulated");

  // Load archetype profile
  const { data: profile } = await svc
    .from("archetype_profiles")
    .select("*")
    .eq("key", archetype_key)
    .single();
  if (!profile) return jsonError(404, "not_found", "Archetype profile not found");

  const behavior = profile.behavior_profile as BehaviorProfile;
  const rng = new SeededRandom(tick_key);

  // Create simulation run (idempotent via unique constraint)
  const { data: simRun, error: srErr } = await svc
    .from("archetype_simulation_runs")
    .upsert(
      { tenant_id, archetype_key, tick_key, status: "running", stats: {} },
      { onConflict: "tenant_id,tick_key" },
    )
    .select("id, status")
    .single();

  if (srErr) return jsonError(500, "internal_error", srErr.message);
  if (simRun.status === "completed") {
    return jsonOk({ ok: true, message: "Tick already completed", idempotent: true });
  }

  try {
    const stats: Record<string, number> = {};

    // Load existing tenant data for context
    const { data: opps } = await svc
      .from("opportunities")
      .select("id, stage, metro_id")
      .eq("tenant_id", tenant_id)
      .limit(200);

    const { data: contacts } = await svc
      .from("contacts")
      .select("id, opportunity_id")
      .eq("tenant_id", tenant_id)
      .limit(500);

    const { data: volunteers } = await svc
      .from("volunteers")
      .select("id")
      .eq("tenant_id", tenant_id)
      .limit(100);

    if (!opps?.length) {
      await svc.from("archetype_simulation_runs")
        .update({ status: "failed", error: { message: "No opportunities found — seed tenant first" }, completed_at: new Date().toISOString() })
        .eq("id", simRun.id);
      return jsonError(400, "bad_request", "No opportunities in tenant. Seed first via Demo Lab.");
    }

    // ── 1) Reflections (Impulsus-style) ──
    const reflectionRows = [];
    for (const opp of opps) {
      if (rng.chance(behavior.reflection_rate * 0.3)) {
        reflectionRows.push({
          opportunity_id: opp.id,
          content: rng.pick(REFLECTION_BODIES),
          reflection_type: "general",
          created_by: user.id,
          tenant_id,
        });
      }
    }
    if (reflectionRows.length) {
      const { data } = await svc.from("opportunity_reflections").insert(reflectionRows).select("id");
      stats.reflections = data?.length ?? 0;
    }

    // ── 2) Activities (email touches — metadata only, no raw bodies) ──
    const activityRows = [];
    for (const contact of (contacts ?? []).slice(0, 50)) {
      if (rng.chance(behavior.email_rate * 0.2)) {
        const daysAgo = rng.intBetween(0, 14);
        activityRows.push({
          activity_id: `sim-${tick_key}-act-${activityRows.length}`,
          activity_type: rng.pick(ACTIVITY_TYPES),
          activity_date_time: new Date(Date.now() - daysAgo * 86400000).toISOString(),
          contact_id: contact.id,
          opportunity_id: contact.opportunity_id,
          tenant_id,
          notes: `Simulated ${profile.narrative_style} interaction`,
        });
      }
    }
    if (activityRows.length) {
      for (let i = 0; i < activityRows.length; i += 50) {
        const chunk = activityRows.slice(i, i + 50);
        await svc.from("activities").insert(chunk);
      }
      stats.activities = activityRows.length;
    }

    // ── 3) Event attendance ──
    const eventRows = [];
    const eventCount = rng.chance(behavior.event_rate) ? rng.intBetween(1, 3) : 0;
    for (let i = 0; i < eventCount; i++) {
      const opp = rng.pick(opps);
      const daysAgo = rng.intBetween(0, 30);
      eventRows.push({
        event_name: `${rng.pick(EVENT_NAMES)} — ${profile.display_name}`,
        event_date: new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0],
        metro_id: opp.metro_id,
        tenant_id,
        created_by: user.id,
        source: "archetype_simulation",
      });
    }
    if (eventRows.length) {
      const { data } = await svc.from("events").insert(eventRows).select("id");
      stats.events = data?.length ?? 0;
    }

    // ── 4) Journey stage advances ──
    let journeyMoves = 0;
    for (const opp of opps) {
      if (rng.chance(behavior.journey_advance_rate * 0.5)) {
        const currentIdx = JOURNEY_STAGES.indexOf(opp.stage);
        if (currentIdx >= 0 && currentIdx < JOURNEY_STAGES.length - 1) {
          const nextStage = JOURNEY_STAGES[currentIdx + 1];
          await svc.from("opportunities")
            .update({ stage: nextStage, updated_at: new Date().toISOString() })
            .eq("id", opp.id);
          journeyMoves++;
        }
      }
    }
    stats.journey_moves = journeyMoves;

    // ── 5) Voluntārium shifts ──
    const shiftRows = [];
    if (volunteers?.length && rng.chance(behavior.volunteer_rate)) {
      const shiftCount = rng.intBetween(1, Math.min(5, volunteers.length));
      for (let i = 0; i < shiftCount; i++) {
        const vol = rng.pick(volunteers);
        const daysAgo = rng.intBetween(0, 14);
        shiftRows.push({
          volunteer_id: vol.id,
          shift_date: new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0],
          minutes: rng.pick([60, 90, 120, 180, 240]),
          role: rng.pick(VOLUNTEER_ROLES),
          tenant_id,
          notes: `Simulated shift — ${profile.narrative_style}`,
        });
      }
      const { data } = await svc.from("volunteer_shifts").insert(shiftRows).select("id");
      stats.volunteer_shifts = data?.length ?? 0;
    }

    // ── 6) Prōvīsiō activity ──
    if (rng.chance(behavior.provisio_rate * 0.3)) {
      const opp = rng.pick(opps);
      const { data: order } = await svc.from("opportunity_orders").insert({
        opportunity_id: opp.id,
        status: rng.pick(["pending", "approved", "fulfilled"]),
        notes: `Simulated provision — ${profile.display_name}`,
        created_by: user.id,
        tenant_id,
      }).select("id").single();

      if (order) {
        const itemCount = rng.intBetween(1, 3);
        const items = [];
        for (let i = 0; i < itemCount; i++) {
          items.push({
            order_id: order.id,
            item_name: rng.pick(PROVISIO_ITEMS),
            quantity: rng.intBetween(1, 10),
          });
        }
        await svc.from("opportunity_order_items").insert(items);
        stats.provisio_orders = 1;
        stats.provisio_items = items.length;
      }
    }

    // ── 7) Testimonium witness events ──
    const witnessEvents = [];
    if (stats.reflections) {
      witnessEvents.push({
        tenant_id,
        event_type: "reflection_created",
        entity_type: "opportunity",
        entity_id: rng.pick(opps).id,
        metadata: { count: stats.reflections, source: "archetype_simulation" },
      });
    }
    if (stats.journey_moves) {
      witnessEvents.push({
        tenant_id,
        event_type: "journey_advanced",
        entity_type: "opportunity",
        entity_id: rng.pick(opps).id,
        metadata: { count: stats.journey_moves, source: "archetype_simulation" },
      });
    }
    if (witnessEvents.length) {
      await svc.from("testimonium_events").insert(witnessEvents);
      stats.testimonium_events = witnessEvents.length;
    }

    // Mark completed
    await svc.from("archetype_simulation_runs")
      .update({ status: "completed", stats, completed_at: new Date().toISOString() })
      .eq("id", simRun.id);

    return jsonOk({ ok: true, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await svc.from("archetype_simulation_runs")
      .update({ status: "failed", error: { message: msg }, completed_at: new Date().toISOString() })
      .eq("id", simRun.id);
    console.error("archetype-simulate-tick error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});
