/**
 * grant-enrich-worker — Scrape + LLM grant detail extraction worker.
 *
 * WHAT: Scrapes grant URL via Firecrawl → LLM extracts structured grant details → writes to discovered_items.
 * WHERE: Called by n8n-dispatch instead of n8n webhook.
 * WHY: Eliminates n8n dependency for grant_enrich workflow.
 *
 * Input: { run_id, grant_id, source_url, grant_name?, funder_name? }
 * Output: Updated discovered_items with extracted details
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

  const { run_id, grant_id, source_url, grant_name, funder_name } = body as {
    run_id: string; grant_id: string; source_url: string; grant_name?: string; funder_name?: string;
  };

  if (!run_id || !grant_id || !source_url) return jsonError(400, "MISSING_FIELD", "run_id, grant_id, source_url required");

  try {
    // Scrape the grant URL
    const scrapeResult = await firecrawlScrape(normalizeFirecrawlUrl(source_url), {
      formats: ["markdown"],
      onlyMainContent: true,
      timeoutMs: 25_000,
    });

    if (!scrapeResult.ok || !scrapeResult.markdown) {
      return jsonOk({ ok: true, skipped: true, reason: `scrape_failed: ${scrapeResult.error}` });
    }

    const content = scrapeResult.markdown.slice(0, 8000);

    // LLM extraction
    const llmResult = await callLlm(
      [
        {
          role: "system",
          content: `You are a grant research specialist. Extract detailed information about this grant opportunity.

Return ONLY valid JSON:
{
  "grant_name": "Official name",
  "funder": "Funding organization",
  "amount_min": null or number,
  "amount_max": null or number,
  "deadline": "YYYY-MM-DD or null",
  "eligibility": ["eligibility criteria"],
  "focus_areas": ["program focus areas"],
  "geographic_restrictions": ["geographic requirements"],
  "application_url": "URL or null",
  "description": "2-3 sentence summary",
  "grant_type": "federal|state|foundation|corporate|other",
  "recurring": true or false
}

Only include facts directly from the content.`,
        },
        { role: "user", content: `Grant: ${grant_name || "Unknown"}\nFunder: ${funder_name || "Unknown"}\nURL: ${source_url}\n\nContent:\n${content}` },
      ],
      { model: "google/gemini-2.5-flash", temperature: 0.1, timeoutMs: 30_000 },
    );

    let extracted: Record<string, unknown> = {};
    if (llmResult.ok && llmResult.content) {
      const jsonMatch = llmResult.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { extracted = JSON.parse(jsonMatch[0]); } catch { /* empty */ }
      }
    }

    // Update discovered_items with extracted details
    const { error: updateErr } = await supabase
      .from("discovered_items")
      .update({
        extracted,
        title: (extracted.grant_name as string) || grant_name || undefined,
        snippet: (extracted.description as string) || undefined,
        last_seen_at: new Date().toISOString(),
        last_run_id: run_id,
      })
      .eq("id", grant_id);

    if (updateErr) {
      console.warn(`[grant-enrich-worker] Update failed: ${updateErr.message}`);
    }

    return jsonOk({
      ok: true,
      grant_id,
      extracted_fields: Object.keys(extracted).length,
      ai_used: true,
    });
  } catch (err) {
    console.error("[grant-enrich-worker] Error:", err);
    return jsonError(500, "PROCESSING_ERROR", err instanceof Error ? err.message : String(err));
  }
});
