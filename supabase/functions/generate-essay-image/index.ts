/**
 * generate-essay-image — Generates a B&W Americana sketch image for an essay.
 *
 * WHAT: Takes essay title + excerpt, generates a minimalist black-and-white sketch, stores in essay-images bucket.
 * WHERE: Called from useEssayPublish hook on publish/ready_for_review.
 * WHY: Each essay gets a unique, thematically appropriate hero image matching CROS aesthetic.
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

    // Validate roles
    const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', user.id);
    const isOperator = roles?.some(r => ['admin', 'operator', 'gardener'].includes(r.role));
    if (!isOperator) {
      return new Response(JSON.stringify({ ok: false, error: 'Insufficient permissions' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { essay_id, title, excerpt, table_name } = await req.json();
    if (!essay_id || !title) {
      return new Response(JSON.stringify({ ok: false, error: 'essay_id and title required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tableName = table_name === 'library_essays' ? 'library_essays' : 'operator_content_drafts';

    // Generate image via Lovable AI
    const prompt = `A minimalist black and white ink sketch in classic Americana style. The subject should evoke the theme: "${title}". ${excerpt ? `Context: ${excerpt.slice(0, 200)}` : ''} Style: fine pen strokes on aged white paper, reminiscent of early American engravings and woodcuts. No text, no words, no letters. Clean composition with generous negative space. Horizontal 16:9 aspect ratio.`;

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

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        throw new Error(`AI generation failed: ${aiRes.status} ${errText}`);
      }

      const aiData = await aiRes.json();
      const base64Url = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!base64Url) throw new Error('No image returned from AI');
      imageUrl = base64Url;
    } finally {
      clearTimeout(timeout);
    }

    // Extract base64 data and upload to storage
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const filePath = `${essay_id}.png`;
    const { error: uploadErr } = await adminClient.storage
      .from('essay-images')
      .upload(filePath, bytes.buffer, {
        contentType: 'image/png',
        upsert: true,
      });
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    const { data: publicUrl } = adminClient.storage
      .from('essay-images')
      .getPublicUrl(filePath);

    // Update the essay record
    const { error: updateErr } = await adminClient
      .from(tableName)
      .update({ hero_image_url: publicUrl.publicUrl })
      .eq('id', essay_id);
    if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

    return new Response(JSON.stringify({
      ok: true,
      hero_image_url: publicUrl.publicUrl,
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
