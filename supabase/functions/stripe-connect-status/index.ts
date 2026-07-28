/**
 * stripe-connect-status — Refreshes and returns Stripe Connect account status for a tenant.
 *
 * WHAT: Checks Stripe for current account status and updates local record.
 * WHERE: Settings → Payments
 * WHY: After onboarding, we need to verify charges_enabled/payouts_enabled.
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

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonError(401, "unauthorized", "Missing auth token");
  const token = authHeader.slice(7).trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return jsonError(401, "unauthorized", "Invalid token");

  const svc = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { tenant_id } = body;
    if (!tenant_id) return jsonError(400, "bad_request", "tenant_id required");

    // Verify membership
    const { data: tu } = await svc
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .single();
    if (!tu) return jsonError(403, "forbidden", "Not a member of this organization");

    const { data: connect } = await svc
      .from("tenant_stripe_connect")
      .select("*")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!connect) {
      return jsonOk({ ok: true, connected: false });
    }

    // Refresh from Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const account = await stripe.accounts.retrieve(connect.stripe_account_id);

    const updates = {
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      details_submitted: account.details_submitted ?? false,
      onboarding_completed_at: account.details_submitted && !connect.onboarding_completed_at
        ? new Date().toISOString()
        : connect.onboarding_completed_at,
      updated_at: new Date().toISOString(),
    };

    await svc.from("tenant_stripe_connect").update(updates).eq("tenant_id", tenant_id);

    return jsonOk({
      ok: true,
      connected: true,
      charges_enabled: updates.charges_enabled,
      payouts_enabled: updates.payouts_enabled,
      details_submitted: updates.details_submitted,
      onboarding_completed_at: updates.onboarding_completed_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe-connect-status] Error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
