/**
 * demo-tenant-create — Creates a demo tenant for the Demo Lab.
 *
 * WHAT: Creates a demo_tenants row + a real tenants row for testing.
 * WHERE: Admin Demo Lab.
 * WHY: Deterministic, isolated demo data for migration testing.
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "unauthorized", "Missing auth token");
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return jsonError(401, "unauthorized", "Invalid token");

  const svc = createClient(supabaseUrl, serviceKey);

  // Admin check
  const { data: roles } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return jsonError(403, "forbidden", "Admin role required");

  const { slug, name, seed_profile } = await req.json();
  if (!slug || !name || !seed_profile) {
    return jsonError(400, "bad_request", "slug, name, and seed_profile required");
  }
  if (!["small", "medium", "large"].includes(seed_profile)) {
    return jsonError(400, "bad_request", "seed_profile must be small, medium, or large");
  }

  try {
    // Create real tenant
    const { data: tenant, error: tErr } = await svc
      .from("tenants")
      .insert({ slug, name, tier: "core", status: "active" })
      .select("id, slug, name")
      .single();
    if (tErr) throw new Error(`Tenant creation failed: ${tErr.message}`);

    // Add caller as tenant admin
    await svc.from("tenant_users").insert({
      tenant_id: tenant.id,
      user_id: user.id,
      role: "admin",
    });

    // Create demo_tenants record
    const { data: demo, error: dErr } = await svc
      .from("demo_tenants")
      .insert({
        tenant_id: tenant.id,
        slug,
        name,
        created_by: user.id,
        seed_profile,
      })
      .select("id")
      .single();
    if (dErr) throw new Error(`Demo tenant creation failed: ${dErr.message}`);

    return jsonOk({
      ok: true,
      demo_tenant_id: demo.id,
      tenant_id: tenant.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("demo-tenant-create error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});
