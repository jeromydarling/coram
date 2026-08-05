# SOC 2 Type II readiness — gap analysis

**Date:** 2026-08-04 · **Scope:** the Coram Worker, its data stores, and the
repository and CI around them · **Assessed by:** internal, automated + manual

> This is a readiness assessment, not an audit. A SOC 2 attestation can only be
> issued by a licensed CPA firm after an observation period. Nothing here is an
> opinion on control effectiveness over time; it is a gap list.

---

## How Phase 1 was adapted

The audit procedure assumes SSH access to servers running Docker, UFW, auditd
and AIDE. Coram has none of those. It is one Cloudflare Worker, Neon Postgres
behind Hyperdrive, R2, KV and Durable Objects — there is no host to harden, no
container to inspect, no firewall to read.

Running those commands anyway would have scanned the ephemeral development
container this assessment was produced in, which has no relationship to
production. Reporting its `ss -tlnp` output as a Coram finding would have been
worse than reporting nothing, so Phase 1 was replaced with the serverless
equivalents: binding inventory, secret handling, database roles and policies,
unauthenticated surface, and platform backup configuration.

Six of the ten "hard-won lessons" are host or container specific and do not
apply. Lesson 9 — *Cloudflare Workers secrets are not in `wrangler.toml`* —
does, and was checked.

---

## Summary

| | At assessment | After the first remediation pass |
|---|---|---|
| Controls assessed | 13 | 13 |
| PASS | 1 | 2 |
| PARTIAL | 6 | 6 |
| FAIL | 6 | 5 |

The remediation pass closed what could be closed from inside the repository:
every production dependency advisory, a strict CSP with HSTS and a
`Permissions-Policy`, CODEOWNERS, a pull request template, Dependabot, and an
audit gate in CI. CC6.7 moves to PASS and CC6.3 from FAIL to PARTIAL. What did
not move needs either a click in somebody's console — repository visibility,
branch protection, MFA, credential rotation — or a document with a person's name
on it.

The product's **technical** data-protection controls are unusually strong for a
pre-audit codebase: forced row-level security on all 78 tables, an append-only
audit log, a retention registry with a CI gate, and role boundaries enforced in
the database rather than the application.

The gaps are almost entirely **organisational** — no incident response plan, no
risk register, no access review, no change approval — plus two technical
findings that outrank everything else: two live administrative credentials that
have been exposed and not rotated, and a 6-hour recovery window on the database
that holds bail and mutual-aid ledgers.

One finding sits outside the Trust Services Criteria and is listed first anyway,
because it is a false public statement rather than a missing control.

---

## F0 — The repository is public while the site says it is not

**Severity: critical (truthfulness, not confidentiality)**

The GitHub repository is publicly readable. Verified anonymously, with no
credentials:

```
GET /repos/jeromydarling/coram          → visibility: public
GET raw .../main/src/worker/index.ts    → HTTP 200
GET raw .../claude/…-arpoc7/wrangler.toml → HTTP 200
```

The deployed marketing site states, in the footer of every page:

> Coram is closed source. We publish audits instead of code.

Both cannot be true. This is the one finding here that actively misleads a
reader, on a site whose entire argument is that its claims can be checked.

No secrets have ever been committed — history is clean for Cloudflare tokens,
Neon keys, connection strings with passwords, AWS keys and private key blocks.
What is exposed is source, plus the resource identifiers in `wrangler.toml`
(KV namespace IDs, Hyperdrive IDs, R2 bucket names). Those are identifiers
rather than credentials, but they are reconnaissance material.

**Resolve by choosing one, today:** make the repository private, or change the
copy. CLAUDE.md's standing rule says closed source, so the former is the
likely intent — but that is a decision for the owner, not for this document.

Flipping it was attempted and refused at the network layer, not the token layer:

```
PATCH /repos/jeromydarling/coram  {"private": true}
→ Repository settings writes are not permitted through this proxy.
```

So this needs a human at **Settings → General → Danger Zone → Change repository
visibility**. Note that making a repository private does not un-publish what has
already been read: assume the source and the `wrangler.toml` identifiers are
public, and treat the identifiers accordingly.

---

## F1 — Two live administrative credentials, exposed and un-rotated

**Severity: critical · CC6.1, CC6.2**

A Cloudflare API token and a Neon API key were pasted in plaintext into a chat
transcript. Both are still valid — both were used successfully during this
session, so this is observed rather than inferred.

| Credential | What it can do |
|---|---|
| Cloudflare API token | Deploy the Worker, read and write every R2 bucket, read KV |
| Neon API key | Read and modify the production database, including every tenant's rows |

Between them they are total compromise of the platform: the Cloudflare token can
ship arbitrary code to the production Worker, and the Neon key reaches the data
directly, underneath every row-level security policy the application relies on.

**Remediate now, in this order:** rotate the Neon key, rotate the Cloudflare
token, then review both audit logs for use that was not yours.

---

## F2 — An unmanaged second Neon project

**Severity: low · CC6.1**

The Neon organisation holds two projects. Only one is wired to anything:

| Project | Region | Roles | Used by |
|---|---|---|---|
| `red-salad-55836736` "coram" | `aws-us-west-2`, pg17 | `coram_app`, `coram_cron`, `coram_refdata` | both Hyperdrive configs point here |
| `small-block-82864417` "Coram" | `aws-us-east-2`, pg18 | `neondb_owner` only | nothing |

The second was created the same day and never provisioned — it has only the
default owner role, none of the separated roles the schema requires, and a
logical size that is about what an empty Neon branch weighs. So it is not
holding organizer data. It is still a Postgres instance with a live owner
credential that nobody is watching, in an account that has no asset register,
which is the shape of thing an auditor asks about and nobody can answer.

**Resolve:** confirm it is empty and delete it, or write down what it is for.
Not done here — deleting a database is not a call to make on somebody's behalf.

---

## Control mapping

| Control | Rating | Evidence |
|---|---|---|
| **CC6.1** Logical access | PARTIAL | 17 of 18 API modules call `requireWorkspace`; `auth` is correctly open. `guards.test.ts` asserts unauthenticated access is refused. Passwords stored as PBKDF2 verifiers; `timingSafeEqual` used for comparison. **But F1**, and MFA on the Cloudflare, Neon and GitHub accounts could not be verified from here. |
| **CC6.2** Access provisioning | FAIL | The product has a role model. The company has no access register, no joiner/leaver process, no periodic review. |
| **CC6.3** Access authorization | ~~FAIL~~ → PARTIAL | CODEOWNERS and a pull request template now exist, and CODEOWNERS enumerates the paths where a careless change is unrecoverable rather than collapsing to `*`. **But** CODEOWNERS is advisory until a branch protection rule requires a code-owner review, and that rule lives in repository settings — it could not be set or even read from here (`/branches/main/protection` → HTTP 403; the token lacks the scope), so it is unverified rather than absent. |
| **CC6.6** Threat protection | PARTIAL | Sixteen advisories at assessment, one critical. **Production dependencies are now clean** (`npm audit --omit=dev` → 0), CI fails on any production advisory at any severity, and Dependabot runs weekly. Two devDependency advisories remain with no upstream fix, documented and printed by CI without failing it. Platform patching is Cloudflare's. |
| **CC6.7** Data transmission | ~~PARTIAL~~ → PASS | TLS by platform. Every response now carries `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, **HSTS** (two years, `includeSubDomains`, `preload`, withheld over plain http), a **`Content-Security-Policy`** that is `default-src 'none'` with `script-src 'self'` and no `'unsafe-inline'`, and a **`Permissions-Policy`** with an empty allowlist on every powerful feature. Verified against Chromium, not just asserted. Encryption at rest is Neon and R2 defaults. No data classification document — though the retention registry's `pii` field (`none`/`public_record`/`pseudonym`/`contact`/`protected`) is a working one, per table, enforced by CI. |
| **CC6.8** Unauthorized software | PARTIAL | No containers or hosts, so image scanning and file-integrity monitoring do not apply. `wrangler deploy` is the only path to production. No dependency scanning, no artifact signing. |
| **CC7.1** Monitoring | FAIL | `[observability] enabled = true` gives Workers' built-in logs. No uptime monitoring, no alerting, no dashboards, no on-call. Nobody is told when the Worker starts failing. |
| **CC7.2** Anomaly detection | PARTIAL | A real application audit log: actor, role, action, record type, count — RLS-protected and **append-only by policy** (INSERT and SELECT policies exist; no UPDATE or DELETE policy, so both are denied). Bulk reads, exports and sheet prints are recorded. But no SIEM, no log export, and the log lives in the same database an administrator can reach. |
| **CC7.3** Security event evaluation | FAIL | No triage procedure, no severity classification. |
| **CC7.4** Incident response | FAIL | No IR plan, no roles, no communication templates, no tabletop. Note the product ships a burn switch and a warrant canary — mechanisms without a procedure around them. |
| **CC8.1** Change management | PARTIAL | CI gates on every push: `check:retention`, `typecheck`, `lint`, `test` (794 tests), and now two dependency audits. Migrations are reviewed SQL in the tree. A pull request template asks what was actually driven rather than whether tests pass, and carries the data, promises and secrets checks. **But** still no *required* review, no deployment approval, no change log, and production deploys are run by hand with no record of who shipped what. |
| **CC9.1** Risk mitigation | FAIL | No risk register. |
| **A1.2** Recovery planning | FAIL | **Neon point-in-time recovery is 6 hours** (`history_retention_seconds: 21600`), and raising it was attempted and refused: 6 hours is the free plan's ceiling, so this is a plan decision rather than an unset slider. Effective RPO is 6 hours; anything older is unrecoverable. No documented RTO, no DR plan, no restore test has been performed. This database holds escrowed bail and mutual-aid ledgers. |

### The four dependency advisories, individually — now patched

Listing CVEs without checking reachability produces noise. Each was traced, and
then each was patched anyway, because an unreachable vulnerability becomes
reachable the day somebody adds `hono/cors`.

| Package | Advisory | Was it reachable? | Now |
|---|---|---|---|
| `drizzle-orm` | SQL injection via improperly escaped identifiers | **No.** Used only to *declare* table shapes in `lib/schema/*` (`pg-core` column builders and `sql` for defaults). No drizzle query builder is called anywhere; every query goes through `postgres.js` tagged templates. The vulnerable path is query construction. | 0.45.2 |
| `hono` | ReDoS in CORS middleware | **No.** `hono/cors` is never imported. The app is same-origin by construction. | 4.13.0, clean |
| `react-router` / `react-router-dom` | RSC-mode CSRF bypass | **No.** The SPA uses `BrowserRouter`; RSC mode is not enabled. | 8.3.0 |

`react-router` needed a package migration rather than a bump: the advisory range
runs to 8.2.0 and the last `react-router-dom` ever published is 7.18.2, because
v8 folded that package into `react-router` itself. npm's suggested alternative
was a downgrade to 7.11.0, which is not a fix — it is standing just outside the
range until the range moves.

`npm audit --omit=dev` now reports zero, and CI fails on any production advisory
at any severity.

### The two that stay, deliberately

Both are devDependencies, neither reaches the Worker bundle, and neither has a
version to move to — npm's only suggested fix for each is a downgrade.

| Package | Advisory | Why it stays |
|---|---|---|
| `esbuild` ≤0.24.2, via `drizzle-kit` | esbuild's dev server answers cross-origin requests | `drizzle-kit`'s newest release still depends on it. The suggested fix is `drizzle-kit` 0.18.1 — thirteen minors backwards. It runs on a developer's machine to generate migrations. |
| `undici` 7.x, via `miniflare` ← `wrangler` | five, including request smuggling and cache-directive disclosure | The current `wrangler` still pulls it. The suggested fix downgrades `@cloudflare/vite-plugin`. Local dev only. |

CI prints both without failing, so the day one becomes fixable is a day somebody
sees it. Re-check when `wrangler` or `drizzle-kit` next publishes.

---

## Remediation checklist

### Progress

| Tier | Total | Done | Remaining |
|------|-------|------|-----------|
| T0 | 5 | 0 | 5 |
| T1 | 8 | 3 | 5 |
| T2 | 6 | 0 | 6 |
| T3 | 4 | 0 | 4 |

Everything still open in T0 needs either a click in a console or a credential
rotation, and neither is something this document can do for you. Of the three
T1 items closed, all three were code.

### T0 — before any audit engagement

- [ ] **Rotate the Neon API key** — CC6.1. Neon console → Account settings →
      API keys → revoke, create, update `REFDATA_PGURI` and any GitHub secret.
      *Evidence: revocation timestamp in the Neon audit log.*
- [ ] **Rotate the Cloudflare API token** — CC6.1. Dashboard → My Profile →
      API Tokens → roll. Re-set anything using it.
      *Evidence: token list showing the old token absent, new creation date.*
- [ ] **Resolve the public repository against the published claim** — F0.
      Either set the repo private, or change the footer copy on every page.
      Attempted; the API proxy refuses repository settings writes, so this is
      **Settings → General → Danger Zone → Change repository visibility**.
      *Evidence: screenshot of repo settings, or the deployed diff.*
- [ ] **Raise Neon PITR from 6 hours to at least 7 days** — A1.2. **Attempted
      and refused: 6 hours is the maximum the free plan allows.** The API
      returns `requested history retention seconds exceeds allowed maximum;
      requested:604800, max:21600`. So this is not a setting somebody forgot to
      change — it is a plan decision, and it means the effective RPO for the
      escrowed bail and mutual-aid ledgers is six hours until the plan changes.
      *Evidence: the API refusal above; then, after upgrading, the new value.*
- [ ] **Enable MFA on Cloudflare, Neon and GitHub** — CC6.1. Neon reports
      `require_mfa: false` on the organisation, which is a setting rather than
      an inference. Cloudflare and GitHub could not be read from here.
      *Evidence: screenshot of each account's security page.*

### T1 — within two weeks

- [ ] **Write the four policies** — CC7.4, A1.2, CC6.2, CC8.1. Incident
      response (P0–P3 with SLAs, IC/TL/CL roles, 72-hour breach notification),
      disaster recovery (RTO/RPO per store, restore procedure), access
      management (least privilege, MFA, quarterly review, joiner/leaver), change
      management (PR required, CI gates, emergency path with retro).
      *Evidence: the documents, dated and version-controlled.*
- [x] **Add CODEOWNERS** — CC6.3. `.github/CODEOWNERS` enumerates the paths
      where a careless change is not recoverable: migrations, the four files
      that are every tenancy boundary, the retention registry and its sweep, and
      the pages carrying the public promises.
      *Evidence: the file. It is advisory until the rule below is on.*
- [ ] **Require code-owner review on `main`** — CC6.3. Repository settings; not
      settable from here.
      *Evidence: branch protection screenshot showing required approvals.*
- [ ] **Confirm branch protection is on** — CC6.3. Unverifiable here (403).
      *Evidence: `GET /repos/:owner/:repo/branches/main/protection` returning 200.*
- [x] **Patch the dependency advisories** — CC6.6. Sixteen were outstanding, one
      critical. Nine are gone; the two that remain are devDependencies with no
      version to move to, documented above. CI now fails on any production
      advisory at any severity and prints the toolchain's without failing.
      *Evidence: `npm audit --omit=dev` reports zero; the gate is in `ci.yml`.*
- [x] **Add Dependabot** — CC6.6. `.github/dependabot.yml`, weekly, grouped into
      runtime and tooling with majors ignored — ungrouped it opens a dozen
      trivial PRs a week, and the rational response to that is to stop reading
      them, which buries the security ones with the rest.
      *Evidence: the file, and the first opened PR.*
- [x] **Add HSTS and a Content-Security-Policy** — CC6.7. Both, plus a
      `Permissions-Policy` denying every powerful feature, in
      `src/worker/lib/headers.ts`. The policy is `default-src 'none'` with a
      line per directive actually used; `script-src` is exactly `'self'`, which
      §10 makes possible and `headers.test.ts` pins. Verified against Chromium
      on a local `wrangler dev`: no violation on marketing, `/trust` or four app
      routes, and an injected inline `<script>` is refused while the flyer
      rasteriser's blob → `<img>` → canvas path still works.
      *Evidence: `headers.test.ts` (14 assertions); response headers.*
- [ ] **Uptime monitoring with an alert that reaches a person** — CC7.1.
      *Evidence: monitor configuration and one test alert delivered.*

### T2 — within thirty days

- [ ] **Perform and document a restore test** — A1.2. Restore Neon to a branch,
      verify row counts and that RLS policies survive.
      *Evidence: dated restore log with before/after counts.*
- [ ] **Export audit logs out of the primary database** — CC7.2. Today the log
      an investigator needs is in the database an attacker would reach first.
      *Evidence: destination configuration and a sample export.*
- [ ] **Record deploys** — CC8.1. Deploys are manual with no record of who
      shipped what. Move to a GitHub Actions deploy on merge, or log the actor.
      *Evidence: a deploy history with actor and commit.*
- [ ] **Publish the data classification already implicit in the retention
      registry** — CC6.7. The `pii` field is a classification scheme; write it
      down as one.
      *Evidence: the document, cross-referenced to `lib/retention.ts`.*
- [ ] **Access register and first quarterly review** — CC6.2.
      *Evidence: the register, and dated review notes.*
- [ ] **Security event triage procedure** — CC7.3.
      *Evidence: the runbook.*

### T3 — within ninety days

- [ ] **Risk register** — CC9.1. Score = likelihood (1–5) × impact (1–5); ≥15
      requires active mitigation; quarterly review.
      *Evidence: the register with dated review.*
- [ ] **Tabletop exercise against the IR plan** — CC7.4. The burn switch and the
      warrant canary are both mechanisms nobody has rehearsed.
      *Evidence: exercise notes and actions taken.*
- [ ] **Vendor register** — CC9.1. Cloudflare, Neon, Stripe, GitHub at minimum.
      *Evidence: the register with each vendor's own SOC 2 report attached.*
- [ ] **Dependency and secret scanning in CI** — CC6.6, CC6.8. History is clean
      today; a gate keeps it clean.
      *Evidence: a CI run showing both gates.*

---

## What is already strong, and worth showing an auditor

These are unusual before an engagement and should be presented as evidence
rather than rebuilt:

- **Row-level security on all 78 tables, both `ENABLE` and `FORCE`**, verified
  paired — no table has one without the other. Default-deny: with RLS on and no
  policy granting a command, that command is refused.
- **An append-only audit log**, enforced by the absence of UPDATE and DELETE
  policies rather than by convention.
- **A retention registry with a CI gate.** Every table declares a retention
  window, a PII class and a reason; `check:retention` fails the build if a table
  holding personal data is added without one. 82 tables registered, 6 holding
  directly identifying data.
- **Role boundaries in the database, not the application.** An organizer's reads
  are turf-bounded by policy, so the export route needs no check of its own.
- **Input validation on every route** — all 18 API modules parse with zod, five
  of them via shared schemas.
- **A warrant canary with staleness checking, and a burn switch.**
