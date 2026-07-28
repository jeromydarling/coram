// Import Schola content sources (RSS feeds, items, essay templates) into thecros.
// One-shot operator tool. Calls Schola's export-content-sources edge function
// with a shared secret, then upserts into thecros tables. Idempotent via ON CONFLICT.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SCHOLA_EXPORT_URL =
  'https://kpcannnhenymymnhpwib.supabase.co/functions/v1/export-content-sources';

type ScholaFeed = {
  id: string;
  feed_url: string;
  feed_name?: string;
  category?: string;
  is_active?: boolean;
  last_fetched_at?: string | null;
  created_at?: string;
  source_type?: string;
};

type ScholaItem = {
  id: string;
  feed_id: string;
  title?: string;
  url?: string;
  published_at?: string | null;
  summary?: string | null;
  fetched_at?: string | null;
  created_at?: string;
  guid?: string;
  author?: string;
  content?: string;
};

type ScholaTemplate = {
  id: string;
  category?: string;
  title_pattern?: string;
  cadence_week?: number;
  audience?: string;
  tone?: string;
  system_prompt?: string;
  standing_data?: unknown;
  seo_targets?: unknown;
  voice_notes?: string;
  created_at?: string;
  updated_at?: string;
};

type ScholaExport = {
  feeds: ScholaFeed[];
  items: ScholaItem[];
  templates: ScholaTemplate[];
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const scholaSecret = Deno.env.get('SCHOLA_INGEST_SECRET');
  const authHeader = req.headers.get('Authorization');

  if (!scholaSecret) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'SCHOLA_INGEST_SECRET environment variable is not configured',
      code: 'MISSING_SCHOLA_SECRET',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing auth' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Confirm operator (gardener or admin)
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id);
  const isOperator = roles?.some((r) => r.role === 'admin' || r.role === 'gardener');
  if (!isOperator) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const summary = {
    sources_imported: 0,
    items_imported: 0,
    templates_imported: 0,
    errors: [] as string[],
  };

  // Fetch full export from Schola in one call.
  let payload: ScholaExport;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch(SCHOLA_EXPORT_URL, {
        method: 'GET',
        headers: { 'x-shared-secret': scholaSecret },
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        return new Response(JSON.stringify({
          ok: false,
          error: `Schola export failed: ${res.status} ${text.slice(0, 300)}`,
          code: 'SCHOLA_EXPORT_FAILED',
        }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      payload = await res.json();
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      error: `Schola export fetch error: ${(e as Error).message}`,
      code: 'SCHOLA_EXPORT_ERROR',
    }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const feeds = Array.isArray(payload?.feeds) ? payload.feeds : [];
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const templates = Array.isArray(payload?.templates) ? payload.templates : [];

  // a) RSS feeds -> operator_rss_sources
  const feedIdMap = new Map<string, string>(); // schola feed id -> thecros source id
  for (const f of feeds) {
    try {
      if (!f.feed_url) {
        summary.errors.push(`feed ${f.id}: missing feed_url`);
        continue;
      }
      const { data, error } = await admin
        .from('operator_rss_sources')
        .upsert({
          name: f.feed_name ?? f.feed_url,
          url: f.feed_url,
          category: f.category ?? 'nonprofit_news',
          enabled: f.is_active ?? true,
          source_app: 'theschola',
          created_by: user.id,
        }, { onConflict: 'url', ignoreDuplicates: false })
        .select('id')
        .single();
      if (error) throw error;
      if (data) {
        feedIdMap.set(f.id, data.id);
        summary.sources_imported++;
      }
    } catch (e) {
      summary.errors.push(`feed ${f.id}: ${(e as Error).message}`);
    }
  }

  // b) Feed items -> operator_rss_items
  for (const it of items) {
    try {
      const sourceId = feedIdMap.get(it.feed_id);
      if (!sourceId) continue; // skip if no matching source
      const guid = it.guid ?? it.url;
      if (!guid) continue;
      const { error } = await admin
        .from('operator_rss_items')
        .upsert({
          source_id: sourceId,
          guid,
          title: it.title ?? '(untitled)',
          link: it.url ?? null,
          published_at: it.published_at ?? null,
          summary: it.summary ?? null,
          fetched_at: it.fetched_at ?? undefined,
          source_app: 'theschola',
        }, { onConflict: 'source_id,guid', ignoreDuplicates: true });
      if (error) throw error;
      summary.items_imported++;
    } catch (e) {
      summary.errors.push(`item ${it.id}: ${(e as Error).message}`);
    }
  }

  // c) Essay templates -> essay_templates (no unique constraint; plain insert)
  for (const t of templates) {
    try {
      const { error } = await admin
        .from('essay_templates')
        .insert({
          name: t.title_pattern || t.category || 'Untitled',
          prompt: t.system_prompt ?? '',
          voice_notes: t.voice_notes ?? null,
          category: t.category ?? null,
          source_app: 'theschola',
          enabled: true,
          created_by: user.id,
        });
      if (error) throw error;
      summary.templates_imported++;
    } catch (e) {
      summary.errors.push(`template ${t.id ?? t.category}: ${(e as Error).message}`);
    }
  }

  return new Response(JSON.stringify({ ok: true, ...summary }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
