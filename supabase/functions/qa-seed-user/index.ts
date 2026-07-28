/**
 * qa-seed-user — Creates or resets the QA demo auth user.
 *
 * WHAT: Creates a Supabase Auth user for QA testing, linked to a demo tenant.
 * WHERE: Operator Console → QA Employee → "Seed QA User" button.
 * WHY: Automated tests need a real auth user with known credentials.
 */
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const qaPassword = Deno.env.get("QA_PASSWORD");

  if (!qaPassword) {
    return jsonError(500, "config_error", "QA_PASSWORD secret not configured");
  }
  if (qaPassword.length < 6) {
    return jsonError(500, "config_error", `QA_PASSWORD is too short (${qaPassword.length} chars, need 6+)`);
  }

  // Auth — require admin
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
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return jsonError(403, "forbidden", "Admin role required");

  // Parse input
  const { tenant_id, email = "qa-demo@thecros.app" } = await req.json();
  if (!tenant_id) {
    return jsonError(400, "bad_request", "tenant_id required");
  }

  // Verify tenant exists
  const { data: tenant } = await svc.from("tenants").select("id, slug, name").eq("id", tenant_id).single();
  if (!tenant) return jsonError(404, "not_found", "Tenant not found");

  try {
    let qaUserId: string;
    const { data: listData } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = listData?.users?.find((u: any) => u.email === email);

    if (existingUser) {
      const { error: updateErr } = await svc.auth.admin.updateUserById(existingUser.id, {
        password: qaPassword,
        email_confirm: true,
      });
      if (updateErr) throw new Error(`Failed to update user: ${updateErr.message}`);
      qaUserId = existingUser.id;
      console.log(`[qa-seed-user] Updated existing user ${email} (${qaUserId})`);
    } else {
      const { data: newUser, error: createErr } = await svc.auth.admin.createUser({
        email,
        password: qaPassword,
        email_confirm: true,
        user_metadata: { display_name: "QA Demo User", is_qa: true },
      });
      if (createErr || !newUser.user) {
        console.error(`[qa-seed-user] createUser error:`, JSON.stringify(createErr));
        throw new Error(`Failed to create user: ${createErr?.message} (status: ${createErr?.status})`);
      }
      qaUserId = newUser.user.id;
      console.log(`[qa-seed-user] Created new user ${email} (${qaUserId})`);
    }

    // Ensure profile exists (trigger may have already created it)
    const { error: profileErr } = await svc.from("profiles").upsert({
      user_id: qaUserId,
      display_name: "QA Demo User",
      is_approved: true,
      dashboard_mode: "operational",
    }, { onConflict: "user_id" });
    if (profileErr) console.warn(`[qa-seed-user] Profile upsert warning:`, profileErr.message);

    // Link to tenant
    await svc.from("tenant_users").upsert({
      tenant_id: tenant.id,
      user_id: qaUserId,
      role: "admin",
    }, { onConflict: "tenant_id,user_id" });

    // Ensure user_roles has admin (required by RLS has_any_role checks)
    const { error: roleErr } = await svc.from("user_roles").upsert({
      user_id: qaUserId,
      role: "admin",
    }, { onConflict: "user_id,role" });
    if (roleErr) console.warn(`[qa-seed-user] user_roles upsert warning:`, roleErr.message);

    return jsonOk({
      ok: true,
      user_id: qaUserId,
      email,
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      message: existingUser
        ? "QA user password reset and linked to tenant"
        : "QA user created and linked to tenant",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("qa-seed-user error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});
