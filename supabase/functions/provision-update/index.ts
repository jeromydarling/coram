import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAFF_FIELDS = ['status', 'assigned_to', 'tracking_carrier', 'tracking_number', 'delivery_status'];
const VALID_STATUSES = ['draft', 'submitted', 'in_progress', 'ordered', 'shipped', 'delivered', 'canceled'];
const VALID_DELIVERY = ['unknown', 'in_transit', 'delivered', 'exception'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { provision_id, ...updates } = body;

    if (!provision_id) {
      return new Response(JSON.stringify({ error: 'provision_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get provision + opportunity
    const { data: provision, error: fetchErr } = await adminClient
      .from('provisions')
      .select('*, opportunities(owner_id, metro_id)')
      .eq('id', provision_id)
      .single();

    if (fetchErr || !provision) {
      return new Response(JSON.stringify({ error: 'Provision not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user roles
    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (userRoles || []).map((r: any) => r.role);
    const isAdmin = roles.includes('admin');
    const isStaff = roles.includes('staff');
    const isRequester = provision.requested_by === user.id;

    // Authorization check
    const requestedFields = Object.keys(updates);
    const hasStaffFields = requestedFields.some(f => STAFF_FIELDS.includes(f));
    const hasNotesOnly = requestedFields.length === 1 && requestedFields[0] === 'notes';

    if (hasStaffFields && !isAdmin && !isStaff) {
      return new Response(JSON.stringify({ error: 'Only staff/admin can update fulfillment fields' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (hasNotesOnly && !isAdmin && !isStaff && isRequester && provision.status !== 'draft') {
      return new Response(JSON.stringify({ error: 'Requester can only edit notes on draft provisions' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isAdmin && !isStaff && !isRequester) {
      return new Response(JSON.stringify({ error: 'No permission to update this provision' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate status
    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return new Response(JSON.stringify({ error: `Invalid status: ${updates.status}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (updates.delivery_status && !VALID_DELIVERY.includes(updates.delivery_status)) {
      return new Response(JSON.stringify({ error: `Invalid delivery_status: ${updates.delivery_status}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build update payload — only allowed fields
    const updatePayload: Record<string, any> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (['notes', 'status', 'assigned_to', 'tracking_carrier', 'tracking_number', 'delivery_status'].includes(key)) {
        updatePayload[key] = val;
      }
    }

    const now = new Date().toISOString();

    if (updates.status === 'submitted' && !provision.submitted_at) updatePayload.submitted_at = now;
    if (updates.status === 'ordered' && !provision.ordered_at) updatePayload.ordered_at = now;
    if (updates.status === 'shipped' && !provision.shipped_at) updatePayload.shipped_at = now;
    if (updates.status === 'delivered' && !provision.delivered_at) updatePayload.delivered_at = now;
    if (updates.status === 'canceled' && !provision.canceled_at) updatePayload.canceled_at = now;

    // Perform update
    const { data: updated, error: updateErr } = await adminClient
      .from('provisions')
      .update(updatePayload)
      .eq('id', provision_id)
      .select()
      .single();

    if (updateErr) {
      return new Response(JSON.stringify({ error: 'Failed to update', detail: updateErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── PART 1: Delivery → opportunity_signal (idempotent) ──
    const deliveryJustHappened =
      updates.delivery_status === 'delivered' &&
      provision.delivery_status !== 'delivered';

    if (deliveryJustHappened && provision.opportunity_id) {
      // Check idempotency — only insert once per provision
      const signalFingerprint = `provision_delivered:${provision_id}`;
      const { data: existing } = await adminClient
        .from('opportunity_signals')
        .select('id')
        .eq('signal_fingerprint', signalFingerprint)
        .limit(1);

      if (!existing || existing.length === 0) {
        // Create a lightweight automation_run record for the FK
        const runId = crypto.randomUUID();
        await adminClient.from('automation_runs').insert({
          run_id: runId,
          workflow_key: 'provision_delivery_signal',
          status: 'completed',
          received_at: now,
          processed_at: now,
          metro_id: provision.metro_id || null,
          org_id: provision.opportunity_id,
        });

        await adminClient.from('opportunity_signals').insert({
          opportunity_id: provision.opportunity_id,
          run_id: runId,
          signal_type: 'provision_delivered',
          signal_value: 'Devices delivered to partner',
          confidence: 1.0,
          detected_at: now,
          signal_fingerprint: signalFingerprint,
          source_type: 'provisions',
          source_id: provision_id,
        });
      }
    }

    // ── Resolve recipient for notifications ──
    const resolveRecipient = (): string | null => {
      if (provision.requested_by) return provision.requested_by;
      if (provision.assigned_to) return provision.assigned_to;
      const opp = provision.opportunities as any;
      if (opp?.owner_id) return opp.owner_id;
      return null;
    };

    // ── Notifications ──
    const notifications: any[] = [];

    if (updates.assigned_to && updates.assigned_to !== provision.assigned_to) {
      notifications.push({
        user_id: updates.assigned_to,
        notification_type: 'provision_assigned',
        title: 'Provision Assigned',
        body: 'You have been assigned a new provision to fulfill.',
        priority: 'medium',
        payload: { provision_id, dedupe_key: `assigned:${provision_id}:${updates.assigned_to}` },
      });
    }

    // HARDENED: Only fire tracking notification when value actually changes
    if (updates.tracking_number &&
        updates.tracking_number.trim() !== '' &&
        updates.tracking_number !== provision.tracking_number) {
      const recipientId = resolveRecipient();
      if (recipientId) {
        notifications.push({
          user_id: recipientId,
          notification_type: 'provision_tracking_added',
          title: 'Tracking Number Added',
          body: `Tracking: ${updates.tracking_number}`,
          priority: 'medium',
          payload: { provision_id, dedupe_key: `tracking:${provision_id}:${updates.tracking_number}` },
        });
      }
    }

    if (updates.delivery_status && updates.delivery_status !== provision.delivery_status) {
      const recipientId = resolveRecipient();
      if (recipientId) {
        notifications.push({
          user_id: recipientId,
          notification_type: 'provision_delivery_update',
          title: 'Delivery Update',
          body: `Delivery status: ${updates.delivery_status}`,
          priority: updates.delivery_status === 'delivered' ? 'high' : 'medium',
          payload: { provision_id, dedupe_key: `delivery:${provision_id}:${updates.delivery_status}:${now}` },
        });
      }

      // ── PART 4: Delivery moment → narrative highlight ──
      if (updates.delivery_status === 'delivered' && provision.metro_id) {
        try {
          // Find or skip if no discovery run exists for this metro
          const { data: latestRun } = await adminClient
            .from('discovery_runs')
            .select('id')
            .eq('metro_id', provision.metro_id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (latestRun && latestRun.length > 0) {
            await adminClient.from('discovery_highlights').insert({
              run_id: latestRun[0].id,
              module: 'provisions',
              kind: 'impact_moment',
              payload: {
                summary: 'Devices delivered to a partner in this metro',
                quantity: provision.total_quantity,
                provision_id: provision_id,
              },
            });
          }
        } catch (e) {
          // Non-blocking — log but don't fail
          console.error('Narrative highlight insert error:', e);
        }
      }
    }

    if (updates.status && updates.status !== provision.status) {
      const recipientId = resolveRecipient();
      if (recipientId) {
        notifications.push({
          user_id: recipientId,
          notification_type: 'provision_status_changed',
          title: 'Provision Status Updated',
          body: `Status changed to: ${updates.status}`,
          priority: 'medium',
          payload: { provision_id, dedupe_key: `status:${provision_id}:${updates.status}:${now}` },
        });
      }
    }

    // Filter out any notifications with null user_id (HARDENED: Part 7)
    const validNotifications = notifications.filter(n => n.user_id != null);

    if (validNotifications.length > 0) {
      const { error: notifErr } = await adminClient
        .from('proactive_notifications')
        .insert(validNotifications);
      if (notifErr) {
        console.error('Notification insert error:', notifErr);
      }
    }

    return new Response(JSON.stringify({ provision: updated }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('provision-update error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
