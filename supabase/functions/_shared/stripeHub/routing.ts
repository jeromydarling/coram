/**
 * Shared routing logic for stripe-hub-connect and stripe-hub-platform.
 * Looks up satellite app by connected account ID or by customer/checkout metadata.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import type Stripe from "https://esm.sh/stripe@18.5.0";

export interface Route {
  connected_account_id: string | null;
  satellite_app: string;
  supabase_project_id: string | null;
  webhook_path: string;
  federation_secret_env: string;
  tenant_id: string | null;
  target_url_override: string | null;
}

/**
 * Resolve the actual forwarding URL for a Route.
 * Uses target_url_override if set (Cloudflare-hosted satellites),
 * else constructs the standard Supabase edge function URL.
 */
export function resolveTargetUrl(route: Route): string | null {
  if (route.target_url_override) return route.target_url_override;
  if (route.supabase_project_id) {
    return `https://${route.supabase_project_id}.supabase.co/functions/v1/${route.webhook_path}`;
  }
  return null;
}

export async function routeByConnectedAccount(
  svc: SupabaseClient,
  connectedAccountId: string,
): Promise<Route | null> {
  const { data } = await svc
    .from("stripe_account_routing")
    .select("connected_account_id, satellite_app, supabase_project_id, webhook_path, federation_secret_env, tenant_id, target_url_override")
    .eq("connected_account_id", connectedAccountId)
    .eq("active", true)
    .maybeSingle();
  return (data as Route) ?? null;
}

export async function routeByCustomer(
  svc: SupabaseClient,
  stripeCustomerId: string,
): Promise<Route | null> {
  const { data } = await svc
    .from("stripe_checkout_routing")
    .select("stripe_customer_id, satellite_app, supabase_project_id, tenant_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  // Customer-map row is minimal — look up the full account_routing row by app slug
  const app = (data as any).satellite_app as string;
  const { data: full } = await svc
    .from("stripe_account_routing")
    .select("connected_account_id, satellite_app, supabase_project_id, webhook_path, federation_secret_env, tenant_id, target_url_override")
    .eq("satellite_app", app)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  return (full as Route) ?? null;
}

/**
 * Best-effort routing for platform events.
 * Fallback chain: metadata.satellite_app → metadata.federation_app → customer lookup.
 */
export async function routeForPlatformEvent(
  svc: SupabaseClient,
  event: Stripe.Event,
): Promise<{ route: Route | null; reason: string }> {
  const obj = event.data.object as any;
  const meta = obj?.metadata ?? {};

  // Try direct metadata pointers first (accept multiple key conventions used
  // historically across the federation: satellite_app (new standard), federation_app,
  // app_slug (communis/8s), app (collegium), source_app (rehearso/bitoku), cros_app
  // (custodia)). The audit confirmed all live satellite code now also sets
  // metadata.satellite_app, but keep the fallbacks so older/inflight objects still route.
  const app =
    meta.satellite_app ||
    meta.federation_app ||
    meta.app_slug ||
    meta.app ||
    meta.source_app ||
    meta.cros_app;
  if (app && typeof app === "string") {
    // Normalize legacy value aliases (metadata values that don't match federation slugs)
    const SLUG_ALIASES: Record<string, string> = {
      "8seconds": "8s",
    };
    const normalized = SLUG_ALIASES[app] || app;
    const { data } = await svc
      .from("stripe_account_routing")
      .select("connected_account_id, satellite_app, supabase_project_id, webhook_path, federation_secret_env, tenant_id, target_url_override")
      .eq("satellite_app", normalized)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (data) return { route: data as Route, reason: "metadata_hint" };
  }

  // Fall back to customer lookup
  const customer = obj?.customer || obj?.customer_id;
  if (customer && typeof customer === "string") {
    const r = await routeByCustomer(svc, customer);
    if (r) return { route: r, reason: "customer_map" };
  }

  return { route: null, reason: "no_route_found" };
}

/** Compute HMAC-SHA256 hex signature for federation forwarding. */
export async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time comparison for HMAC signatures. */
export function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
