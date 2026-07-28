/**
 * relatio-connect — Creates or reconnects an integration installation for a tenant.
 * POST body: { tenant_id, integration_key, config? }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: authError } = await supabase.auth.getClaims(token);
  if (authError || !claims?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claims.claims.sub as string;

  try {
    const body = await req.json();
    const { tenant_id, integration_key, config } = body;

    if (!tenant_id || !integration_key) {
      return new Response(
        JSON.stringify({ error: "tenant_id and integration_key are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user belongs to tenant
    const { data: membership } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member of this tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify integration exists and is active
    const { data: integration } = await supabase
      .from("relatio_integrations")
      .select("key")
      .eq("key", integration_key)
      .eq("active", true)
      .maybeSingle();

    if (!integration) {
      return new Response(JSON.stringify({ error: "Integration not found or disabled" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert installation
    const { data: installation, error: upsertError } = await supabase
      .from("relatio_installations")
      .upsert(
        {
          tenant_id,
          integration_key,
          status: "connected",
          config: config || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,integration_key" }
      )
      .select()
      .single();

    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ installation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
