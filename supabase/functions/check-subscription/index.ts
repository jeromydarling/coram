import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[check-subscription] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return new Response(
      JSON.stringify({ error: "Stripe is not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email unavailable");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user belongs to an operator-granted tenant (skip Stripe entirely)
    const { data: membership } = await supabaseClient
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membership) {
      const { data: tenantRow } = await supabaseClient
        .from("tenants")
        .select("billing_mode, tier")
        .eq("id", membership.tenant_id)
        .single();

      if (tenantRow?.billing_mode === "operator_granted" || tenantRow?.billing_mode === "self_serve_free") {
        logStep("Free/granted tenant, skipping Stripe", { tenantId: membership.tenant_id, billing_mode: tenantRow.billing_mode });
        return json({
          subscribed: true,
          tiers: [tenantRow.tier ?? "core"],
          subscription_end: null,
          stripe_customer_id: null,
          operator_granted: tenantRow.billing_mode === "operator_granted",
          self_serve_free: tenantRow.billing_mode === "self_serve_free",
        });
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return json({ subscribed: false });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    // Check active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    if (subscriptions.data.length === 0) {
      logStep("No active subscription");
      return json({ subscribed: false });
    }

    const sub = subscriptions.data[0];
    let subscriptionEnd: string | null = null;
    if (sub.current_period_end && typeof sub.current_period_end === 'number') {
      const endDate = new Date(sub.current_period_end * 1000);
      if (!isNaN(endDate.getTime())) {
        subscriptionEnd = endDate.toISOString();
      }
    }

    // Collect all active price IDs → derive tiers
    const activePriceIds = sub.items.data.map((item) => item.price.id);
    logStep("Active prices", { activePriceIds });

    // Look up tiers from billing_products
    const { data: products } = await supabaseClient
      .from("billing_products")
      .select("tier, stripe_price_id")
      .in("stripe_price_id", activePriceIds);

    const tiers = (products ?? []).map((p: { tier: string }) => p.tier);

    logStep("Resolved tiers", { tiers, subscriptionEnd });

    return json({
      subscribed: true,
      tiers,
      subscription_end: subscriptionEnd,
      stripe_customer_id: customerId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
