import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth: require valid JWT
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "unauthorized", "Missing auth token");
  }
  const token = authHeader.slice(7).trim();

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return jsonError(401, "unauthorized", "Invalid token");
  }

  const svc = createClient(supabaseUrl, serviceRoleKey);

  // Check admin role
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");

  // Parse input
  const body = await req.json();
  const {
    slug, name, archetype, tier, admin_user_id, home_metro_id,
    territory_selection, caregiver_base, civitas_enabled,
    compliance_posture,
  } = body as {
    slug: string;
    name: string;
    archetype?: string;
    tier?: string;
    admin_user_id?: string;
    home_metro_id?: string;
    territory_selection?: Record<string, unknown> | null;
    caregiver_base?: Record<string, unknown> | null;
    civitas_enabled?: boolean;
    compliance_posture?: string;
  };

  if (!slug || !name) {
    return jsonError(400, "bad_request", "slug and name are required");
  }

  // Self-serve path: non-admin users can only bootstrap their OWN tenant
  // (admin_user_id must not be set, or must match the caller)
  if (!isAdmin) {
    if (admin_user_id && admin_user_id !== user.id) {
      return jsonError(403, "forbidden", "Cannot create tenant for another user");
    }

    // Verify user doesn't already own a tenant (prevent abuse)
    const { data: existingMemberships } = await svc
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .limit(1);

    if (existingMemberships && existingMemberships.length > 0) {
      return jsonError(409, "already_exists", "You already have an organization");
    }
  }

  try {
    // 1. Create tenant (idempotent — if slug exists for this user, resume)
    let tenant: { id: string; slug: string; name: string; tier: string; archetype: string | null };

    const { data: existingTenant } = await svc
      .from("tenants")
      .select("id, slug, name, tier, archetype")
      .eq("slug", slug)
      .maybeSingle();

    if (existingTenant) {
      // Verify this user owns it OR tenant is unclaimed (no members at all)
      const adminUserId = admin_user_id ?? user.id;
      const { data: membership } = await svc
        .from("tenant_users")
        .select("tenant_id")
        .eq("tenant_id", existingTenant.id)
        .eq("user_id", adminUserId)
        .maybeSingle();

      if (!membership) {
        // Check if tenant has ANY members — if not, it's an orphan from a failed bootstrap
        const { count } = await svc
          .from("tenant_users")
          .select("tenant_id", { count: "exact", head: true })
          .eq("tenant_id", existingTenant.id);

        if ((count ?? 0) > 0 && !isAdmin) {
          return jsonError(409, "slug_taken", "This organization slug is already in use");
        }
        // Orphan tenant — allow current user to claim it
        console.log("Claiming orphan tenant:", existingTenant.slug);
      }

      tenant = existingTenant as typeof tenant;
      console.log("Resuming bootstrap for existing tenant:", tenant.slug);
    } else {
      // Determine billing mode — solo companions get free accounts
      const isFreeCompanion = archetype === 'caregiver_solo';
      const insertPayload: Record<string, unknown> = {
        slug,
        name,
        archetype: archetype ?? null,
        tier: tier ?? "core",
        status: "active",
      };
      if (isFreeCompanion) {
        insertPayload.billing_mode = "self_serve_free";
        insertPayload.is_operator_granted = false;
      }

      const { data: newTenant, error: tenantErr } = await svc
        .from("tenants")
        .insert(insertPayload)
        .select("id, slug, name, tier, archetype")
        .single();

      if (tenantErr) throw new Error(`Tenant creation failed: ${tenantErr.message}`);
      tenant = newTenant as typeof tenant;
    }

    // 2. Add caller (or specified user) as tenant admin (idempotent)
    const adminUserId = admin_user_id ?? user.id;
    const { data: existingTU } = await svc
      .from("tenant_users")
      .select("tenant_id")
      .eq("tenant_id", tenant.id)
      .eq("user_id", adminUserId)
      .maybeSingle();

    if (!existingTU) {
      // Validate home_metro_id exists before using it
      let validMetroId: string | null = null;
      if (home_metro_id) {
        const { data: metroCheck } = await svc
          .from("metros")
          .select("id")
          .eq("id", home_metro_id)
          .maybeSingle();
        if (metroCheck) validMetroId = home_metro_id;
        else console.warn("home_metro_id not found in metros table, skipping:", home_metro_id);
      }

      const { error: tuErr } = await svc.from("tenant_users").insert({
        tenant_id: tenant.id,
        user_id: adminUserId,
        role: "admin",
        home_metro_id: validMetroId,
      });
      if (tuErr) throw new Error(`tenant_users insert failed: ${tuErr.message}`);
    }

    // 2b. Auto-approve user profile (self-serve users need this to pass ProtectedRoute)
    await svc.from("profiles").update({ is_approved: true }).eq("user_id", adminUserId);

    // 2c. Ensure user_roles entry exists (self-serve users may only have 'staff' from handle_new_user trigger)
    //     Tenant creators should have at least 'staff' — the system already assigns this via the auth trigger.
    //     We don't escalate to 'admin' in user_roles to avoid privilege confusion with the operator-level admin role.
    //     The tenant_users.role = 'admin' handles tenant-scoped permissions.

    // 3. Seed feature flags and keywords from archetype defaults
    let flagsSeeded = 0;
    if (archetype) {
      const { data: arch } = await svc
        .from("archetypes")
        .select("default_flags, default_keywords")
        .eq("key", archetype)
        .single();

      if (arch?.default_flags && typeof arch.default_flags === "object") {
        const flags = arch.default_flags as Record<string, boolean>;
        const rows = Object.entries(flags).map(([key, enabled]) => ({
          tenant_id: tenant.id,
          key,
          enabled,
        }));
        if (rows.length > 0) {
          const { error: ffErr } = await svc.from("tenant_feature_flags").insert(rows);
          if (!ffErr) flagsSeeded = rows.length;
        }
      }

      // Seed archetype default keywords into tenant search_keywords
      if (arch?.default_keywords && Array.isArray(arch.default_keywords) && (arch.default_keywords as string[]).length > 0) {
        await svc.from("tenants").update({
          search_keywords: arch.default_keywords,
          search_keywords_source: "enrichment",
        }).eq("id", tenant.id);
        console.log(`Seeded ${(arch.default_keywords as string[]).length} archetype keywords for tenant ${tenant.slug}`);
      }
    }

    // If no archetype flags, seed core defaults
    if (flagsSeeded === 0) {
      const coreFlags = [
        { key: "civitas", enabled: civitas_enabled ?? true },
        { key: "voluntarium", enabled: true },
        { key: "provisio", enabled: true },
        { key: "signum", enabled: false },
        { key: "testimonium", enabled: false },
        { key: "impulsus", enabled: false },
        { key: "relatio", enabled: false },
      ];
      const rows = coreFlags.map((f) => ({ tenant_id: tenant.id, ...f }));
      await svc.from("tenant_feature_flags").insert(rows);
      flagsSeeded = rows.length;
    }

    // 3b. Create tenant_territories from territory_selection (is_home = true)
    if (territory_selection && typeof territory_selection === "object") {
      const ts = territory_selection as Record<string, unknown>;
      const mode = ts.mode as string | undefined;
      let territoryIds: string[] = [];

      if (mode === "metro" && ts.territory_id) {
        territoryIds = [ts.territory_id as string];
      } else if (mode === "county" && Array.isArray(ts.territory_ids)) {
        territoryIds = ts.territory_ids as string[];
      } else if (mode === "state" && ts.territory_id) {
        territoryIds = [ts.territory_id as string];
      } else if (mode === "country" && ts.territory_id) {
        territoryIds = [ts.territory_id as string];
      }

      if (territoryIds.length > 0) {
        // Validate territory IDs exist
        const { data: validTerritories } = await svc
          .from("territories")
          .select("id")
          .in("id", territoryIds);
        const validIds = (validTerritories ?? []).map((t: { id: string }) => t.id);

        if (validIds.length > 0) {
          // First territory is home
          const rows = validIds.map((tid: string, idx: number) => ({
            tenant_id: tenant.id,
            territory_id: tid,
            is_home: idx === 0,
          }));
          const { error: ttErr } = await svc.from("tenant_territories").insert(rows);
          if (ttErr) console.warn("tenant_territories insert warning:", ttErr.message);
          else console.log(`Created ${rows.length} tenant_territories, home=${validIds[0]}`);
        }
      }
    }

    // 4. Create onboarding state
    await svc.from("tenant_onboarding_state").insert({
      tenant_id: tenant.id,
      completed: false,
      step: "start",
      data: {},
    });

    // 5. Auto-create tenant partner opportunity for ecosystem visibility
    const partnerOppId = `TENANT-${slug.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const { error: oppErr } = await svc.from("opportunities").insert({
      opportunity_id: partnerOppId,
      organization: name,
      stage: "Stable Producer",
      status: "Active",
      is_tenant_partner: true,
      conversion_source: "signup",
      metro_id: home_metro_id ?? null,
      notes: `Auto-created partner record for tenant: ${slug}`,
    });
    if (oppErr) {
      console.error("Partner opportunity creation failed (non-fatal):", oppErr.message);
    }

    // 6. Link pending Stripe subscription from user metadata (set by webhook)
    const pendingCustomerId = user.user_metadata?.pending_stripe_customer_id;
    const pendingSubId = user.user_metadata?.pending_stripe_subscription_id;
    if (pendingCustomerId && pendingSubId) {
      await svc.from("tenant_subscriptions").upsert(
        {
          tenant_id: tenant.id,
          stripe_customer_id: pendingCustomerId,
          stripe_subscription_id: pendingSubId,
          status: "active",
        },
        { onConflict: "tenant_id" },
      );

      // Clear pending metadata
      await svc.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          pending_stripe_customer_id: null,
          pending_stripe_subscription_id: null,
          pending_tiers: null,
        },
      });
    }

    return jsonOk({
      ok: true,
      tenant,
      flags_seeded: flagsSeeded,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("tenant-bootstrap error:", msg);
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
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
