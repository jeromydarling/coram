# CROS™ Changelog

All notable changes to the Communal Relationship Operating System.

---

## 2026-02-22

### Phase 22 — Operator Console Enhancements & SEO Dashboard

- **Operator Bookmarks** (`src/hooks/useOperatorBookmarks.ts`, `OperatorLayout.tsx`): Persistent bookmark system for any Operator Console section. Star-toggle on every sidebar item, bookmarked items pinned to top of navigation. localStorage-backed, works on desktop and mobile.

- **Operator SEO Dashboard** (`src/pages/operator/OperatorSeoPage.tsx`): New "SEO" section under Operator Business view listing all 11 SEO build phases with descriptions, status badges, and direct links to every marketing page built across phases. Filterable by status, expandable phase cards.

- **8 new Operator Playbooks** inserted into `operator_playbooks` table:
  - *Arrival Stewardship Flow* (activation) — First-week tenant welcome ritual
  - *Activation Companion Ritual* (activation) — Guided activation session protocol
  - *QA & Stability — Quiet Maintenance* (qa) — Weekly stability review cadence
  - *Friction Listening Practice* (support) — Detecting and resolving tenant friction signals
  - *Communio Stewardship* (outreach) — Shared-network governance and care
  - *Expansion Discernment* (expansion) — When and how to expand into new metros
  - *Support & Care Flow* (support) — Warm support response protocol
  - *Weekly Narrative Review* (qa) — Operator narrative health check

---

### Phase 21A — Human Capacity Pricing Refactor

- **Capacity philosophy doctrine** (`.lovable/memory/architecture/capacity-philosophy.md`): Permanent architectural rule — CROS measures active team capacity (Steward, Shepherd, Companion, Admin), never visitors, volunteers, or imported contacts. Scaling via capacity blocks, never per-seat billing.

- **Plan capacity model**: Core includes 10, Insight 25, Story 50 active team members. Defined in `src/content/pricing.ts` (`planCapacity`) and `src/lib/features.ts` (`planActiveCapacity`).

- **Capacity expansion blocks**: Replaced "Additional Users" add-on with three expansion blocks — +25 ($29/mo), +75 ($69/mo), +200 ($149/mo) — in `src/content/pricing.ts` and `src/lib/addons.ts`.

- **Pricing page UX refresh**: "Stability Commitment (Annual)" toggle replaces generic "Annual" label. Calm explanatory copy: "Visitors and volunteers are always welcome — capacity reflects the core team guiding the mission." No progress bars, no quota visuals.

- **Stripe checkout payload updated**: `create-checkout` edge function now sends `capacity_expansion_25`, `_75`, `_200` line items instead of `additional_users_qty`.

### Phase 21B — Capacity Awareness UI (Calm Growth Signals)

- **TeamCapacityCard** (`src/components/dashboard/TeamCapacityCard.tsx`): Warm narrative card on Command Center showing active team presence without percentages or meters. Soft growth message when capacity exceeded.

- **TeamCapacitySection** (`src/components/settings/TeamCapacitySection.tsx`): Settings page section with human-language capacity explanation and included plan capacity.

- **Operator Lumen `capacity_growth` signal**: New signal type in Operator Nexus Lumen feed — "New leaders emerging in [Tenant]" — triggered when active users grow >20% over 30 days.

- **Testimonium `capacity_shift` event**: Silent event type for historical growth pattern tracking.

### QA Expansion — Specs 66–93

- **28 new Playwright smoke tests** covering Operator Console routes (Partners, Scheduling, Outreach, Activation, Error Desk, QA, Manuals, Time Machine, Announcements, Ecosystem, Overrides) and Nexus subpages (Playbooks, Support Inbox, Activation Manager, Expansion, Knowledge, Rhythm, Presence, Arrival, Recovery, Narrative, Narrative Studio, Civitas Studio, Adoption, Stability, Narrative Ecosystem) plus Guided Activation Prep.

---

## 2026-02-21

### Phase 8U — Operator Safeguards & Architecture Guardrails

- **Architecture Guardrails system** (`src/lib/guardrails.ts`): Client-side validators for entitlement integrity, selector contracts, add-on registry sync, and NRI transparency. Runs 10 checks surfaced in Operator Nexus QA.

- **Selector Contract Registry** (`src/lib/qa/selectorRegistry.ts`): Authoritative source of all `data-testid` values with nav selectors, groups, and page-level selectors.

- **NRI Transparency Drawer** (`src/components/nri/NriInsightDrawer.tsx`): "Why am I seeing this?" drawer for every NRI story signal — shows evidence, confidence, and human override (dismiss). Integrated into StorySignalsCard.

- **Operator Nexus QA enhanced**: Architecture Guardrails section with pass/fail cards for Entitlement Integrity, Selector Contracts, Add-on Registry Sync, and NRI Transparency.

### Architecture & Product Structure

- **Bridge demoted from tier to add-on**: CROS now has 3 base tiers (Core → Insight → Story) instead of 4. Bridge ($49/mo) is now an à la carte add-on available alongside Campaigns, Expansion Capacity, etc.
  - Updated `brand.ts`, `features.ts`, `pricing.ts`, `addons.ts`, `stripe.ts`
  - Pricing page now shows 3-column tier grid with Bridge in the Capacity Upgrades section
  - `FeatureGate` component now suggests add-on name when a feature is gated by an add-on
  - `TenantSubscriptionCard` no longer lists Bridge as a plan tier
  - Comparison table shows "Add-on" badge for Bridge-gated features

- **Communio moved to core tier (all plans)**: Communio opt-in, groups, signals, events, and governance are now available at every tier without requiring Bridge or any add-on.
  - Added `communio_opt_in`, `communio_groups`, `communio_signals`, `communio_events`, `communio_governance` to `planFeatures.core`
  - Removed `communio_opt_in` from Bridge add-on features
  - Added "Communio (opt-in shared network)" to Core tier includes in brand config, pricing comparison table, and pricing bullets
  - Bridge add-on now lists only Relatio/CRM features

- **Bridge-as-Add-on drift checklist** (`.lovable/memory/marketing/bridge-addon-consistency.md`): Grep targets, UI checks, runtime checks, and test assertions to prevent future regression.

- **Consistency test suite** (`src/lib/__tests__/bridge-addon-consistency.test.ts`): 8 vitest assertions covering communio availability at all tiers, bridge-only gating for relatio features, and structural invariants.

- **À la carte add-on system created** (`src/lib/addons.ts`): Defines purchasable add-ons independent of the cumulative plan hierarchy — Bridge, Campaigns, Civitas, Expansion Capacity, Additional Users, Expanded AI, Expanded Local Pulse, Advanced NRI, Guided Activation.

- **Feature gating enhanced** (`src/lib/features.ts`): `canUse()` now checks plan grants first, then falls back to active add-on keys via `isFeatureInAddOn()`.

### Type System & Naming

- **CROS type aliases** (`src/types/cros.ts`): Human-centered type aliases for legacy CRM types — `Partner` (Opportunity), `Person` (Contact), `TouchPoint` (Activity), `Region` (Metro), `Chapter` (Journey).

### Communio Governance

- **Governance review UI** (`src/components/communio/CommunioGovernanceReview.tsx`): Allows group admins to review and resolve data-boundary flags (privacy, overcollection, consent issues). Added as a tab on the Communio page.

### Content & Documentation

- **Admin How-To refactored** (`src/pages/admin/AdminHowTo.tsx`): Separated tenant-level documentation from operator-level workflows. Role-gated: stewards/admins see operator sections, tenant admins see only their tools. Added accordion Q&A format and section tooltips.

- **Shared section registry** (`src/lib/appSections.ts`): Single source of truth for section metadata (titles, descriptions, feature gates) shared between Help and AdminHowTo pages.

### Infrastructure

- **PWA offline support** (`public/sw.js`): Cache-first strategy for static assets, network-first for navigation. Field workers (Visitors/Companions) get offline access.

- **Edge function defensive patterns** (`.lovable/memory/technical/edge-functions/defensive-patterns.md`): Documented standards for CORS, auth guards, chunked base64 handling, and error envelopes.

### UX

- **Visitor landing enhanced** (`src/pages/Visits.tsx`): Warm "Welcome, friend" empty state with recording CTA for new visitors.

### QA Automation

- **Full batch QA runner** (`qa-run-batch` edge function): Sequential suite execution with GitHub Actions dispatch, consolidated Repair Pack email on failure, self-healing prompt engine for root-cause identification.

---

## Pre-2026-02-21

Legacy Profunda → CROS rebrand. See `.lovable/plan.md` for the Phase 7 Operator CRM expansion plan.
