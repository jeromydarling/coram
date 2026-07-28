/**
 * generate-seed-movement — Rich, life-like simulation engine for demo tenants.
 *
 * WHAT: Generates diverse, realistic movement across all entity types and roles.
 * WHERE: Called by cron (every 30 min) or manually from Gardener Simulation UI.
 * WHY: Lets the Gardener experience a living dashboard before real tenants onboard.
 *
 * Simulates: Calls, Emails, Meetings, Site Visits, Events, Visit Notes,
 *            Reflections, Volunteers, Opportunity stage advances.
 * Quiet hours: No activity generated between 11:59 PM and 6:00 AM.
 * All records tagged via simulation_markers for safe cleanup.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Seeded RNG ──
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ── Quiet hours check (no movement midnight–6am in tenant's likely timezone) ──
function isQuietHour(): boolean {
  // Use US Central as proxy for most demo tenants
  const now = new Date();
  const central = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const hour = central.getHours();
  return hour >= 0 && hour < 6;
}

// Generate a realistic timestamp within today's business hours
function realisticTimestamp(rng: () => number, daysAgo = 0): string {
  const dt = new Date();
  dt.setDate(dt.getDate() - daysAgo);
  // Business hours: 7am–9pm with weighted distribution (peak 9am–4pm)
  const hourRoll = rng();
  let hour: number;
  if (hourRoll < 0.1) hour = 7 + Math.floor(rng() * 2);       // 7–8am early bird
  else if (hourRoll < 0.75) hour = 9 + Math.floor(rng() * 7);  // 9am–3pm peak
  else if (hourRoll < 0.9) hour = 16 + Math.floor(rng() * 3);  // 4–6pm afternoon
  else hour = 19 + Math.floor(rng() * 3);                       // 7–9pm evening
  dt.setHours(hour, Math.floor(rng() * 60), Math.floor(rng() * 60), 0);
  return dt.toISOString();
}

// ── Content pools by role ──

const ROLE_PERSONAS = ['shepherd', 'companion', 'visitor', 'steward'] as const;

const CALL_NOTES: Record<string, string[]> = {
  shepherd: [
    "Connected with the director about long-term partnership vision.",
    "Leadership check-in — discussed quarterly goals and alignment.",
    "Explored strategic partnership opportunities with executive team.",
    "Caught up on community impact metrics and upcoming initiatives.",
  ],
  companion: [
    "Quick sync about upcoming event logistics.",
    "Followed up on last week's volunteer coordination.",
    "Discussed referral pipeline with program coordinator.",
    "Checked in about the new intake process.",
  ],
  visitor: [
    "Brief call to confirm volunteer shift this weekend.",
    "Asked about community needs for the upcoming drive.",
    "Shared feedback from last week's neighborhood walk.",
  ],
  steward: [
    "Reviewed system configuration with the team lead.",
    "Discussed data migration timeline and next steps.",
    "Synced on integration setup for the new quarter.",
  ],
};

const EMAIL_NOTES: Record<string, string[]> = {
  shepherd: [
    "Sent partnership summary and next steps document.",
    "Shared metro-level impact report with leadership.",
    "Followed up on grant alignment conversation.",
  ],
  companion: [
    "Sent event follow-up with resource links.",
    "Shared volunteer scheduling update for next month.",
    "Forwarded community feedback summary.",
  ],
  visitor: [
    "Confirmed attendance for the community roundtable.",
    "Sent availability for upcoming volunteer shifts.",
  ],
  steward: [
    "Shared onboarding guide with new team members.",
    "Sent weekly system health summary.",
  ],
};

const MEETING_NOTES: Record<string, string[]> = {
  shepherd: [
    "Strategy session with board chair — strong alignment on digital inclusion goals.",
    "Met with three community leaders to discuss regional coordination.",
    "Annual planning meeting — set priorities for next quarter.",
    "Discussed expansion into neighboring metro area.",
  ],
  companion: [
    "Team standup — reviewed this week's outreach targets.",
    "Co-facilitated partner onboarding session.",
    "Met with volunteer coordinator to plan training.",
    "Reviewed impact metrics with program staff.",
  ],
  visitor: [
    "Attended orientation for new community volunteers.",
    "Neighborhood planning walk with local residents.",
  ],
  steward: [
    "System configuration review with core team.",
    "Walked through dashboard with leadership.",
  ],
};

const SITE_VISIT_NOTES = [
  "Visited the community center — good energy, new faces in the lobby.",
  "Toured the expanded facility. Impressed by the volunteer engagement.",
  "Dropped by unannounced — the team was running a smooth intake session.",
  "Observed the after-school program in action. Kids are thriving.",
  "Walked the neighborhood with the outreach team. Strong community ties.",
  "Visited partner site for the first time. Warm reception from staff.",
  "Checked in on the new satellite location. Still getting organized.",
  "Spent an hour observing the food pantry operations. Very efficient.",
];

const VISIT_NOTES = [
  "Checked in with the team — good energy today.",
  "Brief visit. Noticed new faces in the community room.",
  "Dropped off supplies and had a short conversation with the director.",
  "Visited to follow up on last week's discussion about community needs.",
  "Observed the space — things are settling into a rhythm.",
  "Quick drop-in between meetings. Left some materials.",
  "Walked through the new community garden with volunteers.",
];

const REFLECTION_BODIES = [
  "Something shifted in how the team communicates. There's a new openness that wasn't there before. Worth watching closely.",
  "The community seems more receptive this week. Small gestures — remembering names, following up — are building trust.",
  "I noticed a pattern: when we show up consistently, the relationship deepens beyond the transactional. This is where real impact lives.",
  "This partnership is evolving from polite coordination to genuine collaboration. The shared meals after meetings changed the dynamic.",
  "The quiet moments between formal visits carry more weight than I expected. A text checking in means more than a scheduled meeting.",
  "Leadership is starting to invite us into strategic conversations, not just operational ones. That's a trust milestone.",
  "There's a growing sense of shared ownership over the outcomes. They're not just receiving services — they're co-designing them.",
  "Noticed friction between two partner orgs at the roundtable. May need to facilitate a separate conversation.",
  "The volunteer team is self-organizing now. They don't wait for direction — that's a sign of healthy culture.",
  "Had a deeply meaningful conversation with a community member today. Reminded me why this work matters.",
  "The organization is at an inflection point. New leadership brings energy but also uncertainty. Staying close.",
  "Gratitude from the director today — unexpected and genuine. These moments fuel the work.",
];

const EVENT_NAMES_SIM = [
  "Community Roundtable", "Partner Breakfast", "Digital Inclusion Workshop",
  "Quarterly Review", "Volunteer Appreciation Night", "Town Hall Meeting",
  "Youth Empowerment Session", "Health Fair", "Resource Distribution Day",
  "Leadership Forum", "Neighborhood Walk", "Tech Access Workshop",
  "Annual Gathering", "Strategy Session", "Community Prayer Breakfast",
  "Job Training Orientation", "Family Resource Fair", "Housing Assistance Day",
];

const EVENT_TYPES = ['Community Engagement', 'Outreach Event', 'Training', 'Partner Event', 'Internal Meeting'];

const VOLUNTEER_FIRST = ['Maria', 'James', 'Fatima', 'David', 'Keiko', 'Robert', 'Aisha', 'Michael', 'Priya', 'Thomas', 'Elena', 'Carlos', 'Sofia', 'William', 'Zara', 'Samuel', 'Leila', 'Anthony', 'Rosa', 'Marcus'];
const VOLUNTEER_LAST = ['Johnson', 'Garcia', 'Patel', 'Williams', 'Chen', 'Brown', 'Kim', 'Davis', 'Martinez', 'Lee', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis'];
const VOLUNTEER_STATUSES = ['Active', 'Inactive', 'On Leave'];

const OUTCOME_POOL = ['Connected', 'No Response', 'Follow-up Needed', 'Moved Stage'];

// ── Main ──

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Quiet hours gate
    if (isQuietHour()) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'quiet_hours' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    const isCron = body.source === 'cron';
    let automationRunId: string | undefined;

    // Auth: cron calls skip user auth; manual calls require admin
    let userId: string | null = null;
    if (!isCron) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: corsHeaders });
      }
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
      const { data: { user }, error: authErr } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      userId = user.id;
      const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', user.id);
      const isAdmin = roles?.some((r: any) => r.role === 'admin');
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
      }
      const { data: rlOk } = await adminClient.rpc('check_and_increment_rate_limit', {
        p_user_id: user.id, p_function_name: 'generate-seed-movement', p_window_minutes: 60, p_max_requests: 10,
      });
      if (rlOk === false) {
        return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429, headers: corsHeaders });
      }
    }

    const runKey = body.run_key || `sim-${Date.now()}`;
    const inputIntensity = body.intensity || '';

    // Load settings
    const { data: settings } = await adminClient.from('operator_simulation_settings')
      .select('*').limit(1).maybeSingle();

    if (!settings?.enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'simulation_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const intensityOptions = ['low', 'medium', 'active'] as const;
    const manualIntensity = (['low','medium','active'].includes(inputIntensity) ? inputIntensity : 'low');

    // Items per intensity: low=3-5, medium=6-10, active=11-18
    const intensityRange: Record<string, [number, number]> = {
      low: [3, 5], medium: [6, 10], active: [11, 18],
    };

    let targetTenantIds = body.tenant_ids?.length
      ? body.tenant_ids.filter((id: string) => settings.allowed_tenant_ids.includes(id))
      : settings.allowed_tenant_ids;

    if (!targetTenantIds?.length) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_target_tenants' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create run record
    const primaryTenantId = targetTenantIds[0];
    const dbIntensity = isCron ? 'normal' : (manualIntensity === 'medium' ? 'normal' : manualIntensity === 'active' ? 'heavy' : 'light');
    const { data: run, error: runErr } = await adminClient.from('simulation_runs').upsert({
      run_key: runKey,
      tenant_id: primaryTenantId,
      scenario_key: 'church_small',
      status: 'running',
      intensity: dbIntensity,
      stats: {},
    }, { onConflict: 'tenant_id,scenario_key,run_key' }).select().single();

    if (runErr) throw runErr;

    // ── Log to automation_runs so Background Tending dashboards show simulation activity ──
    automationRunId = crypto.randomUUID();
    const simWorkflowKeys = [
      'seed_movement', 'seed_reflections', 'seed_events',
      'seed_volunteers', 'seed_stage_advances', 'seed_connector_syncs',
    ];
    const primaryWorkflowKey = 'seed_movement';
    await adminClient.from('automation_runs').insert({
      run_id: automationRunId,
      workflow_key: primaryWorkflowKey,
      status: 'running',
      dedupe_key: `sim:${runKey}`,
      triggered_by: userId,
      payload: { run_key: runKey, intensity: dbIntensity, tenant_count: targetTenantIds.length },
    }).then(({ error: arErr }) => {
      if (arErr) console.warn('[sim] automation_runs insert failed (non-fatal):', arErr.message);
    });

    const stats = {
      tenants_processed: 0,
      activities_created: 0,
      reflections_created: 0,
      events_created: 0,
      volunteers_created: 0,
      stage_advances: 0,
      connector_syncs: 0,
    };

    // Helper to mark simulated records
    async function markSim(tenantId: string, table: string, recordId: string, kind: string) {
      await adminClient.from('simulation_markers').upsert({
        tenant_id: tenantId,
        record_table: table,
        record_id: recordId,
        kind,
        run_id: run.id,
      }, { onConflict: 'tenant_id,record_table,record_id' });
    }

    for (const tenantId of targetTenantIds) {
      const rng = seededRandom(runKey + tenantId + Date.now().toString());

      // Per-tenant intensity
      const tenantIntensity = isCron
        ? pick([...intensityOptions], rng)
        : manualIntensity;
      const [minItems, maxItems] = intensityRange[tenantIntensity] || [3, 5];
      const totalActions = minItems + Math.floor(rng() * (maxItems - minItems + 1));

      // Load tenant's existing data for linking
      const { data: opps } = await adminClient.from('opportunities')
        .select('id, metro_id, stage').eq('tenant_id', tenantId)
        .is('deleted_at', null).limit(50);
      const { data: contacts } = await adminClient.from('contacts')
        .select('id, opportunity_id').eq('tenant_id', tenantId)
        .is('deleted_at', null).limit(100);
      const { data: metros } = await adminClient.from('opportunities')
        .select('metro_id').eq('tenant_id', tenantId)
        .is('deleted_at', null).not('metro_id', 'is', null).limit(20);

      const oppIds = opps?.map(o => o.id) || [];
      const contactIds = contacts?.map(c => c.id) || [];
      const metroIds = [...new Set(metros?.map(m => m.metro_id).filter(Boolean) || [])];

      // Distribute actions across types
      // Cap forward-looking meetings/site-visits per tick so the weekly snapshot stays realistic
      let forwardMeetingCount = 0;
      const MAX_FORWARD_MEETINGS = 1; // at most 1 meeting/site-visit set for today/future per tick
      for (let i = 0; i < totalActions; i++) {
        const role = pick([...ROLE_PERSONAS], rng);
        const actionRoll = rng();
        // Mostly past-looking (80% 1-5 days ago, 15% today, 5% yesterday)
        const daysAgo = rng() < 0.15 ? 0 : (rng() < 0.20 ? 1 : 2 + Math.floor(rng() * 4));
        const timestamp = realisticTimestamp(rng, daysAgo);
        const suffix = `${tenantId.slice(0,4)}-${i}`;

        try {
          if (actionRoll < 0.18) {
            // ── CALL ──
            const notes = pick(CALL_NOTES[role] || CALL_NOTES.companion, rng);
            const actId = `SIM-${runKey.slice(0,8)}-CL-${suffix}`;
            const { data: act } = await adminClient.from('activities').upsert({
              activity_id: actId,
              activity_type: 'Call',
              activity_date_time: timestamp,
              notes: `[${role}] ${notes}`,
              outcome: pick(OUTCOME_POOL, rng),
              tenant_id: tenantId,
              contact_id: contactIds.length ? pick(contactIds, rng) : null,
              opportunity_id: oppIds.length ? pick(oppIds, rng) : null,
              metro_id: metroIds.length ? pick(metroIds, rng) : null,
            }, { onConflict: 'activity_id' }).select('id').single();
            if (act) { await markSim(tenantId, 'activities', act.id, 'call'); stats.activities_created++; }

          } else if (actionRoll < 0.30) {
            // ── EMAIL ──
            const notes = pick(EMAIL_NOTES[role] || EMAIL_NOTES.companion, rng);
            const actId = `SIM-${runKey.slice(0,8)}-EM-${suffix}`;
            const { data: act } = await adminClient.from('activities').upsert({
              activity_id: actId,
              activity_type: 'Email',
              activity_date_time: timestamp,
              notes: `[${role}] ${notes}`,
              outcome: pick(['Connected', 'No Response'], rng),
              tenant_id: tenantId,
              contact_id: contactIds.length ? pick(contactIds, rng) : null,
              opportunity_id: oppIds.length ? pick(oppIds, rng) : null,
            }, { onConflict: 'activity_id' }).select('id').single();
            if (act) { await markSim(tenantId, 'activities', act.id, 'email'); stats.activities_created++; }

          } else if (actionRoll < 0.35) {
            // ── MEETING ~5% (was 15%) ── forward-looking capped
            if (daysAgo === 0 && forwardMeetingCount >= MAX_FORWARD_MEETINGS) {
              // Convert excess forward meetings to past calls instead
              const notes = pick(CALL_NOTES[role] || CALL_NOTES.companion, rng);
              const pastTs = realisticTimestamp(rng, 2 + Math.floor(rng() * 4));
              const actId = `SIM-${runKey.slice(0,8)}-CL2-${suffix}`;
              const { data: act } = await adminClient.from('activities').upsert({
                activity_id: actId, activity_type: 'Call', activity_date_time: pastTs,
                notes: `[${role}] ${notes}`, outcome: pick(OUTCOME_POOL, rng),
                tenant_id: tenantId,
                contact_id: contactIds.length ? pick(contactIds, rng) : null,
                opportunity_id: oppIds.length ? pick(oppIds, rng) : null,
              }, { onConflict: 'activity_id' }).select('id').single();
              if (act) { await markSim(tenantId, 'activities', act.id, 'call'); stats.activities_created++; }
            } else {
              const notes = pick(MEETING_NOTES[role] || MEETING_NOTES.companion, rng);
              const actId = `SIM-${runKey.slice(0,8)}-MT-${suffix}`;
              const { data: act } = await adminClient.from('activities').upsert({
                activity_id: actId,
                activity_type: 'Meeting',
                activity_date_time: timestamp,
                notes: `[${role}] ${notes}`,
                outcome: pick(OUTCOME_POOL, rng),
                attended: rng() > 0.1,
                tenant_id: tenantId,
                contact_id: contactIds.length ? pick(contactIds, rng) : null,
                opportunity_id: oppIds.length ? pick(oppIds, rng) : null,
                metro_id: metroIds.length ? pick(metroIds, rng) : null,
              }, { onConflict: 'activity_id' }).select('id').single();
              if (act) {
                await markSim(tenantId, 'activities', act.id, 'meeting');
                stats.activities_created++;
                if (daysAgo === 0) forwardMeetingCount++;
              }
            }

          } else if (actionRoll < 0.38) {
            // ── SITE VISIT ~3% (was 10%) ── also capped by forward-meeting limit
            if (daysAgo === 0 && forwardMeetingCount >= MAX_FORWARD_MEETINGS) {
              // Convert to past visit note instead
              const notes = pick(VISIT_NOTES, rng);
              const pastTs = realisticTimestamp(rng, 1 + Math.floor(rng() * 5));
              const actId = `SIM-${runKey.slice(0,8)}-VN2-${suffix}`;
              const { data: act } = await adminClient.from('activities').upsert({
                activity_id: actId, activity_type: 'Visit Note', activity_date_time: pastTs,
                notes: `[${role}] ${notes}`, tenant_id: tenantId,
                opportunity_id: oppIds.length ? pick(oppIds, rng) : null,
              }, { onConflict: 'activity_id' }).select('id').single();
              if (act) { await markSim(tenantId, 'activities', act.id, 'visit_note'); stats.activities_created++; }
            } else {
              const notes = pick(SITE_VISIT_NOTES, rng);
              const actId = `SIM-${runKey.slice(0,8)}-SV-${suffix}`;
              const { data: act } = await adminClient.from('activities').upsert({
                activity_id: actId,
                activity_type: 'Site Visit',
                activity_date_time: timestamp,
                notes: `[${role}] ${notes}`,
                outcome: 'Connected',
                attended: true,
                tenant_id: tenantId,
                opportunity_id: oppIds.length ? pick(oppIds, rng) : null,
                metro_id: metroIds.length ? pick(metroIds, rng) : null,
              }, { onConflict: 'activity_id' }).select('id').single();
              if (act) {
                await markSim(tenantId, 'activities', act.id, 'site_visit');
                stats.activities_created++;
                if (daysAgo === 0) forwardMeetingCount++;
              }
            }

          } else if (actionRoll < 0.52) {
            // ── VISIT NOTE ~14% (was 10%) ──
            const notes = pick(VISIT_NOTES, rng);
            const actId = `SIM-${runKey.slice(0,8)}-VN-${suffix}`;
            const { data: act } = await adminClient.from('activities').upsert({
              activity_id: actId,
              activity_type: 'Visit Note',
              activity_date_time: timestamp,
              notes: `[${role}] ${notes}`,
              tenant_id: tenantId,
              opportunity_id: oppIds.length ? pick(oppIds, rng) : null,
            }, { onConflict: 'activity_id' }).select('id').single();
            if (act) { await markSim(tenantId, 'activities', act.id, 'visit_note'); stats.activities_created++; }

          } else if (actionRoll < 0.70) {
            // ── REFLECTION ~18% (was 13%) ──
            if (oppIds.length) {
              const oppId = pick(oppIds, rng);
              const body = pick(REFLECTION_BODIES, rng);
              // Use the admin user as author since reflections require author_id
              const authorId = settings.created_by;
              const { data: refl, error: reflErr } = await adminClient.from('opportunity_reflections').insert({
                opportunity_id: oppId,
                author_id: authorId,
                body: `[${role}] ${body}`,
                visibility: rng() > 0.3 ? 'team' : 'private',
              }).select('id').single();
              if (!reflErr && refl) {
                await markSim(tenantId, 'opportunity_reflections', refl.id, 'reflection');
                stats.reflections_created++;
              }
            }

          } else if (actionRoll < 0.80) {
          } else if (actionRoll < 0.80) {
            // ── EVENT ~10% (unchanged) ──
            const eventName = pick(EVENT_NAMES_SIM, rng);
            const eventId = `SIM-${runKey.slice(0,8)}-EV-${suffix}`;
            // Spread events more: 30% past, 40% next 3 days, 30% next 4-14 days
            const eventRoll = rng();
            let futureDays: number;
            if (eventRoll < 0.3) futureDays = -Math.floor(rng() * 7) - 1; // past
            else if (eventRoll < 0.7) futureDays = Math.floor(rng() * 3);
            else futureDays = 3 + Math.floor(rng() * 11);
            const eventDate = new Date();
            eventDate.setDate(eventDate.getDate() + futureDays);
            const { data: ev, error: evErr } = await adminClient.from('events').upsert({
              event_id: eventId,
              event_name: eventName,
              event_date: eventDate.toISOString().split('T')[0],
              event_type: pick(EVENT_TYPES, rng),
              metro_id: metroIds.length ? pick(metroIds, rng) : null,
              host_opportunity_id: oppIds.length ? pick(oppIds, rng) : null,
              status: rng() > 0.3 ? 'Registered' : 'Not Registered',
              expected_households: Math.floor(rng() * 200) + 20,
              notes: `[${role}] Simulated event for demo purposes.`,
              tenant_id: tenantId,
            }, { onConflict: 'event_id' }).select('id').single();
            if (!evErr && ev) {
              await markSim(tenantId, 'events', ev.id, 'event');
              stats.events_created++;
            }

          } else if (actionRoll < 0.90) {
            // ── VOLUNTEER ──
            const first = pick(VOLUNTEER_FIRST, rng);
            const last = pick(VOLUNTEER_LAST, rng);
            const email = `${first.toLowerCase()}.${last.toLowerCase()}+sim${Date.now()}${Math.floor(rng()*99999)}@example.com`;
            const { data: vol, error: volErr } = await adminClient.from('volunteers').insert({
              first_name: first,
              last_name: last,
              email,
              phone: `555-${String(Math.floor(rng()*9000)+1000)}`,
              status: pick(VOLUNTEER_STATUSES, rng),
              notes: `[${role}] Simulated volunteer. Interested in community outreach.`,
              tenant_id: tenantId,
            }).select('id').single();
            if (!volErr && vol) {
              await markSim(tenantId, 'volunteers', vol.id, 'volunteer');
              stats.volunteers_created++;
            }

          } else {
            // ── STAGE ADVANCE (opportunity) ──
            if (opps?.length) {
              const advanceable = opps.filter(o =>
                o.stage && !['Stable Producer', 'Closed - Not a Fit', 'Not the Right Time'].includes(o.stage)
              );
              if (advanceable.length) {
                const opp = pick(advanceable, rng);
                const stages = [
                  'Target Identified', 'Found', 'Contacted', 'First Conversation',
                  'Discovery Scheduled', 'Discovery Held', 'Discovery', 'Pricing Shared',
                  'Proposal Sent', 'Agreement Pending', 'Agreement Signed',
                  'Account Setup', 'First Devices', 'First Volume', 'Growing Together',
                ];
                const currentIdx = stages.indexOf(opp.stage);
                if (currentIdx >= 0 && currentIdx < stages.length - 1) {
                  const nextStage = stages[currentIdx + 1];
                  const { error: stageErr } = await adminClient.from('opportunities')
                    .update({ stage: nextStage, updated_at: new Date().toISOString() })
                    .eq('id', opp.id);
                  if (!stageErr) stats.stage_advances++;
                }
              }
            }
          }
        } catch (actionErr) {
          console.warn(`[sim] Action ${i} failed for tenant ${tenantId.slice(0,8)}:`, actionErr);
          // Continue on fail — never stop the run
        }
      }

      stats.tenants_processed++;
    }

    // ── Connector Sync Simulation ──
    // Generate simulated integration sync events so the Integration Sync Status card shows data
    const connectorScenarios = [
      { key: 'hubspot', name: 'HubSpot', coverage: 'full', direction: 'two-way' },
      { key: 'salesforce', name: 'Salesforce', coverage: 'full', direction: 'two-way' },
      { key: 'dynamics365', name: 'Microsoft Dynamics 365', coverage: 'full', direction: 'two-way' },
      { key: 'planning_center', name: 'Planning Center', coverage: 'full', direction: 'inbound' },
      { key: 'shelbynext', name: 'ShelbyNext', coverage: 'minimal', direction: 'inbound' },
      { key: 'breeze', name: 'Breeze ChMS', coverage: 'partial', direction: 'inbound' },
    ];
    const connRng = seededRandom(runKey + '-connectors-' + Date.now().toString());
    // Pick 2-4 connectors per run
    const connCount = 2 + Math.floor(connRng() * 3);
    const shuffled = [...connectorScenarios].sort(() => connRng() - 0.5).slice(0, connCount);
    for (const conn of shuffled) {
      try {
        const syncStatus = conn.coverage === 'minimal'
          ? 'migration_ready'
          : connRng() > 0.12 ? 'synced' : 'needs_setup';
        const contactsImported = Math.floor(connRng() * 400) + 50;
        const activitiesImported = conn.coverage === 'minimal' ? 0 : Math.floor(connRng() * 120) + 20;
        await adminClient.from('simulation_events').insert({
          simulation_run_id: run.id,
          occurred_at: new Date().toISOString(),
          actor_type: 'system',
          module: 'relatio',
          action: `connector_sync:${conn.key}`,
          internal_refs: {
            connector_key: conn.key,
            connector_name: conn.name,
            coverage_mode: conn.coverage,
            sync_direction: conn.direction,
            sync_status: syncStatus,
            contacts_imported: contactsImported,
            activities_imported: activitiesImported,
          },
          outcome: syncStatus === 'needs_setup' ? 'warning' : 'ok',
          warnings: syncStatus === 'needs_setup' ? [{ msg: 'Connector credentials not configured' }] : [],
        });
        stats.connector_syncs++;
      } catch (connErr) {
        console.warn(`[sim] Connector sync event for ${conn.key} failed:`, connErr);
      }
    }

    // ── Operator-Level Growth Metrics ──
    const growthRng = seededRandom(runKey + '-growth-' + Date.now().toString());
    try {
      // Mark some tenants as founding garden members (idempotent)
      if (growthRng() > 0.6) {
        const { data: unfounded } = await adminClient.from('tenants')
          .select('id')
          .eq('founding_garden_status', false)
          .in('id', targetTenantIds)
          .limit(2);
        if (unfounded?.length) {
          const toFound = unfounded[Math.floor(growthRng() * unfounded.length)];
          await adminClient.from('tenants')
            .update({ founding_garden_status: true, is_founding_garden: true, founding_garden_joined_at: new Date().toISOString() })
            .eq('id', toFound.id);
        }
      }

      // Create an activation session occasionally (correct constraint values)
      if (growthRng() > 0.7) {
        const sessionTenant = pick(targetTenantIds, growthRng);
        const { data: existing } = await adminClient.from('activation_sessions')
          .select('id')
          .eq('tenant_id', sessionTenant)
          .in('status', ['scheduled', 'pending'])
          .limit(1);
        if (!existing?.length) {
          await adminClient.from('activation_sessions').insert({
            tenant_id: sessionTenant,
            session_type: pick(['guided_activation', 'guided_activation_plus'], growthRng),
            sessions_total: 1,
            sessions_remaining: 1,
            status: pick(['scheduled', 'pending'], growthRng),
            purchased_at: new Date().toISOString(),
            duration_minutes: pick([30, 45, 60], growthRng),
          });
        }
      }

      // ── Weekly Rollups (run once per day roughly) ──
      // Check if we already have rollups for this week
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
      const weekStr = weekStart.toISOString().split('T')[0];
      const { count: rollupCount } = await adminClient.from('ecosystem_health_rollups')
        .select('*', { count: 'exact', head: true })
        .eq('week_start', weekStr);

      if ((rollupCount ?? 0) === 0) {
        // Generate ecosystem_health_rollups for each tenant
        for (const tid of targetTenantIds) {
          const { data: tenant } = await adminClient.from('tenants').select('archetype').eq('id', tid).single();
          const arch = tenant?.archetype || 'general';
          const rr = seededRandom(runKey + tid + weekStr);
          await adminClient.from('ecosystem_health_rollups').upsert({
            tenant_id: tid,
            archetype: arch,
            week_start: weekStr,
            reflections_count: 3 + Math.floor(rr() * 15),
            events_count: 1 + Math.floor(rr() * 8),
            communio_shares: Math.floor(rr() * 6),
            testimonium_flags: rr() > 0.6 ? ['narrative_surge'] : [],
          }, { onConflict: 'tenant_id,week_start' });
        }

        // Generate operator_adoption_weekly
        const labels = ['quiet', 'warming', 'active', 'thriving'];
        const narratives: Record<string, string[]> = {
          quiet: ['Light activity this week', 'Team may need gentle encouragement'],
          warming: ['Reflections starting to flow', 'Exploring new modules'],
          active: ['Strong reflection cadence', 'Communio sharing increased', 'Journey chapters consistent'],
          thriving: ['Highest activity across modules', 'NRI suggestions accepted regularly'],
        };
        for (const tid of targetTenantIds) {
          const rr = seededRandom(runKey + tid + weekStr + '-adopt');
          const label = pick(labels, rr);
          const score = label === 'quiet' ? 20 + Math.floor(rr() * 30)
            : label === 'warming' ? 50 + Math.floor(rr() * 20)
            : label === 'active' ? 70 + Math.floor(rr() * 15)
            : 85 + Math.floor(rr() * 15);
          await adminClient.from('operator_adoption_weekly').upsert({
            tenant_id: tid,
            week_start: weekStr,
            adoption_score: Math.min(score, 100),
            adoption_label: label,
            narrative: narratives[label],
          }, { onConflict: 'tenant_id,week_start' });
        }
      }

      // ── Gardener Insights (occasional) ──
      if (growthRng() > 0.85) {
        const insightTypes = ['discovery_interest', 'adoption_friction', 'essay_ready'] as const;
        const insightType = pick([...insightTypes], growthRng);
        const insightTitles: Record<string, string[]> = {
          discovery_interest: ['Visitors lingering on Local Pulse', 'Growing interest in Voluntārium', 'Communio directory getting attention'],
          adoption_friction: ['Hesitation around journey chapters', 'Reflection module underexplored', 'Event tracking incomplete'],
          essay_ready: ['Volunteer engagement pattern forming', 'Community trust theme emerging', 'Partnership narrative developing'],
        };
        const title = pick(insightTitles[insightType], growthRng);
        const dedupeKey = `sim-${insightType}-${weekStr}-${Math.floor(growthRng() * 1000)}`;
        await adminClient.from('gardener_insights').upsert({
          type: insightType,
          severity: pick(['low', 'medium'], growthRng),
          title,
          body: `This pattern was observed across demo tenants during the simulation period. Worth watching as real tenants onboard.`,
          source_refs: { simulation: true },
          dedupe_key: dedupeKey,
        }, { onConflict: 'dedupe_key' });
      }

      // ── Lumen Signals (Examen feed — occasional new signals) ──
      if (growthRng() > 0.7) {
        const lumenTypes = ['drift_risk', 'activation_delay', 'narrative_surge', 'expansion_ready', 'volunteer_dropoff', 'capacity_growth'] as const;
        const lType = pick([...lumenTypes], growthRng);
        const lTenant = pick(targetTenantIds, growthRng);
        const { data: tMeta } = await adminClient.from('tenants').select('home_metro_id').eq('id', lTenant).single();
        const lumenSummaries: Record<string, string[]> = {
          drift_risk: ['Partners without contact in 14+ days', 'Relationship cooling detected'],
          activation_delay: ['Onboarding stalled at low completion', 'Setup incomplete after 7+ days'],
          narrative_surge: ['Reflection volume spiked this week', 'Story-telling cadence accelerating'],
          expansion_ready: ['Active users growing steadily', 'Usage patterns suggest readiness'],
          volunteer_dropoff: ['No volunteer activity in 21+ days', 'Volunteer engagement declining'],
          capacity_growth: ['New users approaching plan limit', 'Team size growing quickly'],
        };
        const summary = pick(lumenSummaries[lType], growthRng);
        await adminClient.from('lumen_signals').insert({
          tenant_id: lTenant,
          metro_id: tMeta?.home_metro_id || null,
          signal_type: lType,
          severity: pick(['low', 'medium', 'high'], growthRng),
          confidence: 0.5 + growthRng() * 0.45,
          source_summary: { reason: summary, simulation: true },
          first_detected_at: new Date().toISOString(),
          last_updated_at: new Date().toISOString(),
          resolved: false,
        });
      }

      // ── Testimonium Rollups (weekly summary per tenant) ──
      const { count: testRollupCount } = await adminClient.from('testimonium_rollups')
        .select('*', { count: 'exact', head: true })
        .eq('week_start', weekStr);
      if ((testRollupCount ?? 0) < targetTenantIds.length) {
        for (const tid of targetTenantIds) {
          const tr = seededRandom(runKey + tid + weekStr + '-test');
          const { data: tMeta } = await adminClient.from('tenants').select('home_metro_id').eq('id', tid).single();
          await adminClient.from('testimonium_rollups').upsert({
            tenant_id: tid,
            week_start: weekStr,
            metro_id: tMeta?.home_metro_id || null,
            reflection_count: 2 + Math.floor(tr() * 12),
            email_touch_count: 3 + Math.floor(tr() * 15),
            event_presence_count: Math.floor(tr() * 6),
            journey_moves: Math.floor(tr() * 4),
            volunteer_activity: Math.floor(tr() * 3),
            provisions_created: Math.floor(tr() * 2),
            migration_activity: Math.floor(tr() * 2),
            projects_count: Math.floor(tr() * 3),
            project_notes_count: Math.floor(tr() * 6),
            people_helped_sum: 5 + Math.floor(tr() * 30),
            helpers_involved_count: 1 + Math.floor(tr() * 8),
          }, { onConflict: 'tenant_id,week_start,metro_id' });
        }
      }

      // ── Testimonium Flags (occasional) ──
      if (growthRng() > 0.6) {
        const flagTypes = ['momentum', 'drift', 'reconnection', 'growth'] as const;
        const fType = pick([...flagTypes], growthRng);
        const fTenant = pick(targetTenantIds, growthRng);
        const { data: fMeta } = await adminClient.from('tenants').select('home_metro_id').eq('id', fTenant).single();
        const flagDescs: Record<string, string[]> = {
          momentum: ['Reflection cadence accelerating', 'Event attendance up this period'],
          drift: ['Activity gap detected', 'Partner silence growing'],
          reconnection: ['Dormant relationship re-engaged', 'Return to platform after absence'],
          growth: ['New users onboarding this week', 'Volunteer base expanding'],
        };
        await adminClient.from('testimonium_flags').insert({
          tenant_id: fTenant,
          metro_id: fMeta?.home_metro_id || null,
          flag_type: fType,
          description: pick(flagDescs[fType], growthRng),
        });
      }

      // ── Archetype Signal Rollups (weekly) ──
      const archetypeKeys = ['church', 'digital_inclusion', 'social_enterprise', 'workforce_development', 'refugee_support'];
      const { count: archRollupCount } = await adminClient.from('archetype_signal_rollups')
        .select('*', { count: 'exact', head: true })
        .gte('period_start', weekStr);
      if ((archRollupCount ?? 0) < archetypeKeys.length) {
        const archStories: Record<string, string[]> = {
          church: ['Faith communities deepening pastoral use of technology', 'Congregations hosting community bridge events'],
          digital_inclusion: ['Digital mentorship programs expanding', 'Tech access improving steadily across metros'],
          social_enterprise: ['Social ventures maintaining consistent engagement', 'Cross-org collaboration signals growing'],
          workforce_development: ['Job readiness workshops gaining traction', 'Employer network partnerships forming'],
          refugee_support: ['Cultural navigation support strengthening', 'Volunteer-led language programs emerging'],
        };
        for (const ak of archetypeKeys) {
          const ar = seededRandom(runKey + ak + weekStr);
          await adminClient.from('archetype_signal_rollups').upsert({
            archetype_key: ak,
            period_start: weekStr,
            period_end: new Date().toISOString(),
            reflection_volume: 5 + Math.floor(ar() * 20),
            visit_activity: 8 + Math.floor(ar() * 25),
            event_presence: 2 + Math.floor(ar() * 8),
            momentum_growth: Math.floor(ar() * 6),
            tenant_sample_size: 1 + Math.floor(ar() * 3),
            generated_story: pick(archStories[ak] || archStories.church, ar),
          }, { onConflict: 'archetype_key,period_start' });
        }
      }

      // ── Communio Shared Signals (occasional) ──
      if (growthRng() > 0.65) {
        const { data: groups } = await adminClient.from('communio_groups').select('id').limit(10);
        if (groups?.length) {
          const grp = pick(groups, growthRng);
          const sigTenant = pick(targetTenantIds, growthRng);
          const { data: sMeta } = await adminClient.from('tenants').select('home_metro_id').eq('id', sigTenant).single();
          const sigTypes = ['event_pattern', 'reflection_theme', 'volunteer_movement', 'growth_signal', 'collaboration_spark'];
          const sigSummaries = [
            'Community meals becoming a shared practice across the network',
            'Reflection themes converging around stewardship and trust',
            'Volunteer mentors connecting organically across organizations',
            'New community members joining through word-of-mouth referrals',
            'Organizations exploring shared resource models for events',
            'Cross-metro learning patterns emerging in the coalition',
          ];
          await adminClient.from('communio_shared_signals').insert({
            group_id: grp.id,
            tenant_id: sigTenant,
            metro_id: sMeta?.home_metro_id || null,
            signal_type: pick(sigTypes, growthRng),
            signal_summary: pick(sigSummaries, growthRng),
          });
        }
      }
    } catch (growthErr) {
      console.warn('[sim] Growth metric generation failed:', growthErr);
    }

    // Mark complete
    await adminClient.from('simulation_runs').update({
      status: 'completed',
      stats,
      completed_at: new Date().toISOString(),
    }).eq('id', run.id);

    // ── Mark automation_run as processed ──
    await adminClient.from('automation_runs').update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      payload: { run_key: runKey, stats },
    }).eq('run_id', automationRunId).then(({ error: arErr }) => {
      if (arErr) console.warn('[sim] automation_runs update failed (non-fatal):', arErr.message);
    });

    // Log per-category runs for dashboard granularity
    const categoryRuns = [];
    if (stats.activities_created > 0) categoryRuns.push({ workflow_key: 'seed_activities', count: stats.activities_created });
    if (stats.reflections_created > 0) categoryRuns.push({ workflow_key: 'seed_reflections', count: stats.reflections_created });
    if (stats.events_created > 0) categoryRuns.push({ workflow_key: 'seed_events', count: stats.events_created });
    if (stats.volunteers_created > 0) categoryRuns.push({ workflow_key: 'seed_volunteers', count: stats.volunteers_created });
    if (stats.stage_advances > 0) categoryRuns.push({ workflow_key: 'seed_stage_advances', count: stats.stage_advances });

    if (categoryRuns.length > 0) {
      await adminClient.from('automation_runs').insert(
        categoryRuns.map(cr => ({
          run_id: crypto.randomUUID(),
          workflow_key: cr.workflow_key,
          status: 'processed',
          processed_at: new Date().toISOString(),
          dedupe_key: `sim:${runKey}:${cr.workflow_key}`,
          triggered_by: userId,
          parent_run_id: automationRunId,
          payload: { count: cr.count },
        }))
      ).then(({ error: catErr }) => {
        if (catErr) console.warn('[sim] category automation_runs insert failed (non-fatal):', catErr.message);
      });
    }

    console.log(`[sim] Run ${runKey} complete:`, JSON.stringify(stats));

    return new Response(JSON.stringify({ ok: true, run_id: run.id, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // Mark automation_run as error if we have the ID
    if (typeof automationRunId !== 'undefined') {
      await adminClient.from('automation_runs').update({
        status: 'error',
        error_message: e instanceof Error ? e.message : 'Unknown error',
        processed_at: new Date().toISOString(),
      }).eq('run_id', automationRunId).catch(() => {});
    }
    console.error('generate-seed-movement error:', e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
