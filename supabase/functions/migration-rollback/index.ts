/**
 * migration-rollback — Rolls back a migration run (demo tenants only).
 *
 * WHAT: Deletes records created by a specific migration run.
 * WHERE: Admin Migration Harness.
 * WHY: Safe undo for demo/sandbox testing.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonError(401, "unauthorized", "Missing auth");

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return jsonError(401, "unauthorized", "Invalid token");

  const svc = createClient(supabaseUrl, serviceKey);
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) return jsonError(403, "forbidden", "Admin only");

  const { migration_run_id } = await req.json();
  if (!migration_run_id) return jsonError(400, "bad_request", "migration_run_id required");

  // Lookup run
  const { data: run } = await svc
    .from("migration_runs")
    .select("id, tenant_id, status")
    .eq("id", migration_run_id)
    .single();
  if (!run) return jsonError(404, "not_found", "Migration run not found");
  if (run.status === "rolled_back") return jsonError(400, "bad_request", "Already rolled back");

  // Verify it's a demo tenant
  const { data: demo } = await svc
    .from("demo_tenants")
    .select("id")
    .eq("tenant_id", run.tenant_id)
    .maybeSingle();
  if (!demo) return jsonError(400, "bad_request", "Rollback only supported for demo tenants");

  try {
    // Get created items
    const { data: items } = await svc
      .from("migration_run_items")
      .select("object_type, action, internal_id")
      .eq("migration_run_id", migration_run_id)
      .eq("action", "created");

    let deleted = 0;
    for (const item of items ?? []) {
      if (!item.internal_id) continue;

      const table = item.object_type === "organizations" ? "opportunities" : item.object_type;
      const { error } = await svc.from(table).delete().eq("id", item.internal_id);
      if (!error) deleted++;
    }

    await svc
      .from("migration_runs")
      .update({ status: "rolled_back", completed_at: new Date().toISOString() })
      .eq("id", migration_run_id);

    return jsonOk({ ok: true, deleted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("migration-rollback error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});
