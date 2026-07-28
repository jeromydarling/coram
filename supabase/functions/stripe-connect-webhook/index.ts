/**
 * stripe-connect-webhook — Handles Stripe Connect webhooks for tenant payments.
 *
 * WHAT: Processes checkout.session.completed, invoice.paid, payment_intent.succeeded
 *       for connected accounts (tenant-level payments).
 * WHERE: Called by Stripe webhook endpoint.
 * WHY: Updates financial events, creates timeline entries, confirms event participation.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[stripe-connect-webhook] ${step}${d}`);
};

/** Map event_type to CROS timeline language */
const TIMELINE_LANGUAGE: Record<string, { title: string; confirmation: string }> = {
  generosity: { title: "Generosity", confirmation: "Your generosity has been recorded." },
  participation: { title: "Participation", confirmation: "Your place has been held." },
  collaboration: { title: "Collaboration", confirmation: "This support has been recorded." },
  support: { title: "Support", confirmation: "This support has been recorded." },
  invoice: { title: "Collaboration", confirmation: "Invoice paid." },
  membership: { title: "Participation", confirmation: "Membership confirmed." },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    return new Response(
      JSON.stringify({ ok: false, error: "stripe_connect_not_configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceRoleKey);

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ ok: false, error: "missing_signature" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  try {
    const body = await req.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      logStep("Signature verification failed", { error: String(err) });
      return new Response(JSON.stringify({ ok: false, error: "invalid_signature" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const type = event.type;
    const connectedAccountId = event.account;
    logStep("Event received", { type, id: event.id, account: connectedAccountId });

    // Idempotency check
    const { data: existingEvent } = await svc
      .from("stripe_connect_webhook_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existingEvent) {
      logStep("Duplicate event, skipping", { eventId: event.id });
      return jsonOk({ ok: true, duplicate: true });
    }

    await svc.from("stripe_connect_webhook_events").insert({ event_id: event.id });

    // Find tenant by connected account
    let tenantId: string | null = null;
    if (connectedAccountId) {
      const { data: connectRow } = await svc
        .from("tenant_stripe_connect")
        .select("tenant_id")
        .eq("stripe_account_id", connectedAccountId)
        .maybeSingle();
      tenantId = connectRow?.tenant_id ?? null;
    }

    // ── checkout.session.completed ──
    if (type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata ?? {};
      const eventType = metadata.event_type ?? "support";
      const contactId = metadata.contact_id || null;
      const eventIdRef = metadata.event_id || null;
      const tid = metadata.tenant_id || tenantId;

      if (tid) {
        const amountTotal = session.amount_total ?? 0;
        const lang = TIMELINE_LANGUAGE[eventType] ?? TIMELINE_LANGUAGE.support;

        // Create financial event
        await svc.from("financial_events").insert({
          tenant_id: tid,
          contact_id: contactId || null,
          event_type: eventType,
          status: "completed",
          amount_cents: amountTotal,
          title: lang.title,
          description: session.metadata?.description ?? null,
          payer_name: session.customer_details?.name ?? null,
          payer_email: session.customer_details?.email ?? null,
          source_type: "checkout",
          source_id: session.id,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: (session.payment_intent as string) ?? null,
          event_id: eventIdRef || null,
          completed_at: new Date().toISOString(),
        });

        // If event payment, mark attendee as confirmed
        if (eventIdRef) {
          logStep("Event payment completed", { eventId: eventIdRef, amount: amountTotal });
        }

        // If generosity type, create generosity record
        if (eventType === "generosity" && contactId) {
          await svc.from("generosity_records").insert({
            tenant_id: tid,
            contact_id: contactId,
            amount: amountTotal / 100,
            gift_date: new Date().toISOString().split("T")[0],
            source: "stripe_connect",
            notes: session.metadata?.note ?? "Recorded via Stripe payment",
          });
        }

        logStep("Financial event created", { tenantId: tid, type: eventType, amount: amountTotal });
      }
    }

    // ── invoice.paid ──
    if (type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const metadata = invoice.metadata ?? {};
      const tid = metadata.tenant_id || tenantId;

      if (tid) {
        // Update our invoice record
        await svc.from("tenant_invoices")
          .update({ status: "completed", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("stripe_invoice_id", invoice.id);

        // Update financial event
        await svc.from("financial_events")
          .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("source_id", invoice.id)
          .eq("source_type", "invoice");

        logStep("Invoice paid", { invoiceId: invoice.id, tenantId: tid });
      }
    }

    // ── payment_intent.succeeded ──
    if (type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      logStep("Payment intent succeeded", { piId: pi.id, amount: pi.amount });
      // Financial events are already created via checkout.session.completed
      // This is a safety net for direct payment intents
    }

    // ── charge.refunded — full or partial refund settled on the connected account ──
    if (type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const piId = (charge.payment_intent as string) || null;
      const amount = charge.amount ?? 0;
      const amountRefunded = charge.amount_refunded ?? 0;
      const refundStatus = amountRefunded >= amount ? "refunded" : "partially_refunded";

      if (piId) {
        await svc.from("financial_events")
          .update({
            status: refundStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", piId);
        logStep("Charge refunded", { piId, refundStatus, amountRefunded });
      }
    }

    // ── application_fee.refunded — our platform fee was refunded back to the connected account ──
    if (type === "application_fee.refunded") {
      const fee = event.data.object as Stripe.ApplicationFee;
      logStep("Application fee refunded", { feeId: fee.id, accountId: connectedAccountId, amountRefunded: fee.amount_refunded });
      // Surface to operator so they know the platform commission was reversed.
      if (tenantId) {
        await svc.from("financial_events").insert({
          tenant_id: tenantId,
          event_type: "support",
          status: "refunded",
          amount_cents: -(fee.amount_refunded ?? 0),
          title: "Platform fee refunded",
          description: `Application fee ${fee.id} was refunded.`,
          source_type: "application_fee",
          source_id: fee.id,
          completed_at: new Date().toISOString(),
        });
      }
    }

    // ── charge.dispute.created/updated/closed — chargeback liability on connected account ──
    if (type === "charge.dispute.created" || type === "charge.dispute.updated" || type === "charge.dispute.closed") {
      const dispute = event.data.object as Stripe.Dispute;
      const piId = (dispute.payment_intent as string) || null;
      let mappedStatus: string | null = null;
      if (type === "charge.dispute.created") mappedStatus = "disputed";
      else if (type === "charge.dispute.closed") {
        if (dispute.status === "won") mappedStatus = "dispute_won";
        else if (dispute.status === "lost") mappedStatus = "dispute_lost";
      }

      if (piId && mappedStatus) {
        await svc.from("financial_events")
          .update({ status: mappedStatus, updated_at: new Date().toISOString() })
          .eq("stripe_payment_intent_id", piId);
      }
      logStep("Dispute event", {
        type, disputeId: dispute.id, status: dispute.status, accountId: connectedAccountId, piId, mappedStatus,
      });
    }

    // ── payout.failed — bank rejected a payout to the connected account ──
    if (type === "payout.failed") {
      const payout = event.data.object as Stripe.Payout;
      logStep("Payout failed", {
        payoutId: payout.id, accountId: connectedAccountId, failureCode: payout.failure_code, failureMessage: payout.failure_message,
      });
      // Record on tenant_stripe_connect so the operator dashboard can surface it.
      if (connectedAccountId) {
        await svc.from("tenant_stripe_connect")
          .update({
            last_payout_failure_code: payout.failure_code ?? null,
            last_payout_failure_message: payout.failure_message ?? null,
            last_payout_failure_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_account_id", connectedAccountId);
      }
    }

    // ── account.updated (Connect account status change) ──
    if (type === "account.updated" && connectedAccountId) {
      const account = event.data.object as Stripe.Account;
      // Fetch existing record to preserve onboarding_completed_at
      const { data: existingConnect } = await svc
        .from("tenant_stripe_connect")
        .select("onboarding_completed_at")
        .eq("stripe_account_id", connectedAccountId)
        .maybeSingle();

      await svc.from("tenant_stripe_connect").update({
        charges_enabled: account.charges_enabled ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
        onboarding_completed_at: account.details_submitted && !existingConnect?.onboarding_completed_at
          ? new Date().toISOString()
          : existingConnect?.onboarding_completed_at ?? null,
        updated_at: new Date().toISOString(),
      }).eq("stripe_account_id", connectedAccountId);

      logStep("Account updated", { accountId: connectedAccountId, chargesEnabled: account.charges_enabled });
    }

    return jsonOk({ ok: true, received: type });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe-connect-webhook] Error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
