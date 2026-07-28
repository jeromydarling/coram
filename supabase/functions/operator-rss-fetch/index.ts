/**
 * operator-rss-fetch — Pulls RSS feeds for operator content curation.
 *
 * WHAT: Fetches and parses RSS XML, upserts items into operator_rss_items.
 * WHERE: Called from Operator Nexus Content page.
 * WHY: Provides interim narrative content while tenant stories ramp up.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Decode HTML entities and fix common encoding artifacts */
function cleanText(raw: string): string {
  if (!raw) return raw;
  let s = raw;
  // HTML numeric entities
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  // HTML hex entities
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  // Named HTML entities
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&apos;': "'", '&lsquo;': '\u2018', '&rsquo;': '\u2019',
    '&ldquo;': '\u201C', '&rdquo;': '\u201D', '&mdash;': '\u2014',
    '&ndash;': '\u2013', '&hellip;': '\u2026', '&nbsp;': ' ',
    '&trade;': '\u2122', '&copy;': '\u00A9', '&reg;': '\u00AE',
  };
  for (const [ent, ch] of Object.entries(entities)) {
    s = s.replaceAll(ent, ch);
  }
  // Fix mojibake: common UTF-8 decoded as Windows-1252
  const mojibake: Record<string, string> = {
    '\u00E2\u0080\u0099': '\u2019', // '
    '\u00E2\u0080\u009C': '\u201C', // "
    '\u00E2\u0080\u009D': '\u201D', // "
    '\u00E2\u0080\u0093': '\u2013', // –
    '\u00E2\u0080\u0094': '\u2014', // —
    '\u00E2\u0080\u00A6': '\u2026', // …
    '\u00E2\u0080\u0098': '\u2018', // '
    '\u00C3\u00A9': '\u00E9',       // é
  };
  for (const [garbled, fixed] of Object.entries(mojibake)) {
    s = s.replaceAll(garbled, fixed);
  }
  // Also catch the raw byte patterns that sometimes appear as â€™ etc.
  s = s.replace(/â€™/g, '\u2019');
  s = s.replace(/â€œ/g, '\u201C');
  s = s.replace(/â€\u009D/g, '\u201D');
  s = s.replace(/â€"/g, '\u2014');
  s = s.replace(/â€"/g, '\u2013');
  s = s.replace(/â€¦/g, '\u2026');
  s = s.replace(/â€˜/g, '\u2018');
  // Normalize smart quotes to straight quotes for cleanliness
  s = s.replace(/[\u2018\u2019]/g, "'");
  s = s.replace(/[\u201C\u201D]/g, '"');
  s = s.replace(/\u2014/g, ' — ');
  s = s.replace(/\u2013/g, ' – ');
  s = s.replace(/\u2026/g, '...');
  return s.trim();
}

function extractText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, 's'));
  return match ? cleanText(match[1].trim()) : '';
}

function parseRssItems(xml: string): Array<{ guid: string; title: string; link: string; published_at: string | null; author: string | null; summary: string | null; content: string | null }> {
  const items: any[] = [];
  const itemMatches = xml.match(/<item[\s>].*?<\/item>/gs) || [];
  
  for (const itemXml of itemMatches.slice(0, 50)) {
    const title = extractText(itemXml, 'title');
    const link = extractText(itemXml, 'link');
    const guid = extractText(itemXml, 'guid') || link || title;
    const pubDate = extractText(itemXml, 'pubDate');
    const author = extractText(itemXml, 'author') || extractText(itemXml, 'dc:creator') || null;
    const description = extractText(itemXml, 'description');
    const contentEncoded = extractText(itemXml, 'content:encoded');

    if (!title || !guid) continue;

    // Strip any remaining HTML tags from summary/content
    const stripHtml = (s: string | null) => s ? s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : null;

    items.push({
      guid,
      title: title.slice(0, 500),
      link: link.slice(0, 2000),
      published_at: pubDate ? new Date(pubDate).toISOString() : null,
      author: author?.slice(0, 200) || null,
      summary: stripHtml(description)?.slice(0, 2000) || null,
      content: stripHtml(contentEncoded || description)?.slice(0, 10000) || null,
    });
  }
  return items;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: corsHeaders });

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', user.id);
    if (!roles?.some((r: any) => r.role === 'admin')) {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
    }

    // Rate limit
    const { data: rlOk } = await adminClient.rpc('check_and_increment_rate_limit', {
      p_user_id: user.id, p_function_name: 'operator-rss-fetch', p_window_minutes: 60, p_max_requests: 6,
    });
    if (rlOk === false) return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const sourceId = body.source_id;

    // Fetch sources
    let query = adminClient.from('operator_rss_sources').select('*').eq('enabled', true);
    if (sourceId) query = query.eq('id', sourceId);
    const { data: sources, error: srcErr } = await query.limit(100);
    if (srcErr) throw srcErr;

    const results: Record<string, number> = {};

    for (const source of sources || []) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(source.url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) { results[source.name] = 0; continue; }

        const xml = await res.text();
        const items = parseRssItems(xml);

        let inserted = 0;
        for (const item of items) {
          const { error } = await adminClient.from('operator_rss_items').upsert({
            source_id: source.id,
            ...item,
          }, { onConflict: 'source_id,guid' });
          if (!error) inserted++;
        }
        results[source.name] = inserted;
      } catch (e) {
        results[source.name] = 0;
        console.error(`RSS fetch error for ${source.name}:`, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, results, sources_processed: Object.keys(results).length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('operator-rss-fetch error:', e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
