import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_TYPES = [
  "nri_action_taken", "reconnection", "partner_found", "event_attended",
  "volunteer_returned", "provisio_fulfilled", "migration_success",
];

const FORBIDDEN_KEYS = ["body", "html", "raw", "full_text", "note_text", "email_body", "reflection_text"];

function containsForbidden(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(k)) return true;
    if (typeof v === "object" && containsForbidden(v)) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await anonClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { tenant_id, moment_type, summary, pointers } = body;

    if (!tenant_id || !moment_type || !summary) {
      return new Response(
        JSON.stringify({ error: "tenant_id, moment_type, and summary required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!VALID_TYPES.includes(moment_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid moment_type. Must be one of: ${VALID_TYPES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (summary.length > 240) {
      return new Response(
        JSON.stringify({ error: "Summary must be 240 characters or less" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pointers && containsForbidden(pointers)) {
      return new Response(
        JSON.stringify({ error: "Pointers contain forbidden PII keys" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: insertErr } = await svc.from("operator_value_moments").insert({
      tenant_id,
      moment_type,
      summary,
      pointers: pointers || {},
    });

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
