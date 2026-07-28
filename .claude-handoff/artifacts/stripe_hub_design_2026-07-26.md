# CROS Stripe Hub — Detailed Design
**Date:** 2026-07-27 00:30 CDT
**Status:** Draft, ready to scaffold
**Target repo:** `jeromydarling/thecros` (Supabase edge fn on the platform)

## Purpose

Replace 32 per-satellite webhook endpoints with 2 hub endpoints on thecros. Route events to the correct satellite based on:
- **Connect events**: `event.account` (`acct_xxx`) → routing table lookup
- **Platform events**: `event.data.object.metadata.satellite_app` set by satellite when creating checkout sessions/subscriptions

## Two hub endpoints

### Hub A: `stripe-hub-platform`
- **URL**: `https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/stripe-hub-platform`
- **Purpose**: Platform-level events (checkouts, subscriptions, invoices, customers, disputes on platform charges)
- **Events**: `checkout.session.*`, `payment_intent.*`, `charge.*` (non-Connect), `invoice.*`, `customer.*`, `customer.subscription.*`, `payout.*` (platform)
- **Env**: `STRIPE_HUB_PLATFORM_WEBHOOK_SECRET`

### Hub B: `stripe-hub-connect`
- **URL**: `https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/stripe-hub-connect`
- **Purpose**: All events on connected accounts (`connect: true` flag)
- **Events**: `account.*`, `capability.*`, `person.*`, `external_account.*`, `charge.*` (Connect), `charge.dispute.*`, `payout.*` (Connect), `checkout.session.*` (Connect), `invoice.*` (Connect), `customer.subscription.*` (Connect), `application_fee.*`
- **Env**: `STRIPE_HUB_CONNECT_WEBHOOK_SECRET`

## Routing table

New table on thecros Supabase (project `zmeawjhxbgvtcfcfcygf`):

```sql
create table if not exists public.stripe_account_routing (
  connected_account_id text primary key,
  satellite_app text not null,
  supabase_project_id text not null,
  webhook_path text not null default 'stripe-in',
  federation_secret_env text not null,
  tenant_id uuid,
  notes text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on public.stripe_account_routing(satellite_app);
create index on public.stripe_account_routing(active) where active = true;

-- Also platform-level checkout routing (some events don't have event.account)
create table if not exists public.stripe_checkout_routing (
  stripe_customer_id text primary key,
  satellite_app text not null,
  supabase_project_id text not null,
  tenant_id uuid,
  active boolean default true,
  created_at timestamptz default now()
);

-- Idempotency table (share across both hub fns)
create table if not exists public.stripe_hub_events (
  event_id text primary key,
  event_type text not null,
  connected_account_id text,
  satellite_app text,
  routed_at timestamptz default now(),
  forwarded_status_code int,
  forwarded_response text,
  processed_ok boolean default false
);
create index on public.stripe_hub_events(event_type);
create index on public.stripe_hub_events(satellite_app);
create index on public.stripe_hub_events(routed_at desc);

-- Dead-letter queue for downstream failures
create table if not exists public.stripe_hub_dlq (
  id uuid default gen_random_uuid() primary key,
  event_id text not null,
  event_type text not null,
  connected_account_id text,
  target_url text,
  failure_reason text,
  event_payload jsonb,
  retry_count int default 0,
  next_retry_at timestamptz,
  resolved boolean default false,
  created_at timestamptz default now()
);
create index on public.stripe_hub_dlq(resolved, next_retry_at) where resolved = false;
```

## Routing determination

### Connect events (Hub B)
```
1. event.account is set → lookup in stripe_account_routing
2. Found → forward to satellite
3. Not found → log to DLQ, alert. Do not 5xx (or Stripe will retry storm)
```

### Platform events (Hub A) — trickier
Not all platform events have obvious owner metadata. Strategies (fallback chain):
1. `event.data.object.metadata.satellite_app` (set by satellite when creating the resource)
2. `event.data.object.metadata.federation_app` (alternate key some satellites use)
3. For subscriptions: lookup `stripe_customer_id` in `stripe_checkout_routing`
4. For customers: same
5. Not found → DLQ, alert, but don't 5xx

**Satellite-side action needed:** ALL satellite code that creates a checkout session, subscription, or customer must set `metadata.satellite_app` from now on. New satellites already do this in the more recent codepaths; older satellites need audit.

## Forwarding pattern

Hub receives event, verifies signature, then does ONE of:
1. **Forward** to satellite `stripe-in` fn via signed HMAC POST (federation secret)
2. **Process inline** for platform-owned events (nothing to forward)

Forward payload:
```json
{
  "hub_event_id": "evt_...",
  "satellite_app": "resurrectio",
  "stripe_event": { ...original event object... },
  "delivered_at": "2026-07-27T05:30:00Z"
}
```
Signed with `X-CROS-Federation-Signature` (HMAC-SHA256 of body using per-satellite `FEDERATION_STRIPE_SECRET`).

Satellite `stripe-in` receives, verifies HMAC, dedupes on `hub_event_id`, processes.

## Hub edge fn skeleton (`stripe-hub-connect/index.ts`)

```typescript
// supabase/functions/stripe-hub-connect/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[stripe-hub-connect] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
  const webhookSecret = Deno.env.get("STRIPE_HUB_CONNECT_WEBHOOK_SECRET")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const svc = createClient(supabaseUrl, serviceRoleKey);
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return err(400, "missing_signature");

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    logStep("sig_fail", { error: String(err) });
    return err(400, "invalid_signature");
  }

  // Idempotency
  const { data: seen } = await svc.from("stripe_hub_events")
    .select("event_id").eq("event_id", event.id).maybeSingle();
  if (seen) {
    logStep("duplicate", { id: event.id });
    return new Response(JSON.stringify({ ok: true, dedupe: true }), { status: 200 });
  }

  const connectedAccountId = event.account;
  if (!connectedAccountId) {
    logStep("no_account", { type: event.type, id: event.id });
    // No routing possible — log to DLQ
    await svc.from("stripe_hub_dlq").insert({
      event_id: event.id,
      event_type: event.type,
      failure_reason: "no_connected_account_on_event",
      event_payload: event,
    });
    // Ack 200 so Stripe doesn't retry-storm
    return new Response(JSON.stringify({ ok: true, warning: "no_route" }), { status: 200 });
  }

  // Look up satellite
  const { data: route } = await svc.from("stripe_account_routing")
    .select("*").eq("connected_account_id", connectedAccountId).eq("active", true).maybeSingle();

  if (!route) {
    logStep("unknown_account", { acct: connectedAccountId });
    await svc.from("stripe_hub_dlq").insert({
      event_id: event.id,
      event_type: event.type,
      connected_account_id: connectedAccountId,
      failure_reason: "unknown_connected_account",
      event_payload: event,
    });
    return new Response(JSON.stringify({ ok: true, warning: "unknown_account" }), { status: 200 });
  }

  // Forward to satellite
  const targetUrl = `https://${route.supabase_project_id}.supabase.co/functions/v1/${route.webhook_path}`;
  const federationSecret = Deno.env.get(route.federation_secret_env);
  if (!federationSecret) {
    logStep("no_fed_secret", { env: route.federation_secret_env });
    await dlq(svc, event, connectedAccountId, targetUrl, "missing_federation_secret");
    return new Response(JSON.stringify({ ok: true, warning: "no_secret" }), { status: 200 });
  }

  const payload = JSON.stringify({
    hub_event_id: event.id,
    satellite_app: route.satellite_app,
    stripe_event: event,
    delivered_at: new Date().toISOString(),
  });

  const sig = await hmacHex(federationSecret, payload);
  let forwardStatus = 0;
  let forwardBody = "";
  try {
    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CROS-Federation-Signature": sig,
      },
      body: payload,
    });
    forwardStatus = resp.status;
    forwardBody = (await resp.text()).slice(0, 500);
  } catch (e) {
    logStep("forward_failed", { err: String(e) });
    await dlq(svc, event, connectedAccountId, targetUrl, `fetch_error: ${e}`);
    return new Response(JSON.stringify({ ok: true, warning: "forward_failed" }), { status: 200 });
  }

  await svc.from("stripe_hub_events").insert({
    event_id: event.id,
    event_type: event.type,
    connected_account_id: connectedAccountId,
    satellite_app: route.satellite_app,
    forwarded_status_code: forwardStatus,
    forwarded_response: forwardBody,
    processed_ok: forwardStatus >= 200 && forwardStatus < 300,
  });

  if (forwardStatus < 200 || forwardStatus >= 300) {
    await dlq(svc, event, connectedAccountId, targetUrl,
      `satellite_${forwardStatus}: ${forwardBody.slice(0, 200)}`);
  }

  return new Response(JSON.stringify({ ok: true, routed_to: route.satellite_app }), { status: 200 });
});

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function dlq(svc: any, event: Stripe.Event, acct: string, url: string, reason: string) {
  await svc.from("stripe_hub_dlq").insert({
    event_id: event.id, event_type: event.type,
    connected_account_id: acct, target_url: url,
    failure_reason: reason, event_payload: event,
    next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
}

function err(status: number, msg: string) {
  return new Response(JSON.stringify({ ok: false, error: msg }),
    { status, headers: { "Content-Type": "application/json" } });
}
```

## Satellite receiver skeleton (`stripe-in/index.ts`)

Copied into each satellite that currently receives Stripe events:

```typescript
// supabase/functions/stripe-in/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import type Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const federationSecret = Deno.env.get("FEDERATION_STRIPE_SECRET")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceRoleKey);

  const signature = req.headers.get("X-CROS-Federation-Signature");
  if (!signature) return err(400, "missing_hub_sig");
  const body = await req.text();

  const expected = await hmacHex(federationSecret, body);
  if (!timingSafeEq(signature, expected)) return err(401, "bad_hub_sig");

  const { hub_event_id, satellite_app, stripe_event } = JSON.parse(body);
  const event: Stripe.Event = stripe_event;

  // Idempotency (per-satellite table)
  const { data: seen } = await svc.from("stripe_events_processed")
    .select("event_id").eq("event_id", event.id).maybeSingle();
  if (seen) return new Response(JSON.stringify({ ok: true, dedupe: true }), { status: 200 });

  // Route by type — reuse existing handlers
  try {
    switch (event.type) {
      case "checkout.session.completed":
        // ... existing handler ...
        break;
      case "customer.subscription.updated":
        // ... existing handler ...
        break;
      // etc.
    }
  } catch (e) {
    return err(500, `handler_error: ${e}`);
  }

  await svc.from("stripe_events_processed").insert({
    event_id: event.id,
    event_type: event.type,
    hub_event_id,
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});

// (hmacHex + timingSafeEq utilities as above)
```

## Cutover plan (test-mode → live)

### Test mode (this week, zero risk)
1. Deploy `stripe-hub-connect` + `stripe-hub-platform` to thecros
2. Deploy `stripe-in` receivers to 1 pilot satellite (recommend **resurrectio** or **theschola** — smallest live traffic)
3. Create 2 test-mode webhook endpoints on Stripe pointing to hub fns
4. Trigger test events (`stripe trigger`) and verify:
   - Hub receives + verifies
   - Router looks up correctly
   - Satellite receives + verifies HMAC
   - Idempotency works
   - DLQ captures failures

### Live mode blue/green (next week)
1. Populate `stripe_account_routing` with ALL connected accounts (backfill from Stripe API)
2. Update each satellite that creates Stripe resources to set `metadata.satellite_app`
3. Create 2 live-mode hub endpoints alongside existing 32
4. **Both** hub + existing per-satellite endpoints active for 24-48h — dual-write mode
5. Compare event counts + processing outcomes between hub-routed vs direct
6. Once matched, delete per-satellite endpoints in batches of 5
7. Monitor Stripe event log — no missed deliveries expected

### Rollback plan
If hub misbehaves during dual-write: disable hub endpoint (`enabled: false` via API), traffic continues on per-satellite endpoints. Zero downtime.

## Env vars needed

### thecros (hub)
- `STRIPE_HUB_PLATFORM_WEBHOOK_SECRET` — new
- `STRIPE_HUB_CONNECT_WEBHOOK_SECRET` — new
- `STRIPE_SECRET_KEY` — existing
- Per-satellite: `FEDERATION_STRIPE_SECRET_RESURRECTIO`, `FEDERATION_STRIPE_SECRET_VIGILIA`, etc. (one per active satellite)

### Each satellite (stripe-in)
- `FEDERATION_STRIPE_SECRET` — matches thecros env for that satellite

## Effort estimate
- Hub fn (both): 3-4 hours
- Satellite receiver template: 1 hour
- Testing (test mode): 2 hours
- Routing table + backfill: 1 hour
- Live cutover: 2 hours (mostly monitoring)

**Total: ~10 focused hours, spread over a week is comfortable.**
