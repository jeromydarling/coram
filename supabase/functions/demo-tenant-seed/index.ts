/**
 * demo-tenant-seed — Deterministic seeding for demo tenants.
 *
 * WHAT: Seeds realistic fake data into a demo tenant.
 * WHERE: Admin Demo Lab.
 * WHY: Reproducible test data for migration and smoke testing.
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

// Simple seeded PRNG for determinism
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
}

const PROFILES: Record<string, {
  metros: number; opps: number; contacts: number; events: number;
  activities: number; reflections: number; volunteers: number;
  provisions: number; localPulseSources: number; grants: number; anchors: number;
}> = {
  small: { metros: 3, opps: 12, contacts: 40, events: 6, activities: 24, reflections: 8, volunteers: 5, provisions: 3, localPulseSources: 4, grants: 2, anchors: 1 },
  medium: { metros: 6, opps: 60, contacts: 300, events: 24, activities: 120, reflections: 40, volunteers: 20, provisions: 10, localPulseSources: 12, grants: 6, anchors: 4 },
  large: { metros: 12, opps: 200, contacts: 1200, events: 60, activities: 500, reflections: 100, volunteers: 50, provisions: 25, localPulseSources: 30, grants: 12, anchors: 8 },
};

const METRO_NAMES = [
  "Austin", "Denver", "Portland", "Minneapolis", "Detroit",
  "Nashville", "Charlotte", "Pittsburgh", "Columbus", "Indianapolis",
  "Phoenix", "Seattle", "Atlanta", "Tampa", "Kansas City",
  "Milwaukee", "Raleigh", "Memphis", "Louisville", "Richmond",
];

const ORG_NAMES = [
  "Community First Alliance", "Digital Bridge Foundation", "Tech for All",
  "Neighborhood Connect", "Metro Impact Partners", "Future Ready Coalition",
  "Access Point Network", "Civic Lab", "Together Forward", "Unity Project",
  "Pathways Hub", "Bridge Builders", "Community Compass", "NextStep Foundation",
  "Open Door Initiative", "Roots & Routes", "Connected Communities", "Uplift Partners",
  "Harbor House", "Crossroads Collective", "Thrive Alliance", "Hope Network",
  "Rising Tide Foundation", "Common Ground", "Beacon Partners",
  "Sunrise Community Center", "Prairie Wind Collective", "Lakeside Outreach",
  "Mountain View Alliance", "Riverside Initiative", "Heartland Coalition",
  "Northern Light Foundation", "Summit Partners", "Valley Forge Network",
  "Coastal Impact Group", "Pinewood Community Trust", "Greenfield Cooperative",
  "Stonegate Foundation", "Eastside Empowerment", "Westbrook Initiative",
];

const FIRST_NAMES = [
  "Maria", "James", "Fatima", "David", "Keiko", "Robert", "Aisha", "Michael",
  "Priya", "Thomas", "Elena", "Carlos", "Mei", "Joseph", "Amara", "Daniel",
  "Sofia", "William", "Yuki", "Patrick", "Zara", "Samuel", "Leila", "Anthony",
];
const LAST_NAMES = [
  "Johnson", "Garcia", "Patel", "Williams", "Chen", "Brown", "Kim", "Davis",
  "Martinez", "Lee", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Jackson",
];

const STAGES = ["Found", "Contacted", "Discovery Scheduled", "Discovery Held", "Proposal Sent", "Agreement Pending", "Agreement Signed", "First Volume", "Stable Producer"];
const EVENT_NAMES = [
  "Community Roundtable", "Digital Inclusion Summit", "Partner Breakfast",
  "Quarterly Review", "Leadership Forum", "Town Hall", "Volunteer Appreciation",
  "Strategy Session", "Neighborhood Walk", "Annual Gathering",
];

const REFLECTION_PROMPTS = [
  "First impression of the partnership potential — they seem genuinely invested in the community.",
  "Key takeaway from the discovery meeting: strong alignment on workforce development goals.",
  "Observed growing community engagement after the last event, especially among youth participants.",
  "Notable shift in organizational priorities toward digital inclusion programming.",
  "Promising alignment with metro-level goals around housing and economic mobility.",
  "Relationship deepening over time — trust is building through consistent follow-through.",
  "Quiet progress worth noting: they've started referring other organizations to us.",
  "Leadership transition observations — new ED brings fresh energy but different priorities.",
  "The partnership feels ready for a more formal structure. Worth exploring an MOU.",
  "Community feedback has been overwhelmingly positive about their recent programming.",
];

const GRANT_NAMES = [
  "Digital Inclusion Innovation Fund", "Community Resilience Grant",
  "Workforce Development Partnership", "Neighborhood Revitalization Award",
  "Youth Empowerment Initiative", "Health Equity Access Fund",
  "Small Business Recovery Grant", "Environmental Justice Fund",
  "Arts & Culture Community Grant", "Housing Stability Program",
  "Education Access Initiative", "Senior Services Support Fund",
];

const FUNDER_NAMES = [
  "Local Community Foundation", "National Endowment for Progress",
  "Metro Area United Way", "State Department of Commerce",
  "Federal Housing Authority", "Regional Arts Council",
  "Corporate Giving Alliance", "Family Foundation Trust",
];

const PULSE_LABELS = [
  "City Council RSS", "Local News Feed", "Community Calendar",
  "Nonprofit Directory", "Economic Development Updates",
  "School District News", "Health Department Alerts",
  "Housing Authority Updates", "Transit Authority Feed",
  "Environmental Agency Reports",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonError(401, "unauthorized", "Missing auth");

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return jsonError(401, "unauthorized", "Invalid token");

  const svc = createClient(supabaseUrl, serviceKey);
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) return jsonError(403, "forbidden", "Admin only");

  const { demo_tenant_id, seed_profile, seed_version, run_key } = await req.json();
  if (!demo_tenant_id || !seed_profile || !run_key) {
    return jsonError(400, "bad_request", "demo_tenant_id, seed_profile, and run_key required");
  }

  const profile = PROFILES[seed_profile];
  if (!profile) return jsonError(400, "bad_request", "Invalid seed_profile");

  // Lookup demo tenant
  const { data: demo, error: dErr } = await svc
    .from("demo_tenants")
    .select("id, tenant_id")
    .eq("id", demo_tenant_id)
    .single();
  if (dErr || !demo) return jsonError(404, "not_found", "Demo tenant not found");

  const tenantId = demo.tenant_id;
  const rng = new SeededRandom(`${run_key}-${seed_version ?? 1}`);

  // Create seed run
  const { data: seedRun, error: srErr } = await svc
    .from("demo_seed_runs")
    .upsert(
      { demo_tenant_id, run_key, status: "running", stats: {} },
      { onConflict: "demo_tenant_id,run_key" }
    )
    .select("id")
    .single();
  if (srErr) return jsonError(500, "internal_error", srErr.message);

  try {
    const stats: Record<string, number> = {};

    const ACTIVITY_TYPES = ["Call", "Email", "Meeting", "Event", "Site Visit", "Intro"];
    const TITLES = ["Director", "Manager", "Coordinator", "VP", "Executive Director", "Program Lead", "Outreach Specialist"];

    // Helper: batch upsert to handle re-runs gracefully
    async function batchUpsert(table: string, rows: Record<string, unknown>[], conflictColumn: string, batchSize = 100) {
      const results: { id: string }[] = [];
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        const { data, error } = await svc.from(table)
          .upsert(chunk, { onConflict: conflictColumn, ignoreDuplicates: true })
          .select("id");
        if (error) {
          console.error(`batchUpsert ${table} chunk ${i} error:`, JSON.stringify(error));
          throw new Error(`Upsert into ${table} failed: ${error.message}`);
        }
        if (data) results.push(...data);
      }
      return results;
    }

    // Helper: batch insert (no upsert, for tables without unique constraints)
    async function batchInsert(table: string, rows: Record<string, unknown>[], batchSize = 100) {
      const results: { id: string }[] = [];
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        const { data, error } = await svc.from(table)
          .insert(chunk)
          .select("id");
        if (error) {
          console.error(`batchInsert ${table} chunk ${i} error:`, JSON.stringify(error));
          // Non-fatal for re-runs: duplicates may exist
          if (!error.message.includes("duplicate")) {
            throw new Error(`Insert into ${table} failed: ${error.message}`);
          }
        }
        if (data) results.push(...data);
      }
      return results;
    }

    // ─── 1) Seed metros ───
    const stateCode = `D${tenantId.slice(0, 2).toUpperCase()}`;
    const metroRows = [];
    for (let i = 0; i < profile.metros; i++) {
      metroRows.push({
        metro_id: `DEMO-${tenantId.slice(0, 8)}-${i}`,
        metro: METRO_NAMES[i % METRO_NAMES.length],
        state_code: stateCode,
        lat: 30 + rng.next() * 15,
        lng: -120 + rng.next() * 40,
      });
    }
    const metroInserted: { id: string }[] = [];
    for (const row of metroRows) {
      const { data, error } = await svc.from("metros")
        .upsert(row, { onConflict: "metro_id" })
        .select("id")
        .single();
      if (error) console.error("metro upsert error:", JSON.stringify(error));
      if (data) metroInserted.push(data);
    }
    stats.metros = metroInserted.length;

    // ─── 2) Seed opportunities ───
    const oppRows = [];
    for (let i = 0; i < profile.opps; i++) {
      const metro = metroInserted[i % (metroInserted.length || 1)];
      const orgBase = ORG_NAMES[i % ORG_NAMES.length];
      const suffix = i >= ORG_NAMES.length ? ` ${Math.floor(i / ORG_NAMES.length) + 1}` : "";
      oppRows.push({
        opportunity_id: `DEMO-OPP-${tenantId.slice(0, 8)}-${i}`,
        organization: `${orgBase}${suffix}`,
        metro_id: metro?.id,
        tenant_id: tenantId,
        stage: rng.pick(STAGES),
        status: "Active",
      });
    }
    const opps = await batchUpsert("opportunities", oppRows, "opportunity_id");
    stats.opportunities = opps.length;

    // ─── 3) Seed contacts ───
    const contactRows = [];
    for (let i = 0; i < profile.contacts; i++) {
      const opp = opps[i % (opps.length || 1)];
      const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
      const lastName = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
      contactRows.push({
        contact_id: `DEMO-CON-${tenantId.slice(0, 8)}-${i}`,
        name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@demo.example.com`,
        opportunity_id: opp?.id,
        tenant_id: tenantId,
        created_by: user.id,
        title: rng.pick(TITLES),
      });
    }
    const contacts = await batchUpsert("contacts", contactRows, "contact_id");
    stats.contacts = contacts.length;

    // ─── 4) Seed events ───
    const eventRows = [];
    for (let i = 0; i < profile.events; i++) {
      const metro = metroInserted[i % (metroInserted.length || 1)];
      const daysAgo = Math.floor(rng.next() * 90);
      eventRows.push({
        event_id: `DEMO-EVT-${tenantId.slice(0, 8)}-${i}`,
        event_name: `${rng.pick(EVENT_NAMES)} ${i + 1}`,
        event_date: new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0],
        metro_id: metro?.id,
        tenant_id: tenantId,
      });
    }
    const events = await batchUpsert("events", eventRows, "event_id");
    stats.events = events.length;

    // ─── 5) Seed activities ───
    if (profile.activities) {
      const activityRows = [];
      for (let i = 0; i < profile.activities; i++) {
        const contact = contacts[i % (contacts.length || 1)];
        const opp = opps[i % (opps.length || 1)];
        const daysAgo = Math.floor(rng.next() * 120);
        const actType = rng.pick(ACTIVITY_TYPES);
        activityRows.push({
          activity_id: `demo-act-${tenantId.slice(0, 8)}-${i}`,
          activity_type: actType,
          activity_date_time: new Date(Date.now() - daysAgo * 86400000).toISOString(),
          contact_id: contact?.id || null,
          opportunity_id: opp?.id || null,
          tenant_id: tenantId,
          notes: `Demo ${actType} activity #${i + 1}`,
        });
      }
      const activities = await batchUpsert("activities", activityRows, "activity_id");
      stats.activities = activities.length;
    }

    // ─── 6) Seed reflections ───
    if (profile.reflections && opps.length > 0) {
      const reflectionRows = [];
      for (let i = 0; i < profile.reflections; i++) {
        const opp = opps[i % opps.length];
        const daysAgo = Math.floor(rng.next() * 60);
        reflectionRows.push({
          opportunity_id: opp.id,
          author_id: user.id,
          body: rng.pick(REFLECTION_PROMPTS),
          visibility: rng.pick(["private", "team"]),
          created_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
        });
      }
      const reflections = await batchInsert("opportunity_reflections", reflectionRows);
      stats.reflections = reflections.length;
    }

    // ─── 7) Seed volunteers ───
    if (profile.volunteers) {
      const volunteerRows = [];
      for (let i = 0; i < profile.volunteers; i++) {
        const firstName = FIRST_NAMES[(i + 7) % FIRST_NAMES.length];
        const lastName = LAST_NAMES[(i + 3) % LAST_NAMES.length];
        volunteerRows.push({
          first_name: firstName,
          last_name: lastName,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.vol${i}@demo.example.com`,
          status: rng.pick(["active", "active", "active", "inactive"]),
          tenant_id: tenantId,
          lifetime_minutes: Math.floor(rng.next() * 2400),
          notes: `Demo volunteer #${i + 1}`,
        });
      }
      const volunteers = await batchInsert("volunteers", volunteerRows);
      stats.volunteers = volunteers.length;
    }

    // ─── 8) Seed provisions (Prōvīsiō) ───
    if (profile.provisions && opps.length > 0) {
      const provisionRows = [];
      for (let i = 0; i < profile.provisions; i++) {
        const opp = opps[i % opps.length];
        const daysAgo = Math.floor(rng.next() * 90);
        provisionRows.push({
          opportunity_id: opp.id,
          requested_by: user.id,
          requested_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
          status: rng.pick(["requested", "approved", "shipped", "delivered"]),
          total_quantity: Math.floor(rng.next() * 50) + 1,
          total_cents: Math.floor(rng.next() * 50000) + 500,
          source: "demo_seed",
          notes: `Demo provision #${i + 1}`,
        });
      }
      const provisions = await batchInsert("provisions", provisionRows);
      stats.provisions = provisions.length;
    }

    // ─── 9) Seed local pulse sources ───
    if (profile.localPulseSources && metroInserted.length > 0) {
      const pulseRows = [];
      for (let i = 0; i < profile.localPulseSources; i++) {
        const metro = metroInserted[i % metroInserted.length];
        pulseRows.push({
          metro_id: metro.id,
          user_id: user.id,
          source_type: rng.pick(["rss", "webpage", "calendar"]),
          label: PULSE_LABELS[i % PULSE_LABELS.length],
          url: `https://demo-pulse-${i}.example.com/feed`,
          enabled: true,
        });
      }
      const pulseSources = await batchInsert("local_pulse_sources", pulseRows);
      stats.local_pulse_sources = pulseSources.length;
    }

    // ─── 10) Seed grants ───
    if (profile.grants && opps.length > 0) {
      const grantRows = [];
      for (let i = 0; i < profile.grants; i++) {
        const opp = opps[i % opps.length];
        const metro = metroInserted[i % (metroInserted.length || 1)];
        const daysAgo = Math.floor(rng.next() * 180);
        grantRows.push({
          grant_id: `DEMO-GRT-${tenantId.slice(0, 8)}-${i}`,
          grant_name: GRANT_NAMES[i % GRANT_NAMES.length],
          funder_name: rng.pick(FUNDER_NAMES),
          owner_id: user.id,
          opportunity_id: opp.id,
          metro_id: metro?.id,
          stage: rng.pick(["Prospect", "Researching", "LOI Submitted", "Application Submitted", "Awarded"]),
          status: rng.pick(["Active", "Active", "Active", "Closed"]),
          amount_requested: Math.floor(rng.next() * 100000) + 5000,
          stage_entry_date: new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0],
        });
      }
      const grants = await batchUpsert("grants", grantRows, "grant_id");
      stats.grants = grants.length;
    }

    // ─── 11) Seed anchors ───
    if (profile.anchors && opps.length > 0) {
      const anchorRows = [];
      // Pick from later-stage opportunities for anchors
      const eligibleOpps = opps.filter((_, idx) => {
        const stage = oppRows[idx]?.stage;
        return stage && ["Agreement Signed", "First Volume", "Stable Producer"].includes(stage as string);
      });
      const anchorSource = eligibleOpps.length > 0 ? eligibleOpps : opps;
      for (let i = 0; i < Math.min(profile.anchors, anchorSource.length); i++) {
        const opp = anchorSource[i];
        const metro = metroInserted[i % (metroInserted.length || 1)];
        const daysAgo = Math.floor(rng.next() * 120);
        anchorRows.push({
          anchor_id: `DEMO-ANC-${tenantId.slice(0, 8)}-${i}`,
          opportunity_id: opp.id,
          metro_id: metro?.id,
          anchor_tier: rng.pick(["Gold", "Silver", "Bronze"]),
          first_volume_date: new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0],
          avg_monthly_volume: Math.floor(rng.next() * 500) + 10,
          notes: `Demo anchor #${i + 1}`,
        });
      }
      if (anchorRows.length > 0) {
        const anchors = await batchUpsert("anchors", anchorRows, "anchor_id");
        stats.anchors = anchors.length;
      }
    }

    // Update seed run
    await svc
      .from("demo_seed_runs")
      .update({ status: "completed", stats, completed_at: new Date().toISOString() })
      .eq("id", seedRun.id);

    return jsonOk({ ok: true, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await svc
      .from("demo_seed_runs")
      .update({ status: "failed", error: { message: msg }, completed_at: new Date().toISOString() })
      .eq("id", seedRun.id);
    console.error("demo-tenant-seed error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});
