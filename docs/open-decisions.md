# Open decisions

Things the §9 build sequence surfaced that need a person, not a commit. Each
one is a place where I made a defensible call and moved on rather than block —
so the code runs, but the call is yours to confirm or overturn.

Ordered by what breaks if it goes unanswered.

---

## 1. Secret ballots are not cryptographically secret

**Where:** `migrations/0007_consilium.sql`, `docs/ballot-secrecy.md`

Consilium's secret ballot unlinks the voter from the vote across three tables,
shuffles token insertion, coarsens the timestamp to `cast_hour`, and purges
tokens after 90 days. That defeats casual inspection and most of what a
database dump would yield.

It does **not** defeat the person who issues the tokens at the moment they are
issued. Real unlinkability wants blind signatures, and I did not implement
them: WebCrypto exposes no raw RSA primitive, and hand-rolling blinding
underneath a secrecy claim would be worse than the honest weaker scheme.

**The decision:** whether to fund an audited blind-signature implementation
before any group runs a binding election — an officer election, a strike
authorisation, a contract ratification — on this. Until then
`docs/ballot-secrecy.md` states the limit plainly and the product should not be
sold on ballot secrecy.

## 2. Nothing can actually be delivered

**Where:** `src/worker/lib/sender.ts`, `src/worker/lib/rails.ts`

There is no email or SMS provider wired up. `canDeliver()` returns false and
every send path refuses loudly rather than silently succeeding — Consilium will
not open a secret ballot when delivery is unconfigured, because a ballot nobody
receives is worse than no ballot.

**The decision:** which providers. This is not purely a procurement question:
§3 makes it a data-minimization one, since the provider sees recipient
addresses and message bodies. A provider with a generous log-retention default
undoes work the schema does. Whoever picks also needs to set retention on the
provider side and record it at `/trust`.

## 3. The mutual aid fallback rail is undesigned

**Where:** `src/worker/lib/rails.ts`, §5.6

Thesaurus escrows mutual aid and bail funds and takes zero from them. The card
rail works through Stripe. The fallback rail — for recipients who have no bank
account, which is a substantial share of the people bail funds serve — is
sketched and not designed.

**The decision:** what it actually is. Lightning was the placeholder assumption
and it carries real problems: custody, on-ramp KYC, and volatility exposure on
money someone needs at a specific dollar amount to post bail. Cash-equivalent
alternatives exist and have different problems.

## 4. Federation grants do not widen RLS, on purpose

**Where:** `migrations/0010_federatio.sql`, §5.11

A coalition parent sees `chapter_rollup()` — counts, and nothing else. No
policy admits a parent to a chapter's rows. That is the strictest reading of
§5.11's subsidiarity language and it is the one I built.

**The decision:** whether that is too strict in practice. A union federation
that hits a legal duty to inspect a local's records has no path here short of
the local exporting and sending them. Widening it is a schema change with real
blast radius, so it should be a deliberate yes rather than a patch under
deadline.

## 5. The crisis-line numbers are US-only

**Where:** `src/worker/lib/scope.ts`

Ported from CROS and flagged in the file. A message matching the crisis
patterns gets the 988 lifeline instead of a model response. Outside the US that
number is wrong, and a wrong crisis number is worse than a generic "please
contact local emergency services", because it reads as authoritative.

**The decision:** whether Coram ships outside the US before this is fixed. If
yes, this needs a per-workspace locale and a maintained number table — which is
the kind of data that goes stale silently, so it also needs an owner.

---

## Already decided, recorded so they are not relitigated

- **Postgres via Hyperdrive, no Supabase platform.** RLS stays the security
  boundary; Coram issues its own JWTs. See the end of
  [salvage-inventory.md](salvage-inventory.md).
- **The bail and mutual aid waiver is permanent.** It lives in
  `coram.take_basis_points()`, not a settings row, so changing it takes a
  migration with a name on it.
- **The four `/trust` artifacts live in KV, not Postgres.** They belong to the
  platform rather than a workspace, and a table for them would be the first
  exception to both "every table carries `tenant_id`" and "every table
  registers a retention rule". Reasoning is at the top of
  `src/worker/lib/trust.ts`.
- **Custos excludes the steward from legal-hold review.** Role separation an
  owner can override is not role separation.
