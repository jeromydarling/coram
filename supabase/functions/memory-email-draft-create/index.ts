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

function jsonError(status: number, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "Only POST");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonError(401, "Auth required");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return jsonError(401, "Invalid token");

  try {
    const body = await req.json();
    const { opportunity_id, subject, body: emailBody, context } = body;

    if (!subject || !emailBody) return jsonError(400, "subject and body required");

    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data, error } = await serviceClient
      .from("memory_email_drafts")
      .insert({
        user_id: user.id,
        opportunity_id: opportunity_id || null,
        subject,
        body: emailBody,
        context: context || {},
      })
      .select("id")
      .single();

    if (error) return jsonError(500, error.message);

    return jsonOk({ ok: true, id: data.id });
  } catch (err) {
    console.error("memory-email-draft-create error:", err);
    return jsonError(500, err instanceof Error ? err.message : "Unknown error");
  }
});
