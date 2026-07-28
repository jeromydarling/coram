# Hub Deployment Checklist for thecros

## What's already shipped
- ✅ GitHub commit `77d672a` on `main` — hub fns + migration + config.toml
- ✅ Migration file: `supabase/migrations/20260727115800_stripe_hub_routing.sql`
- ✅ Hub fns: `supabase/functions/stripe-hub-connect/`, `supabase/functions/stripe-hub-platform/`
- ✅ Shared: `supabase/functions/_shared/stripeHub/routing.ts` + `forward.ts`
- ✅ config.toml registered both with `verify_jwt = false`

## What YOU do in Lovable
1. Open thecros in Lovable (https://lovable.dev/projects/{thecros-project-id})
2. Trigger a sync/build — either:
   - Send a message like "sync from GitHub main" if Lovable's agent supports it
   - OR make any tiny edit and revert to force a build
   - OR use Lovable's manual sync button if visible in the UI
3. Watch build logs for:
   - Migration `20260727115800_stripe_hub_routing.sql` applied
   - Edge functions `stripe-hub-connect` and `stripe-hub-platform` deployed

## What I do after you confirm deploy
1. Verify fns respond (`curl` should return 400 missing_signature instead of 404)
2. Populate `stripe_account_routing` with skeleton rows for federation satellites
3. Create 2 test-mode Stripe webhook endpoints pointing to hub fns
4. Use `stripe trigger` to fire test events
5. Verify routing + HMAC + DLQ + idempotency

## Secrets thecros needs in Lovable
Once deployed, these secrets must be set in Lovable → thecros → Settings → Secrets:

**Required for stripe-hub-connect:**
- `STRIPE_HUB_CONNECT_WEBHOOK_SECRET` — generated after creating the Stripe test-mode Connect endpoint
- `STRIPE_SECRET_KEY` — already set (verify)
- `SUPABASE_URL` — auto
- `SUPABASE_SERVICE_ROLE_KEY` — auto

**Required for stripe-hub-platform:**
- `STRIPE_HUB_PLATFORM_WEBHOOK_SECRET` — generated after creating the Stripe test-mode platform endpoint
- Same environment vars as above

**Per-satellite federation forwarding secrets** (add one per satellite when we onboard them):
- `FEDERATION_STRIPE_SECRET_RESURRECTIO`
- `FEDERATION_STRIPE_SECRET_VIGILIA`
- ... etc.
- Each one is a 32-byte random hex string (openssl rand -hex 32)
- Same value must be set as `FEDERATION_STRIPE_SECRET` on the satellite's stripe-in fn

## Signal when ready
Tell me "hub deployed" and I'll take it from there.
