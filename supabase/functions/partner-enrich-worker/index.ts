/**
 * partner-enrich-worker — Scrape + LLM extraction worker.
 *
 * WHAT: Scrapes org website via Firecrawl → LLM extracts structured facts → writes to org_extractions + org_enrichment_facts.
 * WHERE: Called by n8n-dispatch instead of n8n webhook.
 * WHY: Eliminates n8n dependency for partner_enrich workflow.
 *
 * Input: { run_id, org_id, org_name, website_url }
 * Output: extraction_id, enrichment_id
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateWorkerRequest, jsonOk, jsonError, corsHeaders } from "../_shared/workerAuth.ts";
import { callLlm } from "../_shared/llmGateway.ts";
import { firecrawlScrape, normalizeFirecrawlUrl } from "../_shared/firecrawlClient.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST only");
  if (!authenticateWorkerRequest(req)) return jsonError(401, "UNAUTHORIZED", "Invalid auth");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, "INVALID_JSON", "Invalid JSON"); }

  const { run_id, org_id, org_name, website_url } = body as {
    run_id: string; org_id?: string; org_name: string; website_url?: string;
  };

  if (!run_id || !org_name) return jsonError(400, "MISSING_FIELD", "run_id and org_name required");

  try {
    let websiteContent = "";

    // Step 1: Scrape website if URL provided
    if (website_url) {
      const scrapeResult = await firecrawlScrape(normalizeFirecrawlUrl(website_url), {
        formats: ["markdown"],
        onlyMainContent: true,
        timeoutMs: 25_000,
      });

      if (scrapeResult.ok && scrapeResult.markdown) {
        websiteContent = scrapeResult.markdown.slice(0, 8000); // Cap context
      } else {
        console.warn(`[partner-enrich-worker] Scrape failed for ${website_url}: ${scrapeResult.error}`);
      }
    }

    // Step 2: LLM extraction
    const prompt = websiteContent
      ? `Extract structured facts about "${org_name}" from their website content below.\n\nWebsite Content:\n${websiteContent}`
      : `Extract what you know about the organization "${org_name}". Only include facts you are confident about.`;

    const llmResult = await callLlm(
      [
        {
          role: "system",
          content: `You are a nonprofit research analyst. Extract structured organizational facts.

Return ONLY valid JSON:
{
  "mission_summary": "1-2 sentence mission",
  "programs": ["list of programs/services"],
  "populations_served": ["communities/demographics served"],
  "geographies": ["geographic areas served"],
  "funding_signals": ["any funding/grant mentions"],
  "keywords": ["5-10 relevant keywords"]
}

Only include facts directly supported by the content. Never fabricate.`,
        },
        { role: "user", content: prompt },
      ],
      { model: "google/gemini-2.5-flash", temperature: 0.1, timeoutMs: 30_000 },
    );

    let facts: Record<string, unknown> = {
      mission_summary: null,
      programs: [],
      populations_served: [],
      geographies: [],
      funding_signals: [],
      keywords: [],
    };

    if (llmResult.ok && llmResult.content) {
      const jsonMatch = llmResult.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          facts = {
            mission_summary: parsed.mission_summary || null,
            programs: Array.isArray(parsed.programs) ? parsed.programs : [],
            populations_served: Array.isArray(parsed.populations_served) ? parsed.populations_served : [],
            geographies: Array.isArray(parsed.geographies) ? parsed.geographies : [],
            funding_signals: Array.isArray(parsed.funding_signals) ? parsed.funding_signals : [],
            keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
          };
        } catch { /* use defaults */ }
      }
    }

    // Step 3: Write to org_extractions (same as n8n-ingest)
    const { data: extraction, error: extErr } = await supabase
      .from("org_extractions")
      .insert({
        run_id,
        org_name,
        website_url: website_url || null,
        raw_extraction: facts,
      })
      .select("id")
      .single();

    if (extErr) throw new Error(`org_extractions insert failed: ${extErr.message}`);

    // Step 4: Write to org_enrichment_facts
    const { data: enrichment, error: enrErr } = await supabase
      .from("org_enrichment_facts")
      .insert({
        extraction_id: extraction.id,
        run_id,
        org_name,
        mission_summary: facts.mission_summary as string | null,
        programs: facts.programs as string[],
        populations_served: facts.populations_served as string[],
        geographies: facts.geographies as string[],
        funding_signals: facts.funding_signals as string[],
        keywords: facts.keywords as string[],
      })
      .select("id")
      .single();

    if (enrErr) throw new Error(`org_enrichment_facts insert failed: ${enrErr.message}`);

    return jsonOk({
      ok: true,
      extraction_id: extraction.id,
      enrichment_id: enrichment.id,
      ai_used: true,
      scraped: !!websiteContent,
    });
  } catch (err) {
    console.error("[partner-enrich-worker] Error:", err);
    return jsonError(500, "PROCESSING_ERROR", err instanceof Error ? err.message : String(err));
  }
});
