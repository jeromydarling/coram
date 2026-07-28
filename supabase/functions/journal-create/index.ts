import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

// Anchor key validation: alphanumeric, colons, underscores, hyphens only
const ANCHOR_KEY_RE = /^[a-zA-Z0-9:_-]{1,120}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") return jsonError(405, "Method not allowed");

  // Authenticate user via JWT
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonError(401, "Missing authorization");

  const token = authHeader.slice(7).trim();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return jsonError(401, "Invalid token");

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { narrative_id, block_id, anchor_key, note_text, metro_id } = body;

    // Validate note_text
    const trimmedNote = (note_text ?? "").toString().trim();
    if (!trimmedNote) return jsonError(400, "note_text is required");
    if (trimmedNote.length > 2000) return jsonError(400, "note_text max 2000 chars");

    // Validate anchor_key if provided
    if (anchor_key && !ANCHOR_KEY_RE.test(anchor_key)) {
      return jsonError(400, "anchor_key invalid: max 120 chars, alphanumeric/colons/underscores/hyphens only");
    }

    // Insert journal entry (uses user's own client so RLS enforces ownership)
    const { data: entry, error: insertErr } = await userClient
      .from("journal_entries")
      .insert({
        user_id: user.id,
        metro_id: metro_id || null,
        narrative_id: narrative_id || null,
        block_id: block_id || null,
        anchor_key: anchor_key || null,
        note_text: trimmedNote,
        visibility: "private",
      })
      .select("id, created_at")
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return jsonError(500, insertErr.message);
    }

    // Kick off extraction best-effort (async, don't block response)
    extractJournalAsync(serviceClient, entry.id, trimmedNote, metro_id).catch(e =>
      console.error("Extraction error (non-blocking):", e),
    );

    return jsonOk({ ok: true, journal_entry: entry });
  } catch (e) {
    console.error("journal-create error:", e);
    return jsonError(500, e instanceof Error ? e.message : "Unknown error");
  }
});

// Best-effort AI extraction — runs async after response
async function extractJournalAsync(
  supabase: ReturnType<typeof createClient>,
  journalEntryId: string,
  noteText: string,
  metroId: string | null,
): Promise<void> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    // No AI key — insert empty extraction
    await supabase.from("journal_extractions").upsert({
      journal_entry_id: journalEntryId,
      extracted_json: { org_mentions: [], topics: [], signals: [], sentiment: { valence: "neutral", intensity: 0.5 } },
    }, { onConflict: "journal_entry_id" });
    return;
  }

  // Fetch metro context for better extraction
  let metroName = "";
  if (metroId) {
    const { data: metro } = await supabase.from("metros").select("metro").eq("id", metroId).single();
    metroName = metro?.metro ?? "";
  }

  // Fetch opportunity names in metro for org matching
  let orgNames: string[] = [];
  if (metroId) {
    const { data: opps } = await supabase
      .from("opportunities")
      .select("id, organization")
      .eq("metro_id", metroId)
      .eq("status", "Active")
      .limit(100);
    orgNames = (opps ?? []).map(o => o.organization);
  }

  const systemPrompt = `Extract structured data from a short field note written by a community relationship manager.
Return ONLY valid JSON with these keys:
{
  "org_mentions": [{"name": "org name", "confidence": 0.0-1.0}],
  "topics": ["topic1", "topic2"],
  "signals": [{"type": "signal_type", "confidence": 0.0-1.0}],
  "sentiment": {"valence": "positive|neutral|negative|mixed", "intensity": 0.0-1.0}
}

Signal types: leadership_change, program_update, partnership, community_shift, funding, event, concern, win, friction, milestone.
Known organizations in this metro: ${orgNames.slice(0, 30).join(", ") || "none listed"}.
Metro: ${metroName || "unknown"}

If the note is too short or ambiguous, return empty arrays. Never hallucinate org names not in the note.`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: noteText },
        ],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      console.error("AI extraction failed:", resp.status);
      await insertEmptyExtraction(supabase, journalEntryId);
      return;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      await insertEmptyExtraction(supabase, journalEntryId);
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    const extracted = {
      org_mentions: Array.isArray(parsed.org_mentions) ? parsed.org_mentions : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      sentiment: parsed.sentiment && typeof parsed.sentiment === "object"
        ? parsed.sentiment
        : { valence: "neutral", intensity: 0.5 },
    };

    await supabase.from("journal_extractions").upsert({
      journal_entry_id: journalEntryId,
      extracted_json: extracted,
    }, { onConflict: "journal_entry_id" });
  } catch (e) {
    console.error("Extraction failed:", e);
    await insertEmptyExtraction(supabase, journalEntryId);
  }
}

async function insertEmptyExtraction(
  supabase: ReturnType<typeof createClient>,
  journalEntryId: string,
): Promise<void> {
  await supabase.from("journal_extractions").upsert({
    journal_entry_id: journalEntryId,
    extracted_json: { org_mentions: [], topics: [], signals: [], sentiment: { valence: "neutral", intensity: 0.5 } },
  }, { onConflict: "journal_entry_id" });
}
