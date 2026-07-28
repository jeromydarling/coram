/**
 * generate-living-signals — Aggregates behavioral patterns into gentle narrative signals.
 *
 * WHAT: Scans activities, events, testimonium, friction, communio for human patterns.
 * WHERE: Called on schedule via cron or authenticated admin request.
 * WHY: The Living System layer — surfacing moments worth noticing without urgency.
 *
 * Auth: Requires service-role key, n8n shared secret, or enrichment worker secret.
 * For cron: pass { "all_tenants": true } to process all active tenants.
 * For single: pass { "tenant_id": "..." }.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function authenticateRequest(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  // Service role key check
  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    if (authHeader.slice(7).trim() === serviceRoleKey) return true;
  }

  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  if (!token) return false;

  return (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);
}

async function processOneTenant(svc: ReturnType<typeof createClient>, tenant_id: string): Promise<number> {
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  let created = 0;

  // --- 1. Reflection Moment: many visit notes within 48h ---
  const { count: visitNoteCount } = await svc
    .from("activities")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant_id)
    .eq("activity_type", "Visit Note")
    .gte("activity_date_time", twoDaysAgo);

  if ((visitNoteCount ?? 0) >= 3) {
    const { count: existing } = await svc
      .from("living_system_signals")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("signal_type", "reflection_moment")
      .gte("created_at", weekAgo);

    if ((existing ?? 0) === 0) {
      await svc.from("living_system_signals").insert({
        tenant_id,
        signal_type: "reflection_moment",
        confidence_score: Math.min(0.5 + (visitNoteCount ?? 0) * 0.1, 0.95),
        context_json: {
          visit_note_count: visitNoteCount,
          window_hours: 48,
          narrative: `${visitNoteCount} visit notes recorded in the last two days. It may be a good moment to capture what you're seeing together.`,
        },
      });
      created++;
    }
  }

  // --- 2. Community Growth: new contacts from event registrations ---
  const { data: recentRegs } = await svc
    .from("event_registrations")
    .select("id, contact_id")
    .eq("tenant_id", tenant_id)
    .gte("created_at", weekAgo)
    .limit(200);

  const newContactCount = (recentRegs || []).filter((r: any) => r.contact_id).length;
  if (newContactCount >= 2) {
    const { count: existing } = await svc
      .from("living_system_signals")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("signal_type", "community_growth")
      .gte("created_at", weekAgo);

    if ((existing ?? 0) === 0) {
      await svc.from("living_system_signals").insert({
        tenant_id,
        signal_type: "community_growth",
        confidence_score: Math.min(0.5 + newContactCount * 0.05, 0.9),
        context_json: {
          new_contacts: newContactCount,
          source: "event_registration",
          narrative: `${newContactCount} new people connected through events this week. Your community is growing.`,
        },
      });
      created++;
    }
  }

  // --- 3. Adoption Support Needed: repeated friction signals ---
  const { count: frictionCount } = await svc
    .from("testimonium_events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant_id)
    .eq("source_module", "signum" as any)
    .gte("occurred_at", weekAgo);

  if ((frictionCount ?? 0) >= 5) {
    const { count: existing } = await svc
      .from("living_system_signals")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("signal_type", "adoption_support_needed")
      .gte("created_at", weekAgo);

    if ((existing ?? 0) === 0) {
      await svc.from("living_system_signals").insert({
        tenant_id,
        signal_type: "adoption_support_needed",
        confidence_score: Math.min(0.6 + (frictionCount ?? 0) * 0.05, 0.95),
        context_json: {
          friction_events: frictionCount,
          narrative: "Some teammates may need a simpler starting point. A quick check-in could help.",
        },
      });
      created++;
    }
  }

  // --- 4. Collaboration Movement: communio sharing increases ---
  const { count: sharingCount } = await svc
    .from("communio_activity_log")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant_id)
    .gte("created_at", weekAgo);

  if ((sharingCount ?? 0) >= 3) {
    const { count: existing } = await svc
      .from("living_system_signals")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("signal_type", "collaboration_movement")
      .gte("created_at", weekAgo);

    if ((existing ?? 0) === 0) {
      await svc.from("living_system_signals").insert({
        tenant_id,
        signal_type: "collaboration_movement",
        confidence_score: 0.7,
        context_json: {
          sharing_actions: sharingCount,
          narrative: "Your network collaboration is active this week. Community presence is strengthening.",
        },
      });
      created++;
    }
  }

  // --- 5. Visitor Voice Pattern: voice notes creating activities ---
  try {
    const { count: voiceCount } = await svc
      .from("voice_notes")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("transcript_status", "completed")
      .gte("recorded_at", weekAgo);

    if ((voiceCount ?? 0) >= 3) {
      const { count: existing } = await svc
        .from("living_system_signals")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant_id)
        .eq("signal_type", "visitor_voice_pattern")
        .gte("created_at", weekAgo);

      if ((existing ?? 0) === 0) {
        await svc.from("living_system_signals").insert({
          tenant_id,
          signal_type: "visitor_voice_pattern",
          confidence_score: 0.75,
          context_json: {
            voice_notes: voiceCount,
            narrative: "Voice notes are becoming part of your rhythm. The stories are being captured.",
          },
        });
        created++;
      }
    }
  } catch (_) {
    // voice_notes table may not exist for all tenants — graceful skip
  }

  // --- 6. Notification bridge: create gentle proactive_notifications for new signals ---
  if (created > 0) {
    try {
      const { data: tenantUsers } = await svc
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenant_id)
        .limit(10);

      const { data: recentSignals } = await svc
        .from("living_system_signals")
        .select("id, signal_type, context_json")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(created);

      if (tenantUsers && recentSignals) {
        const narrativeMap: Record<string, string> = {
          reflection_moment: "A moment of reflection has been noticed in your community.",
          community_growth: "New people are connecting — your community is growing.",
          adoption_support_needed: "Some teammates may need a simpler starting point.",
          collaboration_movement: "Your network collaboration is strengthening.",
          visitor_voice_pattern: "Voice notes are becoming part of your rhythm.",
        };

        for (const signal of recentSignals) {
          for (const tu of tenantUsers) {
            await svc.from("proactive_notifications").insert({
              user_id: (tu as any).user_id,
              notification_type: "living_signal",
              payload: {
                dedupe_key: `living_signal:${signal.id}`,
                title: "A moment worth noticing",
                why: narrativeMap[signal.signal_type] || "Something gentle is happening in your community.",
                signal_type: signal.signal_type,
                signal_id: signal.id,
              },
            }).catch(() => {}); // dedupe via unique constraint
          }
        }
      }
    } catch (_) {
      // Silent — notification bridge never blocks signal generation
    }
  }

  return created;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth guard — require service-level authentication
  if (!authenticateRequest(req)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { tenant_id, all_tenants } = body;

    if (!tenant_id && !all_tenants) {
      return new Response(
        JSON.stringify({ ok: false, error: "tenant_id or all_tenants required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let totalCreated = 0;
    let tenantsProcessed = 0;

    if (all_tenants) {
      // Cron mode: process all active tenants
      const { data: tenants } = await svc
        .from("tenants")
        .select("id")
        .eq("status", "active")
        .limit(200);

      for (const t of (tenants || [])) {
        try {
          const count = await processOneTenant(svc, t.id);
          totalCreated += count;
          tenantsProcessed++;
        } catch (e) {
          console.error(`[living-signals] Error for tenant ${t.id}:`, (e as Error).message);
        }
      }
    } else {
      totalCreated = await processOneTenant(svc, tenant_id);
      tenantsProcessed = 1;
    }

    // Health telemetry
    await svc.from("system_health_events").insert({
      schedule_key: "generate_living_signals",
      status: "ok",
      stats: { signals_created: totalCreated, tenants_processed: tenantsProcessed },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ ok: true, signals_created: totalCreated, tenants_processed: tenantsProcessed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
