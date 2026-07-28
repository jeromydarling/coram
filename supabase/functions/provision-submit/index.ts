import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { provision_id } = await req.json();
    if (!provision_id) {
      return new Response(JSON.stringify({ error: 'provision_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch provision with opportunity for owner resolution
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

    // Check: must be draft
    if (provision.status !== 'draft') {
      return new Response(JSON.stringify({ error: `Cannot submit: status is ${provision.status}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check: user must be requester or admin
    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (userRoles || []).map((r: any) => r.role);
    const isAdmin = roles.includes('admin');

    if (provision.requested_by !== user.id && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Only the requester or admin can submit' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();

    // ── PART 2: Auto-assign fulfillment owner if assigned_to is NULL ──
    let resolvedAssignee = provision.assigned_to;

    if (!resolvedAssignee) {
      const opp = provision.opportunities as any;

      // Priority 1: opportunity owner
      if (opp?.owner_id) {
        resolvedAssignee = opp.owner_id;
      }

      // Priority 2: staff user assigned to the metro
      if (!resolvedAssignee && provision.metro_id) {
        const { data: metroStaff } = await adminClient
          .from('user_metro_assignments')
          .select('user_id')
          .eq('metro_id', provision.metro_id);

        if (metroStaff && metroStaff.length > 0) {
          // Find a staff user among metro-assigned users
          const staffUserIds = metroStaff.map((m: any) => m.user_id);
          const { data: staffRoles } = await adminClient
            .from('user_roles')
            .select('user_id')
            .in('user_id', staffUserIds)
            .eq('role', 'staff')
            .limit(1);

          if (staffRoles && staffRoles.length > 0) {
            resolvedAssignee = staffRoles[0].user_id;
          }
        }
      }

      // Priority 3: admin fallback
      if (!resolvedAssignee) {
        const { data: adminUsers } = await adminClient
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin')
          .limit(1);

        if (adminUsers && adminUsers.length > 0) {
          resolvedAssignee = adminUsers[0].user_id;
        }
      }
    }

    // Update status + assigned_to
    const updatePayload: Record<string, any> = {
      status: 'submitted',
      submitted_at: now,
    };
    if (resolvedAssignee && !provision.assigned_to) {
      updatePayload.assigned_to = resolvedAssignee;
    }

    const { data: updated, error: updateErr } = await adminClient
      .from('provisions')
      .update(updatePayload)
      .eq('id', provision_id)
      .select()
      .single();

    if (updateErr) {
      return new Response(JSON.stringify({ error: 'Failed to submit', detail: updateErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Notifications
    const notifications: any[] = [];
    const dedupeKey = `status:${provision_id}:submitted:${now}`;

    // Notify the assignee about submission
    if (resolvedAssignee) {
      notifications.push({
        user_id: resolvedAssignee,
        notification_type: 'provision_status_changed',
        title: 'Provision Submitted',
        body: 'A provision has been submitted and is ready for review.',
        priority: 'medium',
        payload: { provision_id, status: 'submitted', dedupe_key: dedupeKey },
      });
    }

    // If auto-assigned, also send an assignment notification
    if (resolvedAssignee && !provision.assigned_to) {
      notifications.push({
        user_id: resolvedAssignee,
        notification_type: 'provision_assigned',
        title: 'Provision Assigned',
        body: 'You have been automatically assigned as fulfillment owner for a new provision.',
        priority: 'medium',
        payload: { provision_id, dedupe_key: `assigned:${provision_id}:${resolvedAssignee}` },
      });
    }

    // Filter null user_ids (safety)
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
    console.error('provision-submit error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
