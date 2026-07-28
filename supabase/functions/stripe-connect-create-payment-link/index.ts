/**
 * stripe-connect-create-payment-link — Creates a Stripe payment link via Connected Account.
 *
 * WHAT: Creates a shareable payment link on the tenant's Stripe account.
 * WHERE: Financial Activity → Create Payment Link
 * WHY: Enables generosity, participation, and support payments routed to the tenant.
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
  if (!stripeKey) return jsonError(503, "stripe_not_configured", "Stripe is not yet configured.");

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
    const { tenant_id, title, amount_cents, event_type, note, contact_id, event_id, max_quantity } = body;

    if (!tenant_id || !title || !amount_cents) {
      return jsonError(400, "bad_request", "tenant_id, title, and amount_cents required");
    }

    // Verify membership
    const { data: tu } = await svc
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .single();
    if (!tu) return jsonError(403, "forbidden", "Not a member of this organization");

    // Get connected account
    const { data: connect } = await svc
      .from("tenant_stripe_connect")
      .select("stripe_account_id, charges_enabled, platform_fee_percent")
      .eq("tenant_id", tenant_id)
      .single();

    if (!connect?.charges_enabled) {
      return jsonError(400, "connect_not_ready", "Stripe payments are not yet enabled for this organization.");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const feePercent = connect.platform_fee_percent ?? 1;

    // Create a product on the connected account
    const product = await stripe.products.create(
      {
        name: title,
        metadata: { tenant_id, event_type: event_type ?? "support", cros_note: note ?? "" },
      },
      { stripeAccount: connect.stripe_account_id },
    );

    // Create a price
    const price = await stripe.prices.create(
      {
        product: product.id,
        unit_amount: amount_cents,
        currency: "usd",
      },
      { stripeAccount: connect.stripe_account_id },
    );

    // Create payment link
    const paymentLink = await stripe.paymentLinks.create(
      {
        line_items: [{ price: price.id, quantity: 1, adjustable_quantity: max_quantity ? { enabled: true, maximum: max_quantity } : undefined }],
        application_fee_percent: feePercent,
        metadata: { tenant_id, event_type: event_type ?? "support", contact_id: contact_id ?? "", event_id: event_id ?? "" },
        after_completion: {
          type: "hosted_confirmation",
          hosted_confirmation: {
            custom_message: event_type === "generosity"
              ? "Your generosity has been recorded. Thank you."
              : event_type === "participation"
              ? "Your place has been held. We look forward to seeing you."
              : "This support has been recorded. Thank you.",
          },
        },
      },
      { stripeAccount: connect.stripe_account_id },
    );

    // Store in DB
    const { data: dbLink } = await svc.from("tenant_payment_links").insert({
      tenant_id,
      created_by: user.id,
      title,
      amount_cents,
      event_type: event_type ?? "support",
      stripe_payment_link_id: paymentLink.id,
      stripe_payment_link_url: paymentLink.url,
      contact_id: contact_id ?? null,
      event_id: event_id ?? null,
      max_quantity: max_quantity ?? null,
      note: note ?? null,
      active: true,
    }).select("id").single();

    return jsonOk({
      ok: true,
      payment_link_id: dbLink?.id,
      url: paymentLink.url,
      stripe_payment_link_id: paymentLink.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe-connect-create-payment-link] Error:", msg);
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
