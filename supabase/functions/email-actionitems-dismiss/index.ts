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

    // RLS enforced — user must have metro access
    const { error } = await supabase
      .from("email_task_suggestions")
      .update({ status: "dismissed" })
      .eq("id", suggestionId)
      .eq("status", "pending");

    if (error) {
      return jsonError(404, "NOT_FOUND", "Suggestion not found or already processed");
    }

    return jsonOk({ ok: true, suggestion_id: suggestionId });
  } catch (err) {
    console.error("email-actionitems-dismiss error:", err);
    return jsonError(500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
});
