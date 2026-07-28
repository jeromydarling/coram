# Salvage inventory — CROS → Coram

Status: **executed.** Approved and carried out; kept for provenance. If you are
looking for something that used to be in this repo, the recovery table at the
bottom says where it went.

Target platform per decision: **Cloudflare Worker + Postgres behind Hyperdrive.**
No Supabase platform (no Auth, no Edge Functions, no `supabase-js`). RLS stays the
security boundary per CLAUDE.md §4.1.

---

## The headline number

The inherited tree is 1,268 TypeScript files, 469 SQL migrations, and 309 Deno edge
functions. Very little of it survives contact with the new platform, and the reason is
mechanical rather than aesthetic:

| Coupling | Files affected | Why it can't port |
|---|---:|---|
| `import { supabase }` / `@supabase/supabase-js` | **539 of 1,268** (42%) | Under Hyperdrive the browser has no DB client. The SPA talks to `/api/*`. Every one of these files changes at the data-access line regardless of how good the code is. |
| `auth.uid()` in RLS policies | **259 of 469** migrations | There is no Supabase Auth. Session identity must come from a GUC (`current_setting('coram.user_id')`) set per connection. Every policy body changes. |
| Deno runtime + `Deno.env` + `npm:`/`esm.sh` specifiers | **309 of 309** edge functions | Workers is not Deno. Different runtime, different module resolution, different env access. |

So the honest read: **this is not a migration, it is a rewrite with a good parts bin.**
The parts bin is real and worth having — it is just concentrated in UI and tooling, not
in domain logic. That is expected: CROS is a Catholic diocesan relationship CRM, Coram is
a grassroots organizing OS. They share a shape, not a domain.

---

## KEEP — ports as-is

| What | Size | Destination | Note |
|---|---:|---|---|
| `src/components/ui/**` | 57 files → 54 kept | `src/app/components/ui/` | shadcn. See the correction below: three of these were not clean. |
| `src/lib/utils.ts` | 6 lines | `src/app/lib/utils.ts` | The `cn()` helper. |
| `src/hooks/use-toast.ts`, `use-mobile.tsx` | 2 files | `src/app/hooks/` | Required by the ui components above. |
| `src/lib/sanitize.ts` | 87 lines | `src/app/lib/sanitize.ts` | DOMPurify allowlist, already correctly restrictive on URI schemes. |
| `src/lib/csv.ts` | ~90 lines | `src/app/lib/csv.ts` | PapaParse wrapper. Feeds Membra import (§5.1). |
| `src/lib/importers/Importer.ts` | 128 lines | `src/shared/importers/` | The `detect / map / preview / import` interface is exactly the dry-run-and-rollback shape §5.1 calls for. |
| `src/lib/geo/stateFips.ts` | 142 lines | `src/shared/geo/` | State FIPS codes. Needed by Petitio legislator lookup (§5.5) and Custos state-by-state KYR flows (§5.9). |
| `components.json`, `postcss.config.js`, `eslint.config.js`, `tsconfig*.json`, `vitest.config.ts` | 7 files | root | Build tooling, platform-agnostic. |

## KEEP — ports with rework

| What | Rework needed |
|---|---|
| `tailwind.config.ts` | Keep the structure and the shadcn token wiring; **replace the entire palette.** The current one is CROS brand. Coram needs the muted/desaturated + single amber accent direction from §8.2. |
| `src/lib/importers/GivingCSVImporter.ts` (281 lines) | Solid column-mapping and dedupe logic. Retarget from donation records to Membra contacts; the donation path moves to Thesaurus. |
| `supabase/functions/_shared/llmGateway.ts` (214 lines) | The retry/backoff and the `LlmErrorKind` classification (`rate_limited` / `timeout` / `server` / `config` / `bad_response`) are good and worth keeping. **Must be re-pointed** from the Lovable AI gateway to `INFERENCE_ENDPOINT`, and it must sit *behind* `redact.ts` — §5.10 forbids PII reaching any model endpoint. |
| `supabase/functions/_shared/errorEnvelope.ts` (131 lines) | The `{ ok, error, code, request_id }` envelope and `x-request-id` passthrough are worth standardising on. Rewrite as Hono middleware; drop the CORS coupling (Coram is same-origin, §1.1). |
| `src/i18n/**` (en, es locales) | Scaffolding is reusable; all strings are CROS copy and get thrown away. Keep only if you want es at MVP — say the word. |

## REFERENCE ONLY — read, extract the pattern, then delete

| What | The pattern worth extracting |
|---|---|
| RLS helper functions across 271 migrations | `has_role(_user_id, _role)` as `SECURITY DEFINER STABLE SET search_path = public`, plus `user_in_tenant(id)` / `is_tenant_admin(id)`. **This is pure Postgres and survives the move** — it is the correct shape for Coram's five roles and `tenant_id` default-deny. Only `auth.uid()` needs swapping for a session GUC. Highest-value pattern in the repo. |
| `supabase/functions/_shared/stripeHub/routing.ts` + `forward.ts` | The satellite contract: `Route` shape, HMAC signature, `webhook_path`, DLQ with `next_retry_at`, and `alreadyProcessed()` idempotency on `event_id`. Coram is a *satellite* of this hub (`metadata.source_app = coram`, §5.6), so what we need is the satellite side of this contract, not the hub itself. |
| `supabase/functions/_shared/withAuth.ts` | Correct instinct (centralise auth so 200+ handlers don't each reinvent the gate) but the body is `supabase.auth.getClaims()`. Rewrite for Hono against our own JWT carrying `tenant_id`, `role`, `turf_ids` (§4.2). |
| `supabase/functions/_shared/tenantScope.ts` | 41 lines. Note §4.1 explicitly says app-layer checks are UX convenience, never the boundary — so this is a guard rail, not security. Cheap to rewrite. |

## DELETE

| What | Count | Why |
|---|---:|---|
| `supabase/migrations/**` | 469 | CROS domain schema (dioceses, metros, grants, archetypes, essays). Retaining it would violate §3 data minimization until rewritten line by line. Coram gets forward-only Drizzle migrations in `/migrations`. |
| `supabase/functions/**` | 309 | Deno runtime. Everything valuable is captured in the REFERENCE ONLY rows above. |
| `src/pages/**` | 76 | CROS product surface — Metros, Grants, Archetypes, MissionAtlas, Communio, Impulsus, operator console. No mapping to Coram's eleven modules. |
| `src/hooks/**` | 264 | ~All are `useX` wrappers over `supabase.from('cros_table')`. The tables do not exist in Coram. (Except the 2 kept above.) |
| `src/components/**` (non-ui) | ~600 | Same reason. Includes `operator/` (53), `dashboard/` (33), `settings/` (30), `admin/` (26). |
| `src/integrations/supabase/types.ts` | 28,090 lines | Generated types for the CROS schema. |
| `src/contexts/**` | 8 | Auth/Tenant/Impersonation/DemoMode contexts, all Supabase-Auth-bound. `TenantContext` and `RoleContext` get rewritten against the new JWT. |
| `src/lib/**` (unkept) | ~75 | PDF builders, providence engine, zodiac, compass, archetypes, operator error capture — CROS-specific. |
| `qa/`, `qa-runner/` | 740K | Harness bound to CROS suites and the Lovable QA edge functions. |
| `.lovable/`, `lovable-tagger` dep, `@lovable.dev/cloud-auth-js` dep | — | Lovable platform residue. |
| `n8n-workflows/` | 16K | External automation for CROS. |
| `tmp/`, `CHANGELOG.md`, `*_BUILD_SPEC.md` (4), `*_CHECKLIST.md` (2) | — | CROS project docs. CLAUDE.md is the spec now. |
| `README.md` | — | Still the Lovable boilerplate template. Gets rewritten for Coram. |
| `index.html` | — | CROS meta tags. Gets rewritten; also currently the SPA entry, which moves under `/app`. |
| `bun.lockb`, `bun.lock`, `package-lock.json` | 830K | Three lockfiles for two package managers. Pick one on the new dependency set. |

---

## Two things I want to flag

**1. `.env` is committed to git.** It carries `VITE_SUPABASE_PROJECT_ID`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, and `VITE_SENTRY_DSN`, and it is
present in the initial commit. The publishable/anon key and DSN are low-severity by design
— they are meant to be public — but they belong to the *other* app and should not be in
Coram's history. I will `git rm --cached` it and add it to `.gitignore`. **Purging it from
history needs a force-push and is your call**; given the key type I would not bother, but
I would rotate the Sentry DSN if that project is still live.

**2. Framer Motion has zero remaining users.** After the marketing delete, nothing imports
it — which is correct, since §8.4 says no motion inside `/app` at all. It stays in
`package.json` for the new marketing routes only.

---

## Correction: the shadcn set was not as clean as this document first claimed

The original version of this file said the 57 `components/ui` files imported
only `@/lib/utils`, `@/hooks/use-mobile`, and `@/hooks/use-toast`. That was
based on a grep that only matched double-quoted import paths, so every
single-quoted CROS import went unseen. Three files were contaminated:

| File | Problem | Resolution |
|---|---|---|
| `sonner.tsx` | Imported `@/lib/toneCharter` and wrapped `toast` in a mapper that rewrote message strings at call time — "Contact created" became "Noted." | Restored to stock shadcn. That mapper encoded the other product's tone charter; §2 sets a different rule, and a component that silently rewrites what a developer wrote is the wrong place to enforce copy style. |
| `help-tooltip.tsx` | Imported `@/lib/helpContent`, a CROS help-key registry | Deleted |
| `rich-text-editor.tsx` | Imported three `@tiptap/*` packages not in the new dependency set | Deleted. Recoverable if Nuntius wants a rich composer. |

54 of the 57 carried forward. The typechecker caught all three, which is the
argument for turning `strict` on before porting rather than after.

## Deferred keepers — where to find them

These were approved as keep-with-rework but belong to modules that have not
been built. Rather than sit in the tree as dead code, they stay in git history.
All paths are as of commit `1ff1e33`, the last commit before the restructure:

| What | Path at `1ff1e33` | Wanted by |
|---|---|---|
| `llmGateway.ts` — retry/backoff + `LlmErrorKind` taxonomy | `supabase/functions/_shared/llmGateway.ts` | Scriba (§5.10). Must be re-pointed at `INFERENCE_ENDPOINT` and placed behind `redact.ts`. |
| Stripe hub satellite contract — `Route`, HMAC, DLQ, `event_id` idempotency | `supabase/functions/_shared/stripeHub/{routing,forward}.ts` | Thesaurus (§5.6) |
| RLS helper patterns — `has_role`, `user_in_tenant`, `is_tenant_admin` | across `supabase/migrations/*.sql` | Already absorbed. `migrations/0001_foundation.sql` carries the `SECURITY DEFINER STABLE SET search_path` shape, with `auth.uid()` replaced by session GUCs. |

Retrieve with `git show 1ff1e33:<path>`.

Ported into the tree now, inert until their module lands: `Importer.ts` and
`GivingCSVImporter.ts` (→ `src/shared/importers/`), `stateFips.ts`
(→ `src/shared/geo/`), `csv.ts` and `sanitize.ts` (→ `src/app/lib/`).

## What this leaves

Roughly **70 files** carry forward out of ~1,600, and 57 of those are the shadcn library.
That is a thin salvage, and I want to be straight about it rather than pad the list with
files that would need rewriting to the point of being new code.

The load-bearing inheritance is not files, it is three patterns:
the `SECURITY DEFINER` RLS helper shape, the Stripe hub satellite contract, and the
importer `detect/map/preview/import` interface. Those are worth more than the file count
suggests.

## Open question the Hyperdrive decision created — **resolved, built**

CLAUDE.md §4.2 says the Worker "connects with a per-request JWT carrying `tenant_id`,
`role`, and `turf_ids`." With Supabase Auth gone, **Coram now has to issue those JWTs
itself** — signup, login, password reset, session refresh, email verification. That is
real work that the spec's build sequence (§9) folds into "Foundation" without naming.
It also means `KV_SESSIONS` (§1.4) becomes load-bearing rather than a convenience.

Built rather than fronted with an external IdP. `src/worker/lib/crypto.ts`
issues HS256 tokens over PBKDF2-verified passwords, `KV_SESSIONS` holds the
revocation state, and the claims deliberately carry **no role** — role and turf
are re-derived from `memberships` inside `coram.set_request_context()` on every
request, so a token minted before a demotion cannot exercise the old role.

Everything still open is in [open-decisions.md](open-decisions.md).
