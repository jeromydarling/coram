import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "Method not allowed");

  // Service auth only
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKey = req.headers.get("x-api-key") ?? "";

  const token = apiKey || (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "");
  const isService = (serviceRoleKey && token === serviceRoleKey) ||
    (sharedSecret && constantTimeCompare(token, sharedSecret));

  if (!isService) return jsonError(401, "Service auth required");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { journal_entry_id } = await req.json();
    if (!journal_entry_id) return jsonError(400, "journal_entry_id required");

    // Fetch the entry
    const { data: entry, error: fetchErr } = await supabase
      .from("journal_entries")
      .select("id, note_text, metro_id")
      .eq("id", journal_entry_id)
      .single();

    if (fetchErr || !entry) return jsonError(404, "Journal entry not found");

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      // No AI — write empty
      await supabase.from("journal_extractions").upsert({
        journal_entry_id,
        extracted_json: { org_mentions: [], topics: [], signals: [], sentiment: { valence: "neutral", intensity: 0.5 } },
      }, { onConflict: "journal_entry_id" });
      return jsonOk({ ok: true, ai_used: false });
    }

    // Get metro orgs for context
    let orgNames: string[] = [];
    if (entry.metro_id) {
      const { data: opps } = await supabase
        .from("opportunities")
        .select("organization")
        .eq("metro_id", entry.metro_id)
        .eq("status", "Active")
        .limit(100);
      orgNames = (opps ?? []).map((o: { organization: string }) => o.organization);
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Extract structured data from a field note. Return ONLY valid JSON:
{"org_mentions":[{"name":"...","confidence":0.0-1.0}],"topics":["..."],"signals":[{"type":"...","confidence":0.0-1.0}],"sentiment":{"valence":"positive|neutral|negative|mixed","intensity":0.0-1.0}}
Signal types: leadership_change, program_update, partnership, community_shift, funding, event, concern, win, friction, milestone.
Known orgs: ${orgNames.slice(0, 30).join(", ") || "none"}. Never hallucinate.`,
          },
          { role: "user", content: entry.note_text },
        ],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(15000),
    });

    let extracted = { org_mentions: [], topics: [], signals: [], sentiment: { valence: "neutral", intensity: 0.5 } };

    if (resp.ok) {
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          extracted = {
            org_mentions: Array.isArray(parsed.org_mentions) ? parsed.org_mentions : [],
            topics: Array.isArray(parsed.topics) ? parsed.topics : [],
            signals: Array.isArray(parsed.signals) ? parsed.signals : [],
            sentiment: parsed.sentiment ?? extracted.sentiment,
          };
        } catch { /* fallback to empty */ }
      }
    } else {
      await resp.text(); // consume body
    }

    await supabase.from("journal_extractions").upsert({
      journal_entry_id,
      extracted_json: extracted,
    }, { onConflict: "journal_entry_id" });

    return jsonOk({ ok: true, ai_used: true, extracted });
  } catch (e) {
    console.error("journal-extract error:", e);
    return jsonError(500, e instanceof Error ? e.message : "Unknown error");
  }
});
