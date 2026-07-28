import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return new Response(
    JSON.stringify({ ok: false, error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError("Only POST is accepted", 405);
  }

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError("Missing Authorization header", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return jsonError("Unauthorized", 401);
  }

  let body: { url: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const { url } = body;
  if (!url || typeof url !== "string" || !/^https?:\/\/.+/i.test(url.trim())) {
    return jsonError("A valid http(s) URL is required", 400);
  }

  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!firecrawlKey) {
    return jsonError("Firecrawl not configured", 503);
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) {
    return jsonError("AI not configured", 503);
  }

  // Step 1: Scrape the URL with Firecrawl (with fallbacks)
  console.log("[event-enrich] Scraping:", url);
  let scrapedContent = "";
  try {
    // Attempt 1: Firecrawl markdown
    const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url.trim(),
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 5000,
      }),
      signal: AbortSignal.timeout(45000),
    });

    const scrapeData = await scrapeResp.json();
    scrapedContent = scrapeData?.data?.markdown || scrapeData?.markdown || "";
    console.log(`[event-enrich] Firecrawl markdown: ${scrapedContent.length} chars`);

    // Attempt 2: Firecrawl HTML fallback
    if (scrapedContent.length < 100) {
      console.log("[event-enrich] Markdown too short, trying html fallback");
      const htmlResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url.trim(),
          formats: ["html"],
          onlyMainContent: true,
          waitFor: 5000,
        }),
        signal: AbortSignal.timeout(45000),
      });
      const htmlData = await htmlResp.json();
      const rawHtml = htmlData?.data?.html || htmlData?.html || "";
      if (rawHtml.length > scrapedContent.length) {
        scrapedContent = rawHtml
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim();
        console.log(`[event-enrich] HTML fallback: ${scrapedContent.length} chars`);
      }
    }

    // Attempt 3: Direct fetch fallback
    if (scrapedContent.length < 100) {
      console.log("[event-enrich] Firecrawl failed, trying direct fetch");
      const directResp = await fetch(url.trim(), {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CROS/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (directResp.ok) {
        const html = await directResp.text();
        const directText = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim();
        if (directText.length > scrapedContent.length) {
          scrapedContent = directText;
          console.log(`[event-enrich] Direct fetch: ${scrapedContent.length} chars`);
        }
      }
    }

    if (scrapedContent.length < 50) {
      return jsonResponse({
        ok: false,
        error: "Could not extract meaningful content from this URL. The page may require JavaScript rendering or login.",
      });
    }

    // Truncate to avoid token limits
    if (scrapedContent.length > 12000) {
      scrapedContent = scrapedContent.substring(0, 12000);
    }

    console.log("[event-enrich] Final content:", scrapedContent.length, "chars");
  } catch (err) {
    console.error("[event-enrich] Scrape error:", err);
    return jsonError("Failed to scrape the URL", 502);
  }

  // Step 2: Use AI to extract event details
  const extractionPrompt = `You are an event information extractor. Given the following scraped web page content from an event listing URL, extract as much structured information as possible about the event AND the organizing entity.

Return a JSON object with these fields (use null for any field you cannot determine):

{
  "event_name": "string — full name of the event",
  "description": "string — a 2-4 sentence summary of the event purpose, audience, and what attendees can expect",
  "event_date": "string — ISO date (YYYY-MM-DD) of the start date",
  "end_date": "string — ISO date (YYYY-MM-DD) if multi-day, null otherwise",
  "event_type": "string — one of: Conference, Workshop, Community Gathering, Fundraiser, Training, Networking, Outreach, Meeting, Volunteer Day, Panel Discussion, Webinar, Open House, Festival, Service Day, or other appropriate type",
  "city": "string — full address or venue + city if available",
  "host_organization": "string — the organization hosting or presenting the event",
  "host_description": "string — a brief description of the host organization if mentioned",
  "target_populations": ["array of strings — who the event serves or targets, e.g. 'Families', 'Youth', 'Seniors'"],
  "is_recurring": false,
  "recurrence_pattern": "string — weekly/biweekly/monthly/quarterly/yearly or null",
  "is_conference": false,
  "expected_attendance": "string — estimated number of attendees if mentioned",
  "registration_required": true,
  "cost": "string — free, or price if mentioned",
  "speakers": ["array of speaker names if listed"],
  "topics": ["array of key topics or themes"],
  "contact_email": "string — contact email if listed",
  "contact_phone": "string — contact phone if listed"
}

IMPORTANT:
- Only extract what is clearly stated or strongly implied
- For dates, convert to YYYY-MM-DD format
- For multi-day events, set both event_date and end_date
- Determine is_conference=true if it's a multi-session professional conference
- Be concise but informative in the description

Scraped content:
---
${scrapedContent}
---

Return ONLY valid JSON, no markdown fences, no explanation.`;

  try {
    console.log("[event-enrich] Calling AI for extraction");
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "user", content: extractionPrompt },
        ],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[event-enrich] AI error:", errText);
      return jsonError("AI extraction failed", 502);
    }

    const aiData = await aiResp.json();
    const rawContent = aiData?.choices?.[0]?.message?.content || "";

    // Parse the JSON response (strip markdown fences if present)
    const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      console.error("[event-enrich] Failed to parse AI response:", rawContent.substring(0, 500));
      return jsonError("AI returned unparseable response", 502);
    }

    console.log("[event-enrich] Extraction complete:", Object.keys(extracted).join(", "));

    return jsonResponse({
      ok: true,
      extracted,
      source_url: url,
    });
  } catch (err) {
    console.error("[event-enrich] AI error:", err);
    return jsonError("AI extraction timed out", 504);
  }
});
