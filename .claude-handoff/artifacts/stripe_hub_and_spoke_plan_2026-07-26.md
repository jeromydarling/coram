# CROS Stripe Hub-and-Spoke Migration Plan
**Date:** 2026-07-26
**Trigger:** Stripe confirms 32 endpoint cap is hard; recommends Connect webhook consolidation

## The current problem (what got us here)

Each satellite app has its own webhook endpoint on the platform account. Same events subscribed by all → same event delivered N times → burns endpoint slots.

Stripe: **"32 is by design. Won't scale further."**

## The target architecture (what Stripe recommends)

```
                        ┌──────────────────────────────────┐
                        │  Stripe Platform (CROS LLC)      │
                        │  1 x connect_account.updated ep  │
                        │  1 x charge.* / payment_intent.* │
                        │  1 x checkout.session.*          │
                        │  1 x invoice.* (Billing)         │
                        │  = 3-5 endpoints total, not 22+  │
                        └────────────┬─────────────────────┘
                                     │
                                     ▼
                     ┌─────────────────────────────────┐
                     │  thecros/functions/             │
                     │  stripe-hub                     │
                     │  (single hub function)          │
                     │                                 │
                     │  1. Verify whsec                │
                     │  2. Extract event.account       │
                     │  3. Lookup connected_account →  │
                     │     satellite app + tenant      │
                     │  4. Forward to satellite fn OR  │
                     │     process inline              │
                     └────────────┬────────────────────┘
                                  │
             ┌────────────────────┼────────────────────┐
             ▼                    ▼                    ▼
      ┌────────────┐        ┌────────────┐      ┌────────────┐
      │ resurrectio│        │ vigilia    │  ... │ sanctum    │
      │ /stripe-in │        │ /stripe-in │      │ /stripe-in │
      └────────────┘        └────────────┘      └────────────┘
       (per-satellite handler, HMAC-verified via federation secret)
```

**Key change:** No more direct Stripe → satellite webhook. All events flow through **thecros/stripe-hub** which is the single source of truth for routing.

## Endpoint count after migration

3-5 platform endpoints total:
- `stripe-hub-connect` — subscribes to Connect account events (account.updated, capability.updated, etc.)
- `stripe-hub-payments` — payment_intent.*, charge.*, payout.*
- `stripe-hub-checkout` — checkout.session.* (very high volume, keep separate)
- `stripe-hub-billing` — invoice.*, subscription.*, customer.*
- `stripe-hub-connect-payments` — (optional, `connect: true` variant for Connect account payments)

**Well below the 32 cap. Leaves 27+ slots for future needs.**

## Migration phases

### Phase 0 — Audit current state (do this first)
- Pull live endpoint list via Stripe API (all 32)
- Map each endpoint → its target Supabase fn URL → owning satellite
- Identify event overlap (which events go to multiple endpoints — those are the culprits)
- Snapshot to `/home/user/workspace/stripe_current_32_endpoints.json`

### Phase 1 — Build the hub (thecros/stripe-hub)
- New Supabase edge fn at `thecros/functions/v1/stripe-hub`
- Verify webhook signature using `STRIPE_HUB_WEBHOOK_SECRET`
- Extract routing info:
  - Connect events: `event.account` (`acct_xxx`)
  - Direct events: destination lookup by customer/tenant metadata
- Federation secret HMAC when forwarding to satellite
- Retry + DLQ (dead-letter queue) for downstream failures

### Phase 2 — Build satellite receivers
- Each satellite that currently receives Stripe events gets a `stripe-in` edge fn
- Verifies HMAC using `FEDERATION_STRIPE_SECRET` (already exists? or new?)
- Processes event using existing per-app handler logic (mostly copy from current webhook fn)

### Phase 3 — Migrate connected accounts
- Update all Stripe Connect account records with `metadata.satellite_app = "resurrectio"` (or whichever)
- Populate a `connected_accounts` table on thecros with `acct_id, satellite_app, tenant_id` — hub uses this to route
- Cross-reference against existing per-app databases

### Phase 4 — Cutover
- Create the 3-5 new hub endpoints in Stripe (via API, once)
- Delete the 22 old per-satellite endpoints (via API, batch)
- Update satellite `STRIPE_WEBHOOK_SECRET` env → no longer directly used, or repurpose as federation secret
- Monitor Stripe event log for delivery failures

### Phase 5 — Cleanup
- Remove old per-app webhook edge fns (or keep as `stripe-in` receivers)
- Update federation gap report
- Document the new pattern in a durable skill

## Risks to flag

1. **Live traffic during migration** — payments happening right now. Need blue/green or careful sequencing. Recommend building hub + satellites first, TEST with test-mode endpoints, then flip live.

2. **Missing routing metadata** — if any current Connect account doesn't have `metadata.satellite_app`, the hub can't route it. Backfill needed.

3. **Non-Connect direct events** — some events (like Billing) may not include `account:`. Need alternative routing (customer metadata, product ID, etc.).

4. **Event replay / idempotency** — Stripe retries. Hub must be idempotent. Track `event.id` in a dedupe table.

5. **Ordering** — Events aren't guaranteed in order. Some handlers assume ordering (subscription lifecycle). Design for that.

## Estimated effort
- Phase 0 (audit): 30 min via Stripe API
- Phase 1 (hub build): 2-4 hrs code + deploy
- Phase 2 (satellites): 30 min × N satellites
- Phase 3 (metadata backfill): 1 hr, mostly SQL
- Phase 4 (cutover): 30 min if test-mode passes; monitoring window 24h
- Phase 5 (cleanup): 1 hr

**Total: 1-2 focused days, or a week of nights.**

## Immediate next step

Pull the live 32-endpoint inventory to see what we're actually working with. That requires either:
- Stripe API key (secret-key or restricted key) via custom-credentials
- Or browser access to dashboard (via Comet — but Comet was flaky last night)

Then design the exact 3-5 hub endpoints based on the actual event mix.
