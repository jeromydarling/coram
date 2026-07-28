/**
 * grant-alignment-worker — Pure LLM worker.
 *
 * WHAT: Scores alignment between organizations and grants using LLM analysis.
 * WHERE: Called internally by dispatch instead of n8n.
 * WHY: Eliminates n8n dependency for grant_alignment_score workflow.
 *
 * Input: { run_id, pairs: [{ org_id, grant_id }] }
 * Output: Writes to grant_alignment table, returns scores.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateWorkerRequest, jsonOk, jsonError, corsHeaders } from "../_shared/workerAuth.ts";
import { callLlm } from "../_shared/llmGateway.ts";

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

  const run_id = body.run_id as string;
  const pairs = body.pairs as Array<{ org_id: string; grant_id: string }> | undefined;

  if (!run_id) return jsonError(400, "MISSING_FIELD", "run_id required");
  if (!Array.isArray(pairs) || pairs.length === 0) return jsonError(400, "MISSING_FIELD", "pairs[] required");

  try {
    const results: Array<{ org_id: string; grant_id: string; score: number; rationale: string }> = [];

    // Process pairs in small batches (up to 5 at a time for LLM context)
    for (let i = 0; i < pairs.length; i += 5) {
      const batch = pairs.slice(i, i + 5);

      // Fetch context for each pair
      const contextParts: string[] = [];
      for (const pair of batch) {
        const [orgResult, grantResult] = await Promise.all([
          supabase.from("opportunities").select("organization, mission, website, metro_id").eq("id", pair.org_id).maybeSingle(),
          supabase.from("discovered_items").select("title, snippet, extracted, canonical_url").eq("id", pair.grant_id).maybeSingle(),
        ]);

        // Also check org_enrichment_facts
        const { data: facts } = await supabase
          .from("org_enrichment_facts")
          .select("mission_summary, programs, populations_served, geographies, keywords")
          .eq("org_name", orgResult.data?.organization || "")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        contextParts.push(`--- Pair ${contextParts.length + 1} ---
Org (${pair.org_id}): ${orgResult.data?.organization || "Unknown"}
Mission: ${orgResult.data?.mission || facts?.mission_summary || "N/A"}
Programs: ${facts?.programs?.join(", ") || "N/A"}
Populations: ${facts?.populations_served?.join(", ") || "N/A"}
Geographies: ${facts?.geographies?.join(", ") || "N/A"}

Grant (${pair.grant_id}): ${grantResult.data?.title || "Unknown"}
Description: ${grantResult.data?.snippet || "N/A"}
Details: ${JSON.stringify(grantResult.data?.extracted || {}).slice(0, 500)}
URL: ${grantResult.data?.canonical_url || "N/A"}`);
      }

      const llmResult = await callLlm(
        [
          {
            role: "system",
            content: `You are a grant alignment analyst. Score how well each organization aligns with each grant opportunity.

Return ONLY valid JSON array:
[{"org_id":"...","grant_id":"...","score":0-100,"rationale":"1-2 sentence explanation"}]

Score guide: 80-100=strong fit, 60-79=moderate, 40-59=weak, 0-39=poor fit.
Base scores on mission alignment, geographic match, population overlap, and program relevance.`,
          },
          { role: "user", content: contextParts.join("\n\n") },
        ],
        { model: "google/gemini-2.5-flash", temperature: 0.1, timeoutMs: 30_000 },
      );

      if (llmResult.ok && llmResult.content) {
        const arrMatch = llmResult.content.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          try {
            const parsed = JSON.parse(arrMatch[0]) as Array<Record<string, unknown>>;
            for (const r of parsed) {
              results.push({
                org_id: String(r.org_id),
                grant_id: String(r.grant_id),
                score: Math.min(100, Math.max(0, Number(r.score) || 0)),
                rationale: String(r.rationale || ""),
              });
            }
          } catch { /* skip malformed batch */ }
        }
      }
    }

    // Write to grant_alignment table
    let inserted = 0;
    for (const r of results) {
      const { error } = await supabase
        .from("grant_alignment")
        .upsert({
          org_id: r.org_id,
          grant_id: r.grant_id,
          score: Math.round(r.score),
          rationale: r.rationale || null,
          run_id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "org_id,grant_id" });

      if (!error) inserted++;
      else if (error.code !== "23505") console.error(`grant_alignment upsert: ${error.message}`);
    }

    return jsonOk({ ok: true, run_id, inserted, total: results.length, ai_used: true });
  } catch (err) {
    console.error("[grant-alignment-worker] Error:", err);
    return jsonError(500, "PROCESSING_ERROR", err instanceof Error ? err.message : String(err));
  }
});
