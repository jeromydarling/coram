/**
 * demo-tenant-reset — Wipes demo tenant data safely.
 *
 * WHAT: Deletes all seeded data for a demo tenant.
 * WHERE: Admin Demo Lab.
 * WHY: Clean slate for re-testing migrations.
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

  const { demo_tenant_id } = await req.json();
  if (!demo_tenant_id) return jsonError(400, "bad_request", "demo_tenant_id required");

  const { data: demo } = await svc
    .from("demo_tenants")
    .select("id, tenant_id, is_demo")
    .eq("id", demo_tenant_id)
    .single();
  if (!demo) return jsonError(404, "not_found", "Demo tenant not found");
  if (!demo.is_demo) return jsonError(400, "bad_request", "Can only reset demo tenants");

  const tid = demo.tenant_id;

  try {
    // Delete in dependency order: contacts/events → opportunities → metros → seed runs
    await svc.from("contacts").delete().eq("tenant_id", tid);
    await svc.from("events").delete().eq("tenant_id", tid);
    await svc.from("activities").delete().eq("tenant_id", tid);
    await svc.from("opportunities").delete().eq("tenant_id", tid);
    await svc.from("metros").delete().eq("tenant_id", tid);
    await svc.from("demo_seed_runs").delete().eq("demo_tenant_id", demo.id);
    await svc.from("migration_runs").delete().eq("tenant_id", tid);

    return jsonOk({ ok: true, message: "Demo tenant data wiped" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("demo-tenant-reset error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});
