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

    const { provision_id, body: messageBody } = await req.json();

    if (!provision_id || !messageBody) {
      return new Response(JSON.stringify({ error: 'provision_id and body are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trimmedBody = messageBody.trim();
    if (trimmedBody.length === 0 || trimmedBody.length > 4000) {
      return new Response(JSON.stringify({ error: 'Body must be 1-4000 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch provision
    const { data: provision, error: fetchErr } = await adminClient
      .from('provisions')
      .select('*, opportunities(owner_id)')
      .eq('id', provision_id)
      .single();

    if (fetchErr || !provision) {
      return new Response(JSON.stringify({ error: 'Provision not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Access check: must be requester, assignee, admin, leadership, staff, or have metro access
    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (userRoles || []).map((r: any) => r.role);
    const isPrivileged = roles.some((r: string) => ['admin', 'leadership', 'staff'].includes(r));
    const isParticipant = provision.requested_by === user.id || provision.assigned_to === user.id;

    if (!isPrivileged && !isParticipant) {
      // Check metro access
      const { data: access } = await adminClient
        .from('user_metro_assignments')
        .select('id')
        .eq('user_id', user.id)
        .eq('metro_id', provision.metro_id)
        .limit(1);

      if (!access || access.length === 0) {
        return new Response(JSON.stringify({ error: 'No access to this provision' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Insert message
    const { data: message, error: msgErr } = await adminClient
      .from('provision_messages')
      .insert({
        provision_id,
        author_id: user.id,
        body: trimmedBody,
      })
      .select()
      .single();

    if (msgErr) {
      return new Response(JSON.stringify({ error: 'Failed to create message', detail: msgErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Notify counterpart
    let recipientId: string | null = null;
    if (user.id === provision.requested_by && provision.assigned_to) {
      recipientId = provision.assigned_to;
    } else if (user.id === provision.assigned_to && provision.requested_by) {
      recipientId = provision.requested_by;
    } else if (provision.requested_by && provision.requested_by !== user.id) {
      recipientId = provision.requested_by;
    } else if (provision.assigned_to && provision.assigned_to !== user.id) {
      recipientId = provision.assigned_to;
    } else {
      const opp = provision.opportunities as any;
      if (opp?.owner_id && opp.owner_id !== user.id) {
        recipientId = opp.owner_id;
      }
    }

    if (recipientId) {
      await adminClient.from('proactive_notifications').insert({
        user_id: recipientId,
        notification_type: 'provision_message',
        title: 'New Provision Message',
        body: trimmedBody.slice(0, 200),
        priority: 'medium',
        payload: {
          provision_id,
          message_id: message.id,
          dedupe_key: `msg:${message.id}`,
        },
      });
    }

    return new Response(JSON.stringify({ message }), {
      status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('provision-message-create error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
