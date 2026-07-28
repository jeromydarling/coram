/**
 * opportunity-monitor-worker — Scrape + LLM signal detection worker.
 *
 * WHAT: Scrapes monitor URLs via Firecrawl → LLM detects change signals → writes to opportunity_signals.
 * WHERE: Called by n8n-dispatch instead of n8n webhook.
 * WHY: Eliminates n8n dependency for opportunity_monitor workflow.
 *
 * Input: { run_id, opportunity_id?, org_name?, monitor_urls[], previous_hashes[] }
 * Output: signals_inserted count
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateWorkerRequest, jsonOk, jsonError, corsHeaders } from "../_shared/workerAuth.ts";
import { callLlm } from "../_shared/llmGateway.ts";
import { firecrawlScrape, normalizeFirecrawlUrl } from "../_shared/firecrawlClient.ts";

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

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

  const { run_id, opportunity_id, org_name, monitor_urls, previous_hashes } = body as {
    run_id: string; opportunity_id?: string; org_name?: string;
    monitor_urls?: string[]; previous_hashes?: string[];
  };

  if (!run_id) return jsonError(400, "MISSING_FIELD", "run_id required");

  try {
    // Get org website if no monitor_urls provided
    let urls = Array.isArray(monitor_urls) ? monitor_urls.slice(0, 6) : [];
    if (urls.length === 0 && opportunity_id) {
      const { data: opp } = await supabase.from("opportunities").select("website").eq("id", opportunity_id).maybeSingle();
      if (opp?.website) urls = [opp.website];
    }

    if (urls.length === 0) {
      return jsonOk({ ok: true, signals_inserted: 0, reason: "no_urls" });
    }

    // Scrape all URLs in parallel
    const scrapeResults = await Promise.all(
      urls.map(url => firecrawlScrape(normalizeFirecrawlUrl(url), { formats: ["markdown"], timeoutMs: 20_000 })),
    );

    const scrapedContent = scrapeResults
      .filter(r => r.ok && r.markdown)
      .map((r, i) => `--- Source: ${urls[i]} ---\n${r.markdown!.slice(0, 3000)}`)
      .join("\n\n");

    if (!scrapedContent) {
      return jsonOk({ ok: true, signals_inserted: 0, reason: "scrape_failed" });
    }

    // LLM signal extraction
    const llmResult = await callLlm(
      [
        {
          role: "system",
          content: `You are an organizational change detector. Analyze website content to detect signals of change for "${org_name || "this organization"}".

Return ONLY valid JSON array:
[{"signal_type":"leadership_change|program_update|partnership|community_shift|funding|event|concern|win|friction|milestone","signal_value":"Brief description","confidence":0.0-1.0,"source_url":"url where found"}]

Only report genuine signals supported by the content. Empty array is valid if no signals detected.`,
        },
        { role: "user", content: scrapedContent },
      ],
      { model: "google/gemini-2.5-flash", temperature: 0.1, timeoutMs: 30_000 },
    );

    let signals: Array<{ signal_type: string; signal_value: string; confidence: number; source_url: string }> = [];

    if (llmResult.ok && llmResult.content) {
      const arrMatch = llmResult.content.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        try {
          signals = JSON.parse(arrMatch[0]).filter(
            (s: Record<string, unknown>) => s.signal_type && s.signal_value,
          );
        } catch { /* empty signals */ }
      }
    }

    // Write signals with fingerprint dedup
    let inserted = 0;
    let skipped = 0;

    for (const s of signals) {
      const fingerprint = await sha256(`${s.signal_type}|${s.signal_value}|${s.source_url || ""}`);

      const { error } = await supabase
        .from("opportunity_signals")
        .insert({
          run_id,
          opportunity_id: opportunity_id || null,
          signal_type: s.signal_type,
          signal_value: s.signal_value,
          confidence: typeof s.confidence === "number" ? s.confidence : 0.5,
          source_url: s.source_url || null,
          detected_at: new Date().toISOString(),
          signal_fingerprint: fingerprint,
        });

      if (error) {
        if (error.code === "23505") { skipped++; continue; }
        throw new Error(`opportunity_signals insert: ${error.message}`);
      }
      inserted++;
    }

    return jsonOk({ ok: true, signals_inserted: inserted, signals_skipped: skipped, ai_used: true, urls_scraped: urls.length });
  } catch (err) {
    console.error("[opportunity-monitor-worker] Error:", err);
    return jsonError(500, "PROCESSING_ERROR", err instanceof Error ? err.message : String(err));
  }
});
