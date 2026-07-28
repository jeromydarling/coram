/**
 * discovery-people-worker — Firecrawl search + LLM extraction for people discovery.
 *
 * WHAT: Searches for key people via Firecrawl → LLM parses → writes to discovered_items + briefings.
 * WHERE: Called by discovery-dispatch instead of n8n webhook.
 * WHY: Eliminates n8n dependency for discovery-people workflow.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateWorkerRequest, jsonOk, jsonError, corsHeaders } from "../_shared/workerAuth.ts";
import { callLlm } from "../_shared/llmGateway.ts";
import { firecrawlSearch } from "../_shared/firecrawlClient.ts";
import { normalizeUrl } from "../_shared/normalizeUrl.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST only");
  if (!authenticateWorkerRequest(req)) return jsonError(401, "UNAUTHORIZED", "Invalid auth");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, "INVALID_JSON", "Invalid JSON"); }

  const { run_id, scope, metro_id, opportunity_id, query_profile } = body as {
    run_id: string; scope: string; metro_id?: string; opportunity_id?: string; query_profile?: Record<string, unknown>;
  };

  if (!run_id) return jsonError(400, "MISSING_FIELD", "run_id required");

  try {
    const orgName = (query_profile?.organization as string) || "";
    const metroName = (query_profile?.metro as string) || "";
    const searchQuery = orgName
      ? `"${orgName}" director executive leader staff team`
      : `${metroName} nonprofit leadership director executive community organization`.trim();

    const searchResult = await firecrawlSearch(searchQuery, { limit: 15, scrapeOptions: { formats: ["markdown"] }, timeoutMs: 40_000 });

    if (!searchResult.ok || !searchResult.results?.length) {
      await supabase.from("discovery_runs").update({ status: "completed", stats: { items: 0 }, completed_at: new Date().toISOString() }).eq("id", run_id);
      return jsonOk({ ok: true, items: 0 });
    }

    const resultsText = searchResult.results.slice(0, 10).map((r, i) =>
      `[${i + 1}] ${r.title || "Untitled"}\nURL: ${r.url}\n${(r.markdown || r.description || "").slice(0, 1500)}`
    ).join("\n\n---\n\n");

    const llmResult = await callLlm([
      { role: "system", content: `Extract people/contacts from search results about "${orgName || metroName}". Return JSON:
{"items":[{"name":"Full Name","title":"Job Title","organization":"Org Name","url":"source URL","email":"if found or null","phone":"if found or null","snippet":"context about this person","confidence":0.0-1.0}],"briefing":{"summary":"...","new_items":[{"title":"...","url":"..."}],"helpful_sources":[{"name":"...","url":"...","why":"..."}]}}
Only real people with verifiable sources. Never fabricate contacts.` },
      { role: "user", content: resultsText },
    ], { model: "google/gemini-2.5-flash", temperature: 0.1, timeoutMs: 30_000 });

    let items: Array<Record<string, unknown>> = [];
    let briefing: Record<string, unknown> = { summary: "People discovery completed." };

    if (llmResult.ok && llmResult.content) {
      const m = llmResult.content.match(/\{[\s\S]*\}/);
      if (m) { try { const p = JSON.parse(m[0]); items = Array.isArray(p.items) ? p.items : []; briefing = p.briefing || briefing; } catch {} }
    }

    let newCount = 0;
    const now = new Date().toISOString();
    for (const item of items) {
      const canonical = normalizeUrl(item.url as string);
      if (!canonical) continue;
      const { data: existing } = await supabase.from("discovered_items").select("id").eq("module", "people").eq("canonical_url", canonical).maybeSingle();
      if (existing) {
        await supabase.from("discovered_items").update({ last_seen_at: now, last_run_id: run_id, title: item.name, snippet: item.snippet, extracted: { title: item.title, email: item.email, phone: item.phone, confidence: item.confidence }, organization_name: item.organization }).eq("id", existing.id);
      } else {
        const { error } = await supabase.from("discovered_items").insert({ module: "people", canonical_url: canonical, title: item.name, snippet: item.snippet, extracted: { title: item.title, email: item.email, phone: item.phone, confidence: item.confidence }, organization_name: item.organization, first_seen_at: now, last_seen_at: now, last_run_id: run_id });
        if (!error) newCount++;
      }
    }

    await supabase.from("discovery_briefings").insert({ run_id, module: "people", scope, metro_id: metro_id || null, opportunity_id: opportunity_id || null, briefing_md: briefing.summary as string || "", briefing_json: briefing });
    await supabase.from("discovery_runs").update({ status: "completed", stats: { items_found: items.length, new_items: newCount }, completed_at: now }).eq("id", run_id);

    return jsonOk({ ok: true, items_found: items.length, new_items: newCount, ai_used: true });
  } catch (err) {
    console.error("[discovery-people-worker]", err);
    await supabase.from("discovery_runs").update({ status: "failed", error: { message: err instanceof Error ? err.message : String(err) }, completed_at: new Date().toISOString() }).eq("id", run_id);
    return jsonError(500, "PROCESSING_ERROR", err instanceof Error ? err.message : String(err));
  }
});
