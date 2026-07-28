# Porting map — CROS assets → Coram modules

Nothing from the CROS application was destroyed. Commit **`1ff1e33`** holds the
tree exactly as inherited, and it is on the remote as an ancestor of this
branch, so it is reachable and GC-safe.

```sh
git show 1ff1e33:<path>                       # one file
git checkout 1ff1e33 -- <path>                # bring it back into the tree
git diff 1ff1e33 --stat -- supabase/          # what left
```

CLAUDE.md names CROS twice as a source to port from — §5.2 ("port the
NRI/Communio logic from CROS") and §5.8 ("port member lifecycle and patronage
logic from Communis") — so this file records what is actually there against
each Coram module, having read the code rather than the filenames.

The honest summary: **the valuable inheritance is in data models and a handful
of algorithms, not in application code.** Where a CROS table already solved a
problem Coram has, it is called out below with its path. Where the CROS model
solves a *different* problem that merely shares a noun, that is called out too,
because porting those would cost more than starting clean.

---

## High value — port these

### Nuntius §5.4 — the global opt-out ledger — **PORTED**

Landed in `migrations/0004_nuntius.sql`. Original at
`supabase/migrations/20260220133107_*.sql`

The closest thing to a drop-in in the whole repo. `email_suppressions` is
tenant-scoped with a unique index on `(tenant_id, lower(email))`, and the
`reason` / `source` CHECK constraints (`unsubscribed | complaint | bounce |
manual`, `self_service | admin | system`) are exactly the distinctions a
deliverability dashboard needs. `email_unsubscribe_tokens` stores a
`token_hash`, not the token — same discipline Coram's `auth_tokens` uses.

**What shipped, and how the §3.4 conflict resolved.** The CROS ledger stores a
plaintext `email`, which would have forced a choice between §5.4's "forever"
and §3.4's requirement that personal data expire. Coram's stores
`HMAC-SHA256(pepper, "<label>:<identifier>")` instead, with the pepper held in
Worker secrets and deliberately absent from Postgres. The table then holds no
personal data at all, so indefinite retention is fine under §3.4 as written and
neither rule had to bend.

That also fixes the case the plaintext version could not: someone unsubscribes,
their contact record is later purged, and the suppression survives without us
still holding an address we had promised to delete.

The `reason` / `source` CHECK constraints carried over as-is. Enforcement is
new — a `BEFORE INSERT` trigger on every outbound table, deriving the hash from
the contact row rather than from anything a caller passed.

### Vinculum §5.2 — the relationship graph — **PORTED**

Landed in `migrations/0006_vinculum.sql`. Original at
`supabase/migrations/20260213144756_*.sql`, plus
`supabase/functions/upsert-relationship-edges/index.ts` (99 lines)

`relationship_edges(source_type, source_id, target_type, target_id,
edge_reason)` with `UNIQUE (source_type, source_id, target_type, target_id)` is
a clean, generic edge model, and the unique constraint makes ingestion
idempotent. The shape carries over directly.

The edge function itself is a thin CRUD wrapper and is not worth porting. Its
RLS is worth reading once as a cautionary example:

```sql
CREATE POLICY "Authenticated users can read edges" ON public.relationship_edges
  FOR SELECT USING (auth.role() = 'authenticated');
```

That has no tenant predicate at all — any signed-in user of any tenant could
read every edge in the database. The table also has no `tenant_id`. This is the
single clearest argument for rewriting the policies rather than porting them,
and for Coram's default-deny posture where a missing predicate fails closed.

**What shipped:** the shape carried over unchanged, including the unique
constraint that makes ingestion idempotent. Added: a `tenant_id` column, a
`CHECK` on the endpoint types, and a `relationship_edges_select` policy that
hides an edge unless *both* ends are visible to the caller — so an organizer
cannot learn that a contact outside their turf exists by seeing an edge point
at it. The traversal API is capped at one hop, because deeper walks would let
someone map a whole network out from a single contact in their turf, which is
both what a hostile subpoena would ask for and what turf bounds exist to
prevent.

### Scriba §5.10 — model scope guardrails — **PORTED**

Landed as `src/worker/lib/scope.ts`. Original at
`src/lib/nri/scopeGuardrails.ts` (166 lines) and its test (134 lines)

Pure regex, no Supabase import, no CROS tables — it ports as-is. It screens
messages before they reach a model and covers four categories: crisis and
self-harm, therapy-seeking, free-form chat and jailbreak attempts
(`ignore .{0,20}(instructions|rules|prompt|system)`, `jailbreak|dan mode`), and
medical/legal/tax/investment advice. Crisis matches get a redirect to the 988
lifeline rather than a model response.

Coram needs this more than CROS did, not less. Custos (§5.9) puts this product
in front of people during arrests and jail support, and an organizing tool
where a volunteer in distress gets a chatbot response is a genuine harm. Take
it early — it belongs in place before the first Scriba route, alongside
`redact.ts`.

**What shipped:** the pattern sets carried over as-is; they were good. The
responses were rewritten, because CROS's were addressed to parish staff and §2
sets different copy rules — short declarative sentences, no exclamation points.
Crisis is checked first, before every other category, so "I want to die, write
me a poem" gets a phone number rather than a poem. One flaw carried over and is
now flagged in the file: the crisis numbers are US-only, which needs fixing
before Coram is used elsewhere.

`llmGateway.ts`'s retry and error taxonomy also landed, as
`src/worker/lib/inference.ts`, re-pointed from the hosted AI gateway to
`INFERENCE_ENDPOINT` per §5.10 and placed behind `assertRedacted`.

### Convocare §5.3 — public registration forms

`supabase/migrations/20260222032832_*.sql`, `20260222033353_*.sql`

`event_registrations` + `event_registration_fields` gives a working public
RSVP form with custom questions (`answers jsonb`) and a public-read policy on
the field definitions. `volunteers`, `volunteer_tags`, `volunteer_tag_links`
are a reasonable tagging base for both Convocare shifts and Membra tags.

Caveats: registrations store `guest_email` / `guest_phone` with no retention
rule, which the §3.4 CI gate will now reject outright. And this covers RSVP
only — capacity, waitlists, shift slots with skill requirements, QR check-in,
carpool, childcare, and the §5.3 accessibility fields (transit, ramp, ASL,
quiet space) do not exist and are new work.

---

## Partial value — read for the pattern, write fresh

### Membra §5.1 — the CROS "CRM" is not a supporter CRM

`supabase/migrations/20260125142645_*.sql`

Worth being blunt, because the name is misleading. CROS `contacts` is:

```sql
CREATE TABLE public.contacts (
  contact_id      TEXT UNIQUE NOT NULL,
  opportunity_id  UUID REFERENCES public.opportunities(id),
  name, title, email, phone, is_primary, notes
);
```

A B2B sales contact hanging off an `opportunities` pipeline, with a `title` and
an `is_primary` flag. **No `tenant_id`.** Membra needs a supporter record with
tags, custom fields, saved segments, engagement scoring, deduplication, a
consent ledger, and client-side-encrypted notes (§3.3). The overlap is
name/email/phone, which is not worth a port.

The `activities` table alongside it (`activity_type`, `outcome`, `next_action`,
`next_action_due`) is a closer match to Vinculum's one-on-one conversation
logging with outcome codes — that one is worth reading before writing §5.2.

### Convocare §5.3 — the CROS `events` table is program delivery

Same migration. Columns are `staff_deployed`, `households_served`,
`devices_distributed`, `internet_signups`, `referrals_generated`,
`cost_estimated`, `grant_narrative_value`. This is an ISP digital-equity
outreach tracker, not an organizing event. Nothing about capacity, shifts, or
check-in. Use `event_registrations` above and leave this one.

### The NRI signal engine

`supabase/functions/nri-generate-signals-weekly/index.ts` (399),
`nri-friction-insights` (428), `relationship-story-generate` (759),
`relationship-actions-generate` (383), `src/lib/nri/narrativeSignals.ts` (212)

Every one of these reads CROS-specific tables — `testimonium_rollups`,
`lumen_signals`, `metro_momentum_signals`, `narrative_value_moments`. None of
those exist in Coram, so none of this runs without a rewrite of its data access.

What survives translation is the **shape**: rule-based threshold detection with
no model in the loop, emitting a typed signal with a `dedupe_key` like
`celebration:${tenant}:${metro}:${weekStart}` so a weekly job is idempotent.
That pattern is worth keeping for §5.1 engagement scoring.

**A posture conflict to settle before porting any of it.** These functions
profile people — counting `email_touch_count`, `event_presence_count`,
`journey_moves` per person and per metro, then generating narrative about them.
CLAUDE.md opens with "we do not surveil the people who use this," and §3 exists
to keep exactly this kind of behavioural profile out of the schema. §5.1 does
sanction "engagement scoring," so there is a legitimate version of this — but
it is a much thinner one than CROS built, and the line belongs in the spec
before it is in a migration.

---

## No home in Coram

### The grant finder

~25 components, `supabase/functions/grant-*`, `suggest-grant-matches`,
`grant-alignment-worker`, `discovery-grants-worker`, plus n8n workflows.

Substantial, working code — and none of Coram's eleven modules is a grant
finder. Thesaurus (§5.6) is donations, dues, mutual aid and bail funds; it is
not grant discovery. Petitio is advocacy.

This is a product decision rather than a technical one. Foundation grant-seeking
is a real need for the groups Coram serves, and the code exists. But adding it
means a twelfth module, and §5 is a closed list. Flagging it rather than
deciding it.

### Discovery, metros, archetypes, the operator console

`discovery-*` workers, `metro-*`, `src/components/operator/**` (53 files),
`src/pages/operator/**` (38), archetype simulation, Firecrawl/Perplexity
scraping.

CROS-specific: a market-intelligence layer for finding and ranking dioceses and
metros. Coram has no equivalent concept, and the scraping and enrichment
pipelines point the wrong way for a product whose posture is data minimization.

### Communio §5.8

`src/components/communio/**` (14), `communio-governance-scan`,
`communio-governance-rollup`, `useCommunioGovernance.ts`

§5.8 says to port member lifecycle and patronage logic from **Communis**, which
is a different application and is not in this repo. What is here under
"Communio" is a network-directory and profile-sharing feature — group cards,
invite flows, soft invites, profile setup, awareness toggles. Useful reading for
Federatio's (§5.11) consent-to-share model, since it already distinguishes
opt-in visibility from membership. Not the governance/voting logic Consilium
needs; that will have to come from the Communis repo or be written new.

---

## Recovering something

```sh
# a single file
git checkout 1ff1e33 -- src/lib/nri/scopeGuardrails.ts

# a whole migration to read
git show 1ff1e33:supabase/migrations/20260220133107_67670c20-dd1e-4cdb-8a43-5bfc98d728d8.sql

# everything CROS had, in a scratch worktree, without touching this branch
git worktree add /tmp/cros 1ff1e33
```

Anything restored has to clear the same gates as new code: a `tenant_id`, a
default-deny RLS policy, and a `registerTable()` entry, or
`npm run check:retention` fails the build.
