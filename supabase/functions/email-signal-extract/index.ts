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

// Valid signal types for email interpretation
const VALID_SIGNAL_TYPES = [
  "follow_up_needed",
  "collaboration_active",
  "onboarding_phase",
  "resource_request",
  "partnership_growth",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST");
  if (!authenticateServiceRequest(req)) return jsonError(401, "UNAUTHORIZED", "Invalid credentials");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const emailMessageId = body.email_message_id as string;
    const opportunityId = body.opportunity_id as string | undefined;

    if (!emailMessageId) return jsonError(400, "BAD_REQUEST", "email_message_id required");

    // Check idempotency
    const { data: existing } = await supabase
      .from("email_story_signals")
      .select("id")
      .eq("email_message_id", emailMessageId)
      .maybeSingle();

    if (existing) {
      return jsonOk({ ok: true, skipped: true, reason: "already_extracted" });
    }

    // Fetch ONLY safe fields — never body
    const { data: email, error: emailErr } = await supabase
      .from("email_communications")
      .select("id, subject, snippet, sent_at, sender_email, recipient_email")
      .eq("id", emailMessageId)
      .single();

    if (emailErr || !email) return jsonError(404, "NOT_FOUND", "Email not found");

    // Privacy: only use subject + safe snippet (max 280 chars)
    const safeSubject = (email.subject || "").slice(0, 200);
    const safeSnippet = (email.snippet || "").slice(0, 280);

    let signalType: string | null = null;
    let confidence: number | null = null;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY && (safeSubject.length > 3 || safeSnippet.length > 10)) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `Classify this email's relationship signal from its subject and snippet only.
Choose exactly one signal_type from: follow_up_needed, collaboration_active, onboarding_phase, resource_request, partnership_growth.
If uncertain, respond with signal_type "collaboration_active" and low confidence.`,
              },
              {
                role: "user",
                content: `Subject: ${safeSubject}\nSnippet: ${safeSnippet}`,
              },
            ],
            tools: [{
              type: "function",
              function: {
                name: "classify_email",
                description: "Classify email relationship signal",
                parameters: {
                  type: "object",
                  properties: {
                    signal_type: {
                      type: "string",
                      enum: [...VALID_SIGNAL_TYPES],
                    },
                    confidence: { type: "number" },
                  },
                  required: ["signal_type", "confidence"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "classify_email" } },
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            if (VALID_SIGNAL_TYPES.includes(parsed.signal_type)) {
              signalType = parsed.signal_type;
              confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
            }
          }
        }
      } catch (aiErr) {
        console.error("AI email classification failed:", aiErr);
        // Fail silently — insert nothing
      }
    }

    // Only insert if we got a valid signal
    if (!signalType) {
      return jsonOk({ ok: true, skipped: true, reason: "no_signal_detected" });
    }

    const { error: insertErr } = await supabase
      .from("email_story_signals")
      .insert({
        email_message_id: emailMessageId,
        opportunity_id: opportunityId || null,
        signal_type: signalType,
        confidence,
      });

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return jsonError(500, "DB_ERROR", insertErr.message);
    }

    return jsonOk({
      ok: true,
      email_message_id: emailMessageId,
      signal_type: signalType,
      confidence,
    });
  } catch (err) {
    console.error("email-signal-extract error:", err);
    return jsonError(500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
});
