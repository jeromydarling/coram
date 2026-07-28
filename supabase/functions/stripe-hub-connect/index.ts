/**
 * stripe-hub-connect
 *
 * Central webhook endpoint for ALL Stripe Connect events across the CROS federation.
 * Replaces per-satellite `stripe-connect-webhook` endpoints.
 *
 * Flow:
 * 1. Verify Stripe signature using STRIPE_HUB_CONNECT_WEBHOOK_SECRET
 * 2. Dedupe by event.id
 * 3. Extract event.account (connected account id)
 * 4. Look up satellite in stripe_account_routing
 * 5. Forward to satellite's stripe-in fn with federation HMAC signature
 * 6. Persist outcome to stripe_hub_events; failures to stripe_hub_dlq
 * 7. Return 200 to Stripe (we own retries via DLQ; don't force Stripe to retry-storm)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { routeByConnectedAccount } from "../_shared/stripeHub/routing.ts";
import {
  alreadyProcessed,
  dlqPush,
  forwardToSatellite,
  recordProcessed,
} from "../_shared/stripeHub/forward.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[stripe-hub-connect] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_HUB_CONNECT_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    logStep("missing_env");
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ ok: false, error: "missing_signature" }, 400);

  const body = await req.text();
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    logStep("sig_verify_failed", { error: String(err) });
    return json({ ok: false, error: "invalid_signature" }, 400);
  }

  const svc = createClient(supabaseUrl, serviceRoleKey);

  // Idempotency
  if (await alreadyProcessed(svc, event.id)) {
    logStep("duplicate", { id: event.id });
    return json({ ok: true, dedupe: true }, 200);
  }

  const connectedAccountId = event.account;
  if (!connectedAccountId) {
    logStep("no_connected_account", { type: event.type, id: event.id });
    await dlqPush(svc, event, null, "no_connected_account_on_event");
    // Ack 200 to prevent Stripe retry storm; DLQ will handle retry.
    return json({ ok: true, warning: "no_route_no_account" }, 200);
  }

  const route = await routeByConnectedAccount(svc, connectedAccountId);
  if (!route) {
    logStep("unknown_account", { acct: connectedAccountId, type: event.type });
    await dlqPush(svc, event, null, `unknown_connected_account:${connectedAccountId}`);
    return json({ ok: true, warning: "unknown_account" }, 200);
  }

  logStep("routing", {
    id: event.id,
    type: event.type,
    acct: connectedAccountId,
    satellite: route.satellite_app,
  });

  const result = await forwardToSatellite(route, event, (env) => Deno.env.get(env) ?? undefined);
  await recordProcessed(svc, event, route, result.status, result.body || result.error || "");

  if (result.error || result.status < 200 || result.status >= 300) {
    logStep("forward_failed", {
      status: result.status,
      err: result.error,
      body: result.body.slice(0, 200),
    });
    await dlqPush(
      svc,
      event,
      route,
      result.error ?? `satellite_${result.status}:${result.body.slice(0, 200)}`,
    );
  } else {
    logStep("forwarded_ok", { satellite: route.satellite_app, status: result.status });
  }

  return json({ ok: true, satellite: route.satellite_app, forward_status: result.status }, 200);
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
