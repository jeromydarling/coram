# CROS Stripe Hub Migration — Claude Code Handoff

**Date:** 2026-07-27
**Handoff from:** Perplexity Computer (this session)
**To:** Claude Code (has broader Lovable/Supabase MCP access)
**Status:** Hub deployed live, secrets in Lovable, endpoints live. **Blocker: routing table not seeded + 14 satellite forwarding secrets not distributed.**

---

## TL;DR — What's Done, What's Left

### Done ✅
1. **Endpoint audit** — 32/32 slots hit hard cap; 10 stale Connect endpoints deleted (32→21).
2. **Metadata standardization** — 20/22 satellites received PRs adding `metadata.satellite_app = "<slug>"`. `via-publica` (no Stripe), `refugium` (archived Stripe code) skipped.
3. **thecros stripe-hub scaffolded and deployed live** — commits `77d672a → f0df847 → a242a63`. Two edge functions live: `stripe-hub-platform` (platform events) and `stripe-hub-connect` (Connect events).
4. **Database migrations applied** (Supabase project `zmeawjhxbgvtcfcfcygf`):
   - `20260727115800_stripe_hub_routing.sql` — creates `stripe_account_routing`, `stripe_checkout_routing`, `stripe_hub_events`, `stripe_hub_dlq`
   - `20260727215900_stripe_hub_target_url_override.sql` — adds `target_url_override` column for Cloudflare-hosted satellites
5. **2 Stripe live-mode webhook endpoints created** pointing at the hub:
   - `we_1TxwfrIuo9wd3dMdfVVb8CI1` → stripe-hub-platform (8 event types)
   - `we_1TxwfsIuo9wd3dMdEx5f4I10` → stripe-hub-connect (11 event types, Connect-scoped)
6. **Hub webhook secrets pasted into Lovable → thecros → Secrets** — both hubs now flip `500→400` (verifying signatures).
7. **Federation forwarding secrets pre-generated** for 14 satellites — see `secrets/federation_stripe_secrets.env`.

### Left to do ⏳ (this handoff)

**PRIMARY TASK (Claude Code):** Distribute 14 federation forwarding secrets across satellite Lovable projects, then seed the routing table.

Detail:
1. **Seed routing table** — run `sql/thecros_stripe_routing_seed.sql` via Supabase MCP on the thecros project (`zmeawjhxbgvtcfcfcygf`).
2. **Distribute FEDERATION_STRIPE_SECRET to 14 satellites** via Lovable MCP. See `prompts/claude_code_distribute_federation_secrets.md`.
3. **Add all 14 `FEDERATION_STRIPE_SECRET_<SLUG>` env vars to thecros itself** so it can HMAC-sign outgoing forwards.

### Downstream (post-Claude-Code)
- Fire test events → verify routing/HMAC/DLQ end-to-end
- Blue/green cutover: delete 14 per-app Stripe endpoints, letting all live traffic flow through the 2 hub endpoints
- Cloudflare-hosted satellites (`sanctum`, `culina`, `directio`, `communicare`, `8s`, `custodia`) stay on direct endpoints for now — they need satellite-side code changes to accept `X-CROS-Federation-Signature`

---

## Directory Layout

```
cros_claude_handoff_bundle/
  README.md                          # This file
  artifacts/                         # Design docs and audit results
    stripe_reality_check_2026-07-27.md         # Pre-launch live-state analysis
    stripe_hub_and_spoke_plan_2026-07-26.md    # Original plan
    stripe_hub_design_2026-07-26.md            # Full architecture
    stripe_32_endpoints_audit_2026-07-26.md    # What was in Stripe when we started
    satellite_metadata_audit.md                # All 20 PR commits + skip reasons
    hub_deployment_checklist.md                # Ordered deployment runbook
    federation_canonical_repos.md              # Which GitHub repo → which Lovable app
    propria_canonical_repo_question.md         # Resolved: propria-aac78f12 is canonical
    create_hub_test_endpoints.sh               # Already executed; reference only
  secrets/                           # 600-mode; treat as credentials
    federation_stripe_secrets.env              # 14 satellite forwarding secrets (pairs)
    hub_webhook_secrets.env                    # 2 whsec values (already in Lovable)
  sql/
    thecros_stripe_routing_seed.sql            # 20 rows (15 Supabase active, 5 Cloudflare inactive)
  prompts/
    claude_code_distribute_federation_secrets.md  # Main prompt for Claude Code
    claude_code_seed_routing_table.md             # Alternate: SQL execution
```

---

## Key Infrastructure Details

### Supabase (thecros project)
- **Project ref:** `zmeawjhxbgvtcfcfcygf`
- **URL:** `https://zmeawjhxbgvtcfcfcygf.supabase.co`
- **Hub URLs:**
  - `https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/stripe-hub-platform`
  - `https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/stripe-hub-connect`
- **Both return HTTP 400 `missing_signature`** on empty POST (verifying signatures live)

### GitHub
- **thecros repo:** `jeromydarling/thecros` (branch: `main`)
- **Latest commit:** `a242a63` — target_url_override support for Cloudflare satellites
- **Hub code lives in:** `supabase/functions/stripe-hub-platform/`, `supabase/functions/stripe-hub-connect/`, `supabase/functions/_shared/stripeHub/`

### Stripe (live mode)
- **Endpoints used:** 23/32 (9 free)
- **Restricted key scope:** Webhook Endpoints R/W (session-scoped, will not persist to Claude Code)
- **Claude Code should NOT need Stripe API access for this handoff** — the endpoints are already created.

### Hub routing conventions
Hub accepts these metadata keys in order (fallback chain from `routing.ts`):
1. `metadata.satellite_app`
2. `metadata.federation_app`
3. `metadata.app_slug`
4. `metadata.app`
5. `metadata.source_app`
6. `metadata.cros_app`

Value alias baked in: `8seconds → 8s`.

---

## Federation Secret Convention

Each satellite gets ONE env var named `FEDERATION_STRIPE_SECRET` in its Lovable project. This is the HMAC signing key.

thecros itself gets **14 env vars** named `FEDERATION_STRIPE_SECRET_<UPPER_SLUG>` — one per satellite. Same values as their satellite counterparts (they must match for HMAC verification).

Example:
```
# On the "resurrectio" Lovable project:
FEDERATION_STRIPE_SECRET=<64-char hex>

# On the "thecros" Lovable project:
FEDERATION_STRIPE_SECRET_RESURRECTIO=<same 64-char hex>
```

Both values come from `secrets/federation_stripe_secrets.env`.

---

## Cloudflare Satellites (deferred)

These 6 satellites are Cloudflare-hosted and **stay on direct Stripe endpoints** for now:

| Satellite | Domain | Direct endpoint URL |
|---|---|---|
| sanctum | sanctum.garden | https://sanctum.garden/api/stripe/webhooks |
| culina | culina.life | https://culina.life/api/stripe/webhooks |
| directio | godirectio.com | https://godirectio.com/api/stripe/webhook |
| communicare | communicare.farm | https://communicare.farm/api/billing/webhook |
| 8s | 8s.rodeo | https://8s.rodeo/api/billing/webhook |
| custodia | custodia.land | *not yet published* |

Their routing rows are seeded with `active=false`. Migrating them requires satellite-side code to accept our `X-CROS-Federation-Signature` header (currently they accept Stripe's native `stripe-signature`).

---

## After Claude Code Completes This Handoff

1. **Verify seed** — SELECT from `stripe_account_routing`; should see 20 rows (15 active, 5 inactive).
2. **Verify satellite secrets** — each satellite Lovable project should have `FEDERATION_STRIPE_SECRET`.
3. **Verify thecros has 14 forwarding secrets** — `FEDERATION_STRIPE_SECRET_RESURRECTIO` through `FEDERATION_STRIPE_SECRET_CORMUNDUM`.
4. **Fire a test event** — from Stripe CLI or dashboard, trigger `checkout.session.completed` with metadata `{"satellite_app": "communis"}` and watch delivery attempts + `stripe_hub_events` table.
5. **Blue/green cutover** — delete the 14 per-app Stripe webhook endpoints for Supabase-hosted satellites, freeing up ~14 slots.

---

## Troubleshooting

**Hub returns 500 `server_misconfigured` after Claude sets secrets:** The two `STRIPE_HUB_*_WEBHOOK_SECRET` env vars might have been overwritten. Re-check `secrets/hub_webhook_secrets.env` for correct values.

**Forwarding fails with `missing_env:FEDERATION_STRIPE_SECRET_<X>`:** That satellite's forwarding secret didn't make it into thecros's env. Re-paste from `secrets/federation_stripe_secrets.env`.

**Satellite rejects hub forward with HMAC mismatch:** The satellite's `FEDERATION_STRIPE_SECRET` value doesn't match thecros's `FEDERATION_STRIPE_SECRET_<SLUG>`. Values must be identical.

**Event lands in `stripe_hub_dlq`:** Check `failure_reason` column. Common causes: no routing row matches, no metadata hint found, target satellite endpoint returned non-2xx.
