import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  compileMetroKeywords,
  buildNewsSearchQueries,
} from "../_shared/metroKeywordCompiler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

/** Deterministic signal strength: 0–100 */
export function computeSignalStrength(
  itemsUsed: number,
  topicsUsed: number,
  hasNeedSignals: boolean,
): number {
  let score = 0;
  score += Math.min(50, itemsUsed * 5);
  score += Math.min(30, topicsUsed * 3);
  if (hasNeedSignals) score += 20;
  return Math.max(0, Math.min(100, score));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth: service secret OR user JWT ──
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  let isServiceAuth = false;
  let userToken = "";

  if (authHeader.startsWith("Bearer ") && authHeader.slice(7).trim() === serviceRoleKey) {
    isServiceAuth = true;
  } else if (apiKeyHeader) {
    const token = apiKeyHeader.trim();
    if (
      (sharedSecret && constantTimeCompare(token, sharedSecret)) ||
      (enrichmentSecret && constantTimeCompare(token, enrichmentSecret))
    ) {
      isServiceAuth = true;
    }
  } else if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (
      (sharedSecret && constantTimeCompare(token, sharedSecret)) ||
      (enrichmentSecret && constantTimeCompare(token, enrichmentSecret))
    ) {
      isServiceAuth = true;
    } else {
      userToken = token;
    }
  }

  if (!isServiceAuth && !userToken) {
    return jsonError(401, "unauthorized", "Missing credentials");
  }

  let supabase: ReturnType<typeof createClient>;
  if (isServiceAuth) {
    supabase = createClient(supabaseUrl, serviceRoleKey);
  } else {
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(userToken);
    if (claimsErr || !claimsData?.claims) {
      return jsonError(401, "unauthorized", "Invalid token");
    }
    const userId = claimsData.claims.sub as string;

    const svc = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", userId);
    const userRoles = (roles ?? []).map((r: { role: string }) => r.role);
    if (!userRoles.some((r) => ["admin", "leadership", "regional_lead", "staff"].includes(r))) {
      return jsonError(403, "forbidden", "Insufficient role");
    }
    supabase = svc;
  }

  const t0 = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const metroId = body.metro_id as string | undefined;
    if (!metroId) return jsonError(400, "missing_field", "metro_id required");

    const { data: metro, error: metroErr } = await supabase
      .from("metros")
      .select("id, metro")
      .eq("id", metroId)
      .single();
    if (metroErr || !metro) return jsonError(404, "not_found", "Metro not found");

    // ── Create run record ──
    const runId = crypto.randomUUID();
    await supabase.from("metro_news_runs").insert({
      id: runId,
      metro_id: metroId,
      status: "running",
      ran_at: new Date().toISOString(),
    });

    try {
      // 1. Compile keywords
      const compiled = await compileMetroKeywords(supabase, metroId);
      if (compiled.keywords.length === 0) {
        await supabase.from("metro_news_runs").update({
          status: "completed",
          articles_found: 0,
          articles_persisted: 0,
          duration_ms: Date.now() - t0,
        }).eq("id", runId);

        return jsonOk({
          ok: true,
          metro_id: metroId,
          run_id: runId,
          message: "No keywords available — nothing to search",
          queries_used: [],
          results_count: 0,
          used_keywords_count: 0,
        });
      }

      // 2. Build search queries
      const queries = buildNewsSearchQueries(metro.metro, compiled.keywords);

      // 3. Execute searches via Perplexity (sonar-pro)
      const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
      const allResults: Array<{
        title: string;
        snippet: string;
        source_url: string;
        published_date: string | null;
        query_label: string;
        matched_categories: string[];
      }> = [];
      const runErrors: Array<{ query: string; error: string }> = [];
      let totalRaw = 0;

      if (perplexityKey) {
        for (const q of queries) {
          try {
            const resp = await fetch("https://api.perplexity.ai/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${perplexityKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "sonar-pro",
                messages: [
                  { role: "system", content: "You are a local news researcher. Return only recent news articles relevant to the query. For each article, provide title, snippet (1-2 sentences), and source_url. Return as JSON array." },
                  { role: "user", content: `Find recent news articles (last 7 days) about: ${q.query}` },
                ],
                search_recency_filter: "week",
                response_format: {
                  type: "json_schema",
                  json_schema: {
                    name: "news_results",
                    schema: {
                      type: "object",
                      properties: {
                        articles: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              title: { type: "string" },
                              snippet: { type: "string" },
                              source_url: { type: "string" },
                            },
                            required: ["title", "snippet"],
                          },
                        },
                      },
                      required: ["articles"],
                    },
                  },
                },
              }),
              signal: AbortSignal.timeout(20000),
            });

            if (resp.ok) {
              const searchData = await resp.json();
              const content = searchData.choices?.[0]?.message?.content;
              let articles: Array<{ title: string; snippet: string; source_url?: string }> = [];
              try {
                const parsed = JSON.parse(content);
                articles = parsed.articles ?? [];
              } catch { /* ignore parse errors */ }

              // Also capture citations as source URLs
              const citations = searchData.citations ?? [];

              totalRaw += articles.length;
              for (let i = 0; i < articles.length; i++) {
                const item = articles[i];
                allResults.push({
                  title: item.title ?? "Untitled",
                  snippet: (item.snippet ?? "").slice(0, 300),
                  source_url: item.source_url || citations[i] || "",
                  published_date: null,
                  query_label: q.label,
                  matched_categories: q.keywords_used.map((k: { category: string }) => k.category),
                });
              }
            } else {
              const errText = await resp.text();
              console.error(`Perplexity search failed for ${q.label}:`, resp.status, errText);
              runErrors.push({ query: q.label, error: `${resp.status}: ${errText.slice(0, 200)}` });
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`Search error for ${q.label}:`, msg);
            runErrors.push({ query: q.label, error: msg });
          }
        }
      } else {
        console.log("PERPLEXITY_API_KEY not set — skipping search execution");
      }

      // 4. Deduplicate by URL
      const seenUrls = new Set<string>();
      const unique = allResults.filter((r) => {
        if (!r.source_url || seenUrls.has(r.source_url)) return false;
        seenUrls.add(r.source_url);
        return true;
      });

      // 5. Persist to discovery_highlights
      const persisted = unique.slice(0, 30);
      if (persisted.length > 0) {
        // Also create a discovery_run record for backward compat
        const discoveryRunId = crypto.randomUUID();
        await supabase.from("discovery_runs").insert({
          id: discoveryRunId,
          module: "metro_news",
          scope: "metro",
          metro_id: metroId,
          status: "completed",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          query_profile: { queries: queries.map((q) => q.query), keyword_count: compiled.keywords.length },
          stats: { total_results: totalRaw, unique_results: unique.length },
        });

        const highlights = persisted.map((r) => ({
          run_id: discoveryRunId,
          module: "metro_news",
          kind: "article",
          payload: {
            title: r.title,
            snippet: r.snippet,
            source_url: r.source_url,
            published_date: r.published_date,
            query_label: r.query_label,
            community_impact_tags: [],
            metro_id: metroId,
          },
        }));
        await supabase.from("discovery_highlights").insert(highlights);
      }

      // 6. Compute signal strength (deterministic)
      const distinctCategories = new Set(unique.flatMap((r) => r.matched_categories));
      const hasNeedSignals = distinctCategories.has("need_signals");
      const signalStrength = computeSignalStrength(persisted.length, distinctCategories.size, hasNeedSignals);

      // 7. Update metro_news_runs with final stats
      const keywordSnapshot = compiled.keywords.map((k) => ({
        keyword: k.keyword,
        category: k.category,
        weight: k.weight,
      }));
      const queriesUsed = queries.map((q) => ({
        label: q.label,
        query: q.query,
        keywords: q.keywords_used,
      }));

      await supabase.from("metro_news_runs").update({
        status: "completed",
        queries_used: queriesUsed,
        keyword_snapshot: keywordSnapshot,
        source_count: queries.length,
        articles_found: totalRaw,
        articles_deduped: unique.length,
        articles_persisted: persisted.length,
        errors: runErrors,
        duration_ms: Date.now() - t0,
      }).eq("id", runId);

      return jsonOk({
        ok: true,
        metro_id: metroId,
        metro_name: metro.metro,
        run_id: runId,
        queries_used: queriesUsed,
        results_count: totalRaw,
        unique_results: unique.length,
        articles_persisted: persisted.length,
        used_keywords_count: compiled.keywords.length,
        signal_strength: signalStrength,
        duration_ms: Date.now() - t0,
      });
    } catch (innerErr) {
      const errMsg = innerErr instanceof Error ? innerErr.message : String(innerErr);
      await supabase.from("metro_news_runs").update({
        status: "failed",
        errors: [{ error: errMsg }],
        duration_ms: Date.now() - t0,
      }).eq("id", runId);
      throw innerErr;
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("Metro news run error:", errMsg);
    return jsonError(500, "internal_error", errMsg);
  }
});
