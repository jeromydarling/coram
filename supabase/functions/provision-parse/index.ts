import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PARSE_SCHEMA = {
  type: 'object',
  properties: {
    external_order_ref: { type: 'string' },
    order_date: { type: 'string' },
    client_id: { type: 'string' },
    business_name: { type: 'string' },
    business_address: { type: 'string' },
    business_city: { type: 'string' },
    business_state: { type: 'string' },
    business_zip: { type: 'string' },
    contact_name: { type: 'string' },
    contact_email: { type: 'string' },
    invoice_date: { type: 'string' },
    payment_due_date: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          category: { type: 'string' },
          tier: { type: 'string' },
          quantity: { type: 'number' },
          unit_price_cents: { type: 'number' },
          product_name: { type: 'string' },
          gl_account: { type: 'string' },
        },
        required: ['name', 'quantity'],
      },
    },
    tracking_number: { type: 'string' },
    tracking_carrier: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['items'],
};

function validateParsedOutput(parsed: any): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, warnings: ['Parsed output is not an object'] };
  }

  if (!Array.isArray(parsed.items)) {
    return { valid: false, warnings: ['No items array found'] };
  }

  if (parsed.items.length === 0) {
    warnings.push('No items extracted');
  }

  for (let i = 0; i < parsed.items.length; i++) {
    const item = parsed.items[i];
    if (!item.name) warnings.push(`Item ${i}: missing name`);
    if (!item.quantity || item.quantity < 1) {
      warnings.push(`Item ${i}: invalid quantity, defaulting to 1`);
      item.quantity = 1;
    }
  }

  return { valid: warnings.length === 0 || parsed.items.length > 0, warnings };
}

function fuzzyMatch(text: string, target: string): number {
  const a = text.toLowerCase().trim();
  const b = target.toLowerCase().trim();
  if (a === b) return 1.0;
  if (b.includes(a) || a.includes(b)) return 0.8;

  // Simple word overlap
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

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

    const { raw_text, opportunity_id } = await req.json();

    if (!raw_text || typeof raw_text !== 'string' || raw_text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'raw_text is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!opportunity_id) {
      return new Response(JSON.stringify({ error: 'opportunity_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load catalog for context
    const { data: catalogItems } = await adminClient
      .from('provision_catalog_items')
      .select('id, category, tier, name, unit_price_cents')
      .eq('active', true);

    const catalogContext = (catalogItems || [])
      .map(c => `- ${c.category}${c.tier ? ` / ${c.tier}` : ''}: "${c.name}" at $${(c.unit_price_cents / 100).toFixed(2)}`)
      .join('\n');

    // Call Lovable AI (gemini-2.5-flash)
    const modelName = 'google/gemini-2.5-flash';
    let parsed: any = null;
    let parseWarnings: string[] = [];
    const model = modelName;

    try {
      const aiResponse = await fetch('https://api.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'system',
              content: `You are a data extraction assistant. Extract structured order/provision information from raw text.

Available catalog items:
${catalogContext}

Return ONLY valid JSON matching this schema:
{
  "external_order_ref": "string or null",
  "order_date": "YYYY-MM-DD or null",
  "client_id": "string or null",
  "business_name": "string or null",
  "business_address": "string or null",
  "business_city": "string or null",
  "business_state": "string or null",
  "business_zip": "string or null",
  "contact_name": "string or null",
  "contact_email": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "payment_due_date": "YYYY-MM-DD or null",
  "items": [
    {
      "name": "item name",
      "category": "Desktop|Laptop|Add-on|Accessory or null",
      "tier": "Good|Better|Best or null",
      "quantity": number,
      "unit_price_cents": number or null,
      "product_name": "string or null",
      "gl_account": "string or null"
    }
  ],
  "tracking_number": "string or null",
  "tracking_carrier": "string or null",
  "notes": "string or null"
}

Rules:
- Always return at least an empty items array
- Map items to catalog names when possible
- Convert dollar prices to cents (e.g. $85 = 8500)
- If quantity not specified, default to 1
- Do NOT invent gl_account values; only extract if explicitly present in the text
- If gl_account is missing, leave it null (do not guess)
- Return ONLY the JSON, no markdown or explanation`,
            },
            {
              role: 'user',
              content: raw_text.trim(),
            },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || '';

        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            parseWarnings.push('AI returned invalid JSON');
          }
        } else {
          parseWarnings.push('No JSON found in AI response');
        }
      } else {
        parseWarnings.push(`AI call failed: HTTP ${aiResponse.status}`);
      }
    } catch (aiErr) {
      parseWarnings.push(`AI error: ${aiErr instanceof Error ? aiErr.message : 'unknown'}`);
    }

    // Fallback: empty items
    if (!parsed) {
      parsed = { items: [], notes: raw_text.slice(0, 500) };
      parseWarnings.push('Using fallback: no items extracted');
    }

    // Validate
    const validation = validateParsedOutput(parsed);
    parseWarnings = [...parseWarnings, ...validation.warnings];

    // Fuzzy match catalog items
    if (parsed.items && catalogItems) {
      for (const item of parsed.items) {
        let bestMatch: any = null;
        let bestScore = 0;

        for (const cat of catalogItems) {
          const nameScore = fuzzyMatch(item.name || '', cat.name);
          // Boost if category/tier match
          let bonus = 0;
          if (item.category && cat.category && item.category.toLowerCase() === cat.category.toLowerCase()) bonus += 0.1;
          if (item.tier && cat.tier && item.tier.toLowerCase() === cat.tier.toLowerCase()) bonus += 0.1;
          const totalScore = nameScore + bonus;

          if (totalScore > bestScore) {
            bestScore = totalScore;
            bestMatch = cat;
          }
        }

        if (bestMatch && bestScore >= 0.6) {
          item.catalog_item_id = bestMatch.id;
          item.catalog_match_score = bestScore;
          item.catalog_match_name = bestMatch.name;
          if (!item.unit_price_cents) {
            item.unit_price_cents = bestMatch.unit_price_cents;
          }
        } else if (bestMatch && bestScore >= 0.3) {
          item.catalog_item_id = bestMatch.id;
          item.catalog_match_score = bestScore;
          item.catalog_match_name = bestMatch.name;
          item.catalog_match_fuzzy = true;
          parseWarnings.push(`Item "${item.name}" fuzzy-matched to "${bestMatch.name}" (score: ${bestScore.toFixed(2)})`);
        }
      }
    }

    // Always persist import record
    const { data: importRecord, error: importErr } = await adminClient
      .from('provision_imports')
      .insert({
        created_by: user.id,
        raw_text: raw_text,
        parsed_json: parsed,
        parse_warnings: parseWarnings,
        model,
      })
      .select()
      .single();

    if (importErr) {
      console.error('Import record insert error:', importErr);
    }

    return new Response(JSON.stringify({
      parsed,
      warnings: parseWarnings,
      import_id: importRecord?.id || null,
      opportunity_id,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('provision-parse error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
