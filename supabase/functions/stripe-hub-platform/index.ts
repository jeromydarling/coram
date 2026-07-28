/**
 * stripe-hub-platform
 *
 * Central webhook endpoint for platform-level Stripe events across the CROS federation.
 * Replaces per-satellite `stripe-webhook` endpoints.
 *
 * Routes based on metadata.satellite_app hint (preferred) or customer lookup (fallback).
 * If neither yields a route, event is DLQ'd and 200 returned (so Stripe stops retrying).
 *
 * NOTE: This hub does NOT process events itself. It's pure router → satellite.
 * The existing thecros stripe-webhook fn continues to handle thecros-owned events
 * (subscriptions on the platform's own product), and is registered as a satellite
 * with connected_account_id = null and app = 'thecros' in stripe_account_routing.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { routeForPlatformEvent } from "../_shared/stripeHub/routing.ts";
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
  console.log(`[stripe-hub-platform] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_HUB_PLATFORM_WEBHOOK_SECRET");
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

  if (await alreadyProcessed(svc, event.id)) {
    logStep("duplicate", { id: event.id });
    return json({ ok: true, dedupe: true }, 200);
  }

  const { route, reason } = await routeForPlatformEvent(svc, event);
  if (!route) {
    logStep("no_route", { type: event.type, id: event.id, reason });
    await dlqPush(svc, event, null, `no_route:${reason}`);
    return json({ ok: true, warning: "no_route" }, 200);
  }

  logStep("routing", {
    id: event.id,
    type: event.type,
    satellite: route.satellite_app,
    reason,
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
