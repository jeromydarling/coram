import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST");

  // User JWT auth
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return jsonError(401, "UNAUTHORIZED", "Missing authorization");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonError(401, "UNAUTHORIZED", "Invalid token");

    const body = await req.json();
    const suggestionId = body.suggestion_id as string;
    if (!suggestionId) return jsonError(400, "BAD_REQUEST", "suggestion_id required");

    // Fetch suggestion (RLS enforced — user must have metro access)
    const { data: suggestion, error: fetchErr } = await supabase
      .from("email_task_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .eq("status", "pending")
      .single();

    if (fetchErr || !suggestion) {
      return jsonError(404, "NOT_FOUND", "Suggestion not found or already processed");
    }

    // Create a relationship_action (the existing task system for opportunities)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: action, error: actionErr } = await serviceClient
      .from("relationship_actions")
      .insert({
        opportunity_id: suggestion.opportunity_id,
        action_type: "follow_up",
        title: suggestion.suggested_title,
        summary: suggestion.suggested_description || suggestion.suggested_title,
        due_date: suggestion.suggested_due_date,
        priority_score: Math.round((suggestion.confidence ?? 0.5) * 100),
        priority_label: "normal",
        drivers: [{ type: "email_parse", label: "Extracted from sent email" }],
        evidence: {
          source: "email_parse",
          suggestion_id: suggestionId,
          email_id: suggestion.email_id,
        },
        status: "open",
      })
      .select("id")
      .single();

    if (actionErr) {
      console.error("Failed to create action:", actionErr);
      return jsonError(500, "DB_ERROR", "Failed to create task");
    }

    // Mark suggestion as accepted
    await supabase
      .from("email_task_suggestions")
      .update({ status: "accepted" })
      .eq("id", suggestionId);

    return jsonOk({ ok: true, task_id: action?.id, suggestion_id: suggestionId });
  } catch (err) {
    console.error("email-actionitems-accept error:", err);
    return jsonError(500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
});
