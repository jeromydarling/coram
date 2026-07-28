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

    // Admin only
    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (userRoles || []).map((r: any) => r.role);
    if (!roles.includes('admin')) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { records } = await req.json();

    if (!Array.isArray(records) || records.length === 0) {
      return new Response(JSON.stringify({ error: 'records array is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        if (!record.opportunity_id) {
          errors.push({ index: i, error: 'Missing opportunity_id' });
          continue;
        }

        // Get opportunity metro
        const { data: opp } = await adminClient
          .from('opportunities')
          .select('metro_id')
          .eq('id', record.opportunity_id)
          .single();

        if (!opp) {
          errors.push({ index: i, error: 'Opportunity not found' });
          continue;
        }

        const status = record.delivered_at ? 'delivered' : (record.shipped_at ? 'shipped' : (record.ordered_at ? 'ordered' : 'submitted'));

        const { data: provision, error: provErr } = await adminClient
          .from('provisions')
          .insert({
            opportunity_id: record.opportunity_id,
            metro_id: opp.metro_id,
            requested_by: user.id,
            assigned_to: record.assigned_to || null,
            status,
            source: 'imported',
            external_order_ref: record.external_order_ref || null,
            notes: record.notes || null,
            tracking_carrier: record.tracking_carrier || null,
            tracking_number: record.tracking_number || null,
            delivery_status: record.delivered_at ? 'delivered' : (record.tracking_number ? 'in_transit' : null),
            total_cents: record.total_cents || 0,
            total_quantity: record.total_quantity || 0,
            submitted_at: record.submitted_at || new Date().toISOString(),
            ordered_at: record.ordered_at || null,
            shipped_at: record.shipped_at || null,
            delivered_at: record.delivered_at || null,
          })
          .select()
          .single();

        if (provErr) {
          errors.push({ index: i, error: provErr.message });
          continue;
        }

        // Insert items if provided
        if (record.items && Array.isArray(record.items) && record.items.length > 0) {
          const itemsToInsert = record.items.map((item: any) => ({
            provision_id: provision.id,
            catalog_item_id: item.catalog_item_id || null,
            item_name: item.item_name || item.name || 'Imported item',
            tier: item.tier || null,
            unit_price_cents: item.unit_price_cents || 0,
            quantity: item.quantity || 1,
            line_total_cents: (item.unit_price_cents || 0) * (item.quantity || 1),
          }));

          await adminClient.from('provision_items').insert(itemsToInsert);
        }

        results.push({ index: i, provision_id: provision.id, status });
      } catch (err) {
        errors.push({ index: i, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return new Response(JSON.stringify({ imported: results.length, errors: errors.length, results, errors }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('provision-import-bulk error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
