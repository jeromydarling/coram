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
npx wrangler r2 bucket create coram-media

npx wrangler queues create coram-purge
npx wrangler queues create coram-purge-dlq
npx wrangler queues create coram-send
npx wrangler queues create coram-send-dlq
```

The dead-letter queue matters more than it looks. A message that lands there is
a burn that did not finish clearing R2 — a workspace the product has told
someone is gone, with objects still in a bucket. Alert on it.

`coram-media` is separate from `coram-files` deliberately: it serves bytes to
unauthenticated visitors, and a bucket that does that must never also hold a
workspace's uploads. It is the only bucket the burn switch does not touch,
because nothing in it belongs to a tenant.

## 3a. Marketing photography (§8.2)

The site renders without this — `<Picture>` falls back to a tone block in the
palette — so it is not a launch blocker. When you want the photographs:

```sh
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...        # needs Workers AI: Read

npm run imagery:generate               # FLUX.2 [dev] on Workers AI
# look at media/original/*.png before going further
npm run imagery:upload -- --remote
```

Generation is build-time, not per-request: nine photographs do not change
between deploys, and putting an inference queue on the critical path of a page
with a 1.5s LCP target would be a bad trade.

Generation never touches the committed manifest. It writes `media/manifest.json`,
and `imagery:upload` promotes that to `src/shared/imagery-manifest.json` only
after every object has landed in R2. That ordering is deliberate: the committed
manifest is what makes `<Picture>` emit a real `<img>` instead of its fallback
tone block, so a manifest whose objects are not in the bucket produces broken
images — worse than the placeholder it replaced. Commit the promoted manifest
to ship the photographs.

**Look at `media/original/` before uploading.** `assertOnDirection()` validates
the prompts we send and cannot see what comes back, and the first run proved
that gap is real: it produced a sign-in sheet headed "Kodak Portra 400", a
Kodak product box sitting on a table, and — the one that matters — a phone bank
with two fully recognizable faces, from a prompt that passed every check. §8.2
calls the face rule "a rule, not a preference", and only a person looking at
the output can enforce it.

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

## Publishing the §7 artifacts

`/trust` lists four things — the annual security audit, the semiannual
transparency report, the quarterly warrant canary, and the export/self-host
docs. Each shows a live date and **flags itself as overdue automatically** once
it passes its cadence. There is no way to suppress that from the application,
which is the point: §7 argues a stale artifact is worse than no artifact.

All four are recorded in `KV_FLAGS` under `trust:<kind>`, so publishing one
needs no deploy:

```sh
npx wrangler kv key put --binding=KV_FLAGS "trust:security_audit" \
  '{"publishedAt":"2026-07-28","url":"https://coram.app/audits/2026.pdf"}'
```

`kind` is one of `security_audit`, `transparency_report`, `canary`,
`export_docs`. A URL is required — `publish()` refuses a record without one,
because "audited" linking to nothing is the exact failure §7 is written
against.

### The canary specifically

Signing is a manual human act and nothing in this codebase does it. That is the
point — a canary's value rests entirely on a person being free to decline to
sign it, so an automated signature would be worth nothing.

Sign the text by hand, then publish both the document and the date:

```sh
npx wrangler kv key put --binding=KV_FLAGS "canary:document" --path ./canary.asc
npx wrangler kv key put --binding=KV_FLAGS "canary:pubkey"   --path ./coram-pgp.asc
npx wrangler kv key put --binding=KV_FLAGS "trust:canary" \
  '{"publishedAt":"2026-07-28","url":"/canary.txt"}'
```

The document is served at `/canary.txt` as `text/plain` and the key at
`/.well-known/coram-pgp.asc`; both 404 until published. The date drives both
the `/trust` card and the nightly `checkCanaryAge` warning — they read the same
record on purpose, so the alert and the public page cannot disagree.

## Backups

§3.5 caps backup retention at 24 hours. A provider default of 7 or 30 days
quietly breaks the burn switch's promise — the rows would still exist in a
snapshot after a steward was told they were destroyed. Set this explicitly when
provisioning the database, and check it again after any provider migration.
