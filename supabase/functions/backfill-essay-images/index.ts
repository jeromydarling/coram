/**
 * backfill-essay-images — Generates images for all published essays that lack one.
 *
 * WHAT: Iterates published operator_content_drafts missing hero_image_url, generates B&W Americana sketches.
 * WHERE: One-time invocation endpoint for backfilling existing content.
 * WHY: Ensures all existing published essays get imagery retroactively.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', user.id);
    const isOperator = roles?.some(r => ['admin', 'operator', 'gardener'].includes(r.role));
    if (!isOperator) {
      return new Response(JSON.stringify({ ok: false, error: 'Insufficient permissions' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find published essays without images in operator_content_drafts
    const { data: essays, error: fetchErr } = await adminClient
      .from('operator_content_drafts')
      .select('id, title, body')
      .eq('status', 'published')
      .is('hero_image_url', null)
      .order('published_at', { ascending: false });

    if (fetchErr) throw new Error(`Fetch failed: ${fetchErr.message}`);
    if (!essays || essays.length === 0) {
      return new Response(JSON.stringify({ ok: true, count: 0, message: 'No essays need imagery' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: { id: string; title: string; ok: boolean; error?: string }[] = [];

    for (const essay of essays) {
      try {
        const excerpt = essay.body?.replace(/[#*_\n]/g, ' ').slice(0, 200) || '';
        const prompt = `A minimalist black and white ink sketch in classic Americana style. The subject should evoke the theme: "${essay.title}". Context: ${excerpt}. Style: fine pen strokes on aged white paper, reminiscent of early American engravings and woodcuts. No text, no words, no letters. Clean composition with generous negative space. Horizontal 16:9 aspect ratio.`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        let imageUrl: string;
        try {
          const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-image',
              messages: [{ role: 'user', content: prompt }],
              modalities: ['image', 'text'],
            }),
            signal: controller.signal,
          });

          if (!aiRes.ok) throw new Error(`AI ${aiRes.status}`);
          const aiData = await aiRes.json();
          const base64Url = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (!base64Url) throw new Error('No image returned');
          imageUrl = base64Url;
        } finally {
          clearTimeout(timeout);
        }

        const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const filePath = `${essay.id}.png`;
        const { error: uploadErr } = await adminClient.storage
          .from('essay-images')
          .upload(filePath, bytes.buffer, { contentType: 'image/png', upsert: true });
        if (uploadErr) throw new Error(`Upload: ${uploadErr.message}`);

        const { data: publicUrl } = adminClient.storage.from('essay-images').getPublicUrl(filePath);

        await adminClient
          .from('operator_content_drafts')
          .update({ hero_image_url: publicUrl.publicUrl })
          .eq('id', essay.id);

        results.push({ id: essay.id, title: essay.title, ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        results.push({ id: essay.id, title: essay.title, ok: false, error: msg });
      }

      // Rate limit: 2s between generations
      await new Promise(r => setTimeout(r, 2000));
    }

    const successCount = results.filter(r => r.ok).length;
    return new Response(JSON.stringify({
      ok: true,
      total: essays.length,
      success: successCount,
      failed: essays.length - successCount,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
