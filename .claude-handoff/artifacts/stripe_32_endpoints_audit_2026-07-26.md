# Stripe 32-Endpoint Live Audit
**Date:** 2026-07-26 23:58 CDT
**Source:** `https://api.stripe.com/v1/webhook_endpoints` (live mode, CROS LLC platform `acct_1TAgVAIuo9wd3dMd`)
**Full data:** `/home/user/workspace/stripe_current_32_endpoints_analysis.json`

## Headline

- **32/32 endpoints — hard cap reached.** 0 slots free.
- **27 unique event types** across all 32 endpoints. In theory, a single hub endpoint subscribed to `*` could receive every event.
- **`checkout.session.completed` fires 23 times per event** — 23 parallel deliveries for a single checkout. This is the exact symptom Stripe's engineering team called out.
- 11 endpoints are Connect (account.updated, capability.updated, etc.), 21 are Platform (subscriptions, checkouts, invoices).

## Immediate wins (quick delete candidates — free slots without code)

### 1. Sanctum has THREE endpoints at the SAME URL
Same URL `https://sanctum.garden/api/stripe/webhooks` — three registrations:
- `we_1TtVHqIuo9wd3dMdxdn9G4IY` — no description, 6 events (looks like a stale duplicate of platform)
- `we_1TkyxLIuo9wd3dMdzFe8HyPt` — "sanctum_connect", 11 events (Connect ep)
- `we_1TkyxLIuo9wd3dMdNcvdNQMW` — "sanctum_platform", 17 events (Platform ep)

**Action:** Verify with sanctum code which whsec it uses. The unnamed 6-event one is almost certainly stale/redundant.
**Slots freed:** 1

### 2. theschola.app kpcannnhenymymnhpwib
- `we_1TtCKcIuo9wd3dMdoQIdZKAX` — no description, 6 events (recently created?)
- `we_1TAgwsIuo9wd3dMdhaG4gq9C` — "theschola.app site", 5 events (older)

Both point to the same `stripe-webhook` fn. Likely one is stale.
**Slots freed:** possibly 1

### 3. Culina + Directio identical event patterns
Both `culina_connect`+`culina_platform` and `directio Connect`+`directio platform` use **identical event sets** (11 events + 17 events). These are the canonical Stripe UI "Connect + Platform" wizard output. They're valid but they are exactly the pattern Stripe wants us to consolidate.

## Endpoints by satellite

| # | Satellite | URL | Events | Type |
|---|-----------|-----|--------|------|
| 1 | sanctum | sanctum.garden/api/stripe/webhooks | 6 | platform (stale?) |
| 2 | ??? (kpcannn) | kpcannnhenymymnhpwib/stripe-connect-webhook | 1 | connect |
| 3 | ??? (kpcannn) | kpcannnhenymymnhpwib/stripe-webhook | 6 | platform |
| 4 | communicare | communicare.farm/api/billing/connect-webhook | 3 | connect |
| 5 | communicare | communicare.farm/api/billing/webhook | 5 | platform |
| 6 | vigilia | ephuuewoqemcnqjojoip/stripe-connect-webhook | 7 | connect |
| 7 | rehearso | tidoerbzdomhtfyuovji/stripe-connect-webhook | 7 | connect |
| 8 | resurrectio | lzincahqppvdeyzxqsqw/stripe-connect-webhook | 7 | connect |
| 9 | refugium | jiefixzipfquwlqyzrcg/stripe-webhook | 6 | platform |
| 10 | bitoku | oumbwqgibozyddwntstc/stripe-webhook | 6 | platform |
| 11 | communis | ebsjikndtrtlvryphkgk/stripe-webhook | 6 | platform |
| 12 | vigilia | ephuuewoqemcnqjojoip/stripe-webhook | 6 | platform |
| 13 | rehearso | tidoerbzdomhtfyuovji/stripe-webhook | 6 | platform |
| 14 | fabrica | wqnplepwcbbmtvajxnqx/stripe-webhook | 6 | platform |
| 15 | hortus | piaoyalquwfusbiedouq/stripe-webhook | 6 | platform |
| 16 | propria | svmobotemmnsorkvlprb/stripe-webhook | 6 | platform |
| 17 | transitus | jksfuzmyxgyjsrypxuxp/stripe-webhook | 6 | platform |
| 18 | resurrectio | lzincahqppvdeyzxqsqw/stripe-webhook | 6 | platform |
| 19 | 8s.rodeo | 8s.rodeo/api/billing/webhook | 4 | platform |
| 20 | collegium | divzdyxtjhkbftsnffnu/stripe-connect-webhook | 11 | connect |
| 21 | collegium | divzdyxtjhkbftsnffnu/stripe-webhook | 17 | platform |
| 22 | sanctum | sanctum.garden/api/stripe/webhooks (sanctum_connect) | 11 | connect |
| 23 | sanctum | sanctum.garden/api/stripe/webhooks (sanctum_platform) | 17 | platform |
| 24 | culina | culina.life/api/stripe/webhooks (culina_connect) | 11 | connect |
| 25 | culina | culina.life/api/stripe/webhooks (culina_platform) | 17 | platform |
| 26 | directio | godirectio.com/api/stripe/webhook (Connect) | 11 | connect |
| 27 | directio | godirectio.com/api/stripe/webhook (Platform) | 17 | platform |
| 28 | ??? (betonqvg) | betonqvgbnuqjeyutzqh/stripe-webhook | 4 | platform (unknown app) |
| 29 | cormundum | lycubwceblanwyxfcojm/stripe-webhook | 4 | platform |
| 30 | thecros | zmeawjhxbgvtcfcfcygf/stripe-connect-webhook | 4 | connect |
| 31 | thecros | zmeawjhxbgvtcfcfcygf/stripe-webhook | 6 | platform |
| 32 | theschola | kpcannnhenymymnhpwib/stripe-webhook | 5 | connect (site) |

### Unknown / uninvestigated hosts (need identification)
- `kpcannnhenymymnhpwib` — likely **theschola** (3 endpoints pointing here, one described)
- `betonqvgbnuqjeyutzqh` — no description; needs identification
- `lycubwceblanwyxfcojm` — "Cor Mundum" (in the federation? or old?)

## Event overlap heatmap (top waste)

| Event | # endpoints subscribed | Waste implication |
|---|---|---|
| `checkout.session.completed` | **23** | ~22 wasted deliveries per checkout |
| `customer.subscription.deleted` | 21 | 20 wasted per event |
| `customer.subscription.updated` | 20 | 19 wasted |
| `customer.subscription.created` | 19 | 18 wasted |
| `invoice.payment_failed` | 18 | 17 wasted |
| `invoice.paid` | 16 | 15 wasted |
| `account.updated` | 11 | 10 wasted |
| `charge.refunded` | 11 | 10 wasted |
| `charge.dispute.created` | 10 | 9 wasted |

Every one of those "wasted" deliveries costs Stripe compute and adds latency.

## Recommended target architecture

**5 hub endpoints total on the platform (frees 27 slots):**

### Hub 1: `stripe-hub-platform-payments`
- URL: `https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/stripe-hub`
- Events: `checkout.session.*`, `payment_intent.*`, `charge.*`, `invoice.*`, `customer.*`, `customer.subscription.*`
- Handles **platform-level** payments across all satellites.
- Routes by looking up `event.data.object.metadata.satellite_app` OR customer's tenant record

### Hub 2: `stripe-hub-connect-account`
- URL: `https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/stripe-hub-connect`
- Events: `account.updated`, `account.application.deauthorized`, `capability.updated`, `person.updated`, `external_account.*`
- Routes by `event.account` (`acct_xxx`) → satellite app lookup

### Hub 3: `stripe-hub-connect-payments`
- URL: same as Hub 2 (or separate path)
- Events (on Connect side): `charge.refunded`, `charge.dispute.*`, `payout.*`, `application_fee.*`
- Routes by `event.account`

### Hub 4: `stripe-hub-billing` (optional, keeps invoice/subscription traffic isolated)
- Events: `invoice.*`, `customer.subscription.*`
- Could roll into Hub 1

### Hub 5: `stripe-hub-checkout-highvolume` (optional, isolates the loudest event)
- Events: `checkout.session.*`
- Isolated so heavy checkout traffic doesn't queue behind slower billing events

**Minimum viable:** 2 endpoints (Hub 1 + Hub 2). We start there and split later only if latency demands it.

## Routing table needed

New table on thecros Supabase:

```sql
create table stripe_account_routing (
  connected_account_id text primary key,   -- acct_xxx
  satellite_app text not null,             -- 'sanctum' | 'culina' | 'directio' | ...
  tenant_id uuid,                          -- optional if satellite is multi-tenant
  supabase_project_id text not null,       -- for URL building
  federation_secret text not null,         -- HMAC to satellite
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Populate by:
1. Pull `GET /v1/accounts` from Stripe → all connected accounts
2. Cross-reference with each satellite's connected_accounts records
3. Backfill

## Migration order (safest to riskiest)

**Phase A (this week, no risk):**
- Delete stale duplicate endpoints (sanctum 3-way, theschola 2-way) → free 2-3 slots
- Investigate + identify unknown hosts (betonqvg, lycubwc/Cor Mundum)

**Phase B (test mode, no risk):**
- Build `stripe-hub` edge fn on thecros
- Create test-mode hub endpoints on Stripe
- Route test payments through the hub
- Verify HMAC + routing correctness

**Phase C (blue/green in live mode):**
- Create live hub endpoints alongside existing 32
- Duplicate whsec into hub-consumer functions
- Monitor delivery to hub for 24-48h; compare against per-satellite endpoint logs
- Once hub proven reliable, delete per-satellite endpoints in batches

**Phase D (cleanup):**
- Delete all 22 per-satellite endpoints
- Remove/rename satellite webhook fns (or keep as internal HMAC receivers)
- Update federation gap report + skill docs

## What's needed to proceed

- ✅ Stripe API key (Read + Write to Webhook Endpoints) — you already provisioned this
- ⏸ Confirmation of unknown hosts (betonqvg, Cor Mundum) — need to identify or skip
- ⏸ Approval to start deleting duplicates (Phase A quick wins)
- ⏸ Design + build sign-off on the hub function

## Files
- Full endpoint dump: `/home/user/workspace/stripe_current_32_endpoints_analysis.json`
- Endpoint list (human readable): `/tmp/stripe_endpoints_raw.txt`
- This audit: `/home/user/workspace/stripe_32_endpoints_audit_2026-07-26.md`
