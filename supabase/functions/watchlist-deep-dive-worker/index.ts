/**
 * watchlist-deep-dive-worker — Scrape + LLM deep analysis worker.
 *
 * WHAT: Deep-scrapes org website via Firecrawl → LLM produces comprehensive analysis → writes snapshot + signals.
 * WHERE: Called by n8n-dispatch instead of n8n webhook.
 * WHY: Eliminates n8n dependency for watchlist_deep_dive workflow.
 *
 * Input: { run_id, org_id, org_name?, website_url? }
 * Output: snapshot_id, analysis
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

  const { run_id, org_id, org_name, website_url } = body as {
    run_id: string; org_id: string; org_name?: string; website_url?: string;
  };

  if (!run_id || !org_id) return jsonError(400, "MISSING_FIELD", "run_id and org_id required");

  try {
    // Resolve website_url if not provided
    let url = website_url;
    if (!url) {
      const { data: opp } = await supabase.from("opportunities").select("website").eq("id", org_id).maybeSingle();
      url = opp?.website || null;
    }
    if (!url) {
      const { data: wl } = await supabase.from("org_watchlist").select("website_url").eq("org_id", org_id).maybeSingle();
      url = wl?.website_url || null;
    }
    if (!url) return jsonOk({ ok: true, skipped: true, reason: "no_website_url" });

    // Scrape
    const scrapeResult = await firecrawlScrape(normalizeFirecrawlUrl(url), {
      formats: ["markdown"],
      onlyMainContent: true,
      timeoutMs: 30_000,
    });

    if (!scrapeResult.ok || !scrapeResult.markdown) {
      return jsonOk({ ok: true, skipped: true, reason: `scrape_failed: ${scrapeResult.error}` });
    }

    const rawText = scrapeResult.markdown.slice(0, 12000);
    const contentHash = await sha256(rawText);

    // Store snapshot
    const { data: snapshot, error: snapErr } = await supabase
      .from("org_snapshots")
      .insert({
        org_id,
        run_id,
        url,
        crawled_at: new Date().toISOString(),
        content_hash: contentHash,
        raw_text: rawText,
        meta: { source: "watchlist-deep-dive-worker", credits: scrapeResult.creditsUsed },
      })
      .select("id")
      .single();

    if (snapErr) {
      if (snapErr.code === "23505") return jsonOk({ ok: true, deduped: true, content_hash: contentHash });
      throw new Error(`org_snapshots insert failed: ${snapErr.message}`);
    }

    // LLM deep analysis
    const llmResult = await callLlm(
      [
        {
          role: "system",
          content: `You are a deep organizational analyst. Perform a comprehensive analysis of "${org_name || "this organization"}" based on their website content.

Return ONLY valid JSON:
{
  "summary": "3-5 sentence comprehensive summary",
  "key_programs": ["programs and services"],
  "leadership_signals": ["any leadership mentions"],
  "partnership_indicators": ["partnership/collaboration signals"],
  "growth_signals": ["expansion, new programs, hiring"],
  "risk_signals": ["concerns, challenges mentioned"],
  "funding_landscape": ["grants, donors, revenue sources"],
  "community_presence": ["events, outreach, community engagement"],
  "strategic_opportunities": ["3-5 specific partnership angles"]
}`,
        },
        { role: "user", content: rawText },
      ],
      { model: "google/gemini-3-flash-preview", temperature: 0.2, timeoutMs: 45_000 },
    );

    let analysis: Record<string, unknown> = {};
    if (llmResult.ok && llmResult.content) {
      const jsonMatch = llmResult.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { analysis = JSON.parse(jsonMatch[0]); } catch { /* empty */ }
      }
    }

    // Store facts
    await supabase.from("org_snapshot_facts").insert({
      org_id,
      snapshot_id: snapshot.id,
      run_id,
      facts: analysis,
      model_version: "gemini-3-flash-preview",
    });

    // Emit signals from analysis
    const signalTypes: Array<{ key: string; type: string }> = [
      { key: "leadership_signals", type: "leadership_change" },
      { key: "growth_signals", type: "program_update" },
      { key: "risk_signals", type: "concern" },
      { key: "partnership_indicators", type: "partnership" },
    ];

    let signalsEmitted = 0;
    for (const { key, type } of signalTypes) {
      const items = analysis[key];
      if (!Array.isArray(items)) continue;
      for (const item of items.slice(0, 3)) {
        const summary = typeof item === "string" ? item : String(item);
        if (!summary || summary.length < 5) continue;
        const fingerprint = await sha256(`${type}|${org_id}|${summary}`);
        const { error } = await supabase.from("org_watchlist_signals").insert({
          org_id,
          diff_id: null,
          snapshot_id: snapshot.id,
          signal_type: type,
          summary,
          confidence: 0.7,
          fingerprint,
        });
        if (!error) signalsEmitted++;
      }
    }

    // Update last_crawled_at
    await supabase.from("org_watchlist").update({ last_crawled_at: new Date().toISOString() }).eq("org_id", org_id);

    return jsonOk({
      ok: true,
      snapshot_id: snapshot.id,
      signals_emitted: signalsEmitted,
      ai_used: true,
      content_length: rawText.length,
    });
  } catch (err) {
    console.error("[watchlist-deep-dive-worker] Error:", err);
    return jsonError(500, "PROCESSING_ERROR", err instanceof Error ? err.message : String(err));
  }
});
