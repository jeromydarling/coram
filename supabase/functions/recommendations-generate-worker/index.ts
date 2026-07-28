/**
 * recommendations-generate-worker — Pure LLM worker.
 *
 * WHAT: Assembles metro context (opportunities, signals, org facts) → LLM generates strategic recommendations.
 * WHERE: Called by n8n-dispatch instead of dispatching to n8n.
 * WHY: Eliminates n8n dependency for recommendations_generate workflow.
 *
 * Input: { run_id, metro_id, horizon_days, opportunities[], recent_signals[], org_facts[], watchlist_signals[] }
 * Output: Writes to ai_recommendations table, returns recommendation_id.
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

  const { run_id, metro_id, horizon_days, opportunities, recent_signals, org_facts, watchlist_signals } = body as {
    run_id: string; metro_id: string; horizon_days?: number;
    opportunities?: unknown[]; recent_signals?: unknown[]; org_facts?: unknown[]; watchlist_signals?: unknown[];
  };

  if (!run_id || !metro_id) return jsonError(400, "MISSING_FIELD", "run_id and metro_id required");

  try {
    // Get metro name for context
    const { data: metro } = await supabase.from("metros").select("metro, region").eq("id", metro_id).maybeSingle();
    const metroName = metro?.metro || "Unknown Metro";
    const region = metro?.region || "";

    // Build context for LLM
    const contextParts = [`Metro: ${metroName}${region ? ` (${region})` : ""}`, `Horizon: ${horizon_days || 30} days`];

    if (Array.isArray(opportunities) && opportunities.length > 0) {
      contextParts.push(`Active Opportunities (${opportunities.length}):\n${JSON.stringify(opportunities.slice(0, 20), null, 1)}`);
    }
    if (Array.isArray(recent_signals) && recent_signals.length > 0) {
      contextParts.push(`Recent Signals (${recent_signals.length}):\n${JSON.stringify(recent_signals.slice(0, 30), null, 1)}`);
    }
    if (Array.isArray(org_facts) && org_facts.length > 0) {
      contextParts.push(`Org Facts (${org_facts.length}):\n${JSON.stringify(org_facts.slice(0, 30), null, 1)}`);
    }
    if (Array.isArray(watchlist_signals) && watchlist_signals.length > 0) {
      contextParts.push(`Watchlist Signals (${watchlist_signals.length}):\n${JSON.stringify(watchlist_signals.slice(0, 30), null, 1)}`);
    }

    const llmResult = await callLlm(
      [
        {
          role: "system",
          content: `You are a strategic advisor for nonprofit community organizations. Given metro context, active opportunities, recent signals, and org intelligence, generate ONE actionable strategic recommendation.

Return ONLY valid JSON:
{"recommendation_type":"expansion|deepening|risk_mitigation|partnership|event_strategy|grant_pursuit","title":"...","body":"...","priority":"low|medium|high","metadata":{"reasoning":"...","key_signals":["..."],"confidence":0.0-1.0}}

Be specific and actionable. Reference actual organizations and signals when possible. Never fabricate data.`,
        },
        { role: "user", content: contextParts.join("\n\n") },
      ],
      { model: "google/gemini-3-flash-preview", temperature: 0.3, timeoutMs: 45_000 },
    );

    let rec: Record<string, unknown> = {
      recommendation_type: "general",
      title: "Review metro opportunities",
      body: "Insufficient context to generate specific recommendation.",
      priority: "medium",
      metadata: null,
    };

    if (llmResult.ok && llmResult.content) {
      const jsonMatch = llmResult.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          rec = {
            recommendation_type: String(parsed.recommendation_type || "general"),
            title: String(parsed.title || "Untitled"),
            body: typeof parsed.body === "string" ? parsed.body : null,
            priority: ["low", "medium", "high"].includes(parsed.priority) ? parsed.priority : "medium",
            metadata: parsed.metadata ?? null,
          };
        } catch { /* use defaults */ }
      }
    }

    // Compute inputs_hash for dedup
    const inputStr = JSON.stringify({ metro_id, opportunities: opportunities?.length, signals: recent_signals?.length });
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inputStr));
    const inputs_hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);

    // Write to ai_recommendations (same as n8n-ingest handler)
    const { data, error } = await supabase
      .from("ai_recommendations")
      .upsert({
        run_id,
        metro_id,
        inputs_hash,
        recommendation_type: rec.recommendation_type as string,
        title: rec.title as string,
        body: rec.body as string | null,
        priority: rec.priority as string,
        metadata: rec.metadata,
        updated_at: new Date().toISOString(),
      }, { onConflict: "metro_id,inputs_hash" })
      .select("id")
      .single();

    if (error) throw new Error(`ai_recommendations upsert failed: ${error.message}`);

    return jsonOk({ ok: true, recommendation_id: data.id, recommendation_type: rec.recommendation_type, ai_used: true });
  } catch (err) {
    console.error("[recommendations-generate-worker] Error:", err);
    return jsonError(500, "PROCESSING_ERROR", err instanceof Error ? err.message : String(err));
  }
});
