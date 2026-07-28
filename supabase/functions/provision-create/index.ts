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
    // Auth: get user from token
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

    // Check role: deny warehouse_manager
    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (userRoles || []).map((r: any) => r.role);
    if (roles.includes('warehouse_manager')) {
      return new Response(JSON.stringify({ error: 'Warehouse managers cannot create provisions' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isAdmin = roles.includes('admin');
    const isLeadership = roles.includes('leadership');

    const body = await req.json();
    const {
      opportunity_id, items, notes, assigned_to,
      // New invoice fields
      invoice_type, invoice_date, business_unit, client_id,
      business_name, business_address, business_city, business_state, business_zip,
      contact_name, contact_email, payment_due_date,
    } = body;

    if (!opportunity_id) {
      return new Response(JSON.stringify({ error: 'opportunity_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one item is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get opportunity + metro
    const { data: opp, error: oppError } = await adminClient
      .from('opportunities')
      .select('id, metro_id, owner_id')
      .eq('id', opportunity_id)
      .single();

    if (oppError || !opp) {
      return new Response(JSON.stringify({ error: 'Opportunity not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check metro access (unless admin/leadership)
    if (!isAdmin && !isLeadership) {
      const { data: access } = await adminClient
        .from('user_metro_assignments')
        .select('id')
        .eq('user_id', user.id)
        .eq('metro_id', opp.metro_id)
        .limit(1);

      if (!access || access.length === 0) {
        return new Response(JSON.stringify({ error: 'No metro access for this opportunity' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch catalog items for price snapshots
    const catalogIds = items.map((i: any) => i.catalog_item_id).filter(Boolean);
    let catalogMap: Record<string, any> = {};

    if (catalogIds.length > 0) {
      const { data: catalogItems } = await adminClient
        .from('provision_catalog_items')
        .select('*')
        .in('id', catalogIds)
        .eq('active', true);

      if (catalogItems) {
        for (const ci of catalogItems) {
          catalogMap[ci.id] = ci;
        }
      }
    }

    // Build provision items with snapshot prices
    let totalCents = 0;
    let totalQuantity = 0;
    const provisionItems: any[] = [];

    for (const item of items) {
      const catalogItem = item.catalog_item_id ? catalogMap[item.catalog_item_id] : null;
      const qty = Math.max(1, Math.floor(item.quantity || 1));
      const unitPrice = catalogItem ? catalogItem.unit_price_cents : (item.unit_price_cents || 0);
      const itemName = catalogItem ? catalogItem.name : (item.item_name || 'Custom item');
      const tier = catalogItem ? catalogItem.tier : (item.tier || null);
      const lineTotal = unitPrice * qty;

      totalCents += lineTotal;
      totalQuantity += qty;

      provisionItems.push({
        catalog_item_id: item.catalog_item_id || null,
        item_name: itemName,
        tier,
        unit_price_cents: unitPrice,
        quantity: qty,
        line_total_cents: lineTotal,
        product_name: item.product_name || itemName,
        gl_account: item.gl_account || (catalogItem ? catalogItem.default_gl_account : null) || null,
      });
    }

    // Create provision with invoice fields
    const { data: provision, error: provError } = await adminClient
      .from('provisions')
      .insert({
        opportunity_id,
        metro_id: opp.metro_id,
        requested_by: user.id,
        assigned_to: assigned_to || null,
        status: 'draft',
        source: 'native',
        notes: notes || null,
        total_cents: totalCents,
        total_quantity: totalQuantity,
        // Invoice fields
        invoice_type: invoice_type || 'Due',
        invoice_date: invoice_date || null,
        business_unit: business_unit || null,
        client_id: client_id || null,
        business_name: business_name || null,
        business_address: business_address || null,
        business_city: business_city || null,
        business_state: business_state || null,
        business_zip: business_zip || null,
        contact_name: contact_name || null,
        contact_email: contact_email || null,
        payment_due_date: payment_due_date || null,
      })
      .select()
      .single();

    if (provError) {
      console.error('Provision insert error:', provError);
      return new Response(JSON.stringify({ error: 'Failed to create provision', detail: provError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert items
    const itemsToInsert = provisionItems.map((pi) => ({
      ...pi,
      provision_id: provision.id,
    }));

    const { error: itemsError } = await adminClient
      .from('provision_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Items insert error:', itemsError);
    }

    return new Response(JSON.stringify({ provision, items: itemsToInsert }), {
      status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('provision-create error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
