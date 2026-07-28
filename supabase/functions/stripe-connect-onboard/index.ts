/**
 * stripe-connect-onboard — Initiates Stripe Connect onboarding for a tenant.
 *
 * WHAT: Creates a connected Stripe account and returns the onboarding link.
 * WHERE: Settings → Payments
 * WHY: Tenants need their own Stripe account to receive payments directly.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return jsonError(503, "stripe_not_configured", "Stripe is not yet configured.");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "unauthorized", "Missing auth token");
  }
  const token = authHeader.slice(7).trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return jsonError(401, "unauthorized", "Invalid token");

  const svc = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { tenant_id, refresh_url, return_url } = body;

    if (!tenant_id) return jsonError(400, "bad_request", "tenant_id required");

    // Verify user is tenant admin
    const { data: tu } = await svc
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .single();

    if (!tu || (tu.role !== "admin" && tu.role !== "steward")) {
      return jsonError(403, "forbidden", "Only stewards can manage payments");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if connect account already exists
    const { data: existing } = await svc
      .from("tenant_stripe_connect")
      .select("stripe_account_id, charges_enabled, details_submitted")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    let accountId = existing?.stripe_account_id;

    if (!accountId) {
      // Get tenant info for prefill
      const { data: tenant } = await svc
        .from("tenants")
        .select("name")
        .eq("id", tenant_id)
        .single();

      // Create a new Standard connected account
      const account = await stripe.accounts.create({
        type: "standard",
        metadata: { tenant_id, cros_platform: "true" },
        business_profile: {
          name: tenant?.name ?? undefined,
        },
      });
      accountId = account.id;

      // Store it
      await svc.from("tenant_stripe_connect").upsert({
        tenant_id,
        stripe_account_id: accountId,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      }, { onConflict: "tenant_id" });
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refresh_url ?? `${req.headers.get("origin")}/settings?tab=payments&connect=refresh`,
      return_url: return_url ?? `${req.headers.get("origin")}/settings?tab=payments&connect=complete`,
      type: "account_onboarding",
    });

    return jsonOk({ ok: true, url: accountLink.url, account_id: accountId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe-connect-onboard] Error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
