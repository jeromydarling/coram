/**
 * relatio-import-start — Starts a migration job for a one-way import.
 * POST body: { tenant_id, integration_key }
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
    const { tenant_id, integration_key } = await req.json();

    if (!tenant_id || !integration_key) {
      return new Response(
        JSON.stringify({ error: "tenant_id and integration_key are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify membership
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
      .select("key, is_two_way")
      .eq("key", integration_key)
      .eq("active", true)
      .maybeSingle();

    if (!integration) {
      return new Response(JSON.stringify({ error: "Integration not found or disabled" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify installation is connected
    const { data: installation } = await supabase
      .from("relatio_installations")
      .select("status")
      .eq("tenant_id", tenant_id)
      .eq("integration_key", integration_key)
      .eq("status", "connected")
      .maybeSingle();

    if (!installation) {
      return new Response(
        JSON.stringify({ error: "Integration not connected. Connect it first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check no already-running migration
    const { data: running } = await supabase
      .from("relatio_migrations")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("integration_key", integration_key)
      .eq("migration_status", "running")
      .maybeSingle();

    if (running) {
      return new Response(
        JSON.stringify({ error: "A migration is already in progress for this integration." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create migration record
    const { data: migration, error: insertError } = await supabase
      .from("relatio_migrations")
      .insert({
        tenant_id,
        integration_key,
        migration_status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // In a real implementation, this would dispatch an async job.
    // For now, mark as completed immediately (stub).
    // Future: dispatch to n8n or a background edge function.
    //
    // When the real runner detects row-level failures it should POST to
    // `migration-ai-repair` with the failing rows. That function handles the
    // AI rescue AND notifies Gardener@thecros.app via `migration-gardener-notify`.

    return new Response(JSON.stringify({ migration }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Best-effort gardener notification on a hard dispatch failure.
    const internalKey = Deno.env.get("INTERNAL_NOTIFY_KEY");
    if (internalKey) {
      try {
        await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/migration-gardener-notify`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-key": internalKey,
            },
            body: JSON.stringify({
              migration_id: "00000000-0000-0000-0000-000000000000",
              tenant_id: "00000000-0000-0000-0000-000000000000",
              integration_key: "unknown",
              reason: `Migration dispatch failed before starting: ${msg.slice(0, 240)}`,
              failed_count: 0,
              rescued_count: 0,
              unrescuable_count: 0,
              sample_errors: [msg.slice(0, 240)],
            }),
          },
        );
      } catch (_) { /* never block the response on notify failure */ }
    }

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
