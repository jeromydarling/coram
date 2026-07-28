import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // --- Auth: require admin JWT ---
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "unauthorized", "Missing auth token");
  }
  const token = authHeader.slice(7).trim();

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return jsonError(401, "unauthorized", "Invalid token");
  }

  const svc = createClient(supabaseUrl, serviceRoleKey);

  // Verify admin role
  const { data: roles } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles ?? []).some(
    (r: { role: string }) => r.role === "admin",
  );
  if (!isAdmin) {
    return jsonError(403, "forbidden", "Admin role required");
  }

  // --- Parse input ---
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_request", "Invalid JSON body");
  }

  const {
    organization_name,
    slug,
    archetype,
    metro_id,
    admin_email,
    admin_name,
    grant_reason,
  } = body as {
    organization_name: string;
    slug: string;
    archetype?: string;
    metro_id?: string;
    admin_email: string;
    admin_name?: string;
    grant_reason?: string;
  };

  if (!organization_name || !slug || !admin_email) {
    return jsonError(
      400,
      "bad_request",
      "organization_name, slug, and admin_email are required",
    );
  }

  // Validate slug format
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return jsonError(
      400,
      "bad_request",
      "Slug must be lowercase alphanumeric with hyphens only",
    );
  }

  try {
    // 1. Check slug uniqueness
    const { data: existing } = await svc
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      return jsonError(409, "conflict", `Slug "${slug}" is already taken`);
    }

    // 2. Create tenant with operator-granted billing
    const { data: tenant, error: tenantErr } = await svc
      .from("tenants")
      .insert({
        slug,
        name: organization_name,
        archetype: archetype ?? null,
        tier: "core",
        status: "active",
        billing_mode: "operator_granted",
        is_operator_granted: true,
        operator_granted_by: user.id,
        operator_granted_at: new Date().toISOString(),
        operator_grant_reason: grant_reason ?? null,
      })
      .select("id, slug, name, tier, archetype")
      .single();

    if (tenantErr)
      throw new Error(`Tenant creation failed: ${tenantErr.message}`);

    // 3. Find or invite admin user
    let adminUserId: string | null = null;

    // Check if user already exists
    const { data: existingUsers } = await svc.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email === admin_email,
    );

    if (existingUser) {
      adminUserId = existingUser.id;
    } else {
      // Create user via invite (generates magic link email)
      const { data: invited, error: inviteErr } =
        await svc.auth.admin.inviteUserByEmail(admin_email, {
          data: {
            full_name: admin_name ?? organization_name,
            invited_to_tenant: tenant.id,
          },
        });
      if (inviteErr)
        throw new Error(`User invite failed: ${inviteErr.message}`);
      adminUserId = invited.user.id;
    }

    // 4. Add user as tenant admin
    if (adminUserId) {
      const { error: tuErr } = await svc.from("tenant_users").insert({
        tenant_id: tenant.id,
        user_id: adminUserId,
        role: "admin",
        home_metro_id: metro_id ?? null,
      });
      if (tuErr)
        throw new Error(`tenant_users insert failed: ${tuErr.message}`);
    }

    // 5. Seed feature flags (core defaults + Bridge enabled for migration testing)
    let flagsSeeded = 0;
    if (archetype) {
      const { data: arch } = await svc
        .from("archetypes")
        .select("default_flags")
        .eq("key", archetype)
        .single();

      if (arch?.default_flags && typeof arch.default_flags === "object") {
        const flags = arch.default_flags as Record<string, boolean>;
        const rows = Object.entries(flags).map(([key, enabled]) => ({
          tenant_id: tenant.id,
          key,
          enabled:
            ["testimonium", "impulsus", "signum"].includes(key)
              ? false
              : key === "relatio" ? true : enabled,
        }));
        // Add Bridge feature keys so FeatureGate passes
        rows.push(
          { tenant_id: tenant.id, key: "relatio_marketplace", enabled: true },
          { tenant_id: tenant.id, key: "crm_migrations", enabled: true },
          { tenant_id: tenant.id, key: "hubspot_two_way", enabled: true },
        );
        if (rows.length > 0) {
          const { error: ffErr } = await svc
            .from("tenant_feature_flags")
            .insert(rows);
          if (!ffErr) flagsSeeded = rows.length;
        }
      }
    }

    if (flagsSeeded === 0) {
      const coreFlags = [
        { key: "civitas", enabled: true },
        { key: "voluntarium", enabled: true },
        { key: "provisio", enabled: true },
        { key: "signum", enabled: false },
        { key: "testimonium", enabled: false },
        { key: "impulsus", enabled: false },
        { key: "relatio", enabled: true },
        { key: "relatio_marketplace", enabled: true },
        { key: "crm_migrations", enabled: true },
        { key: "hubspot_two_way", enabled: true },
      ];
      const rows = coreFlags.map((f) => ({ tenant_id: tenant.id, ...f }));
      await svc.from("tenant_feature_flags").insert(rows);
      flagsSeeded = rows.length;
    }

    // 6. Create onboarding state
    await svc.from("tenant_onboarding_state").insert({
      tenant_id: tenant.id,
      completed: false,
      step: "start",
      data: {},
    });

    return jsonOk({
      ok: true,
      tenant_id: tenant.id,
      slug: tenant.slug,
      flags_seeded: flagsSeeded,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("operator-create-free-tenant error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});

function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ ok: false, error: code, message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
