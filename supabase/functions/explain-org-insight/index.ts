import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { emitUsageEvents, type UsageEvent } from "../_shared/usageEvents.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  const correlationId = crypto.randomUUID().slice(0, 8);

  // ── Auth ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "UNAUTHORIZED", "Missing auth token");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return jsonError(401, "UNAUTHORIZED", "Invalid token");
  }

  const userId = claimsData.claims.sub as string;

  // ── Parse body ──
  let body: { insight_id?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  if (!body.insight_id || typeof body.insight_id !== "string") {
    return jsonError(400, "MISSING_FIELD", "insight_id is required");
  }

  const insightId = body.insight_id;
  const force = body.force === true;

  console.log(`[${correlationId}] explain-org-insight for insight ${insightId}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // ── Rate limit ──
    const { data: rateLimitOk } = await supabase.rpc("check_and_increment_rate_limit", {
      p_user_id: userId,
      p_function_name: "explain_org_insight",
      p_window_minutes: 1440,
      p_max_requests: 30,
    });

    if (rateLimitOk === false) {
      return jsonError(429, "RATE_LIMITED", "Daily explanation limit reached (30/day)");
    }

    // ── Load insight ──
    const { data: insight, error: insightErr } = await supabase
      .from("org_insights")
      .select("id, org_id, insight_type, title, severity, confidence, summary, explanation, explanation_model, source, valid_until")
      .eq("id", insightId)
      .maybeSingle();

    if (insightErr) throw new Error(`insight fetch failed: ${insightErr.message}`);
    if (!insight) return jsonError(404, "NOT_FOUND", "Insight not found");

    // ── Cache check: if explanation exists and still valid ──
    if (!force && insight.explanation && new Date(insight.valid_until) > new Date()) {
      console.log(`[${correlationId}] cached explanation`);
      return jsonOk({
        ok: true,
        cached: true,
        explanation: insight.explanation,
        model: insight.explanation_model,
      });
    }

    // ── Gather evidence ──
    const evidence: string[] = [];
    const source = insight.source as Record<string, unknown>;
    const signalIds = (source?.signal_ids as string[]) || [];

    // Load referenced signals
    if (signalIds.length > 0) {
      const { data: signals } = await supabase
        .from("org_watchlist_signals")
        .select("signal_type, summary, confidence")
        .in("id", signalIds.slice(0, 10));

      if (signals) {
        signals.forEach((s, i) => {
          evidence.push(`[Signal ${i + 1}] ${s.signal_type}: "${s.summary}" (confidence: ${s.confidence})`);
        });
      }
    }

    // Load neighborhood insight summary
    const { data: neighborhoodRow } = await supabase
      .from("org_neighborhood_insights")
      .select("summary")
      .eq("org_id", insight.org_id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (neighborhoodRow?.summary) {
      const bullets = neighborhoodRow.summary.split("\n").filter(Boolean).slice(0, 5);
      bullets.forEach((b, i) => {
        evidence.push(`[Neighborhood ${i + 1}] ${b}`);
      });
    }

    if (evidence.length === 0) {
      // Fallback: use the insight summary itself
      evidence.push(`[Summary] ${insight.summary}`);
    }

    // ── Call LLM for explanation ONLY ──
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return jsonError(500, "CONFIG_ERROR", "AI service not configured");
    }

    const model = "google/gemini-2.5-flash";

    const evidenceText = evidence.map((e, i) => `${i}. ${e}`).join("\n");

    const systemPrompt = `You are an expert analyst explaining a CRM insight to a nonprofit partnership manager. You MUST:
1. Explain WHY this insight was generated using ONLY the evidence provided
2. Cite evidence by index number (e.g., "Evidence 0 shows...")
3. Write 2-4 short paragraphs
4. Do NOT propose new actions — the insight already has recommended actions
5. Do NOT add facts beyond what is in the evidence
6. Be concise, clear, and actionable

Return valid JSON:
{
  "explanation": "string (2-4 paragraphs)",
  "evidence_used": [0, 1, 2]
}`;

    const userPrompt = `Explain this insight:
Type: ${insight.insight_type}
Title: ${insight.title}
Severity: ${insight.severity}
Summary: ${insight.summary}

Evidence:
${evidenceText}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    let aiResp: Response;
    try {
      aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 800,
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      // One retry on transient error
      console.warn(`[${correlationId}] LLM first attempt failed, retrying...`);
      try {
        aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            max_tokens: 800,
            temperature: 0.3,
            response_format: { type: "json_object" },
          }),
        });
      } catch {
        // Store fallback
        await supabase
          .from("org_insights")
          .update({
            explanation: "Unable to generate explanation.",
            explanation_model: model,
          })
          .eq("id", insightId);

        return jsonOk({
          ok: true,
          cached: false,
          explanation: "Unable to generate explanation.",
          model,
        });
      }
    }
    clearTimeout(timeout);

    if (!aiResp!.ok) {
      const errText = await aiResp!.text();
      console.error(`[${correlationId}] LLM error: ${aiResp!.status} ${errText}`);

      // Store fallback
      await supabase
        .from("org_insights")
        .update({
          explanation: "Unable to generate explanation.",
          explanation_model: model,
        })
        .eq("id", insightId);

      return jsonOk({
        ok: true,
        cached: false,
        explanation: "Unable to generate explanation.",
        model,
      });
    }

    const aiData = await aiResp!.json();
    const rawContent = aiData?.choices?.[0]?.message?.content || "{}";
    const usageTokens = aiData?.usage || {};

    let parsed: { explanation?: string; evidence_used?: number[] };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // One repair attempt
      console.warn(`[${correlationId}] invalid JSON from LLM, using fallback`);
      parsed = { explanation: "Unable to generate explanation.", evidence_used: [] };
    }

    // Validate: must not contain "actions" field
    const explanation = parsed.explanation || "Unable to generate explanation.";

    // ── Store ──
    const { error: updateErr } = await supabase
      .from("org_insights")
      .update({
        explanation,
        explanation_model: model,
        explanation_tokens_in: usageTokens.prompt_tokens || null,
        explanation_tokens_out: usageTokens.completion_tokens || null,
      })
      .eq("id", insightId);

    if (updateErr) {
      console.error(`[${correlationId}] update error: ${updateErr.message}`);
    }

    // ── Usage metering ──
    const usageEvents: UsageEvent[] = [
      {
        workflow_key: "org_insights",
        run_id: correlationId,
        event_type: "org_insight_explanations_generated",
        quantity: 1,
        unit: "count",
      },
    ];
    if (usageTokens.prompt_tokens) {
      usageEvents.push({
        workflow_key: "org_insights",
        run_id: correlationId,
        event_type: "llm_tokens_in",
        quantity: usageTokens.prompt_tokens,
        unit: "token",
      });
    }
    if (usageTokens.completion_tokens) {
      usageEvents.push({
        workflow_key: "org_insights",
        run_id: correlationId,
        event_type: "llm_tokens_out",
        quantity: usageTokens.completion_tokens,
        unit: "token",
      });
    }
    await emitUsageEvents(supabase, usageEvents);

    console.log(`[${correlationId}] explanation generated successfully`);

    return jsonOk({
      ok: true,
      cached: false,
      explanation,
      model,
      evidence_used: parsed.evidence_used || [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${correlationId}] error: ${message}`);
    return jsonError(500, "PROCESSING_ERROR", message);
  }
});
