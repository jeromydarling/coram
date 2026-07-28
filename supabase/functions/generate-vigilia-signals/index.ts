/**
 * generate-vigilia-signals — Rule-based companion signal generator.
 *
 * WHAT: Scans activities, voice_notes, events, friction for each tenant
 *       and produces MAX 3 gentle signals per tenant per run.
 *       ALSO aggregates cross-tenant patterns into communio_awareness_signals.
 * WHERE: Called via cron (daily) or manual trigger.
 * WHY: Vigilia is the calm companion layer — rules, not AI.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Dedupe: check cooldown
    const { data: cooldown } = await admin.rpc('check_automation_cooldown', {
      p_workflow_key: 'vigilia_signal_gen',
      p_cooldown_seconds: 3600, // 1 hour
    });
    if (cooldown && !cooldown.allowed) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'cooldown_active' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Register run
    const runId = crypto.randomUUID();
    await admin.from('automation_runs').insert({
      run_id: runId,
      workflow_key: 'vigilia_signal_gen',
      status: 'running',
      triggered_by: 'cron',
    });

    // Get active tenants
    const { data: tenants } = await admin.from('tenants').select('id').limit(200);
    if (!tenants || tenants.length === 0) {
      await admin.from('automation_runs').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('run_id', runId);
      return new Response(JSON.stringify({ ok: true, count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    let totalSignals = 0;

    // Track cross-tenant signal type counts for awareness aggregation
    const crossTenantCounts: Record<string, number> = {};

    for (const tenant of tenants) {
      const tid = tenant.id;
      const signals: Array<{ type: string; severity: string; suggested_action: string; role_scope: string; context_ref?: string }> = [];

      // Check HIPAA mode
      const { data: settings } = await admin.from('tenant_settings').select('compliance_posture').eq('tenant_id', tid).maybeSingle();
      const isHipaa = settings?.compliance_posture === 'hipaa_sensitive';

      // Skip if already 3+ open signals for this tenant
      const { count: openCount } = await admin.from('vigilia_signals').select('*', { count: 'exact', head: true }).eq('tenant_id', tid).eq('status', 'open');
      if ((openCount ?? 0) >= 3) continue;

      const maxNew = 3 - (openCount ?? 0);

      // Rule 1: Activities without follow-up reflections (visit_without_followup)
      const { data: recentActivities } = await admin
        .from('activities')
        .select('id, activity_type, opportunity_id')
        .eq('tenant_id', tid)
        .gte('activity_date_time', threeDaysAgo)
        .in('activity_type', ['Visit', 'Meeting', 'Phone Call'])
        .limit(20);

      if (recentActivities && recentActivities.length > 0) {
        const oppIds = recentActivities.filter(a => a.opportunity_id).map(a => a.opportunity_id);
        let reflectionCount = 0;
        if (oppIds.length > 0) {
          const { count } = await admin
            .from('opportunity_reflections')
            .select('*', { count: 'exact', head: true })
            .in('opportunity_id', oppIds)
            .gte('created_at', threeDaysAgo);
          reflectionCount = count ?? 0;
        }
        if (recentActivities.length > 0 && reflectionCount === 0 && signals.length < maxNew) {
          signals.push({
            type: 'visit_without_followup',
            severity: 'low',
            suggested_action: isHipaa
              ? 'A recent visit may benefit from a follow-up reflection.'
              : 'A recent visit may benefit from a follow-up reflection.',
            role_scope: 'companion',
            context_ref: recentActivities[0].id,
          });
        }
      }

      // Rule 2: Activity dropoff (no activities in 7 days)
      if (signals.length < maxNew) {
        const { count: actCount } = await admin
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tid)
          .gte('activity_date_time', weekAgo);
        if ((actCount ?? 0) === 0) {
          signals.push({
            type: 'activity_dropoff',
            severity: 'low',
            suggested_action: 'It has been a little while since any activities were logged. Perhaps a check-in would help.',
            role_scope: 'steward',
          });
        }
      }

      // Rule 3: Events without follow-up (event_followup_missing)
      if (signals.length < maxNew) {
        const { data: pastEvents } = await admin
          .from('events')
          .select('id, event_name, attended')
          .eq('tenant_id', tid)
          .eq('attended', true)
          .gte('event_date', threeDaysAgo)
          .limit(10);
        if (pastEvents && pastEvents.length > 0) {
          const { count: eventReflections } = await admin
            .from('opportunity_reflections')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tid)
            .gte('created_at', threeDaysAgo);
          if ((eventReflections ?? 0) === 0) {
            signals.push({
              type: 'event_followup_missing',
              severity: 'low',
              suggested_action: isHipaa
                ? 'An attended event could be captured in a reflection.'
                : 'An attended event could be captured in a reflection.',
              role_scope: 'visitor',
              context_ref: pastEvents[0].id,
            });
          }
        }
      }

      // Rule 4: Partner silence gap (no contact with opportunities in 14 days)
      if (signals.length < maxNew) {
        const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
        const { data: silentPartners } = await admin
          .from('opportunities')
          .select('id')
          .eq('tenant_id', tid)
          .eq('status', 'Active')
          .lt('last_contact_date', fourteenDaysAgo)
          .limit(1);
        if (silentPartners && silentPartners.length > 0) {
          signals.push({
            type: 'partner_silence_gap',
            severity: 'medium',
            suggested_action: isHipaa
              ? 'A community partner may benefit from a gentle reconnection.'
              : 'A community partner may benefit from a gentle reconnection.',
            role_scope: 'shepherd',
            context_ref: silentPartners[0].id,
          });
        }
      }

      // Insert signals
      if (signals.length > 0) {
        const rows = signals.map(s => ({
          tenant_id: tid,
          type: s.type,
          severity: s.severity,
          suggested_action: s.suggested_action,
          role_scope: s.role_scope,
          is_hipaa_sensitive: isHipaa,
          context_ref: s.context_ref || null,
          status: 'open',
        }));
        await admin.from('vigilia_signals').insert(rows);
        totalSignals += rows.length;

        // Accumulate cross-tenant counts
        for (const s of signals) {
          crossTenantCounts[s.type] = (crossTenantCounts[s.type] || 0) + 1;
        }
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PHASE 21B: Communio Awareness Signal Aggregation
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let awarenessSignals = 0;
    const AWARENESS_THRESHOLD = 5; // Minimum tenants with same pattern

    const awarenessMessages: Record<string, { message: string; action: string; role: string }> = {
      visit_without_followup: {
        message: 'Many companions across the network found that adding a short reflection after visits helped them stay connected.',
        action: 'Try adding a reflection after your next visit.',
        role: 'companion',
      },
      activity_dropoff: {
        message: 'Some organizations noticed that even a brief weekly check-in keeps relationships warm.',
        action: 'Consider logging a quick activity this week.',
        role: 'steward',
      },
      partner_silence_gap: {
        message: 'A few companions found that a gentle follow-up after a quiet period often reopened meaningful conversations.',
        action: 'Perhaps a simple note to a quiet partner could help.',
        role: 'shepherd',
      },
      event_followup_missing: {
        message: 'Organizations that capture reflections after events tend to notice more about the people they serve.',
        action: 'Try capturing a quick reflection after your next event.',
        role: 'visitor',
      },
    };

    // Delete old awareness signals (older than 7 days) to keep fresh
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    await admin.from('communio_awareness_signals').delete().lt('created_at', sevenDaysAgo);

    for (const [signalType, count] of Object.entries(crossTenantCounts)) {
      if (count >= AWARENESS_THRESHOLD && awarenessMessages[signalType]) {
        const msg = awarenessMessages[signalType];

        // Check if a similar awareness signal already exists this week
        const { count: existing } = await admin
          .from('communio_awareness_signals')
          .select('*', { count: 'exact', head: true })
          .eq('source_signal_type', signalType)
          .gte('created_at', sevenDaysAgo);

        if ((existing ?? 0) === 0) {
          await admin.from('communio_awareness_signals').insert({
            source_signal_type: signalType,
            anonymized_message: msg.message,
            suggested_action: msg.action,
            role_scope: msg.role,
            is_hipaa_safe: true,
            visibility: 'both',
          });
          awarenessSignals++;
        }
      }
    }

    // Mark run complete
    await admin.from('automation_runs').update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      payload: {
        signals_created: totalSignals,
        awareness_signals_created: awarenessSignals,
        tenants_scanned: tenants.length,
      },
    }).eq('run_id', runId);

    return new Response(JSON.stringify({ ok: true, count: totalSignals, awareness: awarenessSignals }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
