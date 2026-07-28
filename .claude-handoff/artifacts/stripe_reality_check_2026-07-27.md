# Stripe Reality Check — What's Actually Live
**Date:** 2026-07-27 16:15 CDT
**Trigger:** Backfilling routing table revealed nothing to backfill

## Live production Stripe state

| Metric | Count | Notes |
|---|---|---|
| Webhook endpoints | 31/32 | 32-cap Stripe confirmed; hard block on adding more |
| Connected accounts | 2 | Both never-onboarded (`charges_enabled=false`) |
| Customers | 13 | 12 smoke tests + 1 personal (jeromy.darling@gmail.com) |
| Active subscriptions | 0 | Zero customers have `subscriptions.data[]` |
| Completed charges (6 months) | 1 | $500 test charge on 2026-06-16 |
| Recent checkout sessions | 5 | All EXPIRED unpaid |

## What this means

**The 32-endpoint cap is a launch-readiness issue, not a production issue.**

You are pre-launch across the entire federation:
- No paying customers
- No active subscriptions
- No completed Connect onboarding
- No Connect activity of any kind

**Therefore:** Hub-and-spoke migration has ZERO production risk right now. This is the ideal moment to consolidate — before customers arrive.

## Metadata convention findings

Recent checkout sessions (all expired, from 2026-07-21 to 2026-07-22) show inconsistent metadata:

- **communis**: `metadata.app_slug = 'communis'`, `metadata.kind = 'platform_subscription'` ✅ good pattern
- **directio**: `metadata.directio_organization_id`, `metadata.directio_user_id`, `metadata.directio_platform_tier` ❌ prefix-only, no `satellite_app` key
- **One session**: `metadata.kind = 'platform_subscription'` alone, no app identifier ❌ unroutable

For hub-and-spoke to route platform events correctly, **every satellite that creates a Stripe resource must set** `metadata.satellite_app = '<slug>'`. This needs to be enforced in code before any real traffic starts.

## Revised migration plan (dramatically simplified)

Since there's nothing live to preserve, the migration is:

### Phase 1: Standardize metadata (day 1) — DO FIRST
- Update all satellite `stripe-create-checkout-session` code to set `metadata.satellite_app`
- Audit each satellite's checkout/subscription creation code
- Ship PRs to main across all satellites

### Phase 2: Deploy hub in test mode (day 1-2)
- Run `20260727115800_stripe_hub_routing.sql` on thecros
- Populate `stripe_account_routing` with skeleton rows for each satellite (even though acct_id is null for platform-only apps)
- Create 2 test-mode Stripe webhook endpoints pointing to hub fns
- Trigger test events with `stripe trigger`
- Verify routing + HMAC + DLQ

### Phase 3: Cut over live endpoints (day 3)
- Delete all 22 per-satellite endpoints in Stripe (they serve no live traffic)
- Create 2 live-mode hub endpoints
- Copy `stripe_in_satellite_template.ts` into satellites that need to react to events
- **No downtime because no live traffic**

### Phase 4: Real launch
- Onboard actual Connect accounts
- Enable real subscriptions
- Everything routes through the hub from day 1 of real traffic

## Immediate action items

1. **Audit metadata patterns across all satellite Stripe code** — subagent job
2. **Ship metadata.satellite_app standardization PRs** — code changes
3. **Deploy hub fn + migration to thecros** — trigger via Lovable or manual Supabase push
4. **Delete stale/empty endpoints from the 31** — frees slots for the hub itself

## What we can safely delete NOW to free slots

Since NO customer is going to fail if any of these are deleted:
- All 11 Connect endpoints (no Connect account is onboarded)
- All 21 Platform endpoints (13 customers exist, all smoke tests)

Effectively we could delete all 31 endpoints and only miss:
- The 1 completed charge from 2026-06-16 which is done anyway
- Smoke tests that don't matter

**But** — some code paths on the satellites are wired to expect Stripe events. Deleting endpoints without shipping hub-side receivers will silently break those code paths when real traffic starts. Order matters.

## Recommended order tonight

1. Populate routing table with all federation satellites (data prep, no risk)
2. Ship the migration + hub fn to thecros Supabase (deploy the code we already pushed)
3. Create 2 test-mode hub endpoints, test with `stripe trigger`
4. Audit metadata patterns in satellite code (subagent)
5. Ship metadata standardization PRs (parallel to hub testing)

Then tomorrow, in daylight, do the live cutover.
