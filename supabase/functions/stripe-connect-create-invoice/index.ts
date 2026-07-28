/**
 * stripe-connect-create-invoice — Creates a Stripe-hosted invoice via Connected Account.
 *
 * WHAT: Creates an invoice on the tenant's connected Stripe account.
 * WHERE: Person detail → Send Invoice action
 * WHY: Enables tenants to send invoices with funds going directly to them.
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
    const { tenant_id, contact_id, description, amount_cents, due_date, note, recipient_email } = body;

    if (!tenant_id || !description || !amount_cents) {
      return jsonError(400, "bad_request", "tenant_id, description, and amount_cents required");
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

    // Get or determine email
    let email = recipient_email;
    if (!email && contact_id) {
      const { data: contact } = await svc
        .from("contacts")
        .select("email")
        .eq("id", contact_id)
        .single();
      email = contact?.email;
    }

    if (!email) {
      return jsonError(400, "no_email", "A recipient email is required to send an invoice.");
    }

    // Create customer on connected account
    const customer = await stripe.customers.create(
      { email, metadata: { contact_id: contact_id ?? "", cros_tenant: tenant_id, satellite_app: "thecros" } },
      { stripeAccount: connect.stripe_account_id },
    );

    // Create invoice
    const invoice = await stripe.invoices.create(
      {
        customer: customer.id,
        collection_method: "send_invoice",
        days_until_due: due_date ? Math.max(1, Math.ceil((new Date(due_date).getTime() - Date.now()) / 86400000)) : 30,
        metadata: { tenant_id, contact_id: contact_id ?? "", cros_note: note ?? "", satellite_app: "thecros" },
        application_fee_amount: Math.round(amount_cents * ((connect.platform_fee_percent ?? 1) / 100)),
      },
      { stripeAccount: connect.stripe_account_id },
    );

    // Add line item
    await stripe.invoiceItems.create(
      {
        customer: customer.id,
        invoice: invoice.id,
        amount: amount_cents,
        currency: "usd",
        description,
      },
      { stripeAccount: connect.stripe_account_id },
    );

    // Finalize and send
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(
      invoice.id,
      {},
      { stripeAccount: connect.stripe_account_id },
    );

    await stripe.invoices.sendInvoice(
      invoice.id,
      {},
      { stripeAccount: connect.stripe_account_id },
    );

    // Store in our DB
    const { data: dbInvoice } = await svc.from("tenant_invoices").insert({
      tenant_id,
      created_by: user.id,
      contact_id: contact_id ?? null,
      description,
      amount_cents,
      due_date: due_date ?? null,
      note: note ?? null,
      stripe_invoice_id: invoice.id,
      stripe_hosted_url: finalizedInvoice.hosted_invoice_url,
      status: "pending",
    }).select("id").single();

    // Create financial event
    await svc.from("financial_events").insert({
      tenant_id,
      contact_id: contact_id ?? null,
      event_type: "collaboration",
      status: "pending",
      amount_cents,
      title: description,
      note,
      payer_email: email,
      source_type: "invoice",
      source_id: invoice.id,
      invoice_id: dbInvoice?.id ?? null,
    });

    return jsonOk({
      ok: true,
      invoice_id: dbInvoice?.id,
      stripe_invoice_id: invoice.id,
      hosted_url: finalizedInvoice.hosted_invoice_url,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe-connect-create-invoice] Error:", msg);
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
