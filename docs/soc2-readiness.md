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

| | Count |
|---|---|
| Controls assessed | 13 |
| PASS | 1 |
| PARTIAL | 6 |
| FAIL | 6 |

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

## Control mapping

| Control | Rating | Evidence |
|---|---|---|
| **CC6.1** Logical access | PARTIAL | 17 of 18 API modules call `requireWorkspace`; `auth` is correctly open. `guards.test.ts` asserts unauthenticated access is refused. Passwords stored as PBKDF2 verifiers; `timingSafeEqual` used for comparison. **But F1**, and MFA on the Cloudflare, Neon and GitHub accounts could not be verified from here. |
| **CC6.2** Access provisioning | FAIL | The product has a role model. The company has no access register, no joiner/leaver process, no periodic review. |
| **CC6.3** Access authorization | FAIL | No CODEOWNERS, no PR template. Branch protection could not be read (`/branches/main/protection` → HTTP 403; the token lacks the scope), so it is unverified rather than absent. |
| **CC6.6** Threat protection | PARTIAL | Four advisories in production dependencies, all with fixes available, **none currently reachable** — each was checked individually rather than counted. No automated dependency scanning in CI. Platform patching is Cloudflare's. |
| **CC6.7** Data transmission | PARTIAL | TLS by platform. `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` set on every response. **No HSTS, no CSP.** Encryption at rest is Neon and R2 defaults. No data classification document — though the retention registry's `pii` field (`none`/`public_record`/`pseudonym`/`contact`/`protected`) is a working one, per table, enforced by CI. |
| **CC6.8** Unauthorized software | PARTIAL | No containers or hosts, so image scanning and file-integrity monitoring do not apply. `wrangler deploy` is the only path to production. No dependency scanning, no artifact signing. |
| **CC7.1** Monitoring | FAIL | `[observability] enabled = true` gives Workers' built-in logs. No uptime monitoring, no alerting, no dashboards, no on-call. Nobody is told when the Worker starts failing. |
| **CC7.2** Anomaly detection | PARTIAL | A real application audit log: actor, role, action, record type, count — RLS-protected and **append-only by policy** (INSERT and SELECT policies exist; no UPDATE or DELETE policy, so both are denied). Bulk reads, exports and sheet prints are recorded. But no SIEM, no log export, and the log lives in the same database an administrator can reach. |
| **CC7.3** Security event evaluation | FAIL | No triage procedure, no severity classification. |
| **CC7.4** Incident response | FAIL | No IR plan, no roles, no communication templates, no tabletop. Note the product ships a burn switch and a warrant canary — mechanisms without a procedure around them. |
| **CC8.1** Change management | PARTIAL | CI gates on every push: `check:retention`, `typecheck`, `lint`, `test` (780 tests). Migrations are reviewed SQL in the tree. **But** no required review, no deployment approval, no change log, and production deploys are run by hand with no record of who shipped what. |
| **CC9.1** Risk mitigation | FAIL | No risk register. |
| **A1.2** Recovery planning | FAIL | **Neon point-in-time recovery is 6 hours** (`history_retention_seconds: 21600`). Effective RPO is 6 hours; anything older is unrecoverable. No documented RTO, no DR plan, no restore test has been performed. This database holds escrowed bail and mutual-aid ledgers. |

### The four dependency advisories, individually

Listing CVEs without checking reachability produces noise. Each was traced:

| Package | Advisory | Reachable? |
|---|---|---|
| `drizzle-orm` | SQL injection via improperly escaped identifiers | **No.** Used only to *declare* table shapes in `lib/schema/*` (`pg-core` column builders and `sql` for defaults). No drizzle query builder is called anywhere; every query goes through `postgres.js` tagged templates. The vulnerable path is query construction. |
| `hono` | ReDoS in CORS middleware | **No.** `hono/cors` is never imported. The app is same-origin by construction. |
| `react-router` / `react-router-dom` | RSC-mode CSRF bypass | **No.** The SPA uses `BrowserRouter`; RSC mode is not enabled. |

All four still warrant patching: an unreachable vulnerability becomes reachable
the day somebody adds `hono/cors`.

---

## Remediation checklist

### Progress

| Tier | Total | Done | Remaining |
|------|-------|------|-----------|
| T0 | 5 | 0 | 5 |
| T1 | 7 | 0 | 7 |
| T2 | 6 | 0 | 6 |
| T3 | 4 | 0 | 4 |

### T0 — before any audit engagement

- [ ] **Rotate the Neon API key** — CC6.1. Neon console → Account settings →
      API keys → revoke, create, update `REFDATA_PGURI` and any GitHub secret.
      *Evidence: revocation timestamp in the Neon audit log.*
- [ ] **Rotate the Cloudflare API token** — CC6.1. Dashboard → My Profile →
      API Tokens → roll. Re-set anything using it.
      *Evidence: token list showing the old token absent, new creation date.*
- [ ] **Resolve the public repository against the published claim** — F0.
      Either set the repo private, or change the footer copy on every page.
      *Evidence: screenshot of repo settings, or the deployed diff.*
- [ ] **Raise Neon PITR from 6 hours to at least 7 days** — A1.2. Project
      settings → history retention. On a paid plan this is a slider.
      *Evidence: screenshot of the retention setting.*
- [ ] **Enable MFA on Cloudflare, Neon and GitHub** — CC6.1. Could not be
      verified from here; verify and evidence it.
      *Evidence: screenshot of each account's security page.*

### T1 — within two weeks

- [ ] **Write the four policies** — CC7.4, A1.2, CC6.2, CC8.1. Incident
      response (P0–P3 with SLAs, IC/TL/CL roles, 72-hour breach notification),
      disaster recovery (RTO/RPO per store, restore procedure), access
      management (least privilege, MFA, quarterly review, joiner/leaver), change
      management (PR required, CI gates, emergency path with retro).
      *Evidence: the documents, dated and version-controlled.*
- [ ] **Add CODEOWNERS and require review on `main`** — CC6.3.
      *Evidence: branch protection screenshot showing required approvals.*
- [ ] **Confirm branch protection is on** — CC6.3. Unverifiable here (403).
      *Evidence: `GET /repos/:owner/:repo/branches/main/protection` returning 200.*
- [ ] **Patch the four dependency advisories** — CC6.6. `npm audit fix`, then
      re-run the suite. None is reachable today; that is not a reason to carry them.
      *Evidence: `npm audit --omit=dev` showing 0.*
- [ ] **Add Dependabot or Renovate** — CC6.6.
      *Evidence: `.github/dependabot.yml` and a first opened PR.*
- [ ] **Add HSTS and a Content-Security-Policy** — CC6.7. Both belong beside the
      three headers already set in `src/worker/index.ts`. CSP is the more
      valuable of the two here: §10 forbids external scripts, so the policy can
      be genuinely strict and will catch any regression of that rule.
      *Evidence: response headers, plus a test asserting them.*
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
