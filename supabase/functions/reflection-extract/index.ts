import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

function authenticateServiceRequest(req: Request): boolean {
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    if (authHeader.slice(7).trim() === serviceRoleKey) return true;
  }

  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  if (!token) return false;

  return (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST");
  if (!authenticateServiceRequest(req)) return jsonError(401, "UNAUTHORIZED", "Invalid credentials");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const reflectionId = body.reflection_id as string;
    if (!reflectionId) return jsonError(400, "BAD_REQUEST", "reflection_id required");

    // Fetch the reflection body for extraction
    const { data: reflection, error: refErr } = await supabase
      .from("opportunity_reflections")
      .select("id, body, opportunity_id")
      .eq("id", reflectionId)
      .single();

    if (refErr || !reflection) return jsonError(404, "NOT_FOUND", "Reflection not found");

    // Attempt AI extraction
    let topics: string[] = [];
    let relationshipSignals: Array<{ type: string; value?: string }> = [];
    let sentiment: string | null = null;
    let confidence: number | null = null;
    let model: string | null = null;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY && reflection.body && reflection.body.length > 10) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `Extract structured signals from a team reflection about a nonprofit partner.
Output ONLY structured data. Never reproduce the raw text.
Return topics (2-5 short phrases), relationship_signals (0-3 signal objects with type from: leadership_change, new_program, community_need, resource_request, collaboration_active, partnership_growth, onboarding_phase), and sentiment (positive/neutral/cautious).`,
              },
              { role: "user", content: reflection.body.slice(0, 2000) },
            ],
            tools: [{
              type: "function",
              function: {
                name: "extract_signals",
                description: "Extract topics and signals from a reflection",
                parameters: {
                  type: "object",
                  properties: {
                    topics: { type: "array", items: { type: "string" } },
                    relationship_signals: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          type: { type: "string" },
                          value: { type: "string" },
                        },
                        required: ["type"],
                      },
                    },
                    sentiment: { type: "string", enum: ["positive", "neutral", "cautious"] },
                  },
                  required: ["topics", "relationship_signals", "sentiment"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "extract_signals" } },
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 5) : [];
            relationshipSignals = Array.isArray(parsed.relationship_signals)
              ? parsed.relationship_signals.slice(0, 3)
              : [];
            sentiment = typeof parsed.sentiment === "string" ? parsed.sentiment : null;
            confidence = 0.7;
            model = "gemini-2.5-flash";
          }
        }
      } catch (aiErr) {
        console.error("AI extraction failed, using empty fallback:", aiErr);
        // Fallback: empty arrays — never block reflection creation
      }
    }

    // Upsert extraction (idempotent by reflection_id UNIQUE constraint)
    const { error: upsertErr } = await supabase
      .from("reflection_extractions")
      .upsert({
        reflection_id: reflectionId,
        topics,
        relationship_signals: relationshipSignals,
        sentiment,
        confidence,
        model,
      }, { onConflict: "reflection_id" });

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      return jsonError(500, "DB_ERROR", upsertErr.message);
    }

    return jsonOk({
      ok: true,
      reflection_id: reflectionId,
      topics_count: topics.length,
      signals_count: relationshipSignals.length,
      sentiment,
    });
  } catch (err) {
    console.error("reflection-extract error:", err);
    return jsonError(500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
});
