# CROS Federation — Master Build Spec

> **Status:** Draft. Layer 1 (Universal Lead Intake) is the first deliverable; Layers 2–4 are queued but not started.
> **Owner:** Jeromy.
> **Last edited:** 2026-04-26.
> **Inspiration:** `cosmos.one` "Strategic Operating System" framing, mapped onto the existing CROS Gardener Console (Cura / Machina / Crescere / Scientia / Silentium).

## The thesis (one paragraph)

We have 17 apps in production. Each has its own admin surface — local error consoles, QA panels, settings pages, lead inboxes, content moderation, billing checks, announcement banners. As the family grows, the operator burden grows linearly. Watchtower already absorbed monitoring. **CROS now absorbs everything else operator-facing**, so a satellite app is responsible only for the end-user experience and the operator logs in to exactly one place — CROS — to run the entire business. The technical mechanism is a lightweight **federation bus**: satellites keep their own databases and identities, but publish significant business events to CROS, where a federated Gardener Console renders one operator view across the family.

## Layered plan

| Layer | Name                            | Status     | Why this order                                                            |
|-------|---------------------------------|------------|---------------------------------------------------------------------------|
| 1     | Universal Lead Intake           | **In PR**  | Smallest, highest-leverage proof of the pattern; touches every app once.  |
| 2     | QA / Error Console retirement   | Next       | Removes the largest amount of dead code per-app; Watchtower is the home.  |
| 3     | Federation Bus + Person Graph   | After 2    | The data spine. Once this exists, everything else is just rendering.      |
| 4     | Unified Email Marketing         | After 3    | The first big cross-cutting business system that pays for the spine.     |
| 5     | Crescere → Cosmos surface       | Final cut  | The portfolio observatory: telemetry, deployments, lineage, KPIs, signals.|

Each layer ships independently. We never build a layer we can't justify with operator-time saved.

## Layer 1 — Universal Lead Intake (in flight)

See `CROS_LEAD_INTAKE_BUILD_SPEC.md`. Done when all 17 apps post leads to `public-leads-intake` and the Operator Console **Leads by App** tab shows real rows from every app. Phase exit criteria:

- [x] `public.inbound_leads` extended with attribution columns
- [x] `public-leads-intake` edge function deployed
- [x] React `<CrosLeadForm />` and vanilla `cros-lead-form.js` drop-ins
- [x] **Leads by App** tab in OperatorConsole
- [ ] Wave 1: schola's `schola-demo-lead-webhook` retired in favor of new endpoint
- [ ] Waves 2 + 3: 17 apps integrated
- [ ] At least 7 days of real submissions visible in the Leads by App tab

## Layer 2 — Retire QA / Error Console panels

Goal: every satellite app stops shipping its own admin "QA / errors" UI. Watchtower is the canonical place.

For each app:
1. Identify the local admin route (e.g. `/admin/qa`, `/admin/errors`, `/operator`).
2. Delete the route + components + tests.
3. Replace with a single `<WatchtowerLink />` button that opens `https://jeromydarling.github.io/watchtower/?slug=<app>`.
4. Confirm the app's `clients/error-reporter.js` is wired to Watchtower's `ingest-error` edge function (per Watchtower README).

**Estimated retirement surface per app:** ~5–15 components, 1–3 routes, often a settings tab. Across 17 apps this is meaningful debt removed.

The list of candidates per app lands in `LAYER_2_RETIREMENTS.md` once we audit each repo.

## Layer 3 — Federation Bus + Person Graph

The data spine. Three pieces.

### 3a. `app_federation` schema in CROS Supabase

```sql
-- Source of truth for every CROS-family app
CREATE TABLE app_federation.federated_apps (
  slug          text PRIMARY KEY,                  -- 'hortus', matches watchtower
  name          text NOT NULL,
  supabase_ref  text,                              -- project ref of the satellite
  events_secret text NOT NULL,                     -- HMAC secret the app uses to sign event posts
  status        text NOT NULL DEFAULT 'active',    -- active|paused|retired
  created_at    timestamptz DEFAULT now()
);

-- One row per real human across the whole family
CREATE TABLE app_federation.federated_users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_email text NOT NULL,
  display_name  text,
  merged_into   uuid REFERENCES app_federation.federated_users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX uniq_federated_users_email ON app_federation.federated_users (lower(primary_email)) WHERE merged_into IS NULL;

-- Per-app user-id pointers
CREATE TABLE app_federation.app_user_links (
  federated_user_id uuid REFERENCES app_federation.federated_users(id) ON DELETE CASCADE,
  source_app        text REFERENCES app_federation.federated_apps(slug),
  app_user_id       text NOT NULL,
  app_email         text,
  first_seen_at     timestamptz DEFAULT now(),
  last_seen_at      timestamptz DEFAULT now(),
  PRIMARY KEY (source_app, app_user_id)
);

-- The event stream
CREATE TABLE app_federation.federated_events (
  id            bigserial PRIMARY KEY,
  source_app    text NOT NULL REFERENCES app_federation.federated_apps(slug),
  event_type    text NOT NULL,         -- 'lead.submitted','user.signup','order.placed','book.purchased',…
  federated_user_id uuid REFERENCES app_federation.federated_users(id),
  app_user_id   text,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  payload       jsonb NOT NULL DEFAULT '{}',
  ingested_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fed_events_app_time   ON app_federation.federated_events (source_app, occurred_at DESC);
CREATE INDEX idx_fed_events_user_time  ON app_federation.federated_events (federated_user_id, occurred_at DESC);
CREATE INDEX idx_fed_events_type_time  ON app_federation.federated_events (event_type, occurred_at DESC);
```

### 3b. `cros-bridge` client (one file per satellite)

Each satellite app gets a 50-line module that exposes:

```ts
publishEvent({ event_type, app_user_id, app_email, payload })
```

…which signs the body with the app's `events_secret` and POSTs to `https://thecros.lovable.app/functions/v1/federated-events-ingest`. The ingest function validates the HMAC, upserts the federated user, and writes the event row.

### 3c. Identity merge job

A nightly job in CROS reconciles `app_user_links` rows that share an email and merges the corresponding `federated_users` (sets `merged_into` so history is never destroyed).

**Why this matters for marketing:** once 3 is live, "send the spring campaign to everyone in the family who's bought a Heritage Catholic book and never used Hortus" is a single SQL query.

## Layer 4 — Unified Email Marketing

Built on top of 3. The pieces:

- **One sender identity per kind** (transactional vs. marketing) — already in CROS via Brevo (see `brevo-*` edge functions).
- **One segmentation engine** — query against `federated_users` + `federated_events`. Saved segments live in CROS.
- **One suppression list** — global do-not-email + per-app overrides. Honors existing `contacts.do_not_email`.
- **One template library** — already exists in `_shared/email-templates/`. Extend with per-app branding (header / footer / accent color from `federated_apps`).
- **One scheduled-send queue** — reuse the existing `send-limit-guard` and `acknowledge-send-intent` infrastructure.

Per-app marketing pages remain in the satellite app for SEO + look-and-feel, but every "send" goes through CROS. Operators schedule a campaign once; it runs across the family.

## Layer 5 — Crescere → Cosmos

A new section under the **Crescere** zone in the Gardener Console (per the user's choice — Crescere is the "is the ecosystem growing well?" zone, which is exactly the question Cosmos answers). Living-system aesthetic.

Panels:

| Panel                    | Source                                                          |
|--------------------------|-----------------------------------------------------------------|
| Constellation Map        | watchtower/status.json + federated_events activity              |
| Live Pulse               | watchtower + federated_events                                   |
| Lead Flow                | inbound_leads + federated_events (`lead.submitted`)             |
| Family Tree              | static manifest + git history                                   |
| Tenants × Apps Matrix    | operator_tenant_stats join app_user_links                       |
| Initiative Tracker       | new `cosmos_initiatives` table                                  |
| Strategic Signals        | LLM rollup over the last 7 days of federated_events             |

Cosmos is the *consumer* of Layers 1–4. Building it before the data spine produces a hollow dashboard.

## Anti-goals

- **No bigbang migration.** Layers ship one at a time. Any layer can be reverted.
- **No multi-tenant satellite databases.** Satellites stay independent — federation is read-side, not write-side.
- **No new auth system.** Satellites keep their own auth. CROS observes events; it does not log users in for the satellites.
- **No per-app fork of the Gardener Console.** The console renders the same UI regardless of which app the data came from. App-awareness is a query parameter, not a UI variant.

## Open decisions

- [ ] Where does the `cros-bridge` client live — a published npm package, or a single file copied into each repo? (Lean copy-file for now; package later.)
- [ ] Cosmos visual style: living-system / observatory chosen, but render shape (constellation, dependency graph, ecosystem flow?) needs design.
- [ ] Do we ever surface federated data to *non-operator* end users in the satellites? (E.g. "you also use Hortus".) Out-of-scope for now; revisit after Layer 4.

---
*This spec lives in the CROS repo. Each layer below it lands its own spec.*
