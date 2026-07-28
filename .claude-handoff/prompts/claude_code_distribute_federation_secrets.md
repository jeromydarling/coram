# Claude Code Task: Distribute Federation Stripe Secrets

## Context

The Perplexity Computer session that preceded you built and deployed a Stripe hub-and-spoke on the `thecros` Supabase project. Read `README.md` at the root of this bundle for full context.

You have broader Lovable/Supabase MCP access. Your job is to distribute 14 federation forwarding secrets across satellite Lovable projects, then seed the hub's routing table.

## Task 1 — Distribute 14 satellite forwarding secrets

**Input:** `secrets/federation_stripe_secrets.env` — contains 14 satellite entries, each with a satellite name, Supabase project ID, and a `FEDERATION_STRIPE_SECRET=<64-char hex>` value.

**For each satellite:**
1. Locate the satellite's Lovable project by name (see mapping table below).
2. Set the env var `FEDERATION_STRIPE_SECRET` to the value from the file.
3. Do NOT create any other new env vars.
4. Redeploy the Lovable project so the secret takes effect.

**Satellite → Lovable project mapping:**

| Satellite slug | Lovable project name | Supabase project ID |
|---|---|---|
| resurrectio | resurrectio | lzincahqppvdeyzxqsqw |
| vigilia | vigilia | ephuuewoqemcnqjojoip |
| rehearso | rehearso | tidoerbzdomhtfyuovji |
| theschola | theschola | kpcannnhenymymnhpwib |
| collegium | collegium | divzdyxtjhkbftsnffnu |
| bitoku | bitoku | oumbwqgibozyddwntstc |
| communis | communis | ebsjikndtrtlvryphkgk |
| fabrica | fabrica | wqnplepwcbbmtvajxnqx |
| hortus | hortus | piaoyalquwfusbiedouq |
| propria | propria-aac78f12 (the CANONICAL propria repo; ignore `propria` and `propria-1e798e8e` which are stale) | svmobotemmnsorkvlprb |
| transitus | transitus | jksfuzmyxgyjsrypxuxp |
| thegreatnave | thegreatnave | betonqvgbnuqjeyutzqh |
| cormundum | cormundum | lycubwceblanwyxfcojm |
| thecros | thecros | zmeawjhxbgvtcfcfcygf |

Note: `thecros` gets ALL 14 forwarding secrets (see Task 2), not `FEDERATION_STRIPE_SECRET`.

## Task 2 — Add 14 forwarding secrets to thecros

The thecros hub needs to know which secret to use when signing outbound forwards to each satellite. It needs env vars named `FEDERATION_STRIPE_SECRET_<UPPER_SLUG>`.

**On the `thecros` Lovable project (Supabase: `zmeawjhxbgvtcfcfcygf`)**, set:

```
FEDERATION_STRIPE_SECRET_RESURRECTIO=<value from secrets file>
FEDERATION_STRIPE_SECRET_VIGILIA=<...>
FEDERATION_STRIPE_SECRET_REHEARSO=<...>
FEDERATION_STRIPE_SECRET_THESCHOLA=<...>
FEDERATION_STRIPE_SECRET_COLLEGIUM=<...>
FEDERATION_STRIPE_SECRET_BITOKU=<...>
FEDERATION_STRIPE_SECRET_COMMUNIS=<...>
FEDERATION_STRIPE_SECRET_FABRICA=<...>
FEDERATION_STRIPE_SECRET_HORTUS=<...>
FEDERATION_STRIPE_SECRET_PROPRIA=<...>
FEDERATION_STRIPE_SECRET_TRANSITUS=<...>
FEDERATION_STRIPE_SECRET_THEGREATNAVE=<...>
FEDERATION_STRIPE_SECRET_CORMUNDUM=<...>
FEDERATION_STRIPE_SECRET_THECROS=<...>
```

**Values come from `secrets/federation_stripe_secrets.env`** — each satellite section shows the same hex value for both the satellite's `FEDERATION_STRIPE_SECRET` and thecros's `FEDERATION_STRIPE_SECRET_<UPPER>`. Values MUST match exactly for HMAC verification to succeed.

Redeploy thecros after all 14 are set.

## Task 3 — Seed the routing table

Run `sql/thecros_stripe_routing_seed.sql` via Supabase MCP on the `zmeawjhxbgvtcfcfcygf` project.

**Expected result:** 20 rows inserted into `public.stripe_account_routing`:
- 15 Supabase-hosted satellites with `active=true`
- 5 Cloudflare-hosted satellites with `active=false` (informational only)

The SQL is idempotent (`on conflict (connected_account_id) do update`) — safe to re-run.

**Verify with:**
```sql
select connected_account_id, satellite_app, active, target_url_override, notes
from public.stripe_account_routing
order by satellite_app;
```

## Task 4 — Verify end-to-end (optional but recommended)

After all secrets and routing rows are in place:

1. **Hit both hub URLs** — should return `400 missing_signature`:
   ```bash
   curl -X POST https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/stripe-hub-platform
   curl -X POST https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/stripe-hub-connect
   ```

2. **Trigger a synthetic event** from Stripe CLI (if the user has a live-mode CLI session):
   ```bash
   stripe trigger checkout.session.completed --add "metadata[satellite_app]=communis"
   ```

3. **Check the hub events table:**
   ```sql
   select * from public.stripe_hub_events order by created_at desc limit 5;
   select * from public.stripe_hub_dlq order by created_at desc limit 5;
   ```

Success looks like: an event in `stripe_hub_events` with `routed_satellite='communis'` and `forward_status_code=2xx`, and nothing in DLQ.

## What NOT to do

- **Do not create new Stripe webhook endpoints.** The 2 hub endpoints are already in place. Adding more Stripe endpoints will burn slots (23/32 currently used).
- **Do not touch the Cloudflare satellites** (sanctum, culina, directio, communicare, 8s, custodia). They stay on direct endpoints; they need code changes before hub migration.
- **Do not change hub-side code.** Latest commit `a242a63` on `jeromydarling/thecros` is deployed and working.
- **Do not delete the 14 per-app satellite webhook endpoints yet.** That's a downstream cutover step after end-to-end validation.

## When you're done

Report back with:
1. Confirmation of 14 satellite Lovable env vars set
2. Confirmation of 14 forwarding secrets on thecros
3. Row count from `select count(*) from public.stripe_account_routing;` (should be 20)
4. Any satellite where the Lovable project doesn't exist under the mapped name (flag for follow-up)
