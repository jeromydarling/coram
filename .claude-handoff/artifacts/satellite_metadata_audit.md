# Satellite Stripe `metadata.satellite_app` Audit

**Date:** 2026-07-27
**Purpose:** Prepare all CROS federation satellites for the hub-and-spoke Stripe migration (`thecros/stripe-hub-platform` routes platform events on `event.data.object.metadata.satellite_app`).
**Method:** Shallow-cloned all 22 canonical satellite repos (`gh repo clone --depth=1`) and grepped locally for Stripe resource-creation calls (`gh search code` hit GitHub's API rate limit, so local clone+grep was used instead — see Anomalies). Reviewed every match by hand for existing metadata keys.

Convention enforced: every satellite creating `checkout.Session`, `Subscription`, `Customer`, or `PaymentIntent` sets `metadata.satellite_app = '<slug>'`, added **alongside** existing keys (never replacing them).

---

## Per-satellite findings

### 1. communicare — `jeromydarling/communicare`
- **Stripe integration:** Yes — Cloudflare Pages Functions, raw REST via `stripeRequest()` helper (not the Node SDK, so it didn't show up on `stripe.customers.create` pattern search).
- Files: `functions/api/billing/create-checkout-session.ts` (Customer + Checkout Session), `functions/_lib/stripe.ts` (shared helper), `supabase/functions/stripe-connect` (Connect, out of scope — webhook/onboarding, not resource creation).
- **Current metadata:** `metadata[user_id]` on both Customer and Checkout Session. No app identifier.
- **PR shipped:** ✅ Yes — added `metadata[satellite_app] = "communicare"` to both calls.

### 2. vigilia — `jeromydarling/vigilia-ffa3c410`
- **Stripe integration:** Yes.
- Files:
  - `supabase/functions/create-checkout/index.ts:176` — Checkout Session. **This is a shared/vestigial template file** (hardcoded fallback origin `https://thecros.app`, generic tier/addon metadata) — identical copy also found in resurrectio, refugium, thecros. No app identifier at all.
  - `supabase/functions/stripe-connect-create-invoice/index.ts:85` — Customer (on connected account) + Invoice. Sets `cros_tenant`, `contact_id` — no app identifier. (Also identical shared template across 4 repos.)
  - `supabase/functions/vigilia-create-signup-checkout/index.ts:89` — Checkout Session. Sets `flow: 'vigilia_self_serve'`, `organization_name`, `buyer_email` — no app identifier (Product/Price metadata elsewhere already uses `app: "vigilia"`, but that's out of scope — not a Session/Sub/Customer/PaymentIntent).
- **PR shipped:** ✅ Yes — added `satellite_app: "vigilia"` to all three resource-creation calls.

### 3. resurrectio — `jeromydarling/resurrectio-3d07f98c`
- **Stripe integration:** Yes.
- Files: `supabase/functions/create-checkout/index.ts:176` (same shared template as vigilia — no app id), `supabase/functions/stripe-connect-create-invoice/index.ts:85` (same shared template — no app id).
- **PR shipped:** ✅ Yes — added `satellite_app: "resurrectio"` to both.

### 4. sanctum — `jeromydarling/sanctum`
- **Stripe integration:** Yes — Cloudflare Worker, raw REST via `stripeCall()` helper.
- Files: `apps/worker/src/routes/stripe.ts` — `handleCheckout()` (line ~125, PaymentIntent-style destination-charge Checkout Session, sets `payment_intent_data[metadata][booking_id]` only) and `handleSubscribe()` (line ~160, Checkout Session, sets `metadata[kind]='subscription'`, `client_reference_id`). No app identifier in either.
- **PR shipped:** ✅ Yes — added `'metadata[satellite_app]': 'sanctum'` (and to the nested `payment_intent_data[metadata]`) in both functions.

### 5. culina — `jeromydarling/culina`
- **Stripe integration:** Yes — Cloudflare Worker, raw REST via `stripe()` helper.
- Files: `apps/worker/src/stripe/index.ts` — `handleInvoicePay()` (line 76, invoice-pay Checkout Session, sets `metadata: {invoice_id, kitchen_id, tenant_id}`) and storefront `checkout` action (line 169, Checkout Session, sets `metadata: {order_id, tenant_id, slug}`). No app identifier.
- **PR shipped:** ✅ Yes — added `satellite_app: 'culina'` to both metadata objects.

### 6. directio — `jeromydarling/directio`
- **Stripe integration:** Yes — Remix app, raw REST via `stripeRequest()` helper. **This is the BAD pattern flagged in live data.**
- Files:
  - `app/lib/stripe.server.ts:180` `createCheckoutSession()` — generic Connect checkout, merges caller-supplied `args.metadata` via a loop (line 261-263). No app id unless caller passes one (none do).
  - `app/lib/stripe.server.ts:470` `createPlatformCheckoutSession()` — sets `metadata[directio_organization_id]`, `metadata[directio_user_id]`, `metadata[directio_platform_tier]` exactly as observed live. No `satellite_app`.
- **PR shipped:** ✅ Yes — added `body["metadata[satellite_app]"] = "directio"` unconditionally in both functions (in the generic loop-based one, added right after the loop so it can't be overridden by caller-supplied metadata).

### 7. collegium — `jeromydarling/collegium-connect`
- **Stripe integration:** Yes.
- File: `supabase/functions/collegium-stripe-checkout/index.ts` — Customer (line 140) + Checkout Session (line 164).
- **Current metadata:** Already sets `metadata.app = "collegium"` on Customer and `metadata = {app: "collegium", plan, user_id, chapter_id?}` on Checkout Session. **Compatible with hub routing** (`app` is not one of the two keys the hub checks — `satellite_app` / `federation_app` — so this still needs a follow-up, see below).
- **PR shipped:** ✅ Yes — added `satellite_app: "collegium"` alongside the existing `app: "collegium"` key (kept `app` for backward compatibility with any collegium-internal code that reads it).

### 8. rehearso — `jeromydarling/rehearso`
- **Stripe integration:** Yes.
- Files:
  - `supabase/functions/create-booking-payment/index.ts:94` — PaymentIntent, sets `metadata: {space_id, org_id, booking_date}`. No app id.
  - `supabase/functions/create-checkout/index.ts:102` — Checkout Session, sets `metadata: {source_app: "rehearso", tier}`. **`source_app` is not a recognized hub key.**
  - `supabase/functions/gig-payment/index.ts:84` — PaymentIntent, sets `metadata: {gig_booking_id, musician_profile_id, org_id}`. No app id.
- **PR shipped:** ✅ Yes — added `satellite_app: "rehearso"` to all three metadata objects (kept `source_app` where present).

### 9. bitoku — `jeromydarling/bitoku-9fb5dffb`
- **Stripe integration:** Yes.
- File: `supabase/functions/create-checkout/index.ts:106` — Checkout Session, sets `metadata: {source_app: "bitoku", tier}` on both top-level and `subscription_data.metadata`. Same `source_app` gap as rehearso.
- **PR shipped:** ✅ Yes — added `satellite_app: "bitoku"` alongside `source_app`.

### 10. hortus — `jeromydarling/hortus-claude-s-garden`
- **Stripe integration:** Yes.
- File: `supabase/functions/create-checkout/index.ts` — Customer (line 87, `metadata: {supabase_user_id}`) + Checkout Session (line 100; the Session call itself carries no top-level `metadata`, only `subscription_data.metadata: {supabase_user_id, tier}`).
- **PR shipped:** ✅ Yes — added `satellite_app: "hortus"` to the Customer metadata and to `subscription_data.metadata`.

### 11. transitus — `jeromydarling/transitus-be0eceba`
- **Stripe integration:** Yes — but via raw `fetch()` directly to `api.stripe.com`, not a helper or SDK (didn't match the grep pattern at all; found via manual inspection).
- File: `supabase/functions/stripe-create-checkout/index.ts` — Customer (line 62, `fetch .../v1/customers`, `metadata[user_id]`) + Checkout Session (line 81, `fetch .../v1/checkout/sessions`, `metadata[user_id]`, `metadata[tier]`, mirrored to `subscription_data[metadata]`). No app id.
- **PR shipped:** ✅ Yes — added `metadata[satellite_app]` (and `subscription_data[metadata][satellite_app]`) = `"transitus"` to both fetch bodies.

### 12. refugium — `jeromydarling/refugium-a261235f`
- **Stripe integration:** Yes, but code lives in `supabase/functions.archive/` (an **archived** functions directory, not the live `supabase/functions/`).
- Files: `functions.archive/create-checkout/index.ts:176` (same shared thecros.app template, no app id), `functions.archive/stripe-connect-create-invoice/index.ts:85` (same shared template, Customer + Invoice, no app id).
- **PR shipped:** ⚠️ **Skipped — flagged as anomaly.** These files are under a directory literally named `functions.archive`, meaning they are not deployed. Editing dead code adds no routing value and risks confusing future cleanup. See Anomalies section — recommend confirming these are truly retired (or restoring/renaming if refugium actually still needs Stripe) as a manual follow-up.

### 13. communis — `jeromydarling/communis-b47839b1`
- **Stripe integration:** Yes. **This is the "good" satellite per live data — but only partially, in code.**
- Files (4 checkout functions):
  - `stripe-buy-in-checkout/index.ts:75` — Checkout Session, `metadata: {tenant_id, member_id, schedule_id, kind:'buy_in'}`. No app id.
  - `stripe-dues-subscribe/index.ts:54` — Checkout Session, `metadata: {tenant_id, member_id, kind:'dues'}`. No app id.
  - `stripe-org-license-checkout/index.ts:50` — Checkout Session, `metadata: {org_id, kind:'org_license', user_id}`. No app id.
  - `stripe-platform-subscribe/index.ts:53` — Checkout Session, `metadata: user ? {user_id, kind:'platform_subscription'} : {kind:'platform_subscription'}`. **This is the exact "one session had only `metadata.kind`, no app identifier" anomaly the reality-check doc flagged.** None of the 4 functions in the current codebase set `app_slug` — the live `app_slug='communis'` sample must have come from a different/older code path or been set manually; current `main` does not produce it.
- **PR shipped:** ✅ Yes — added `satellite_app: 'communis'` to all 4 Checkout Session calls (and their `subscription_data.metadata` mirrors where present).

### 14. propria — `jeromydarling/propria-aac78f12`
*(Canonical-repos doc lists `propria-1e798e8e` as of 2026-06-10, but `propria-aac78f12` is newer — pushed 2026-07-17 vs 2026-06-27 — and far larger (8.3MB vs 8.1MB, actively growing). Treated `propria-aac78f12` as canonical; flagged in Anomalies.)*
- **Stripe integration:** Yes.
- File: `supabase/functions/create-checkout/index.ts:86` — Checkout Session, metadata only set when `userId` present: `metadata: {userId, lookupKey, cltId?}`, mirrored to `subscription_data.metadata`. No app id. Guest checkouts (no `userId`) get **no metadata at all**.
- **PR shipped:** ✅ Yes — added `satellite_app: "propria"` unconditionally (moved outside the `userId &&` guard so guest checkouts are still tagged) to both the top-level and `subscription_data.metadata`.

### 15. fabrica — `jeromydarling/fabrica-forge`
- **Stripe integration:** Yes.
- File: `supabase/functions/create-checkout/index.ts:56` — Checkout Session. **No `metadata` field at all** in the current code — the most bare-bones case found.
- **PR shipped:** ✅ Yes — added a new `metadata: { satellite_app: "fabrica" }` block to the session-create call.

### 16. theschola — `jeromydarling/theschola`
- **Stripe integration:** Yes — most Stripe surface area of any satellite (5 checkout-creating functions).
- Files:
  - `supabase/functions/create-checkout/index.ts:74` — Checkout Session, `metadata: {community_id}`.
  - `supabase/functions/create-invoice-payment/index.ts:159` — Checkout Session, `metadata: {invoice_id, community_id, payment_type:'tuition'}`.
  - `supabase/functions/schola-formation-checkout/index.ts:82,153` — two Checkout Session calls (`create_cohort` / `join_cohort` actions), `metadata: {cohort_id, user_id, community_id, action}`.
  - `supabase/functions/schola-yearbook-print-order/index.ts:166` — Checkout Session, `metadata: {yearbook_order_id, yearbook_id, community_id, payment_type:'yearbook'}`.
  - None set an app identifier.
- **PR shipped:** ✅ Yes — added `satellite_app: "theschola"` to all 5 metadata objects.

### 17. thecros — `jeromydarling/thecros`
- **Stripe integration:** Yes — same shared template files as vigilia/resurrectio/refugium: `supabase/functions/create-checkout/index.ts:176` and `supabase/functions/stripe-connect-create-invoice/index.ts:85`. No app id (this is the hub-to-be, but it also runs its own platform checkout for CROS-branded plans).
- **PR shipped:** ✅ Yes — added `satellite_app: "thecros"` to both. Also **note:** thecros is about to become the hub itself — this metadata is still correct/needed for thecros's own platform-level Stripe resources (distinct from the hub-routing fn being built), so the change is safe and desired.

### 18. via-publica — `jeromydarling/via-publica`
- **Stripe integration:** ❌ **No.** No Stripe files, no billing code, no checkout/payment routes found anywhere in the repo (confirmed the app is Sightengine/WalkScore/Census integrations per the canonical-repos amendment, with no monetization surface yet).
- **PR shipped:** N/A — skipped, nothing to change.

### 19. thegreatnave — `jeromydarling/thegreatnave-49ebb963`
- **Stripe integration:** Yes.
- File: `supabase/functions/create-checkout/index.ts` — Customer (line 75, `metadata: {supabase_user_id}`) + Checkout Session (line 85, `metadata: {supabase_user_id}`). No app id.
- **PR shipped:** ✅ Yes — added `satellite_app: "thegreatnave"` to both.

### 20. cormundum — `jeromydarling/cormundum`
- **Stripe integration:** Yes.
- Files:
  - `supabase/functions/create-checkout/index.ts:68,75` — Customer (`metadata: {supabase_user_id}`) + Checkout Session (`metadata: {supabase_user_id}`, mirrored to `subscription_data.metadata`).
  - `supabase/functions/create-retreat-checkout/index.ts:101,111` — Customer (`metadata: {supabase_user_id}`) + Checkout Session (`metadata: {retreat_id, user_id, pricing_tier}`).
  - No app id anywhere.
- **PR shipped:** ✅ Yes — added `satellite_app: "cormundum"` to all four metadata objects.

### 21. custodia — `jeromydarling/custodia`
- **Stripe integration:** Yes.
- Files:
  - `src/server/billing/billing.functions.ts:65,80` — Customer (`metadata: {org_id, cros_app: "custodia"}`) + Checkout Session (`metadata: {org_id, custodia_tier, cros_app: "custodia"}`, mirrored to `subscription_data.metadata`). **Already sets `cros_app` — a satellite-identifying key, but not one of the two hub fallback keys (`satellite_app`/`federation_app`).**
  - `supabase/functions/fundraising-checkout/index.ts:156,207` — two Checkout Session calls using a shared `baseMetadata` object that already includes `custodia_app: "fundraising"` plus `org_id`, `kind`, `donor_email`, etc. Same gap — `custodia_app` isn't a hub-recognized key.
- **PR shipped:** ✅ Yes — added `satellite_app: "custodia"` alongside the existing `cros_app`/`custodia_app` keys in all locations (kept both existing keys unchanged).

### 22. 8s — `jeromydarling/8s`
- **Stripe integration:** Yes — Cloudflare Worker, raw REST via `stripe()` helper.
- File: `worker/billing.ts` — Customer (line 119, `"metadata[app_slug]": "8seconds"`) + Checkout Session (line 133, `"metadata[app_slug]": "8seconds"`, mirrored to `subscription_data[metadata][app_slug]`).
- **Current metadata:** Already sets `metadata[app_slug] = "8seconds"`. **This already uses the recognized `app_slug` fallback key** — BUT the value is `"8seconds"`, not `"8s"` (the actual repo/federation slug). Hub routing tables key on federation slugs (`8s`), so `app_slug="8seconds"` would fail to match `stripe_account_routing`/`stripe_checkout_routing` rows keyed on `8s`.
- **PR shipped:** ✅ Yes — added `"metadata[satellite_app]": "8s"` (matching the canonical federation slug) alongside the existing `app_slug: "8seconds"` key, in both Customer and Checkout Session calls (and the subscription_data mirror). Did not touch `app_slug` — leaving it as an internal legacy value in case other 8s code depends on it.

---

## Summary

| Satellite | Stripe integration? | Metadata before | PR shipped? |
|---|---|---|---|
| communicare | Yes | `user_id` only | ✅ |
| vigilia | Yes | none/tier data, no app id | ✅ |
| resurrectio | Yes | none | ✅ |
| sanctum | Yes | booking/kind, no app id | ✅ |
| culina | Yes | order/invoice ids, no app id | ✅ |
| directio | Yes | `directio_*` prefixed keys, no app id | ✅ |
| collegium | Yes | `app: "collegium"` (compatible but not hub key) | ✅ |
| rehearso | Yes | `source_app: "rehearso"` (not hub key) | ✅ |
| bitoku | Yes | `source_app: "bitoku"` (not hub key) | ✅ |
| hortus | Yes | `supabase_user_id` only | ✅ |
| transitus | Yes (raw fetch) | `user_id`/`tier` only | ✅ |
| refugium | Yes, but in `functions.archive/` (dead code) | none | ⚠️ Skipped — see anomalies |
| communis | Yes | `kind`/tenant ids, no app id in any of 4 fns | ✅ |
| propria | Yes | `userId`/`lookupKey`, guest checkouts had none | ✅ |
| fabrica | Yes | **no metadata at all** | ✅ |
| theschola | Yes (5 functions) | community/cohort/invoice ids, no app id | ✅ |
| thecros | Yes | none (shared template) | ✅ |
| via-publica | **No Stripe integration** | — | N/A |
| thegreatnave | Yes | `supabase_user_id` only | ✅ |
| cormundum | Yes (2 functions) | `supabase_user_id`/retreat ids, no app id | ✅ |
| custodia | Yes (2 files) | `cros_app`/`custodia_app` (compatible but not hub key) | ✅ |
| 8s | Yes | `app_slug: "8seconds"` (wrong slug value) | ✅ |

**Totals:**
- **21 / 22 satellites have live Stripe resource-creation code.**
- **1 satellite (via-publica) has no Stripe integration** — nothing to do.
- **1 satellite (refugium) has Stripe code only in an archived/dead directory** — skipped, flagged for manual follow-up rather than editing dead code.
- **20 satellites received PRs** adding `metadata.satellite_app` (see commit log below for shas once pushed).
- **0 satellites required removing/replacing existing metadata** — all existing keys were preserved per the constraint; `satellite_app` was always added alongside.

---

## Anomalies / manual follow-ups needed

1. **refugium — dead code, not edited.** Its only Stripe resource-creation code lives under `supabase/functions.archive/`, which by naming convention is retired/non-deployed. If refugium is actually supposed to have live Stripe checkout, someone needs to un-archive (move back to `supabase/functions/`) and re-deploy — at which point it should get the same `satellite_app` fix applied here. Recommend the hub team confirm whether refugium currently has *any* live Stripe surface before the cutover; if not, no routing table row is needed for it either.

2. **propria — canonical repo CONFIRMED 2026-07-27.** User confirmed `jeromydarling/propria-aac78f12` is the correct Lovable-bound repo. This audit's edit (commit `dacebb5`) is on the right repo. The other two propria repos (`propria` bare, `propria-1e798e8e`) are stale and should be archived/renamed to prevent future audit confusion.

3. **8s slug mismatch — fixed, not just flagged.** Code already set `metadata[app_slug] = "8seconds"`, but the federation/repo slug is `8s`. Left `app_slug` untouched (in case other code reads it) and added the correct `satellite_app: "8s"` alongside it in both Customer and Checkout Session calls. Hub routing will now match correctly via `satellite_app` regardless of the legacy `app_slug` value.

4. **communis "good" pattern doesn't match current code.** The reality-check doc's live-data sample showed `app_slug='communis'` on a recent checkout session, but none of the 4 checkout-creating functions in the current `main` branch of `communis-b47839b1` set `app_slug` (or any app id) anywhere. That sample was likely produced by an older code path, a manual test, or a function that has since been refactored. All 4 functions now correctly set `satellite_app: 'communis'` going forward.

5. **Several satellites use satellite-prefixed-but-non-standard keys that are NOT in the hub's recognized fallback chain** (`satellite_app` / `federation_app` per `stripe_hub_design_2026-07-26.md`): `collegium` (`app`), `rehearso`/`bitoku` (`source_app`), `custodia` (`cros_app`/`custodia_app`). These were all preserved as-is and `satellite_app` was added alongside — no functional risk, but worth noting the federation has at least 4 different ad-hoc naming conventions in addition to the new standard.

6. **GitHub code search API rate-limited.** `gh search code` returned HTTP 403 "API rate limit exceeded" almost immediately when run across 22 repos × 4 patterns. Pivoted to shallow-cloning all repos and grepping locally — this worked but means Phase 1 findings depend on local grep patterns (`stripe.checkout.sessions.create`, `stripe.customers.create`, `stripe.subscriptions.create`, `stripe.paymentIntents.create`, case-sensitive) plus manual follow-up inspection for the 7 repos that use raw REST/fetch instead of the Stripe SDK (communicare, culina, directio, sanctum, transitus, 8s use helper wrappers or `fetch()` directly rather than the SDK call shape — all were found via manual `grep -rli stripe` + file inspection, not the literal SDK pattern).

7. **No `stripe.subscriptions.create` (direct Subscription API, not via Checkout) or `customer.subscriptions.create` calls found in any satellite.** All subscription creation across the federation goes through `checkout.sessions.create` with `mode: 'subscription'`, which is covered by the Checkout Session metadata fix. No satellite creates Subscriptions or PaymentIntents-for-subscriptions via the raw Subscriptions API.

8. **Disk space.** Workspace was at ~78-81% during cloning (22 repos, 618MB shallow). All clones were removed after PRs shipped, per instructions — see cleanup confirmation below.

---

## Commit log

All commits pushed directly to `main` per standing instruction (pre-launch, no PR review needed). Commit message for all: `stripe: add metadata.satellite_app for hub-and-spoke routing`. Author: `CROS Gardener <gardener@thecros.app>`.

| Satellite | Repo | Commit SHA |
|---|---|---|
| communicare | jeromydarling/communicare | `4ea714a` |
| vigilia | jeromydarling/vigilia-ffa3c410 | `f36482e` |
| resurrectio | jeromydarling/resurrectio-3d07f98c | `635710d` |
| sanctum | jeromydarling/sanctum | `ebc7b3a` |
| culina | jeromydarling/culina | `9651029` |
| directio | jeromydarling/directio | `565cfe2` |
| collegium | jeromydarling/collegium-connect | `7d611ee` |
| rehearso | jeromydarling/rehearso | `57c982a` |
| bitoku | jeromydarling/bitoku-9fb5dffb | `1ac9bee` |
| hortus | jeromydarling/hortus-claude-s-garden | `21e6f06` |
| transitus | jeromydarling/transitus-be0eceba | `f2e70fa` |
| communis | jeromydarling/communis-b47839b1 | `c79c281` |
| propria | jeromydarling/propria-aac78f12 | `dacebb5` |
| fabrica | jeromydarling/fabrica-forge | `15a7b23` |
| theschola | jeromydarling/theschola | `a729f12` |
| thecros | jeromydarling/thecros | `b376d5f` (rebased onto a concurrent `stripe-hub` commit — see note below) |
| thegreatnave | jeromydarling/thegreatnave-49ebb963 | `c76dd3e` |
| cormundum | jeromydarling/cormundum | `a739946` |
| custodia | jeromydarling/custodia | `02dc7fb` |
| 8s | jeromydarling/8s | `351017a` |

**refugium** and **via-publica**: no commit — skipped (see per-satellite sections above).

**Note on thecros:** while this audit was in progress, a concurrent commit (`639f7e5`, "stripe-hub: accept metadata.app_slug alongside satellite_app for backward compat with communis") landed on `thecros/main` as part of the hub-build work. That commit confirms the hub-routing function already treats `app_slug` as an accepted fallback key (consistent with this audit's assumption). This audit's local commit was rebased cleanly onto that change before pushing — no content conflicts, both changes are complementary.
