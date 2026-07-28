# Deploying

Every `REPLACE_ME` in `wrangler.toml` corresponds to a resource below. Nothing
here has been created — the ids in the repo are placeholders, and the commands
run against a real Cloudflare account and a real database.

## 1. Postgres

Any Postgres that Hyperdrive can reach: Neon, RDS, Supabase-as-plain-Postgres,
self-hosted. Coram uses no Supabase-specific feature, so the choice is about
operations, not compatibility.

Apply the migration as a superuser or as the database owner — it creates roles
and `SECURITY DEFINER` functions:

```sh
psql "$DATABASE_URL" -f migrations/0001_foundation.sql
```

Then give the two roles passwords and login rights. **They must be different
users**, because separating them is what keeps a request handler from being
able to bypass RLS:

```sql
ALTER ROLE coram_app  WITH LOGIN PASSWORD '...';
ALTER ROLE coram_cron WITH LOGIN PASSWORD '...';   -- has BYPASSRLS
```

Confirm the boundary actually holds before going further. As `coram_app`, with
no request context set, every one of these must return zero rows:

```sql
SET ROLE coram_app;
SELECT count(*) FROM public.tenants;      -- 0
SELECT count(*) FROM public.memberships;  -- 0
SELECT count(*) FROM public.audit_log;    -- 0
SELECT count(*) FROM public.auth_tokens;  -- permission denied
```

A non-zero count means RLS is not being enforced — most likely because
`coram_app` ended up owning the tables. Stop and fix that; nothing downstream
is safe until this passes.

## 2. Hyperdrive

Two configs against the same database, one per role:

```sh
npx wrangler hyperdrive create coram-app \
  --connection-string="postgres://coram_app:...@host:5432/coram"

npx wrangler hyperdrive create coram-cron \
  --connection-string="postgres://coram_cron:...@host:5432/coram"
```

Paste the returned ids into the `[[hyperdrive]]` blocks.

## 3. KV, R2, Queues

```sh
npx wrangler kv namespace create KV_SESSIONS
npx wrangler kv namespace create KV_FLAGS
npx wrangler kv namespace create KV_RATE

npx wrangler r2 bucket create coram-files
npx wrangler r2 bucket create coram-exports

npx wrangler queues create coram-purge
npx wrangler queues create coram-purge-dlq
npx wrangler queues create coram-send
npx wrangler queues create coram-send-dlq
```

The dead-letter queue matters more than it looks. A message that lands there is
a burn that did not finish clearing R2 — a workspace the product has told
someone is gone, with objects still in a bucket. Alert on it.

## 4. Secrets

```sh
npx wrangler secret put AUTH_JWT_SECRET          # openssl rand -base64 48
npx wrangler secret put SUPPRESSION_PEPPER       # openssl rand -base64 48
npx wrangler secret put FEDERATION_STRIPE_SECRET
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put INFERENCE_KEY
```

Rotating `AUTH_JWT_SECRET` invalidates every session immediately. That is the
intended behaviour, and it is the fastest global sign-out available.

**`SUPPRESSION_PEPPER` is not rotatable.** It keys every hash in the opt-out
ledger (§5.4), and changing it orphans every existing suppression — meaning
people who unsubscribed would start receiving messages again. Set it once,
back it up somewhere the workspace can survive losing, and do not treat it as a
routine credential. It is deliberately absent from Postgres so a database
disclosure cannot be used to test whether a given address is suppressed.

## 5. Deploy

```sh
npm run build
npm run deploy
```

## Cron

Two triggers, both declared in `wrangler.toml`:

| UTC | Handler | Does |
|---|---|---|
| 03:00 | `runRetentionSweep` | Purges rows past the window each table declared (§3.4) |
| 04:00 | `checkCanaryAge` | Warns at 100 days, marks `/trust` overdue at 120 (§7) |

## Publishing a canary

Signing is a manual human act and nothing in this codebase does it. That is the
point — a canary's value rests entirely on a person being free to decline to
sign it, so an automated signature would be worth nothing.

Sign the text by hand, then publish:

```sh
npx wrangler kv key put --binding=KV_FLAGS "canary:document" --path ./canary.asc
npx wrangler kv key put --binding=KV_FLAGS "canary:last_signed_at" "2026-07-28"
```

It is served at `/canary.txt` as `text/plain`, and `/trust` reads the date. No
deploy is needed to publish one.

## Backups

§3.5 caps backup retention at 24 hours. A provider default of 7 or 30 days
quietly breaks the burn switch's promise — the rows would still exist in a
snapshot after a steward was told they were destroyed. Set this explicitly when
provisioning the database, and check it again after any provider migration.
