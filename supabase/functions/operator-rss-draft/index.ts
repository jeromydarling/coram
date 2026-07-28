/**
 * operator-rss-draft — Generates NRI-voiced essay drafts from RSS items.
 *
 * WHAT: Takes selected RSS items and produces a calm, reflective essay draft.
 * WHERE: Called from Operator Editorial Studio.
 * WHY: Interim narrative content while tenant stories are still forming.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    console.log('[operator-rss-draft] request received');
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('[operator-rss-draft] no auth header');
      return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) {
      console.log('[operator-rss-draft] auth failed:', authErr?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    console.log('[operator-rss-draft] authed:', user.id);

    // Role check
    const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', user.id);
    if (!roles?.some((r: any) => r.role === 'admin')) {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { draft_type = 'essay', item_ids = [], voice_profile = 'cros_nri', category = '', regenerate_id = null } = body;
    console.log('[operator-rss-draft] params:', JSON.stringify({ draft_type, item_count: item_ids.length, regenerate_id }));

    // Fetch selected items (may be empty if items were cleared since draft creation)
    let items: any[] = [];
    if (item_ids.length) {
      const { data, error: itemsErr } = await adminClient.from('operator_rss_items')
        .select('title, summary, content, link, author, published_at')
        .in('id', item_ids);
      if (itemsErr) throw itemsErr;
      items = data || [];
    }

    // If regenerating and source items were deleted, use existing draft body as context
    let existingDraftBody = '';
    if (!items.length && regenerate_id) {
      const { data: existingDraft } = await adminClient.from('operator_content_drafts')
        .select('body, title').eq('id', regenerate_id).single();
      if (existingDraft?.body) {
        existingDraftBody = existingDraft.body;
        console.log('[operator-rss-draft] source items deleted, using existing draft as context');
      } else {
        return new Response(JSON.stringify({ error: 'Draft not found and source items no longer exist' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else if (!items.length) {
      return new Response(JSON.stringify({ error: 'No items selected' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Build context for NRI voice generation
    let articleSummaries: string;
    if (items.length) {
      articleSummaries = items.map((item: any, i: number) =>
        `Article ${i + 1}: "${item.title}"\n${item.summary || item.content?.slice(0, 500) || 'No summary available.'}\nSource: ${item.link}`
      ).join('\n\n');
      console.log('[operator-rss-draft] found', items.length, 'items');
    } else {
      articleSummaries = `Previous draft content to reimagine:\n\n${existingDraftBody.slice(0, 2000)}`;
      console.log('[operator-rss-draft] using existing draft body as context');
    }

    const categoryContext = category ? `\nThese articles all belong to the "${category}" category. Let this theme guide the narrative focus.` : '';

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.log('[operator-rss-draft] no LOVABLE_API_KEY, using fallback');
      const fallbackBody = items.map((item: any) =>
        `## ${item.title}\n\n${item.summary || 'A story worth reflecting on.'}\n\n[Read more](${item.link})`
      ).join('\n\n---\n\n');

      const fallbackTitle = category
        ? `${category} — ${draft_type === 'briefing' ? 'Weekly Briefing' : 'Reflection'}`
        : (draft_type === 'briefing' ? `Weekly Briefing — ${new Date().toLocaleDateString()}` : items[0].title);

      let draft;
      if (regenerate_id) {
        const { data, error: updateErr } = await adminClient.from('operator_content_drafts')
          .update({ title: fallbackTitle, body: fallbackBody, voice_origin: 'operator', collection: category || null, updated_at: new Date().toISOString() })
          .eq('id', regenerate_id).select('id').single();
        if (updateErr) throw updateErr;
        draft = data;
      } else {
        const slugBase = (items[0].title || 'draft').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
        const slug = `${slugBase}-${Date.now().toString(36)}`;
        const { data, error: draftErr } = await adminClient.from('operator_content_drafts').insert({
          draft_type, title: fallbackTitle, body: fallbackBody, slug,
          source_item_ids: item_ids, voice_profile, voice_origin: 'operator',
          collection: category || null,
          narrative_source: 'rss', is_interim_content: true,
          disclaimer: 'NRI-generated draft — Operator discernment required', created_by: user.id,
        }).select('id').single();
        if (draftErr) throw draftErr;
        draft = data;
      }

      return new Response(JSON.stringify({ ok: true, draft_id: draft.id, ai_generated: false, category }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate with NRI voice via Lovable AI
    console.log('[operator-rss-draft] calling AI gateway');
    const systemPrompt = `You are NRI (Narrative Relational Intelligence), the narrative voice of CROS — a Communal Relationship Operating System.

You are a WITNESS, not a commentator. A companion, not a lecturer. You notice movement — you do not explain meaning.

OBSERVER POSTURE:
- Never say: "This reveals…", "This demonstrates…", "This proves…", "We must…", "The truth is…"
- Instead use: "Taken together, these moments begin to suggest…", "Over time, these threads gather into…", "Some communities are discovering…", "Perhaps…", "It may be that…"
- Tone must feel curious and attentive, never authoritative.

CONCRETE IMAGERY (MANDATORY):
- Every reflection section must include at least one grounded, physical image.
- Examples: a shoebox packed at a kitchen table, volunteers clearing debris after a storm, a family entering a new home, shared meals, conversations, a quiet movement toward one another.
- If a paragraph has more than 3 abstract nouns, ground it with concrete imagery.

IGNATIAN CADENCE — structure for a ${draft_type}:
- Begin with a DESCRIPTIVE TITLE on the first line (a single # heading). The title must capture the essay's theme — NEVER use generic words like "Noticing" or "Reflection" alone. Example: "Hands Reaching Across Kitchen Tables" or "When Logistics Becomes Love".
- Then write the essay body using this flow:
1. Noticing — a grounded observation about what is unfolding (include a concrete image). The FIRST PARAGRAPH of the body (after the title) MUST be wrapped in an <h2> tag.
2. Reflection — what relational themes are gathering across these stories (one metaphor maximum)
3. What Some Are Discovering — what leaders and communities are finding, framed as observation not directive. Use phrases like "What some are discovering is…" or "In several places, people are finding…"
4. Quiet Pattern — a pattern emerging across communities, summarized with concrete grounding. NEVER reference "NRI" or any system name. Use indirect observation language like "Across many communities, a similar rhythm appears…", "A quiet pattern emerges…", "Again and again, people and resources move toward…"
5. Gentle Invitation — The sentence that introduces the closing questions (e.g. "As these stories settle, a few gentle questions remain…") MUST be wrapped in an <h3> tag. Then each of the 2-3 invitational questions MUST be wrapped in its own <blockquote> tag.
- Do NOT use section headers like "## Noticing" or "## Reflection" in the body. Let the prose flow naturally.
- NEVER reference "NRI", "the system", "our platform", or any internal tool name. The voice is human, not system-generated.

AUTHORITY REDUCTION (MANDATORY):
- Before finalizing, scan for phrases implying narrative dominance and soften them.
- Never teach lessons, deliver conclusions, or present moral directives.

SECTOR LANGUAGE GUARDRAIL:
- Never use: "nonprofit sector analysis", "faith-based industry trends", "ministry ecosystem commentary"
- Instead use: "lived moments", "relational observations", "human-scale storytelling", "community rhythms"

NARRATIVE WARMTH:
- Feel: Calm, present, grounded, hopeful without hype
- Never: promotional, triumphalistic, overly poetic, mystically abstract
- If tone exceeds poetic threshold (stacked metaphors, abstract emotional language), auto-ground with concrete imagery.

HARD RULES:
- Do NOT mention specific tenant names or organizations
- This is national/community context only
- Keep total length under 800 words
- Never use marketing language, CTAs, or listicle formatting
- Output the body as HTML (use <h1> for the title, <h2>, <h3>, <p>, <blockquote> tags). Do NOT use markdown syntax — output raw HTML tags only.${categoryContext}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please write a ${draft_type} based on these recent articles:\n\n${articleSummaries}` },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[operator-rss-draft] AI error:', response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited by AI gateway' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits needed' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const aiResult = await response.json();
    let generatedBody = aiResult.choices?.[0]?.message?.content || '';
    console.log('[operator-rss-draft] AI generated', generatedBody.length, 'chars');

    // Strip markdown code fences if AI wraps output in ```html blocks
    generatedBody = generatedBody.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // Extract title from <h1> tag or first line
    const h1Match = generatedBody.match(/<h1[^>]*>(.*?)<\/h1>/i);
    let title: string;
    if (h1Match) {
      title = h1Match[1].replace(/<[^>]*>/g, '').trim();
    } else {
      const lines = generatedBody.split('\n').filter((l: string) => l.trim());
      title = lines[0]?.replace(/^#+\s*/, '').replace(/\*+/g, '').replace(/<[^>]*>/g, '').trim() || '';
    }
    if (!title) title = `${category ? category + ' — ' : ''}${draft_type === 'briefing' ? 'Weekly Briefing' : 'Essay'} — ${new Date().toLocaleDateString()}`;
    if (title.length > 120) title = title.slice(0, 117) + '...';
    const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    let draft;
    if (regenerate_id) {
      const { data, error: updateErr } = await adminClient.from('operator_content_drafts')
        .update({ title, body: generatedBody, voice_origin: 'nri', collection: category || null, updated_at: new Date().toISOString() })
        .eq('id', regenerate_id).select('id').single();
      if (updateErr) throw updateErr;
      draft = data;
    } else {
      const { data, error: draftErr } = await adminClient.from('operator_content_drafts').insert({
        draft_type, title, body: generatedBody, slug,
        source_item_ids: item_ids, voice_profile, voice_origin: 'nri',
        collection: category || null,
        narrative_source: 'rss', is_interim_content: true,
        disclaimer: 'NRI-generated draft — Operator discernment required', created_by: user.id,
      }).select('id').single();
      if (draftErr) throw draftErr;
      draft = data;
    }

    console.log('[operator-rss-draft] success, draft_id=', draft.id);
    return new Response(JSON.stringify({ ok: true, draft_id: draft.id, ai_generated: true, category }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[operator-rss-draft] error:', e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
