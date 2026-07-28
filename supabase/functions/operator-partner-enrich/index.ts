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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonError("POST only", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonError("Unauthorized", 401);

  // Verify user is admin
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return jsonError("Unauthorized", 401);

  const { data: roleCheck } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleCheck) return jsonError("Admin access required", 403);

  let body: { opportunity_id: string; source_url?: string };
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }

  const { opportunity_id, source_url } = body;
  if (!opportunity_id || !UUID_RE.test(opportunity_id)) return jsonError("Valid opportunity_id required", 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Get opportunity
  const { data: opp, error: oppErr } = await admin
    .from("operator_opportunities")
    .select("*")
    .eq("id", opportunity_id)
    .maybeSingle();
  if (oppErr || !opp) return jsonError("Opportunity not found", 404);

  const effectiveUrl = source_url?.trim() || opp.website_url || opp.website || null;
  if (!effectiveUrl) return jsonError("No URL available. Add a website URL first.", 400);

  // Update status to processing
  await admin.from("operator_opportunities").update({
    org_knowledge_status: "processing",
    org_enrichment_status: "processing",
    ...(source_url?.trim() ? { website_url: source_url.trim() } : {}),
  }).eq("id", opportunity_id);

  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (!firecrawlKey || !lovableKey) {
    await admin.from("operator_opportunities").update({
      org_knowledge_status: "failed",
      org_enrichment_status: "failed",
    }).eq("id", opportunity_id);
    return jsonError("Missing API keys", 503);
  }

  // Step 1: Scrape the website (try markdown first, then html fallback)
  console.log(`[op-enrich] Scraping: ${effectiveUrl}`);
  let scrapedContent = "";
  try {
    const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: effectiveUrl,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 5000,
      }),
      signal: AbortSignal.timeout(45000),
    });
    const scrapeData = await scrapeResp.json();
    scrapedContent = scrapeData?.data?.markdown || scrapeData?.markdown || "";

    // Fallback 1: if markdown is too short, try html format via Firecrawl
    if (scrapedContent.length < 100) {
      console.log(`[op-enrich] Markdown too short (${scrapedContent.length}), trying html fallback`);
      const htmlResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: effectiveUrl,
          formats: ["html"],
          onlyMainContent: false,
          waitFor: 8000,
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
        console.log(`[op-enrich] Firecrawl HTML fallback yielded ${scrapedContent.length} chars`);
      }
    }

    // Fallback 2: direct fetch in case Firecrawl is blocked on this domain
    if (scrapedContent.length < 100) {
      console.log(`[op-enrich] Firecrawl content still short (${scrapedContent.length}), trying direct fetch fallback`);
      const directResp = await fetch(effectiveUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CROS-EnrichmentBot/1.0)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });

      if (directResp.ok) {
        const directHtml = await directResp.text();
        const directText = directHtml
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim();

        if (directText.length > scrapedContent.length) {
          scrapedContent = directText;
          console.log(`[op-enrich] Direct fetch fallback yielded ${scrapedContent.length} chars`);
        }
      } else {
        console.log(`[op-enrich] Direct fetch fallback status: ${directResp.status}`);
      }
    }

    if (scrapedContent.length > 15000) scrapedContent = scrapedContent.substring(0, 15000);
    console.log(`[op-enrich] Final scraped content: ${scrapedContent.length} chars`);
  } catch (err) {
    console.error("[op-enrich] Scrape error:", err);
    await admin.from("operator_opportunities").update({
      org_knowledge_status: "failed",
      org_enrichment_status: "failed",
    }).eq("id", opportunity_id);
    return jsonError("Failed to scrape website", 502);
  }

  if (scrapedContent.length < 50) {
    console.error(`[op-enrich] Content too short: ${scrapedContent.length} chars from ${effectiveUrl}`);
    await admin.from("operator_opportunities").update({
      org_knowledge_status: "failed",
      org_enrichment_status: "failed",
    }).eq("id", opportunity_id);
    return jsonResponse({ ok: false, error: "Could not extract meaningful content from this URL. The site may block automated access or require JavaScript. Try a different URL." });
  }

  // Step 2: AI extraction
  const extractionPrompt = `You are an organization intelligence analyst. Given the following scraped website content, extract comprehensive organizational information.

Return a JSON object with these fields (use null for any field you cannot determine):

{
  "organization_name": "string — official name",
  "description": "string — 2-4 sentence overview of what the org does",
  "mission_snapshot": ["array of 3-5 short phrases describing their mission focus areas"],
  "best_partnership_angle": ["array of 2-4 phrases describing how to partner with them"],
  "grant_alignment": ["array of relevant grant/funding areas they align with"],
  "partner_tiers": ["array of relevant categories: Anchor, Distribution, Referral, Workforce, Housing, Education, Other"],
  "city": "string — city they're headquartered in",
  "state": "string — state/province abbreviation",
  "zip": "string — zip/postal code if found",
  "leadership": [{"name": "string", "title": "string", "email": "string or null"}],
  "programs": ["array of key programs or services they offer"],
  "populations_served": ["array of populations they serve"],
  "annual_budget_range": "string — rough budget range if mentioned",
  "founding_year": "string — year founded if mentioned",
  "social_media": {"linkedin": "url", "twitter": "url", "facebook": "url"},
  "key_partnerships": ["array of named partner organizations"],
  "org_type": "string — nonprofit, government, faith-based, social enterprise, etc.",
  "raw_summary": "string — 3-5 paragraph comprehensive summary of everything notable about this organization"
}

Extract ONLY what is clearly stated or strongly implied. Be thorough.

Website content:
---
${scrapedContent}
---

Return ONLY valid JSON, no markdown fences.`;

  try {
    console.log("[op-enrich] AI extraction starting");
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: extractionPrompt }],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[op-enrich] AI error:", errText);
      await admin.from("operator_opportunities").update({
        org_knowledge_status: "failed",
        org_enrichment_status: "failed",
      }).eq("id", opportunity_id);
      return jsonError("AI extraction failed", 502);
    }

    const aiData = await aiResp.json();
    const rawContent = aiData?.choices?.[0]?.message?.content || "";
    const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let extracted: Record<string, unknown>;
    try { extracted = JSON.parse(cleaned); } catch {
      console.error("[op-enrich] Parse failed:", rawContent.substring(0, 500));
      await admin.from("operator_opportunities").update({
        org_knowledge_status: "failed",
        org_enrichment_status: "failed",
      }).eq("id", opportunity_id);
      return jsonError("AI returned unparseable response", 502);
    }

    // Step 3: Update the operator_opportunity with extracted data
    const updatePayload: Record<string, unknown> = {
      org_knowledge_status: "completed",
      org_enrichment_status: "completed",
    };

    if (extracted.description && !opp.description) updatePayload.description = extracted.description;
    if (extracted.city && !opp.city) updatePayload.city = extracted.city as string;
    if (extracted.state && !opp.state) updatePayload.state = extracted.state as string;
    if (extracted.zip && !opp.zip) updatePayload.zip = extracted.zip as string;
    if (Array.isArray(extracted.mission_snapshot) && extracted.mission_snapshot.length > 0) {
      updatePayload.mission_snapshot = extracted.mission_snapshot;
    }
    if (Array.isArray(extracted.best_partnership_angle) && extracted.best_partnership_angle.length > 0) {
      updatePayload.best_partnership_angle = extracted.best_partnership_angle;
    }
    if (Array.isArray(extracted.grant_alignment) && extracted.grant_alignment.length > 0) {
      updatePayload.grant_alignment = extracted.grant_alignment;
    }
    if (Array.isArray(extracted.partner_tiers) && extracted.partner_tiers.length > 0) {
      updatePayload.partner_tiers = extracted.partner_tiers;
    }

    // Build enrichment notes with all extra info
    const extras: string[] = [];
    if (extracted.org_type) extras.push(`Type: ${extracted.org_type}`);
    if (extracted.founding_year) extras.push(`Founded: ${extracted.founding_year}`);
    if (extracted.annual_budget_range) extras.push(`Budget: ${extracted.annual_budget_range}`);
    if (Array.isArray(extracted.programs) && extracted.programs.length > 0) {
      extras.push(`Programs: ${(extracted.programs as string[]).join(', ')}`);
    }
    if (Array.isArray(extracted.populations_served) && extracted.populations_served.length > 0) {
      extras.push(`Populations: ${(extracted.populations_served as string[]).join(', ')}`);
    }
    if (Array.isArray(extracted.leadership) && extracted.leadership.length > 0) {
      const leaders = (extracted.leadership as Array<{name: string; title: string; email?: string}>)
        .map(l => `${l.name} (${l.title})${l.email ? ` — ${l.email}` : ''}`)
        .join('; ');
      extras.push(`Leadership: ${leaders}`);
    }
    if (Array.isArray(extracted.key_partnerships) && extracted.key_partnerships.length > 0) {
      extras.push(`Key Partners: ${(extracted.key_partnerships as string[]).join(', ')}`);
    }
    const social = extracted.social_media as Record<string, string> | null;
    if (social) {
      const links = Object.entries(social).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
      if (links.length > 0) extras.push(`Social: ${links.join(', ')}`);
    }
    if (extracted.raw_summary) extras.push(`\n--- AI Summary ---\n${extracted.raw_summary}`);

    if (extras.length > 0) {
      const enrichedNotes = `--- Enriched from ${effectiveUrl} ---\n${extras.join('\n')}`;
      updatePayload.notes = opp.notes ? `${opp.notes}\n\n${enrichedNotes}` : enrichedNotes;
    }

    await admin.from("operator_opportunities").update(updatePayload).eq("id", opportunity_id);

    // Step 4: Store org knowledge snapshot for reuse by UI components
    // Deactivate any existing authoritative snapshot first
    await admin.from("org_knowledge_snapshots")
      .update({ active: false })
      .eq("org_id", opportunity_id)
      .eq("is_authoritative", true)
      .eq("active", true);

    // Get current version for incrementing
    const { data: currentSnap } = await admin.from("org_knowledge_snapshots")
      .select("version")
      .eq("org_id", opportunity_id)
      .eq("is_authoritative", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const newVersion = (currentSnap?.version || 0) + 1;

    await admin.from("org_knowledge_snapshots").insert({
      org_id: opportunity_id,
      is_authoritative: true,
      active: true,
      source_type: "firecrawl_bootstrap",
      source_url: effectiveUrl,
      raw_excerpt: extracted.raw_summary || scrapedContent.substring(0, 5000),
      structured_json: extracted,
      created_by: user.id,
      version: newVersion,
    }).select().maybeSingle();

    console.log("[op-enrich] Enrichment complete for", opp.organization);

    return jsonResponse({
      ok: true,
      fields_updated: Object.keys(updatePayload).filter(k => k !== 'org_knowledge_status' && k !== 'org_enrichment_status'),
      extracted,
    });
  } catch (err) {
    console.error("[op-enrich] Error:", err);
    await admin.from("operator_opportunities").update({
      org_knowledge_status: "failed",
      org_enrichment_status: "failed",
    }).eq("id", opportunity_id);
    return jsonError("Enrichment failed", 500);
  }
});
