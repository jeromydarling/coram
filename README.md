# Coram

The operating system for grassroots organizing.

One repo, one Cloudflare Worker, one deploy. The marketing site, the API, and
the product ship together on the same origin. See `CLAUDE.md` for the spec that
governs this codebase — it is authoritative, and where this README disagrees
with it, this README is wrong.

Private repository. Trust is earned through published third-party audits.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Cloudflare Workers, one Worker |
| Router / API | Hono |
| Frontend | React 19 + Vite, SPA under `/app` |
| Marketing | Same Worker, server-rendered via Hono JSX |
| Database | Postgres behind Cloudflare Hyperdrive, RLS-enforced |
| Edge state | Workers KV — sessions, rate limits, flags |
| Object storage | R2 |
| Async jobs | Cloudflare Queues |
| Scheduled | Cron Triggers |
| Validation | Zod, shared between client and Worker |

## Layout

```
migrations/            forward-only SQL. The RLS policies here are the
                       security boundary — not the TypeScript.
src/worker/            the Worker: routes, cron, queue consumers, lib
src/app/               the React SPA served under /app
src/shared/            Zod schemas and types imported by both sides
scripts/               CI gates
```

## Running it

```sh
npm install
npm run dev              # Vite and the Worker, together
npm test
npm run typecheck
npm run check:retention
```

Deploying needs real Cloudflare resources and a Postgres instance. See
[docs/deploy.md](docs/deploy.md).

## Three things to know before changing anything

**Access control is in Postgres, not in TypeScript.** Every table is
default-deny RLS. The Worker connects as `coram_app`, which is not the table
owner and has no `BYPASSRLS`. A handler that forgets a `WHERE tenant_id = ...`
returns zero rows rather than someone else's. Application-layer checks exist to
produce good error messages, never to make the decision — a change that
enforces access only in TypeScript is wrong, however well it reads.

**Every table declares how long it keeps data, next to its definition.**
`src/worker/lib/retention.ts` is the registry, and `npm run check:retention`
fails CI if a migration creates a table that has not registered, or if a rule
names a column the table does not have. This is not a lint rule to be relaxed
under deadline — it backs a promise made publicly at `/trust`.

**The burn switch is real.** A steward can destroy a workspace irreversibly in
under a minute: rows, R2 objects, and Durable Object state. No soft-delete, no
undo. Any module that stores something outside Postgres must register its
cleanup with the burn path, or it will leave data behind after a workspace is
supposed to be gone.

## Status

Section 9 build sequence, step 6 of 8 complete:

- [x] Worker entry, Hono routing, one deploy
- [x] Tenancy, the five roles, default-deny RLS
- [x] Sessions and auth — signup, login, reset, revocation
- [x] Audit log — access, never content
- [x] `retention.ts`, nightly purge cron, CI gate
- [x] Burn switch
- [x] Membra, and the import/export pipeline
- [x] Convocare — events, shifts, RSVP, check-in
- [x] Nuntius — outreach and the opt-out ledger
- [x] Thesaurus — funds, dues, escrowed mutual aid and bail
- [x] Vinculum — 1:1s, ladders, follow-up queue, relationship graph
- [x] Consilium — proposals, quorum, five voting methods, secret ballots
- [x] Colloquium + Custos — sealed channels, jail support, panic wipe
- [ ] Scriba + Federatio
- [ ] Marketing routes, `/trust`, canary infrastructure
