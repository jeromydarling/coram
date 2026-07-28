/**
 * relatio-rollback — Rolls back a committed sync job (demo tenants only).
 * POST { sync_job_id }
 *
 * Deletes records created by the job using sync_items markers.
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
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { sync_job_id } = await req.json();

    if (!sync_job_id) {
      return new Response(
        JSON.stringify({ error: "sync_job_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get the job
    const { data: job } = await admin
      .from("relatio_sync_jobs")
      .select("*")
      .eq("id", sync_job_id)
      .single();

    if (!job) {
      return new Response(JSON.stringify({ error: "Sync job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check tenant is demo
    const { data: demo } = await admin
      .from("demo_tenants")
      .select("id")
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();

    if (!demo) {
      return new Response(
        JSON.stringify({ error: "Rollback is only allowed for demo tenants" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get created items
    const { data: items } = await admin
      .from("relatio_sync_items")
      .select("object_type, internal_id")
      .eq("sync_job_id", sync_job_id)
      .eq("action", "created")
      .not("internal_id", "is", null);

    let deleted = 0;

    if (items && items.length > 0) {
      const contactIds = items.filter((i) => i.object_type === "contacts").map((i) => i.internal_id);
      const orgIds = items.filter((i) => i.object_type === "organizations").map((i) => i.internal_id);

      // Delete contacts first (FK dependency)
      if (contactIds.length > 0) {
        const { count } = await admin
          .from("contacts")
          .delete({ count: "exact" })
          .in("id", contactIds);
        deleted += count ?? 0;
      }

      // Delete orgs
      if (orgIds.length > 0) {
        const { count } = await admin
          .from("opportunities")
          .delete({ count: "exact" })
          .in("id", orgIds);
        deleted += count ?? 0;
      }
    }

    // Mark job as rolled back
    await admin
      .from("relatio_sync_jobs")
      .update({
        status: "failed",
        summary: { rolled_back: true, deleted_count: deleted },
        completed_at: new Date().toISOString(),
      })
      .eq("id", sync_job_id);

    return new Response(
      JSON.stringify({ ok: true, deleted_count: deleted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
