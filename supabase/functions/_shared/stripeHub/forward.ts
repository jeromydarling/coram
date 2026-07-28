/**
 * Forwarding + persistence helpers for stripe-hub-* functions.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import type Stripe from "https://esm.sh/stripe@18.5.0";
import { hmacHex, resolveTargetUrl, type Route } from "./routing.ts";

export async function alreadyProcessed(svc: SupabaseClient, eventId: string): Promise<boolean> {
  const { data } = await svc
    .from("stripe_hub_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();
  return !!data;
}

export async function recordProcessed(
  svc: SupabaseClient,
  event: Stripe.Event,
  route: Route | null,
  status: number,
  responseBody: string,
) {
  await svc.from("stripe_hub_events").insert({
    event_id: event.id,
    event_type: event.type,
    connected_account_id: route?.connected_account_id ?? event.account ?? null,
    satellite_app: route?.satellite_app ?? null,
    forwarded_status_code: status,
    forwarded_response: responseBody.slice(0, 500),
    processed_ok: status >= 200 && status < 300,
  });
}

export async function dlqPush(
  svc: SupabaseClient,
  event: Stripe.Event,
  route: Route | null,
  reason: string,
) {
  const nextRetry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  await svc.from("stripe_hub_dlq").insert({
    event_id: event.id,
    event_type: event.type,
    connected_account_id: route?.connected_account_id ?? event.account ?? null,
    target_url: route ? resolveTargetUrl(route) : null,
    failure_reason: reason,
    event_payload: event,
    next_retry_at: nextRetry,
  });
}

export interface ForwardResult {
  status: number;
  body: string;
  error?: string;
}

export async function forwardToSatellite(
  route: Route,
  event: Stripe.Event,
  getFederationSecret: (envName: string) => string | undefined,
): Promise<ForwardResult> {
  const secret = getFederationSecret(route.federation_secret_env);
  if (!secret) return { status: 0, body: "", error: `missing_env:${route.federation_secret_env}` };

  const targetUrl = resolveTargetUrl(route);
  if (!targetUrl) {
    return { status: 0, body: "", error: "missing_target_url" };
  }
  const payload = JSON.stringify({
    hub_event_id: event.id,
    satellite_app: route.satellite_app,
    stripe_event: event,
    delivered_at: new Date().toISOString(),
  });

  const sig = await hmacHex(secret, payload);

  try {
    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CROS-Federation-Signature": sig,
        "X-CROS-Hub-Event-Id": event.id,
      },
      body: payload,
    });
    const body = await resp.text();
    return { status: resp.status, body };
  } catch (e) {
    return { status: 0, body: "", error: String(e) };
  }
}
