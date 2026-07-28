/**
 * relatio-sync-runner — Silent read-only ingestion for Narrative Companion Mode.
 *
 * WHAT: Polls connected ChMS systems, writes to staging tables, emits narrative signals.
 * WHERE: Called on schedule or manually by operator.
 * WHY: CROS listens alongside external systems — never modifies them.
 *
 * RULES:
 * - Read-only polling only
 * - Write ONLY to staging tables
 * - Emit narrative signals (living_system_signals)
 * - NEVER create contacts automatically
 * - NEVER overwrite tenant data
 * - NEVER modify external systems
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace('Bearer ', '')
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify admin role
    const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', userId);
    const isAdmin = roles?.some((r: any) => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ ok: false, error: 'Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting
    const { data: rateLimitOk } = await adminClient.rpc('check_and_increment_rate_limit', {
      p_user_id: userId,
      p_function_name: 'relatio-sync-runner',
      p_window_minutes: 60,
      p_max_requests: 10,
    });

    if (rateLimitOk === false) {
      return new Response(JSON.stringify({ ok: false, error: 'Rate limited — try again shortly' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetTenantId = body.tenant_id ?? null;

    // Get active listening connections
    let query = adminClient
      .from('relatio_companion_connections')
      .select('*')
      .eq('status', 'listening');

    if (targetTenantId) {
      query = query.eq('tenant_id', targetTenantId);
    }

    const { data: connections, error: connErr } = await query;
    if (connErr) throw connErr;

    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No active connections', processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process unprocessed staging records → emit narrative signals
    let signalsEmitted = 0;

    for (const conn of connections) {
      // Check tenant has companion enabled
      const { data: settings } = await adminClient
        .from('tenant_settings')
        .select('narrative_companion_enabled, compliance_posture')
        .eq('tenant_id', conn.tenant_id)
        .maybeSingle();

      if (!settings?.narrative_companion_enabled) continue;

      const isHipaa = settings.compliance_posture === 'hipaa_sensitive';

      // Get unprocessed staging records for this connection
      const { data: staged } = await adminClient
        .from('relatio_staging_records')
        .select('*')
        .eq('connection_id', conn.id)
        .eq('narrative_signal_emitted', false)
        .limit(50);

      if (!staged || staged.length === 0) continue;

      // Translate each staged record into a narrative signal
      for (const record of staged) {
        const signalType = translateToSignalType(record.external_type);
        if (!signalType) continue;

        const narrativeHint = isHipaa
          ? getAnonymizedHint(record.external_type)
          : getNarrativeHint(record.external_type);

        // Emit living_system_signal
        await adminClient.from('living_system_signals').insert({
          tenant_id: conn.tenant_id,
          signal_type: mapToLivingSignalType(signalType),
          message: narrativeHint,
          anonymized_summary: isHipaa ? narrativeHint : null,
          source_ref: `relatio:${conn.connector_key}:${record.external_id}`,
        }).then(() => {});

        // Mark as processed
        await adminClient
          .from('relatio_staging_records')
          .update({ narrative_signal_emitted: true })
          .eq('id', record.id);

        signalsEmitted++;
      }

      // Update connection stats
      await adminClient
        .from('relatio_companion_connections')
        .update({
          last_poll_at: new Date().toISOString(),
          last_poll_status: 'ok',
          records_ingested: conn.records_ingested + signalsEmitted,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id);
    }

    return new Response(JSON.stringify({
      ok: true,
      connections_processed: connections.length,
      signals_emitted: signalsEmitted,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('relatio-sync-runner error:', err);
    return new Response(JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function translateToSignalType(externalType: string): string | null {
  const map: Record<string, string> = {
    household_updated: 'family_movement',
    member_added: 'community_growth',
    member_removed: 'family_movement',
    event_attended: 'engagement_pattern',
    event_created: 'community_growth',
    check_in: 'service_participation',
    group_joined: 'group_activity',
    group_left: 'group_activity',
    note_added: 'care_moment',
    visit_logged: 'visit_signal',
    volunteer_shift: 'service_participation',
  };
  return map[externalType] ?? null;
}

function mapToLivingSignalType(narrativeType: string): string {
  const map: Record<string, string> = {
    family_movement: 'community_growth',
    community_growth: 'community_growth',
    engagement_pattern: 'reflection_moment',
    care_moment: 'reflection_moment',
    group_activity: 'collaboration_movement',
    visit_signal: 'reflection_moment',
    service_participation: 'collaboration_movement',
  };
  return map[narrativeType] ?? 'community_growth';
}

function getNarrativeHint(externalType: string): string {
  const hints: Record<string, string> = {
    household_updated: 'A household record was updated — family context may have shifted.',
    member_added: 'A new member joined the community.',
    member_removed: 'A member transitioned out of the community.',
    event_attended: 'Someone attended a community event.',
    event_created: 'A new community gathering was planned.',
    check_in: 'A check-in was recorded at a service or gathering.',
    group_joined: 'Someone joined a community group.',
    group_left: 'Someone stepped away from a group.',
    note_added: 'A pastoral note was added.',
    visit_logged: 'A visit was logged in the connected system.',
    volunteer_shift: 'Someone served the community through volunteering.',
  };
  return hints[externalType] ?? 'Activity was noticed in the connected system.';
}

function getAnonymizedHint(externalType: string): string {
  const hints: Record<string, string> = {
    household_updated: 'A household was updated.',
    member_added: 'A person joined the community.',
    member_removed: 'A person transitioned.',
    event_attended: 'A gathering was attended.',
    event_created: 'A gathering was planned.',
    check_in: 'A check-in was recorded.',
    group_joined: 'A person joined a group.',
    group_left: 'A person stepped away from a group.',
    note_added: 'A care note was added.',
    visit_logged: 'A visit was recorded.',
    volunteer_shift: 'Service was contributed.',
  };
  return hints[externalType] ?? 'Activity was noticed.';
}
