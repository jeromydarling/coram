// console-apps-update — Federation Apps Registry write API
// WHAT: Updates tier/status/notes (and selected metadata) on a federation_apps row.
// WHERE: POST /functions/v1/console-apps-update  { source_app, tier?, status?, notes?, seo_active?, is_critical? }
// WHY:  Side-drawer edits from /operator/console/apps. Auth: caller must be a
//       gardener (validated via JWT + gardener_grants), then we write with service role.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_TIER = new Set(['hub', 'federation', 'adjacent', 'excluded']);
const ALLOWED_STATUS = new Set(['active', 'prelaunch', 'paused', 'sunsetting', 'archived']);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = auth.slice('Bearer '.length);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Gardener guard: must hold an active gardener_grants row
    const { data: grant } = await admin
      .from('gardener_grants')
      .select('gardener_id')
      .eq('gardener_id', userId)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .maybeSingle();
    if (!grant) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({} as any));
    const sourceApp: string | undefined = body.source_app ?? body.slug;
    if (!sourceApp || typeof sourceApp !== 'string') {
      return new Response(JSON.stringify({ error: 'source_app required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.tier === 'string') {
      if (!ALLOWED_TIER.has(body.tier)) {
        return new Response(JSON.stringify({ error: 'invalid tier' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      patch.tier = body.tier;
    }
    if (typeof body.status === 'string') {
      if (!ALLOWED_STATUS.has(body.status)) {
        return new Response(JSON.stringify({ error: 'invalid status' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      patch.status = body.status;
    }
    if (typeof body.notes === 'string' || body.notes === null) patch.notes = body.notes;
    if (typeof body.seo_active === 'boolean') patch.seo_active = body.seo_active;
    if (typeof body.is_critical === 'boolean') patch.is_critical = body.is_critical;

    if (Object.keys(patch).length === 0) {
      return new Response(JSON.stringify({ error: 'nothing to update' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await admin
      .from('federation_apps')
      .update(patch)
      .eq('slug', sourceApp)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, app: { ...data, source_app: (data as any).slug } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
