import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

/**
 * Notification Dispatcher — Runs on a schedule (every 5 minutes)
 * 
 * Responsibilities:
 * 1. Collect pending notification events
 * 2. Apply T2 bundling (group by bundle_key within 45-min window)
 * 3. Apply dedupe (fingerprint uniqueness enforced at DB level)
 * 4. Respect quiet hours per user
 * 5. Enforce hourly caps (soft=6, hard=10)
 * 6. Respect global kill switch + per-type toggles
 * 7. Call profunda-notify to send pushes
 * 8. Record deliveries
 */

interface NotificationEvent {
  id: string;
  event_type: string;
  org_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown>;
  priority: string;
  fingerprint: string;
  tier: string;
  deep_link: string | null;
  title: string;
  body: string;
  status: string;
  bundle_key: string | null;
  created_at: string;
}

interface UserSettings {
  user_id: string;
  push_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  quiet_hours_enabled: boolean;
  notify_watchlist_signals: boolean;
  notify_campaign_suggestions: boolean;
  notify_event_enrichment: boolean;
  notify_campaign_summary: boolean;
  notify_automation_health: boolean;
  notify_meeting_notes: boolean;
  notify_daily_digest: boolean;
  notify_weekly_summary: boolean;
}

interface TypeConfig {
  event_type: string;
  enabled: boolean;
  default_on: boolean;
  admin_only: boolean;
}

const SETTING_MAP: Record<string, keyof UserSettings> = {
  watchlist_signal: 'notify_watchlist_signals',
  campaign_suggestion_ready: 'notify_campaign_suggestions',
  event_enrichment_ready: 'notify_event_enrichment',
  campaign_send_summary: 'notify_campaign_summary',
  automation_failed: 'notify_automation_health',
  meeting_notes_ready: 'notify_meeting_notes',
};

const BUNDLE_WINDOW_MS = 45 * 60 * 1000; // 45 minutes

function isInQuietHours(userTimezone: string, quietStart: number, quietEnd: number): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone || 'UTC',
      hour: 'numeric',
      hour12: false,
    });
    const localHour = parseInt(formatter.format(now), 10);

    // Handle wrapping (e.g., 21-8 means 21,22,23,0,1,...,7)
    if (quietStart > quietEnd) {
      return localHour >= quietStart || localHour < quietEnd;
    }
    return localHour >= quietStart && localHour < quietEnd;
  } catch {
    return false; // On error, don't block
  }
}

function getNextDeliverAfter(userTimezone: string, quietEnd: number): Date {
  try {
    const now = new Date();
    // Calculate tomorrow's quiet-end hour in user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')!.value;
    const month = parts.find(p => p.type === 'month')!.value;
    const day = parts.find(p => p.type === 'day')!.value;

    // Try today at quiet_end first
    const todayAtEnd = new Date(`${year}-${month}-${day}T${String(quietEnd).padStart(2, '0')}:30:00`);
    if (todayAtEnd > now) return todayAtEnd;

    // Otherwise tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tParts = formatter.formatToParts(tomorrow);
    const tYear = tParts.find(p => p.type === 'year')!.value;
    const tMonth = tParts.find(p => p.type === 'month')!.value;
    const tDay = tParts.find(p => p.type === 'day')!.value;
    return new Date(`${tYear}-${tMonth}-${tDay}T${String(quietEnd).padStart(2, '0')}:30:00`);
  } catch {
    const d = new Date();
    d.setHours(d.getHours() + 10);
    return d;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const internalNotifyKey = Deno.env.get('INTERNAL_NOTIFY_KEY');

  // Global kill switch
  const notificationsEnabled = Deno.env.get('NOTIFICATIONS_ENABLED') !== 'false';

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { mode } = body;

    // ============================================================
    // MODE: emit — Producers call this to create a notification event
    // ============================================================
    if (mode === 'emit') {
      // Validate internal key for service-to-service calls
      const xKey = req.headers.get('x-internal-key');
      const authHeader = req.headers.get('Authorization');
      const bearer = authHeader?.replace('Bearer ', '');

      if (!xKey || xKey !== internalNotifyKey || !bearer || bearer !== serviceRoleKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { event_type, org_id, user_id, metadata, priority, fingerprint, tier, deep_link, title, body: eventBody, bundle_key } = body;

      if (!event_type || !fingerprint || !title || !eventBody) {
        return new Response(JSON.stringify({ error: 'Missing required fields: event_type, fingerprint, title, body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check global kill switch — log but don't send
      if (!notificationsEnabled) {
        console.log(`[dispatcher] Global kill switch OFF — logging event ${event_type} but not delivering`);
        const { data, error } = await admin.from('notification_events').insert({
          event_type,
          org_id: org_id || null,
          user_id: user_id || null,
          metadata: metadata || {},
          priority: priority || 'normal',
          fingerprint,
          tier: tier || 'T1',
          deep_link: deep_link || null,
          title,
          body: eventBody,
          status: 'dropped',
          bundle_key: bundle_key || null,
        }).select('id').single();

        return new Response(JSON.stringify({ logged: true, delivered: false, reason: 'kill_switch', id: data?.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check per-type config
      const { data: typeConfig } = await admin
        .from('notification_type_config')
        .select('enabled, admin_only')
        .eq('event_type', event_type)
        .single();

      if (typeConfig && !typeConfig.enabled) {
        const { data } = await admin.from('notification_events').insert({
          event_type, org_id, user_id, metadata: metadata || {}, priority: priority || 'normal',
          fingerprint, tier: tier || 'T1', deep_link, title, body: eventBody,
          status: 'dropped', bundle_key,
        }).select('id').single();

        return new Response(JSON.stringify({ logged: true, delivered: false, reason: 'type_disabled', id: data?.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Insert event (dedupe via unique index)
      const { data: evt, error: insertError } = await admin.from('notification_events').upsert({
        event_type,
        org_id: org_id || null,
        user_id: user_id || null,
        metadata: metadata || {},
        priority: priority || 'normal',
        fingerprint,
        tier: tier || 'T1',
        deep_link: deep_link || null,
        title,
        body: eventBody,
        status: 'pending',
        bundle_key: bundle_key || null,
      }, { onConflict: 'user_id,fingerprint', ignoreDuplicates: true }).select('id').single();

      if (insertError && insertError.code !== '23505') {
        throw insertError;
      }

      return new Response(JSON.stringify({ emitted: true, id: evt?.id, dedupe: insertError?.code === '23505' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================================
    // MODE: dispatch — Called on schedule to process pending events
    // ============================================================
    if (mode === 'dispatch') {
      // Auth: internal key or cron
      const xKey = req.headers.get('x-internal-key');
      const authHeader = req.headers.get('Authorization');
      const bearer = authHeader?.replace('Bearer ', '');

      const isInternalAuth = xKey && xKey === internalNotifyKey && bearer && bearer === serviceRoleKey;
      const isCronAuth = bearer === Deno.env.get('SUPABASE_ANON_KEY');

      if (!isInternalAuth && !isCronAuth) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!notificationsEnabled) {
        return new Response(JSON.stringify({ dispatched: 0, reason: 'kill_switch' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch all pending events
      const { data: pendingEvents, error: fetchError } = await admin
        .from('notification_events')
        .select('*')
        .in('status', ['pending', 'queued_quiet'])
        .order('created_at', { ascending: true })
        .limit(200);

      if (fetchError) throw fetchError;
      if (!pendingEvents || pendingEvents.length === 0) {
        return new Response(JSON.stringify({ dispatched: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch type configs
      const { data: typeConfigs } = await admin.from('notification_type_config').select('*');
      const configMap: Record<string, TypeConfig> = {};
      (typeConfigs || []).forEach((c: TypeConfig) => { configMap[c.event_type] = c; });

      // Group events by user_id
      const userEventMap: Record<string, NotificationEvent[]> = {};
      const broadcastEvents: NotificationEvent[] = [];

      for (const evt of pendingEvents as NotificationEvent[]) {
        if (evt.user_id) {
          if (!userEventMap[evt.user_id]) userEventMap[evt.user_id] = [];
          userEventMap[evt.user_id].push(evt);
        } else {
          broadcastEvents.push(evt);
        }
      }

      // For broadcast events (admin_only like automation_failed), resolve target users
      if (broadcastEvents.length > 0) {
        const { data: adminUsers } = await admin
          .from('user_roles')
          .select('user_id')
          .in('role', ['admin', 'leadership']);

        for (const evt of broadcastEvents) {
          for (const u of (adminUsers || [])) {
            // Create per-user copies
            if (!userEventMap[u.user_id]) userEventMap[u.user_id] = [];
            userEventMap[u.user_id].push({ ...evt, user_id: u.user_id });
          }
          // Mark original as delivered
          await admin.from('notification_events').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', evt.id);
        }
      }

      // Fetch all relevant user settings
      const userIds = Object.keys(userEventMap);
      if (userIds.length === 0) {
        return new Response(JSON.stringify({ dispatched: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: allSettings } = await admin
        .from('user_notification_settings')
        .select('*')
        .in('user_id', userIds);

      const settingsMap: Record<string, UserSettings> = {};
      (allSettings || []).forEach((s: UserSettings) => { settingsMap[s.user_id] = s; });

      // Fetch user timezones
      const { data: profiles } = await admin
        .from('profiles')
        .select('user_id, timezone')
        .in('user_id', userIds);

      const tzMap: Record<string, string> = {};
      (profiles || []).forEach((p: { user_id: string; timezone: string }) => { tzMap[p.user_id] = p.timezone || 'UTC'; });

      // Fetch user roles for admin_only checks
      const { data: userRoles } = await admin
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const roleMap: Record<string, string[]> = {};
      (userRoles || []).forEach((r: { user_id: string; role: string }) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });

      let totalDispatched = 0;
      let totalQueued = 0;
      let totalDropped = 0;

      for (const [userId, events] of Object.entries(userEventMap)) {
        const settings = settingsMap[userId];
        const tz = tzMap[userId] || 'UTC';
        const roles = roleMap[userId] || [];

        // No settings = no push enabled
        if (!settings || !settings.push_enabled) {
          for (const evt of events) {
            await admin.from('notification_events').update({ status: 'dropped' }).eq('id', evt.id);
          }
          totalDropped += events.length;
          continue;
        }

        // Check hourly cap
        const { data: capResult } = await admin.rpc('check_notification_hourly_cap', {
          p_user_id: userId,
          p_soft_cap: 6,
          p_hard_cap: 10,
        });

        const cap = capResult as { allowed: boolean; soft_exceeded: boolean; hard_exceeded: boolean; count: number } | null;
        if (cap && cap.hard_exceeded) {
          for (const evt of events) {
            await admin.from('notification_events').update({ status: 'dropped' }).eq('id', evt.id);
          }
          totalDropped += events.length;
          continue;
        }

        // Check quiet hours
        const inQuietHours = settings.quiet_hours_enabled && isInQuietHours(tz, settings.quiet_hours_start, settings.quiet_hours_end);

        // Process each event
        for (const evt of events) {
          // Check per-type config
          const tConfig = configMap[evt.event_type];
          if (tConfig && !tConfig.enabled) {
            await admin.from('notification_events').update({ status: 'dropped' }).eq('id', evt.id);
            totalDropped++;
            continue;
          }

          // Check admin_only
          if (tConfig && tConfig.admin_only) {
            const isAdminOrLeadership = roles.some(r => ['admin', 'leadership'].includes(r));
            if (!isAdminOrLeadership) {
              await admin.from('notification_events').update({ status: 'dropped' }).eq('id', evt.id);
              totalDropped++;
              continue;
            }
          }

          // Check user per-type preference
          const settingKey = SETTING_MAP[evt.event_type];
          if (settingKey && settings[settingKey] === false) {
            await admin.from('notification_events').update({ status: 'dropped' }).eq('id', evt.id);
            totalDropped++;
            continue;
          }

          // Quiet hours: queue for later
          if (inQuietHours && evt.priority !== 'high') {
            const deliverAfter = getNextDeliverAfter(tz, settings.quiet_hours_end);
            await admin.from('notification_queue').insert({
              user_id: userId,
              event_ids: [evt.id],
              bundle_key: evt.bundle_key || `${userId}:${evt.event_type}`,
              event_type: evt.event_type,
              title: evt.title,
              body: evt.body,
              deep_link: evt.deep_link,
              priority: evt.priority,
              deliver_after: deliverAfter.toISOString(),
            });
            await admin.from('notification_events').update({ status: 'queued_quiet' }).eq('id', evt.id);
            totalQueued++;
            continue;
          }

          // T2: Check if there are bundleable events within window
          if (evt.tier === 'T2' && evt.bundle_key) {
            // Check if already a queue item for this bundle_key
            const { data: existingQueue } = await admin
              .from('notification_queue')
              .select('id, event_ids')
              .eq('user_id', userId)
              .eq('bundle_key', evt.bundle_key)
              .eq('status', 'pending')
              .gte('created_at', new Date(Date.now() - BUNDLE_WINDOW_MS).toISOString())
              .single();

            if (existingQueue) {
              // Add to existing bundle
              const updatedIds = [...(existingQueue.event_ids || []), evt.id];
              await admin.from('notification_queue').update({
                event_ids: updatedIds,
                title: `${updatedIds.length} updates ready for review`,
                body: `New context available from ${updatedIds.length} signals — ready when you are.`,
              }).eq('id', existingQueue.id);
              await admin.from('notification_events').update({ status: 'bundled', bundle_id: existingQueue.id }).eq('id', evt.id);
              continue;
            }

            // Create new bundle queue item (deliver after 45 min to allow more bundling)
            const deliverAfter = new Date(Date.now() + BUNDLE_WINDOW_MS);
            await admin.from('notification_queue').insert({
              user_id: userId,
              event_ids: [evt.id],
              bundle_key: evt.bundle_key,
              event_type: evt.event_type,
              title: evt.title,
              body: evt.body,
              deep_link: evt.deep_link,
              priority: evt.priority,
              deliver_after: deliverAfter.toISOString(),
            });
            await admin.from('notification_events').update({ status: 'bundled' }).eq('id', evt.id);
            continue;
          }

          // T1: Direct send
          if (cap && !cap.allowed) {
            await admin.from('notification_events').update({ status: 'dropped' }).eq('id', evt.id);
            totalDropped++;
            continue;
          }

          // Send via profunda-notify
          const sendResult = await fetch(`${supabaseUrl}/functions/v1/profunda-notify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-key': internalNotifyKey!,
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              mode: 'send-notification',
              userId,
              trigger: 'watchlist_signal' as const,  // Use any valid trigger type
              title: evt.title,
              body: evt.body,
              deepLink: evt.deep_link || '/',
            }),
          });

          const sendData = await sendResult.json();

          // Record delivery
          await admin.from('notification_deliveries').insert({
            event_id: evt.id,
            user_id: userId,
            status: sendData.success || sendData.sent > 0 ? 'sent' : (sendData.skipped ? 'skipped' : 'failed'),
            sent_at: new Date().toISOString(),
            error: sendData.error || null,
          });

          if (sendData.success || sendData.sent > 0) {
            await admin.from('notification_events').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', evt.id);
            await admin.rpc('increment_notification_push_count', { p_user_id: userId });
            totalDispatched++;
          } else {
            await admin.from('notification_events').update({ status: 'dropped' }).eq('id', evt.id);
            totalDropped++;
          }
        }
      }

      // ============================
      // Process mature queue items
      // ============================
      const { data: matureQueue } = await admin
        .from('notification_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('deliver_after', new Date().toISOString())
        .order('deliver_after', { ascending: true })
        .limit(50);

      for (const qi of (matureQueue || [])) {
        // Re-check caps
        const { data: capResult2 } = await admin.rpc('check_notification_hourly_cap', {
          p_user_id: qi.user_id,
          p_soft_cap: 6,
          p_hard_cap: 10,
        });

        const cap2 = capResult2 as { allowed: boolean } | null;
        if (cap2 && !cap2.allowed) {
          continue; // Will retry next dispatch cycle
        }

        // Send bundled notification
        const sendResult = await fetch(`${supabaseUrl}/functions/v1/profunda-notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': internalNotifyKey!,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            mode: 'send-notification',
            userId: qi.user_id,
            trigger: 'watchlist_signal' as const,
            title: qi.title,
            body: qi.body,
            deepLink: qi.deep_link || '/',
          }),
        });

        const sendData = await sendResult.json();

        await admin.from('notification_queue').update({
          status: sendData.success || sendData.sent > 0 ? 'delivered' : 'failed',
          delivered_at: new Date().toISOString(),
        }).eq('id', qi.id);

        // Update all linked events
        if (qi.event_ids && qi.event_ids.length > 0) {
          await admin.from('notification_events').update({
            status: 'delivered',
            delivered_at: new Date().toISOString(),
          }).in('id', qi.event_ids);
        }

        if (sendData.success || sendData.sent > 0) {
          await admin.rpc('increment_notification_push_count', { p_user_id: qi.user_id });
          totalDispatched++;
        }
      }

      return new Response(JSON.stringify({
        dispatched: totalDispatched,
        queued: totalQueued,
        dropped: totalDropped,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================================
    // MODE: digest — Generate and send T3 daily/weekly digests
    // ============================================================
    if (mode === 'digest') {
      const xKey = req.headers.get('x-internal-key');
      const authHeader = req.headers.get('Authorization');
      const bearer = authHeader?.replace('Bearer ', '');

      if (!xKey || xKey !== internalNotifyKey || !bearer || bearer !== serviceRoleKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!notificationsEnabled) {
        return new Response(JSON.stringify({ sent: 0, reason: 'kill_switch' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { digest_type } = body; // 'daily' or 'weekly'

      // Get users who have digest enabled
      const settingCol = digest_type === 'weekly' ? 'notify_weekly_summary' : 'notify_daily_digest';
      const { data: eligibleUsers } = await admin
        .from('user_notification_settings')
        .select('user_id')
        .eq('push_enabled', true)
        .eq(settingCol, true);

      let sentCount = 0;

      for (const u of (eligibleUsers || [])) {
        const windowHours = digest_type === 'weekly' ? 168 : 24;
        const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

        // Gather recent delivered events for this user
        const { data: recentEvents } = await admin
          .from('notification_events')
          .select('event_type, title')
          .eq('user_id', u.user_id)
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!recentEvents || recentEvents.length === 0) continue;

        // Count by type
        const typeCounts: Record<string, number> = {};
        for (const e of recentEvents) {
          typeCounts[e.event_type] = (typeCounts[e.event_type] || 0) + 1;
        }

        const lines: string[] = [];
        if (typeCounts.watchlist_signal) lines.push(`📡 ${typeCounts.watchlist_signal} new signal${typeCounts.watchlist_signal > 1 ? 's' : ''} you may want to review`);
        if (typeCounts.campaign_suggestion_ready) lines.push(`💡 ${typeCounts.campaign_suggestion_ready} draft outreach suggestion${typeCounts.campaign_suggestion_ready > 1 ? 's' : ''} ready`);
        if (typeCounts.event_enrichment_ready) lines.push(`🎯 New attendee matches from recent events`);

        if (lines.length === 0) continue;

        const title = digest_type === 'weekly' ? '📊 Your Weekly Summary' : '📋 Your Daily Digest';
        const digestBody = lines.join(' · ');

        await fetch(`${supabaseUrl}/functions/v1/profunda-notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': internalNotifyKey!,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            mode: 'send-notification',
            userId: u.user_id,
            trigger: 'weekly_plan' as const,
            title,
            body: digestBody,
            deepLink: '/',
          }),
        });

        sentCount++;
      }

      return new Response(JSON.stringify({ sent: sentCount, digest_type }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown mode. Valid: emit, dispatch, digest' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[notification-dispatcher] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
