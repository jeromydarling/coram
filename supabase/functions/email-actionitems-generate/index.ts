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

const ALLOWED_SIGNAL_TYPES = [
  "follow_up_needed",
  "collaboration_active",
  "onboarding_phase",
  "resource_request",
  "partnership_growth",
  "schedule_meeting",
  "send_information",
  "check_in",
] as const;

interface ActionItem {
  title: string;
  description?: string;
  due_date?: string;
  confidence: number;
  evidence_excerpt?: string;
}

function normalizeDedupe(opportunityId: string, emailId: string, title: string): string {
  const normalizedTitle = title.trim().replace(/\s+/g, " ").toLowerCase();
  return `email_action:${opportunityId}:${emailId}:${normalizedTitle}`;
}

function safeSnippet(text: string | null, max: number): string {
  if (!text) return "";
  return text.slice(0, max).trim();
}

/** Deterministic heuristic fallback when AI fails */
function heuristicExtract(subject: string, snippet: string): ActionItem[] {
  const combined = `${subject} ${snippet}`.toLowerCase();
  const items: ActionItem[] = [];

  if (combined.includes("next step") || (combined.includes("re:") && combined.includes("follow"))) {
    items.push({
      title: "Follow up on this conversation",
      confidence: 0.3,
      evidence_excerpt: safeSnippet(subject, 140),
    });
  }

  const commitPhrases = ["i will", "we will", "i'll", "we'll", "can you", "please send", "please share"];
  for (const phrase of commitPhrases) {
    if (combined.includes(phrase)) {
      items.push({
        title: "Review commitment from this email",
        confidence: 0.25,
        evidence_excerpt: safeSnippet(subject, 140),
      });
      break;
    }
  }

  return items.slice(0, 1); // Max 1 from heuristics
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST");
  if (!authenticateServiceRequest(req)) return jsonError(401, "UNAUTHORIZED", "Invalid credentials");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const opportunityId = body.opportunity_id as string;
    if (!opportunityId) return jsonError(400, "BAD_REQUEST", "opportunity_id required");

    const windowDays = Math.min(body.window_days ?? 1, 30);
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    // Find contacts for this opportunity
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id")
      .eq("opportunity_id", opportunityId);

    const contactIds = (contacts || []).map((c: { id: string }) => c.id);
    if (contactIds.length === 0) {
      return jsonOk({ ok: true, opportunity_id: opportunityId, processed_emails: 0, suggestions_created: 0, reason: "no_contacts" });
    }

    // Fetch recent SENT emails (only safe fields — NO body)
    const { data: emails } = await supabase
      .from("email_communications")
      .select("id, subject, snippet, sent_at, sender_email, recipient_email")
      .in("contact_id", contactIds)
      .gte("sent_at", cutoff)
      .order("sent_at", { ascending: false })
      .limit(20);

    if (!emails || emails.length === 0) {
      return jsonOk({ ok: true, opportunity_id: opportunityId, processed_emails: 0, suggestions_created: 0, reason: "no_recent_emails" });
    }

    let totalSuggestions = 0;
    const MAX_TOTAL = 30;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    for (const email of emails) {
      if (totalSuggestions >= MAX_TOTAL) break;

      const safeSubject = safeSnippet(email.subject, 200);
      const safeSnip = safeSnippet(email.snippet, 500);

      let items: ActionItem[] = [];

      // Try AI extraction
      if (LOVABLE_API_KEY && (safeSubject.length > 3 || safeSnip.length > 10)) {
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
                  content: `You extract action items from sent email metadata. Use gentle, relationship-first language. Never use urgency words like "urgent", "critical", "ASAP", "immediately", "overdue". Output STRICT JSON.`,
                },
                {
                  role: "user",
                  content: `Subject: ${safeSubject}\nSnippet: ${safeSnip}\nSent: ${email.sent_at}\nTo: ${email.recipient_email}\n\nExtract 0-3 action items. Each has: title (<=120 chars, gentle tone), description (<=500, optional), due_date (YYYY-MM-DD, optional), confidence (0-1), evidence_excerpt (<=280, optional).`,
                },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "extract_actions",
                  description: "Extract action items from email metadata",
                  parameters: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            description: { type: "string" },
                            due_date: { type: "string" },
                            confidence: { type: "number" },
                            evidence_excerpt: { type: "string" },
                          },
                          required: ["title", "confidence"],
                        },
                      },
                    },
                    required: ["items"],
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "extract_actions" } },
            }),
            signal: AbortSignal.timeout(10000),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              const parsed = JSON.parse(toolCall.function.arguments);
              if (Array.isArray(parsed.items)) {
                items = parsed.items.slice(0, 3).filter(
                  (it: ActionItem) => it.title && typeof it.title === "string" && it.title.length <= 200,
                );
              }
            }
          }
        } catch (aiErr) {
          console.warn("AI extraction failed, using heuristic fallback:", aiErr);
        }
      }

      // Heuristic fallback
      if (items.length === 0) {
        items = heuristicExtract(safeSubject, safeSnip);
      }

      // Upsert suggestions (dedupe by key)
      for (const item of items) {
        if (totalSuggestions >= MAX_TOTAL) break;

        const dedupeKey = normalizeDedupe(opportunityId, email.id, item.title);
        const excerpt = safeSnippet(item.evidence_excerpt ?? safeSubject, 280);

        const { error: upsertErr } = await supabase
          .from("email_task_suggestions")
          .upsert(
            {
              opportunity_id: opportunityId,
              email_id: email.id,
              suggested_title: item.title.slice(0, 200),
              suggested_description: item.description?.slice(0, 2000) ?? null,
              suggested_due_date: item.due_date ?? null,
              confidence: Math.min(Math.max(item.confidence ?? 0.5, 0), 1),
              extracted_spans: excerpt ? [{ excerpt: excerpt.slice(0, 280) }] : [],
              dedupe_key: dedupeKey,
              created_by: body.user_id ?? "00000000-0000-0000-0000-000000000000",
            },
            { onConflict: "dedupe_key", ignoreDuplicates: true },
          );

        if (!upsertErr) totalSuggestions++;
      }
    }

    return jsonOk({
      ok: true,
      opportunity_id: opportunityId,
      processed_emails: emails.length,
      suggestions_created: totalSuggestions,
    });
  } catch (err) {
    console.error("email-actionitems-generate error:", err);
    return jsonError(500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
});
