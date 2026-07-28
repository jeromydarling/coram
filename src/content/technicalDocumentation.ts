/**
 * technicalDocumentation.ts — Living technical reference for the Gardener.
 *
 * WHAT: Comprehensive developer-level documentation of the CROS platform.
 * WHERE: Used by buildTechnicalDocPdf.ts to generate a downloadable PDF.
 * WHY: The Gardener needs a single reference document for architecture,
 *       data model, integrations, and operational procedures.
 *
 * UPDATE POLICY: This file must be updated whenever a new feature, module,
 * edge function, or integration is added to the platform.
 */

export interface TechDocSection {
  id: string;
  title: string;
  content: string;
}

export interface TechDocChapter {
  id: string;
  title: string;
  sections: TechDocSection[];
}

export const TECH_DOC_META = {
  title: 'CROS — Technical Architecture Reference',
  subtitle: 'Communal Relationship Operating System',
  version: '2.23.0',
  lastUpdated: '2026-03-14',
  audience: 'Gardener / Platform Operator / Developer',
};

export const techDocChapters: TechDocChapter[] = [
  {
    id: 'overview',
    title: '1. Platform Overview',
    sections: [
      {
        id: 'mission',
        title: '1.1 Mission & Identity',
        content: `CROS (Communal Relationship Operating System) is a human-centered platform for mission-driven organizations. It replaces traditional CRM paradigms with relationship memory, community awareness, and narrative intelligence.

NRI (Narrative Relational Intelligence, pronounced "Neary") is the intelligence layer. It follows a core loop: Recognize signals of care and change, Synthesize scattered information into coherent stories, and Prioritize the next faithful step. Unlike artificial intelligence, NRI draws from human reflections, shared experiences, community signals, and relationship history. AI assists — but the intelligence belongs to the relationships. NRI is bounded by design: private by default, non-surveillance, and humans remain responsible for all decisions.

The platform serves nonprofits, churches, digital inclusion organizations, workforce development programs, refugee support organizations, education access programs, and library systems through archetype-driven onboarding.`,
      },
      {
        id: 'stack',
        title: '1.2 Technology Stack',
        content: `**Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
**UI Library:** shadcn/ui (Radix primitives + Tailwind)
**State:** TanStack React Query v5 (server state), React Context (auth/tenant)
**Backend:** Lovable Cloud (Supabase — Postgres 15, Edge Functions, Storage, Auth)
**Automation:** n8n (external orchestration — all AI logic lives here, never in-app)
**Email:** Gmail API integration (no Brevo, Apollo, or SMTP)
**Payments:** Stripe (activation sessions, billing products)
**PDF:** jsPDF + jspdf-autotable
**Maps:** react-simple-maps + TopoJSON
**Rich Text:** TipTap (reflections, notes)
**Drag & Drop:** @hello-pangea/dnd
**Charts:** Recharts`,
      },
      {
        id: 'architecture-principles',
        title: '1.3 Architecture Principles',
        content: `- Mobile-first responsive design
- Multi-tenant with Row Level Security (RLS) on every table
- Role-based access control (RBAC): Database enum keys are admin, regional_manager, user — mapped to functional roles Gardener (admin), Steward (regional_manager), Shepherd/Companion/Visitor (user with feature-gated permissions)
- n8n orchestrates ALL automation — Supabase enforces truth
- AI logic never lives in the frontend or edge functions
- Service-role writes only inside Edge Functions
- Idempotency and replay protection on all external calls
- Privacy-first: reflections are sacred and private
- Narrative-first UX: no urgency-driven dashboards
- Ignatian design principles for Operator Console`,
      },
    ],
  },
  {
    id: 'data-model',
    title: '2. Data Model',
    sections: [
      {
        id: 'core-entities',
        title: '2.1 Core Entities',
        content: `**tenants** — Multi-tenant root. Each organization is a tenant with archetype, tier, metro assignments.
**profiles** — User profiles linked to auth.users. Contains role, tenant_id, display info.
**contacts** — People in the relationship network. Linked to opportunities and activities.
**opportunities** — Partner organizations. Have journey stages, health scores, metro assignments.
**activities** — Interactions: meetings, calls, events, emails. Linked to contacts + opportunities.
**activity_impact** — Outcome tracking per activity (attendance, people helped).
**activity_participants** — Many-to-many: contacts/volunteers attending activities.
**reflections** — Private narrative entries. Sacred, never shared without consent. Supports optional follow_up_date for gentle reminders.
**journey_chapters** — Milestone records for opportunity lifecycle.
**life_events** — Structured life events on people/partners. Extended milestone types: breakthrough, recovery_milestone, spiritual_milestone, celebration, major_transition.
**sectors** — Domain taxonomy catalog (Housing, Digital Inclusion, Youth, etc.). Category-grouped, color-coded.
**tenant_sectors** — Many-to-many linking tenants to sector tags. Supports is_primary flag. Max 5 per tenant.`,
      },
      {
        id: 'ai-tables',
        title: '2.2 AI & Intelligence Tables',
        content: `**ai_suggestions** — AI-generated recommendations (contact creation, follow-ups, tasks). Has confidence scores, sender patterns, dedup hashing.
**ai_sender_patterns** — Learned sender behavior for auto-approval thresholds.
**ai_analysis_runs** — Audit trail for email analysis batches.
**ai_chat_sessions / ai_chat_messages** — NRI assistant conversation history.
**ai_user_settings** — Per-user AI preferences (Gmail integration, OCR, context window).
**ai_knowledge_documents** — Company-level KB documents injected into all AI prompts.
**ai_knowledge_document_versions** — Version history for KB documents.
**ai_recommendations** — Metro-level AI recommendations from automation runs.`,
      },
      {
        id: 'community-tables',
        title: '2.3 Community & Civic Tables (Civitas)',
        content: `**territories** — Unified geographic abstraction layer. Types: metro, county, state, country, mission_field, custom_region. Replaces raw metro references for multi-geography support. Back-linked to metros via metro_id column.
**tenant_territories** — Many-to-many linking tenants to activated territories. Supports bundle_id for county bundles and activation_slots for pricing calculation.
**metros** — Geographic regions (legacy, preserved). All metros are auto-migrated into territories with territory_type = metro.
**metro_narratives** — AI-generated narrative summaries per metro.
**local_pulse_events** — Discovered community events from external sources.
**local_pulse_runs** — Crawl run history with stats (sources_checked, sources_cached, discovery_engine).
**local_pulse_sources** — User-added URLs with caching fields (last_checked_at, last_status, crawl_health_score).
**local_pulse_config** — Per-metro keyword and source configuration.
**Local Pulse Engine:** Discovery uses Perplexity (sonar) for web search; Firecrawl handles RSS/HTML scraping only. Source-level caching (24h) and metro-level cooldown (48h, 24h for active metros) reduce credit consumption.
**anchor_pipeline / anchors** — Strategic partner pipeline tracking.
**brevo_metro_lists** — Email list mappings per metro (legacy, retained for data).

**Territory Activation Slot Rules:**
- Metro: 1 slot per metro
- County: up to 5 counties within same state = 1 slot
- State: 1 state = 2 slots
- Country: 1 country = 1 slot
- Mission Field: 0 slots (free if parent country activated)
- Custom Region: 1 slot per region

**Solo Caregiver Base Location:** tenants.base_country_code, base_state_code, base_city — private, non-territorial, no activation slots consumed. Used for operator analytics only.`,
      },
      {
        id: 'operator-tables',
        title: '2.4 Operator & Platform Tables',
        content: `**automation_runs** — Canonical run log for all n8n workflows. Includes dedupe_key, inputs_hash, cooldown, retry tracking.
**provisions** (Prōvīsiō) — Internal technology requests from tenants.
**volunteers** (Voluntārium) — Volunteer profiles and lifecycle.
**activation_checklists / activation_checklist_items** — Tenant onboarding readiness tracking.
**activation_offers** — Consent-gated activation meeting offers.
**activation_sessions** — Purchased onboarding sessions (Stripe-linked).
**billing_products** — Stripe product/price mappings per tier.
**audit_log** — All entity mutations tracked (action, changes, user).
**app_event_stream** — Frontend analytics events (page views, errors, interactions).
**archetype_profiles / archetype_defaults** — Archetype behavior configuration.
**archetype_simulation_runs** — Simulation data for archetype testing.`,
      },
      {
        id: 'integration-tables',
        title: '2.5 Integration Tables (Relatio)',
        content: `**integration_connections** — OAuth connection records per tenant.
**integration_field_mappings** — Configurable field mapping per connector.
**integration_sync_runs / integration_sync_run_steps** — Sync audit trail with per-entity step logs.
**connector_adapters** — Adapter registry (HubSpot, Salesforce, Bloomerang, Google Contacts, Outlook, Monica CRM, Contacts+, Apple/iCloud, CiviCRM).

Each adapter implements: mapAccounts, mapContacts, mapTasks, mapEvents, mapActivities, metadata(). 31 connectors total; 7 support two-way sync (Salesforce, HubSpot, Dynamics 365, Blackbaud, Google Contacts, Outlook, CiviCRM).`,
      },
    ],
  },
  {
    id: 'edge-functions',
    title: '3. Edge Functions',
    sections: [
      {
        id: 'edge-overview',
        title: '3.1 Overview',
        content: `All edge functions run on Deno (Lovable Cloud). They handle auth-gated API logic, n8n callbacks, and service-role operations. Every function must:
- Validate Authorization header
- Return consistent JSON envelopes: { ok: true/false, ... }
- Handle CORS preflight (OPTIONS)
- Use AbortController for timeouts
- Be tested in supabase/functions/tests/`,
      },
      {
        id: 'edge-catalog',
        title: '3.2 Function Catalog',
        content: `**discovery-cron** — Unified internal scheduler (replaces 3 n8n cron workflows). Supports jobs: daily, weekly, momentum, intelligence, hourly. Auth-gated, time-bounded, with consistent step reporting.
**n8n-ingest** — Receives callbacks from n8n workflows. Validates envelope, normalizes payload, updates automation_runs. 65+ tests.
**n8n-dispatch** — Dispatches workflow requests to n8n. Handles cooldown, dedup, priority. 90+ tests.
**automation-gate** — Pre-flight validation for automation requests. Checks workflow key, cooldown, auth.
**lumen-detect** — Narrative signal detection for tenant activity patterns.
**generate-next-best-actions** — AI-powered action suggestions based on relationship context.
**detect-priority-moments** — Detects time-sensitive relationship moments across metro portfolios.
**monitor-automation-health** — System health check across automation pipelines.
**momentum-recalculate** — Batch recompute of momentum scores across all opportunities.
**momentum-alerts-evaluate** — Evaluates alert thresholds against latest momentum scores.
**generate-daily-intelligence-feed** — Produces daily intelligence briefing for stewards.
**recalculate-prospect-priority** — Re-scores prospect priority based on signals + activity.
**add-and-draft-outreach** — Creates contact + drafts email outreach in one transaction.
**grant-alignment-callback** — Callback handler for grant alignment automation.
**hubspot-push** — Pushes CROS data to HubSpot via adapter.
**parse-pdf-to-kb** — Extracts markdown from uploaded PDFs for Knowledge Base.
**ai-chat** — NRI assistant endpoint. Injects company KB context.
**stripe-webhook** — Handles Stripe payment events for activation sessions.
**create-checkout-session** — Creates Stripe checkout for activation purchases.

**n8n Cron Workflows Superseded:**
- momentum-nightly.json → discovery-cron { "job": "momentum" }
- cron-daily-intelligence-feed.json → discovery-cron { "job": "intelligence" }
- phase25-cron-nba-moments-health.json → discovery-cron { "job": "hourly" }`,
      },
      {
        id: 'shared-modules',
        title: '3.3 Shared Modules (_shared/)',
        content: `**companyKbContext.ts** — Loads active KB documents and formats them as system prompt blocks.
**cors.ts** — Standard CORS headers for edge functions.
**supabaseAdmin.ts** — Service-role Supabase client factory.`,
      },
    ],
  },
  {
    id: 'operator-console',
    title: '4. Operator Console',
    sections: [
      {
        id: 'zone-governance',
        title: '4.1 Five-Zone Governance',
        content: `The Operator Console is governed by five zones. No feature may be added without passing the Zone Gatekeeper Protocol.

**CURA (Living Work)** — Nexus workflows, signals, guidance, review surfaces. Pastoral and guiding. Only for "what should I do today?"
**MACHINA (System Engine)** — Configuration, automation monitoring, integration setup. Quiet and invisible.
**CRESCERE (Growth & Economics)** — Business, tenants, revenue, adoption momentum. Strategic but hopeful.
**SCIENTIA (Insight & Understanding)** — Pattern recognition, narrative insights. Human language only — no charts-first dashboards.
**SILENTIUM (Hidden Internal)** — Dev utilities, internal tooling. Never appears in main sidebar.

Rules:
- No new top nav groups
- One feature, one home (no duplicates across zones)
- CURA never contains settings, integrations, or dev tools
- All features must pass the Ignatian emotional experience check`,
      },
      {
        id: 'liturgical-states',
        title: '4.2 Liturgical Design States',
        content: `Every Operator surface aligns with one of four states:

1. **NOTICING** — Soft awareness. Signals presented gently.
2. **DISCERNING** — Context + narrative insight. Human language.
3. **ACTING** — Clear next steps. Small number of choices.
4. **RESTING** — Completion acknowledged. Calm empty states.

Anti-patterns: dev-style dashboards, chart-heavy panels, error-first experiences, loud KPI displays.`,
      },
    ],
  },
  {
    id: 'testing',
    title: '5. Testing & Quality',
    sections: [
      {
        id: 'test-strategy',
        title: '5.1 Test Strategy',
        content: `**Edge Functions:** Deno test suite in supabase/functions/tests/. 174+ tests covering:
- Auth gating (missing/invalid tokens)
- CORS compliance (OPTIONS preflight)
- Payload normalization and validation
- RBAC enforcement
- Replay protection and dedup fingerprinting
- Error envelope consistency

**Integration Confidence Ladder (6 Rungs):**
1. Adapter Contract Integrity — fixture-based mapping tests
2. Schema Drift Immunity — extra/renamed/missing field handling
3. Edge Function Resilience — mock endpoint testing
4. Runner Behavior — audit logs, dedup, rate limiting
5. Dry-Run Confidence — tenant preview before real import
6. Live Account Verification — optional, with real vendor accounts`,
      },
      {
        id: 'type-safety',
        title: '5.2 Type Safety Policy',
        content: `A centralized untypedTable() helper in src/lib/untypedTable.ts is the ONLY location for (supabase as any) casts. An ESLint rule fails the build if used elsewhere. Every use requires a // TEMP TYPE ESCAPE comment explaining the mismatch. Standard queries use fully typed supabase.from().`,
      },
    ],
  },
  {
    id: 'integrations',
    title: '6. Integrations (Relatio)',
    sections: [
      {
        id: 'connector-architecture',
        title: '6.1 Connector Architecture',
        content: `Each integration follows the ConnectorAdapter interface:
- mapAccounts() — normalizes partner/org records
- mapContacts() — normalizes people records
- mapTasks() — normalizes task/action items
- mapEvents() — normalizes calendar/event records
- mapActivities() — normalizes interaction logs
- normalizeGiving() — (optional) normalizes financial giving records into NormalizedGiving
- metadata() — returns connector capabilities and field schema

Adapters live in src/integrations/connectors/. Currently implemented (Rung 4 — full adapter):
- HubSpot (hubspotAdapter.ts)
- Salesforce (salesforceAdapter.ts)
- Bloomerang (bloomerangAdapter.ts) — includes normalizeGiving()
- Microsoft Dynamics 365 (dynamics365Adapter.ts)
- CiviCRM (civicrmAdapter.ts) — APIv4, includes normalizeGiving() for Contributions entity
- Airtable (airtableAdapter.ts)
- FluentCRM (fluentcrmAdapter.ts)
- JetpackCRM (jetpackcrmAdapter.ts)
- WP ERP (wperpAdapter.ts)

Stub adapters (Rung 1 — registry + onboarding guide):
- Virtuous CRM (donor_crm — elevated to Rung 2 planning given CROS target market)
- Oracle CRM (general_crm — OAuth 2.0 Client Credentials)
- Kindful (donor_crm — now Bloomerang-acquired)
- Zoho CRM (general_crm)
- Wild Apricot (membership platform)
- ParishSoft, MinistryPlatform, Planning Center, Rock RMS, Breeze, FellowshipOne, Pushpay/CCB, ShelbyNext, Servant Keeper (chms)

**Connector count:** 31+ registered connectors across CRM, Donor CRM, ChMS, Nonprofit, WordPress, Membership, and CSV categories.`,
      },
      {
        id: 'n8n-orchestration',
        title: '6.2 n8n Orchestration Rules',
        content: `All workflows must:
- Be delivered as importable JSON
- Be time-bounded
- Use "Continue On Fail" for network/LLM nodes
- Treat "no data" as valid success
- End in exactly ONE callback (success OR failure)
- Pass run_id through explicitly
- Use deterministic callback envelopes
- Handle minor schema drift defensively

A workflow stuck in "running" is a failure. No silent branches allowed.`,
      },
    ],
  },
  {
    id: 'marketing',
    title: '7. Marketing Site',
    sections: [
      {
        id: 'marketing-pages',
        title: '7.1 Public Pages',
        content: `**Landing Page (/)** — CROS manifesto, archetype selector, feature highlights, testimonials
**See People (/see-people)** — Reflection guide with downloadable PDF. Ignatian examen.
**Features (/features)** — Hybrid narrative + card hub. Includes RelationshipVsTransactionDiagram (CRM vs CROS philosophy), Financial Moments section, and RelationalFlowStrip (Reflection → Participation → Generosity → Collaboration rhythm).
**Pricing (/pricing)** — Tier comparison: Core, Insight, Story, Bridge. Financial Moments pricing (Stripe + 1% platform fee). RelationalFlowStrip.
**Public Tenant Mirror (/community/:slug)** — Public-facing tenant profile page
**Archetype Interest Signals** — Anonymous tracking of archetype exploration on landing page`,
      },
    ],
  },
  {
    id: 'ai-governance',
    title: '8. AI Governance (Shared Intelligence)',
    sections: [
      {
        id: 'unified-budget',
        title: '8.1 Unified AI Budget & Intelligence Layers',
        content: `CROS uses a **two-layer Intelligence Governance** model:

**Essential Intelligence (Unlimited):**
- Single-entry summaries, tone rewrites, basic reflections, structured aggregation
- No external research, no multi-step reasoning
- Never stops — available regardless of allowance

**Deep Intelligence (Metered):**
- Cross-entity synthesis, external research (Perplexity), drift detection, reports, compass full recalculation
- Monthly allowances: Core → 100, Insight → 250, Story → 600
- No rollover, resets monthly
- When exhausted, degrades to Essential mode gracefully

**Engines:**
- **Lovable AI** — Primary engine for all structured AI tasks (chat, suggestions, narrative generation). No API key required.
- **Perplexity (sonar-pro)** — Live web research for enrichment, grant discovery, metro news, watchlist ingestion.

**Tracking columns (tenant_usage_counters):**
- ai_calls — unified total
- ai_calls_lovable / ai_calls_perplexity / ai_calls_firecrawl — engine-specific
- deep_mode_calls / essential_mode_calls — intelligence layer counts
- ai_cost_estimated_usd — rate-card-based cost estimate (operator visibility only)

**Cost estimation (rate cards):**
- Lovable AI: $0.0005 / 1K tokens (platform-included, tracked for internal awareness)
- Perplexity (sonar-pro): ~$0.005 / request
- Firecrawl: ~$0.002 / credit
- Real token counts captured from API responses (not character-length estimates)

**Atomic counter upsert:** increment_usage_counter RPC uses a single INSERT...ON CONFLICT statement that increments ALL columns (ai_calls, tokens, cost, mode, engine) atomically — no separate UPDATE statements, no race conditions between concurrent calls.

**Engine attribution:** Four engine counters: ai_calls_lovable (NRI, chat, analysis), ai_calls_perplexity (search, discovery), ai_calls_firecrawl (scraping, RSS), ai_calls_gemini (Providence Engine stage 3 polish). Rate cards: $0.0005/1K Lovable tokens, $0.005/Perplexity request, $0.006/Firecrawl credit, $0.001/1K Gemini tokens.

**Workflow safety:** Unknown workflow keys default to 'deep' (metered) to prevent accidental unlimited usage.

**Workflow Attribution (ai_workflow_usage):**
- Per-call tracking by workflow_key, engine_used, intelligence_mode
- Feeds AI Observatory for cost analysis and simulation

**Operator Governance (operator_ai_budget):**
- force_essential_mode — emergency global Essential-only switch
- deep_allowance_core/insight/story — configurable per tier
- pause_drift_detection / pause_territory_crawls — background task governance`,
      },
      {
        id: 'safeguards',
        title: '8.2 Calm Safeguards',
        content: `AI capacity is governed with gentle safeguards rather than hard walls:

- **No per-prompt billing** — tenants never see token counts or cost estimates
- **No surprise overages** — Deep Insights degrade to Essential, never block
- **Soft awareness** at 80% usage: "You're approaching your included Deep Insights"
- **Critical notice** at 95%: "Nearly at your included Deep Insight limit"
- **Graceful degradation** at 100%: Essential mode activates, Compass switches to Light mode
- **Capacity grows with tier** — Core < Insight < Story
- **Gardener visibility** — AI Observatory shows burn, projections, tenant intensity, and governance controls
- **✦ Deep Insight badge** shown next to actions that consume Deep allowance

The marketing site communicates this as "Shared Intelligence Capacity" — never tokens, API calls, or engine names.`,
      },
      {
        id: 'nri-scope-guardrails',
        title: '8.3 NRI Scope Guardrails',
        content: `NRI is scoped exclusively to tenant-specific relational and organizational work. Three enforcement layers prevent misuse:

**Layer 1 — Client-side Pre-screening (src/lib/nri/scopeGuardrails.ts):**
- Pattern-based detection of off-topic, emotional, crisis, and professional advice messages
- Blocked messages never reach the edge function — gentle responses rendered locally
- Messages and guardrail responses are stored in chat history for transparency

**Layer 2 — Server-side Pre-screening (profunda-ai edge function):**
- Duplicate pattern checks before any AI call is made
- Returns immediately with guardrail response, no AI tokens consumed
- Catches any client-side bypass attempts

**Layer 3 — System Prompt Hardening:**
- Explicit scope boundary section in the NRI system prompt
- Lists exactly what NRI MAY discuss (tenant data, platform features, organizational records)
- Lists explicit refusal categories (general knowledge, creative writing, emotional support, professional advice, coding, politics, games, jailbreak)
- Template-based refusal responses to maintain Ignatian tone

**Blocked Categories:**
- Crisis topics → Compassionate redirect with 988 Lifeline, Crisis Text Line, SAMHSA
- Emotional support → Gentle redirect to professional resources
- Free-form / general knowledge → Redirect to organizational capabilities
- Professional advice (medical, legal, tax, financial) → Professional referral
- Prompt injection / jailbreak → Silent redirect to capabilities list
- Creative writing, coding, games, politics → Scope redirect

**Tests:** 44 Vitest tests covering allowed messages, all blocked categories, and prompt injection resistance.`,
      },
    ],
  },
  {
    id: 'security',
    title: '9. Security & Access Control',
    sections: [
      {
        id: 'rls-policy',
        title: '9.1 RLS Strategy',
        content: `Every table has Row Level Security enabled. Policies follow these patterns:

- **Tenant isolation:** WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
- **User ownership:** WHERE user_id = auth.uid()
- **Role gating:** WHERE role IN ('admin', 'regional_manager') via profiles join
- **Public read:** Only for marketing/public-facing tables (archetype_interest_signals, public_movement_cache)
- **Operator privacy boundary (database-enforced):** Sensitive recycle bin data (entity_name, snapshot) is stored in a separate \`recycle_bin_payloads\` table with RLS that DENIES operator/admin SELECT access. The main \`recycle_bin\` table contains only metadata (entity_type, tenant_id, timestamps). Tenant users access their own payloads via the \`recycle_bin_tenant_v\` view (SECURITY INVOKER). Recovery ticket context is sanitized via \`sanitizeRecoveryActions()\` before write. Safe operator query helpers are centralized in \`src/lib/safeOperatorQueries.ts\`. NRI assistant may use tenant data for narrative insight but the UI enforces strict separation.

Service-role writes (bypassing RLS) only occur inside Edge Functions with explicit auth validation.`,
      },
      {
        id: 'auth-flow',
        title: '9.2 Authentication Flow',
        content: `- Email + password signup with email verification (no auto-confirm)
- Google OAuth supported
- Session managed by Supabase Auth
- Protected routes wrapped in ProtectedRoute component
- Role-based route gating (admin routes use requiredRoles=['admin'])
- Anonymous signups are never used`,
      },
    ],
  },
  {
    id: 'performance',
    title: '10. Performance',
    sections: [
      {
        id: 'code-splitting',
        title: '10.1 Code Splitting',
        content: `60+ admin/operator routes use React.lazy() with Suspense boundaries. The LazyOperatorPages.tsx registry centralizes all lazy imports. The OperatorShell wrapper provides consistent Suspense fallback (Skeleton-based OperatorFallback).

Tenant-facing routes remain eagerly loaded for fastest initial paint.`,
      },
      {
        id: 'query-patterns',
        title: '10.2 Query Patterns',
        content: `- TanStack React Query with staleTime tuning per resource
- Paginated queries with server-side count for total
- Optimistic UI with adjustedTotal pattern (never double-subtract)
- Supabase 1000-row default limit accounted for in all list queries
- Loading states show stale data during refetch (never flash empty)`,
      },
    ],
  },
  {
    id: 'relationship-signals',
    title: '11. Relationship Signals',
    sections: [
      {
        id: 'relationship-signals-overview',
        title: '11.1 Overview',
        content: `**Relationship Signals** (formerly "Email Suggestions") surfaces NRI-detected follow-up actions from email conversations with partners. It helps stewards, shepherds, and companions stay present with the humans they're caring for — without manual tracking.

**Components:**
- useDashboardEmailSuggestions hook — fetches pending/accepted suggestions across all opportunities
- useEmailTaskSuggestions hook — per-opportunity suggestion list
- useAcceptSuggestion / useDismissSuggestion mutations — create care tasks or dismiss

**Tables:** email_task_suggestions
**Edge Functions:** email-actionitems-accept, email-actionitems-dismiss

**Access Control:** Lens-gated to steward, shepherd, and companion roles via useTenantLens(). Visitors do not see Relationship Signals.

**Surfaces:** Phase 23 consolidated all suggestion surfaces into the Compass drawer via useCompassSessionEngine. The standalone EmailSuggestionsCard has been retired from the dashboard.`,
      },
    ],
  },
  {
    id: 'garden-pulse',
    title: '12. Garden Pulse & Ecosystem Layers',
    sections: [
      {
        id: 'garden-pulse-overview',
        title: '12.1 Garden Pulse Overview',
        content: `Garden Pulse (/operator/nexus/garden-pulse) is the Gardener's primary visual ecosystem view. It reveals movement, presence, and story rather than performance metrics. Five layers:

1. **Constellation** — Tenant node graph grouped by Familia. Glow intensity reflects movement.
2. **Atlas** — Geographic metro presence with activity density overlays.
3. **Living Timeline** — Horizontal narrative ribbon following Noticing → Reflection → Movement rhythm.
4. **Seasonal Rhythm** — Liturgical/seasonal calendar (Advent, Lent, etc.) showing mission cadence.
5. **Storybook** — Emerging essay drafts and published reflections from Living Library.

**Silent Mode** removes all labels for a purely contemplative experience.

**Tables:** ecosystem_garden_pulse_view (aggregated), tenants, metros, testimonium_events
**Route:** /operator/nexus/garden-pulse`,
      },
      {
        id: 'providence-overlay',
        title: '12.2 Providence Overlay',
        content: `The Providence layer renders soft narrative threads connecting moments of care across the ecosystem. Gardener-only. Visible as golden thread lines on the Atlas and Constellation layers.

**Tables:** providence_signals (thread_type validation trigger)
**Privacy:** Only aggregated care moments — no PII, no tenant-identifying data.
**Toggle:** "Show narrative threads" in Garden Pulse header.`,
      },
      {
        id: 'compass-overlay',
        title: '12.3 Compass Overlay',
        content: `Compass directional overlay anchors four CROS values to cardinal directions:

- **North** — Narrative
- **East** — Discernment
- **South** — Care
- **West** — Restoration

Toggled via Garden Pulse header. Persists preference locally. Blends with Providence layer without visual competition.`,
      },
      {
        id: 'restoration-layer',
        title: '12.4 Restoration Narrative Layer',
        content: `When entities are restored from the recycle bin, calm narrative signals are emitted. These appear as soft gold accents in Garden Pulse.

**Tables:** restoration_signals (90-day retention, automatic cleanup)
**Hooks:** useRestorationSignals, useEmitRestorationSignal
**Privacy:** Aggregated phrases only — no PII, no entity names, no blame, no gamification.
**Tone:** "Moments of restoration — care remembered."`,
      },
      {
        id: 'public-movement',
        title: '12.5 Public Movement Constellation',
        content: `Tenants can opt into sharing anonymous movement signals for the public marketing constellation.

**Tables:** public_movement_cache (rate-limited, aggregated counts only)
**Onboarding:** PublicMovementOptInCard with HIPAA-aware toggles
**Marketing:** ConstellationEmbedSection on homepage — Atlas, Constellation, Providence, Compass windows
**Privacy:** Only aggregated counts. HIPAA disables excerpt sharing. Never PII.`,
      },
    ],
  },
  {
    id: 'gardener-studio',
    title: '13. Gardener Studio',
    sections: [
      {
        id: 'studio-overview',
        title: '13.1 Overview',
        content: `Garden Studio (/operator/nexus/studio) is a unified safe editing workspace for the Gardener. All edits follow a draft-first, version-tracked, audit-logged discipline.

**Tabs (current — 5 tabs):**
- **Library** — Essay CRUD with draft-first workflow, publishing controls, SEO metadata
- **Playbooks** — Markdown editor for ai_knowledge_documents with automated versioning
- **Voice & Tone** — NRI editorial calibration with Do/Don't rules and Before/After examples
- **Communio Directory** — Moderation panel for public-facing group profiles
- **Atlas** — Metro knowledge graph and expansion planning

**Note:** Notifications and Switches have moved to Platform Config (/operator/nexus/config). They are no longer in the Studio navigation.

**AI Assist Panel:** Ignatian-safe companion editing (Refine Tone, Simplify, Add Reflection, etc.). AI proposals are stored in editor_ai_suggestions and require explicit human acceptance.

**Tables:** library_essays, ai_knowledge_documents, ai_knowledge_document_versions, gardener_audit_log, editor_ai_suggestions
**Safety:** Draft-first, version history, rollback, audit log on every edit surface. Admin-only RLS.`,
      },
    ],
  },
  {
    id: 'recovery-intelligence',
    title: '14. Recovery & Restoration Intelligence',
    sections: [
      {
        id: 'action-breadcrumbs',
        title: '14.1 Action Breadcrumbs',
        content: `Privacy-safe action breadcrumbs log WHAT you did (not content) to help undo mistakes. Uses a strict allowlist — no PII, no content, no free-text.

**Tables:** app_event_stream (30-day retention with automatic cleanup)
**Privacy:** tenant_privacy_settings allows tenants to opt out of recent-action tracking.
**NRI Guide:** Shows recent actions and offers restore/undo guidance when asked. "I accidentally deleted something" quick prompt available.`,
      },
      {
        id: 'recovery-tickets',
        title: '14.2 Recovery Tickets',
        content: `The NRI assistant can open emergency recovery requests with context attached. The Gardener sees these in RecoveryTicketsPanel on the Recovery & Restoration page.

**Tables:** recovery_tickets
**Route:** /operator/nexus/recovery (two tabs: Recycle Bin + Recovery Requests)
**Tone:** "Nothing is lost here" — recovery trust signal shown in welcome overlay.`,
      },
    ],
  },
  {
    id: 'calm-digests',
    title: '15. Calm Digest System',
    sections: [
      {
        id: 'digest-overview',
        title: '15.1 Overview',
        content: `Living Pulse Digests deliver role-aware, Ignatian-structured narrative summaries by email.

**Structure:** Noticing → Reflection → Insight → Invitation
**Frequency:** Daily / Weekly / Monthly / Off (per-user preference)
**Role adaptation:** Content adapts to ministry role (Visitor, Companion, Shepherd, Steward)

**Tables:** user_digest_preferences (frequency, section toggles)
**View:** tenant_local_pulse_view (aggregated: visits, projects, voice notes, narrative signals)
**Edge Function:** notifications-generate-digest
**Sections:** Visits, Projects, Narratives, Network, Essays, Living Pulse, System`,
      },
    ],
  },
  {
    id: 'familia',
    title: '16. Familia (Organizational Kinship)',
    sections: [
      {
        id: 'familia-overview',
        title: '16.1 Familia Overview',
        content: `Familia™ represents organizational kinship — households of related organizations (e.g., a church network, a school district). NRI detects potential kinship through deterministic scoring across geo proximity, name similarity, archetype match, enrichment data, and communio co-membership.

**Tables:** familias, familia_memberships, familia_suggestions
**Onboarding:** Optional "Are you part of a larger household?" discernment step
**Settings:** Familia card — create, join, leave, view NRI suggestions
**Access model:** Creation/membership mutations are leadership-scoped (tenant admin or steward/admin role), while suggestions remain tenant-scoped.
**Gardener Insight Type:** familia_kinship — calm signals for emerging households`,
      },
      {
        id: 'familia-stewardship',
        title: '16.2 Familia Stewardship Layer',
        content: `Tenants can opt into sharing anonymized care signals across their Familia.

**Toggle:** familia_sharing_enabled in tenant settings ("Walking Together" card)
**View:** familia_provision_rollups — anonymized, HAVING ≥ 2 tenants, SECURITY INVOKER
**NRI Signals:** shared_resource_pattern, regional_need_shift, collective_response_emerging
**Privacy:** Local provisioning remains private; Familia sees only narrative patterns.`,
      },
    ],
  },
  {
    id: 'provisio-evolution',
    title: '17. Prōvīsiō (Stewardship Modes)',
    sections: [
      {
        id: 'provision-modes',
        title: '17.1 Provision Modes',
        content: `Prōvīsiō supports three modes based on organizational archetype:

1. **Care Tracking** (default) — Simple resource stewardship for most organizations
2. **Stewardship** — Enhanced inventory and distribution tracking (housing, workforce orgs)
3. **Social Enterprise** — Catalog and pricing capabilities for revenue-generating programs

**Tables:** tenant_provision_settings (tenant-scoped RLS)
**Settings:** "Shared Resources" card — choose mode, enable catalog and pricing toggles
**Sidebar:** Prōvīsiō appears under Partners only when mode exceeds simple care
**NRI Signals:** care_pattern_emerging, supply_pressure_warning, community_need_shift
**Archetype Defaults:** Housing/workforce → stewardship; social enterprise → enterprise`,
      },
    ],
  },
  {
    id: 'projects-activities',
    title: '18. Projects as Activities',
    sections: [
      {
        id: 'projects-overview',
        title: '18.1 Overview',
        content: `Projects (Good Work) are community service containers (food drives, home repairs, mission trips). They live as first-class activity types within the Activities page — not as a standalone module.

**Activity Types:** Project, Project Note, Visit, Visit Note
**Hierarchy:** parent_activity_id links project notes to their parent project
**Status:** project_status (Planned, In Progress, Done) with validation trigger
**Impact:** activity_impact table — lightweight snapshots (people_helped, attendance_count, outcome_note)

**Filters:** Activities page has Visit and Project filters, plus a "New Project" button
**Detail:** ProjectDetail page with reflections timeline, helper tracking, voice note support
**NRI:** "Good work in motion" signal from 3+ projects/week with story density tracking
**Testimonium:** Rollup fields — projects_count, project_notes_count, people_helped_sum, helpers_involved_count
**Drift Detection:** Flags when project creation is healthy but story capture (notes) drops`,
      },
    ],
  },
  {
    id: 'gardener-examen',
    title: '19. Gardener Examen',
    sections: [
      {
        id: 'examen-overview',
        title: '19.1 Overview',
        content: `The Gardener Examen establishes a daily contemplative rhythm for platform oversight, replacing traditional admin dashboards.

**Morning Examen** (/operator/nexus/examen/morning):
- Noticing — what moved overnight
- Gratitude — growth moments
- Attention — where care is needed
- Invitation — suggested focus for today

**Evening Examen** (/operator/nexus/examen/evening):
- Where Life Moved — activity summary
- Resistance — friction patterns
- Quiet Growth — unnoticed positive signals
- NRI Learning — what intelligence noticed

**Rules:**
- Presented only once per calendar day
- Calm Mode aesthetics: serif typography, warm neutrals
- No analytics charts, KPIs, or urgency markers
- Journal-like presence

**Tables:** gardener_insights, lumen_signals`,
      },
    ],
  },
  {
    id: 'compass-posture',
    title: '20. Compass Posture System (CROS Companion)',
    sections: [
      {
        id: 'compass-overview',
        title: '20.1 Overview',
        content: `The Compass Posture System replaces the previous chat icon with a compass-based orientation model for the CROS Companion (NRI assistant). The system has three layers:

**1. Compass Launcher (AIChatButton)**
- Floating compass icon replaces the Sparkles icon
- Soft halo glow (4s pulse, primary color at low opacity) when the companion detects "helpful movement"
- Glow is time-bounded (≤2 minutes) with a 3-minute cooldown to prevent spam
- aria-label: "Open CROS Companion"

**2. Compass Glow Logic (useCompassGlow hook)**
- Reads recent action breadcrumbs from app_event_stream
- Triggers on: entity_created, entity_deleted, entity_restored, import_completed, publish
- Never glows when drawer is already open
- Respects tenant privacy toggle (enable_recent_actions_for_assistant)
- Client-side only — no new database writes

**3. Compass Posture Inference (useCompassPosture hook)**
- Derives one of four postures from route + recent actions
- Priority: Restoration → Narrative → Discernment → Care (default)
- Always-visible posture label in drawer header at 70% opacity
- Label "breathes" to 90% opacity for ~4s on posture change

**Posture Mapping:**
| Posture | Routes | Signals |
|---------|--------|---------|
| Care (South) | /activities, /visits, /people, /events, /provisions | entity_created, entity_updated |
| Narrative (North) | /reports, /intelligence, /testimonium, /communio | narrative_surge |
| Discernment (East) | /settings, /integrations | Low confidence, uncertainty |
| Restoration (West) | Any route | entity_deleted, entity_restored (within 2min) |

**Files:**
- src/components/ai/AIChatButton.tsx — Compass launcher with glow
- src/components/ai/AIChatDrawer.tsx — Drawer with posture label
- src/hooks/useCompassGlow.ts — Glow detection hook
- src/hooks/useCompassPosture.ts — Posture inference hook
- src/lib/compassDirection.ts — Pure utility for direction mapping

**CSS:** compass-glow animation (index.css), posture-label-enter/rest transitions
**No new tables.** Uses existing app_event_stream with _action_breadcrumb filter.`,
      },
    ],
  },
  {
    id: 'companion-system',
    title: '21. Companion System',
    sections: [
      {
        id: 'companion-overview',
        title: '21.1 Overview',
        content: `CROS supports two Companion paths: Solo (independent) and Organization (team-based). The Companion archetype serves mentors, sponsors, caregivers, spiritual directors, coaches, and anyone who walks closely with others.

**Companion (Solo) Tier:**
- Free forever, pay-what-you-can support
- Private workspace for up to 10 active People
- Visit logs, voice notes, season summaries, and completion rituals
- No organization access unless the companion explicitly exports/shares
- Archetype key: caregiver_solo (database key retained for compatibility)

**Companion Organization Archetype:**
- Standard tenant archetype chosen during normal onboarding
- Invites companions as team members via standard invite flow
- Leadership sees metadata (counts, hours) — never private log content
- Archetype key: caregiver_agency (database key retained for compatibility)

**Activity Types Added:**
Visit, Check-in, Home Support, Transport, Appointment Support, Respite

**Database Changes:**
- activities: is_private (boolean), hours_logged (numeric)
- contacts: care_status (active/care_completed), completion_date, date_of_passing, closing_reflection
- season_summaries table: versioned narrative captures with publish_status (private/shared/exported)

**Privacy Model:**
- Per-entry is_private toggle (organization tenants)
- Private logs: author-only visibility, count toward totals but content hidden
- Season summaries: default private, optional share-to-organization or PDF export
- date_of_passing: never public, never in movement sharing

**Companion Completion Ritual:**
1. Optional closing reflection
2. Generate season summary (recommended)
3. Archive person (care_status → care_completed)
4. Constellation memory layer: dimmed star (tenant-only)

**Offboarding (Organization):**
- Configurable by organization Steward: retention policy when companion departs
- Options: logs stay, companion exports, or organization-defined policy

**One-Way Export (Solo → Organization):**
- Solo companions can push selected summaries to an organization they also belong to
- Never reverse: organization cannot pull from solo workspace

**Tables:** activities, contacts, season_summaries
**Components:** CarePrivacyToggle, SeasonSummaryCard, CareCompletionDialog
**Hook:** useSeasonSummaries`,
      },
    ],
  },
  {
    id: 'ch22',
    title: 'Chapter 22 — Life Events Ontology',
    sections: [
      {
        id: 'ch22-model',
        title: '22.1 Data Model',
        content: `Life Events are structured, privacy-aware records attached to a Person (contact).
They represent meaningful seasons: beginnings (birth, adoption, marriage), milestones (graduation, sobriety),
and endings (death, care completion, retirement).

**Table: life_events**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK | Tenant-scoped |
| person_id | uuid FK → contacts | |
| event_type | text | Validated via trigger |
| event_date | date | |
| title | text | Optional |
| description | text | Optional |
| visibility | text | private, tenant_only, familia_aggregate, communio_aggregate |
| created_by | uuid | Author |
| created_at | timestamptz | |

**Allowed event_type values:**
marriage, birth, adoption, graduation, ordination, retirement, anniversary,
milestone, sobriety_milestone, relapse, hospitalization, recovery, care_completed, death`,
      },
      {
        id: 'ch22-compass',
        title: '22.2 Compass Integration',
        content: `Each event_type maps to a Compass direction via the KIND_MAP in compassDirection.ts:

- **North (Narrative/Identity):** marriage, ordination, graduation, anniversary
- **East (Discernment/Becoming):** milestone, sobriety_milestone, recovery
- **South (Care/Presence):** birth, adoption, hospitalization
- **West (Restoration/Return):** care_completed, retirement, death, relapse

Creating a life event increments the tenant's Compass weight for that direction.`,
      },
      {
        id: 'ch22-privacy',
        title: '22.3 Privacy Rules',
        content: `- Private events: never appear in Compass publicly, Communio, or marketing embeds
- Death: default tenant_only, appears as dimmed star in Constellation memory layer
- Relapse: default private, no public Compass pulse
- All descriptions excluded from public movement cache
- RLS enforces: private events visible only to author; all others tenant-scoped

**Default visibility by type:**
| Type | Default |
|------|---------|
| relapse | private |
| hospitalization | private |
| death | tenant_only |
| all others | tenant_only |`,
      },
      {
        id: 'ch22-constellation',
        title: '22.4 Constellation Behavior',
        content: `Life events affect star behavior subtly and privately:
- Birth/Adoption: slight brightness increase
- Marriage: optional soft line between two nodes (tenant-only)
- Sobriety milestone: brief gentle pulse (tenant-only)
- Death: star transitions to dimmed memory state
- Relapse: no public indicator; Compass West pulse privately

Memory Layer toggle shows dimmed/archived stars; never public.

**Components:** LifeEventsSection, AddLifeEventDialog
**Hook:** useLifeEvents`,
      },
    ],
  },
  {
    id: 'bidirectional-sync',
    title: '23. Bi-Directional Sync & Dynamics 365',
    sections: [
      {
        id: 'ch23-overview',
        title: '23.1 Overview',
        content: `CROS now supports bi-directional sync with four major enterprise CRMs. Sync direction is controlled per-tenant by Shepherds.

**Architecture:**
- **Inbound:** ConnectorAdapter normalizes vendor → CROS (existing pattern)
- **Outbound:** OutboundAdapter denormalizes CROS → vendor format
- **Conflicts:** sync_conflicts table with flag-for-review resolution
- **Transport:** Direct Edge Function → Vendor API (no n8n dependency)
- **Edge Function:** relatio-outbound-sync handles denormalization, conflict detection, and push
- **Direction Config:** relatio_sync_config table per tenant/connector (Shepherd-only write)

**Supported connectors for 2-way sync (7 total):**
- Salesforce (REST API + OAuth 2.0)
- Microsoft Dynamics 365 (OData v4 + OAuth 2.0 via Azure AD)
- HubSpot (CRM API v3 + API Key)
- Blackbaud RE NXT (SKY API + OAuth 2.0, requires subscription key + OAuth)
- Google Contacts (People API + OAuth 2.0)
- Microsoft Outlook (Microsoft Graph + OAuth 2.0)
- CiviCRM (APIv4 + API Key)

**Outbound entities:** account, contact, task, event, activity, stage

**Shepherd Sync Direction Toggle:**
- relatio_sync_config table: tenant_id, connector_key, sync_direction, conflict_resolution, enabled
- RLS: any tenant member can read; only Shepherds/Stewards can modify
- UI: inline toggle on ConnectorCard + dedicated Sync Direction tab in Operator Integrations
- Conflict resolution strategies: flag_for_review (default), cros_wins, remote_wins`,
      },
      {
        id: 'ch23-dynamics365',
        title: '23.2 Microsoft Dynamics 365 Adapter',
        content: `Full ConnectorAdapter implementation for Dynamics 365 OData v4 export data.

**Authentication:** OAuth 2.0 client credentials flow via Azure AD
- Requires: Azure Tenant ID, Client ID, Client Secret
- Token endpoint: POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token
- Rate limit: 6,000 req / 5-min sliding window

**Field mapping (Dynamics → CROS):**
| Dynamics Field | CROS Field |
|---|---|
| contactid / accountid | external_id |
| firstname + lastname | name |
| emailaddress1 | email |
| telephone1 / mobilephone | phone |
| jobtitle | title |
| address1_line1 | address |
| address1_city | city |
| address1_stateorprovince | state |
| address1_postalcode | postal_code |
| parentcustomerid | account_external_id |
| statecode | status (0=Active, 1=Inactive) |

**Change tracking:** Dynamics supports delta links via Prefer: odata.track-changes header.
**Pagination:** Server-driven via @odata.nextLink (5,000 records per page).

**Files:** dynamics365Adapter.ts, dynamics365Outbound.ts`,
      },
      {
        id: 'ch23-conflict-resolution',
        title: '23.3 Conflict Resolution',
        content: `When a record is edited in both CROS and the external CRM between sync cycles, a conflict is created.

**Strategy:** Flag for review (human-in-the-loop)
- Conflicts stored in sync_conflicts table
- Each conflict shows: CROS data, remote data, conflicting fields
- Resolution options: accept_cros, accept_remote, merged, dismissed

**Table: sync_conflicts**
- tenant_id, connector_key, entity_type, entity_id, external_id
- cros_data (jsonb), remote_data (jsonb), conflicting_fields (text[])
- resolution: pending | accept_cros | accept_remote | merged | dismissed
- RLS: tenant-scoped, steward-managed

**Table: sync_direction_config**
- tenant_id, connector_key, sync_direction (inbound | outbound | bidirectional)
- outbound_entities (text[]), webhook_url, delta_token
- RLS: tenant-scoped, steward-managed`,
      },
      {
        id: 'ch23-outbound-architecture',
        title: '23.4 Outbound Architecture',
        content: `OutboundAdapter interface (outboundTypes.ts) defines:
- denormalizeAccount/Contact/Task/Event/Activity → OutboundPayload
- detectConflicts → FieldDiff[]
- Each payload includes: endpoint, method (POST/PATCH), body, externalId

**Edge Function: relatio-outbound-sync**
- Receives entity change payload (tenant_id, connector_key, entity_type, entity_id, action, cros_data)
- Looks up sync_direction_config for vendor credentials
- Denormalizes via built-in adapter logic
- For updates: fetches remote record, runs conflict detection
- If conflicts found → inserts sync_conflicts row, does NOT push
- If clean → pushes directly to vendor API with AbortController timeout
- Logs every run in automation_runs with deduplication

**Direct sync flow (no n8n):**
1. CROS record saved → client calls relatio-outbound-sync edge function
2. Edge function denormalizes data to vendor format
3. Edge function fetches remote record for conflict check
4. If conflicts → flagged for Steward review
5. If clean → pushed directly to vendor API
6. Result logged in automation_runs`,
      },
    ],
  },
  {
    id: 'signum-territory',
    title: '24. Signum Territory-Aware Discovery',
    sections: [
      {
        id: 'ch24-overview',
        title: '24.1 Territory-Aware Filtering',
        content: `Signum discovery now filters results by the tenant's activated territories (tenant_territories + territories join) rather than a single metro.

**Archetype behavior:**
- **Organization archetypes** — filter by activated territories (metro, county, state)
- **Missionary orgs** — filter by activated country, optional mission_field refinement
- **Rural orgs (county bundle)** — filter within selected counties, state fallback at 0.7 weight
- **Solo caregivers** — filter by base_state_code only, no territory activation, no expansion prompts

**Hook:** useTenantTerritories (src/hooks/useTenantTerritories.ts)
- Fetches activated territories for the current tenant
- Provides archetype-sensitive labels (getTerritoryLabel, getScopeLabel)`,
      },
      {
        id: 'ch24-relevance',
        title: '24.2 Relevance Scoring Engine',
        content: `Located at src/lib/discovery/territoryRelevance.ts

**Score formula:**
territory_match_weight + archetype_alignment + NRI_signal + communio_overlap + momentum

**Territory weights:**
- metro exact match: 1.0
- county exact match: 0.85
- custom_region match: 0.75
- state match: 0.7
- country match: 0.6
- mission_field match: 0.6
- outside territory: 0.2 (0.5 if expandBeyond toggled)
- caregiver base_state match: 1.0

**Match type derivation:** Based on territory_type, not weight magnitude.

**Score cap:** Final score capped at 1.0.

**Files:** territoryRelevance.ts, FindPage.tsx, DiscoveryBriefingPanel.tsx`,
      },
      {
        id: 'ch24-content-reports',
        title: '24.3 Content Reporting (content_reports)',
        content: `Abuse reporting table for Communio profiles and shared content.

**Table: content_reports**
- reporter_id (uuid, not null)
- reported_entity_type (text: 'profile' | 'signal' | 'event')
- reported_entity_id (uuid)
- reason (text)
- status (text: pending → reviewed → resolved → dismissed)
- reviewer_id, reviewer_notes, resolved_at
- Validation trigger enforces status enum

**RLS:**
- Authenticated users can INSERT their own reports
- Only leadership/admin can SELECT and UPDATE

**Component:** ReportProfileButton.tsx inserts into content_reports`,
      },
      {
        id: 'movement-intelligence',
        title: 'Movement Intelligence Dashboard',
        content: `**Version:** 2.7.1 (Hardened)

The /intelligence route replaces the legacy /analytics (Profunda-era) dashboard with a territory-aware, compass-integrated movement intelligence view.

**Hardening (v2.7.1):**
- Centralized time window: all sections use getMovementWindow() from src/lib/movementWindow.ts — no hardcoded date ranges
- Aggregation: ≤3 DB roundtrips via parallel Promise.all batches in useMovementIntelligence.ts
- Double-count protection: dev-mode overlap detection warns if events appear in both Care and Activation at >10% overlap
- Performance guard: soft console warning if total query time exceeds 800ms (dev only)
- Per-card loading skeletons: each section shows its own named skeleton during load
- Life event extension slots: Restoration section includes milestoneEvents and memorials breakdown from life_events table
- Archetype isolation: solo caregivers never see Territory Vitality card; missionaries never see Metro labels; rural orgs never see Metro Readiness

**Seven Dashboard Sections:**
1. **Territory Vitality** — Activated territories, activity density, momentum trend. Solo caregivers see "Care Rhythm" instead.
2. **Care & Presence Flow** — Projects, events, provisions, visits, hours logged, reflections.
3. **Relationship Formation** — New people, Communio interactions, partner connections.
4. **Activation & Engagement** — Territory engagement depth, event density, volunteer participation.
5. **Discovery & Discernment** — Opportunities explored, grants pursued, discovery conversion.
6. **Restoration & Memory** — Records restored, life events, memorials, milestones, recovery signals.
7. **Narrative Threads** — Providence summaries, Compass dominant direction, NRI quarterly narrative.

**Key Files:**
- src/lib/movementWindow.ts — centralized period resolver
- src/hooks/useMovementIntelligence.ts — data hook
- src/pages/MovementIntelligence.tsx — page component
- src/lib/__tests__/movementIntelligence.test.ts — hardening tests

**Route:** /:tenantSlug/intelligence (also /:tenantSlug/analytics for backward compat)`,
      },
    ],
  },
  {
    id: 'relational-orientation',
    title: '22. Relational Orientation & Unified Entity Architecture (Phase 22Ω)',
    sections: [
      {
        id: 'orientation-system',
        title: '22.1 Relational Orientation System',
        content: `## Relational Orientation

Tenants now declare a **relational orientation** that controls UI density, compass weighting, and narrative richness.

**Orientations:**
- **human_focused** — People carry rich narrative; Partners are lighter (people_richness=3, partner_richness=1)
- **institution_focused** — Partners carry rich narrative; People are operational (people_richness=1, partner_richness=3)
- **hybrid** — Both carry full narrative richness (both=3)

**Database Columns (tenants table):**
- relational_orientation TEXT (human_focused | institution_focused | hybrid)
- people_richness_level INT (1 or 3)
- partner_richness_level INT (1 or 3)
- auto_manage_richness BOOLEAN — when true, richness auto-adjusts with orientation changes

**RPC:** \`set_relational_orientation(p_tenant_id, p_orientation, p_auto_manage)\`
- SECURITY DEFINER, validates tenant membership + tenant-scoped role (admin/regional_lead)
- If auto_manage=true, sets richness defaults; if false, only updates orientation
- Writes audit trail to \`tenant_orientation_audit\` table on every change

**Audit Table:** \`tenant_orientation_audit\`
- Records actor_id, old/new orientation, old/new richness levels, auto_manage before/after
- RLS: viewable by admin/regional_lead; inserts only via SECURITY DEFINER function

**Key Files:**
- src/hooks/useRelationalOrientation.ts — reads orientation from TenantContext
- src/hooks/useEntityRichness.ts — effective richness with per-entity overrides + clearOverride
- src/hooks/useRichnessEligibility.ts — threshold-based upgrade suggestion (fed into CompassSessionEngine)
- src/components/entity/EntityDetailLayout.tsx — adaptive flat/tabbed renderer
- src/components/entity/RichnessExplanation.tsx — steward-visible "why this view" popover with reset
- src/components/onboarding/RelationalFocusStep.tsx — onboarding step
- src/components/settings/RelationalFocusCard.tsx — settings card (uses query invalidation, no page reload)
- src/pages/operator/OrientationDebugPage.tsx — Machina aggregate orientation observatory
- scripts/verify_phase_22omega.sql — canonical DB verification script

**Stabilization (22Ω Hardening):**
- entity_richness_overrides.created_by tracks who set the override
- Orientation change in Settings invalidates tenant/compass/richness queries (no page reload)
- RichnessExplanation popover shows source (tenant default vs override), orientation, and allows reset
- Gardener Orientation Observatory at /operator/machina/orientation shows aggregate distribution only
- SeasonalEchoCard double-gated: settings enabled + non-dismissed candidates must exist

**Phase 23 (Compass Convergence):**
- RichnessSuggestionBanner retired from EntityDetailLayout; richness eligibility now feeds into CompassSessionEngine
- All dashboard suggestion cards (NextBestActionsCard, EmailSuggestionsCard, DeepInsightBanner, NriBadge, NRI Reflection banner) retired
- Unified nudge surface via TodaysMovementSection in Compass drawer
- Auto-open logic with 8h cooldown (useCompassAutoOpen)`,
      },
      {
        id: 'life-events-polymorphism',
        title: '22.2 Life Events Polymorphism',
        content: `## Polymorphic Life Events

Life events now support both Person and Partner entities via canonical (entity_type, entity_id) columns.

**Schema Changes:**
- person_id: now NULLABLE (legacy shadow column)
- entity_type TEXT: 'person' or 'partner' (canonical, enforced by CHECK constraint)
- entity_id UUID NOT NULL: canonical entity reference
- CHECK \`chk_entity_type_allowed\`: entity_type IN ('person','partner')
- CHECK \`chk_person_shadow_sync\`: ensures person_id = entity_id when entity_type='person', NULL otherwise
- Trigger \`life_events_entity_sync\`: enforces person_id sync at runtime

**Backward Compatibility:**
- Existing reads by person_id continue to work
- New writes use entity_type + entity_id (trigger syncs person_id)
- useLifeEvents hook accepts entityType parameter (default 'person')

**Key Tables:**
- life_events (updated with CHECK constraints)
- entity_richness_overrides (new)`,
      },
      {
        id: 'compass-recalibration',
        title: '22.3 Compass Recalibration',
        content: `## Orientation-Aware Compass

The compass system now adjusts signal weighting based on tenant relational orientation.

**Function:** \`buildOrientedWeights(kinds, orientation)\` in compassDirection.ts
- human_focused: visits/life_events weighted 2x, partner signals 0.5x
- institution_focused: partner/grants weighted 2x, life_events 0.3x
- hybrid: all weighted equally (1x)

This affects dominant direction, glow intensity, and narrative phrasing without any visible UI indicator of the weighting logic.`,
      },
      {
        id: 'archive-seasonal-echo',
        title: '22.4 Archive & Seasonal Echo System',
        content: `## Seasonal Echo System

Conservative pattern detection for recurring rhythms and anniversaries.

**Tables:**
- archive_suggestion_candidates: detected patterns (no AI, nightly batch)
- archive_reflections: Ignatian-structured drafts (Noticing, Gratitude, Movement, Invitation)
- narrative_influence_events: logs when echoes influence compass phrasing

**UI:** SeasonalEchoCard in Compass drawer shows max 3 candidates with dismiss + generate reflection actions.

**Tenant Setting:** seasonal_echoes_enabled (default true) in tenant_settings.

**Key Principle:** Zero candidates is a valid, successful outcome. No noise.`,
      },
    ],
  },
  {
    id: 'phase-23-compass-convergence',
    title: '23. Phase 23 — Compass Convergence Engine',
    sections: [
      {
        id: 'compass-convergence-overview',
        title: '23.1 Overview',
        content: `## Compass Convergence Engine (v2.8.0)

Phase 23 unifies ALL tenant nudges, suggestions, and friendly dashboard cards into the Compass system. The Compass becomes the single interpretive + directive surface in the tenant experience.

**Retired Surfaces:**
- NextBestActionsCard (dashboard)
- EmailSuggestionsCard (dashboard)
- DeepInsightBanner (dashboard)
- NriBadge (dashboard)
- NRI Reflection inline banner (dashboard)
- EmailInsightsCard (dashboard sidebar)
- RichnessSuggestionBanner (EntityDetailLayout)
- StorySuggestionsPanel (MetroDetailPanel)

**New Components:**
- useCompassSessionEngine.ts — unified evaluation hook aggregating overdue actions, stagnant relationships, life events, email suggestions, next-best-actions, AI usage awareness, and tenant error awareness
- TodaysMovementSection.tsx — calm nudge cards inside Compass drawer (max 3, day-dismissible)
- useCompassAutoOpen.ts — auto-opens drawer on login when nudges exist (8h cooldown, respects daily dismissals)

**Nudge Directions:** care, expansion, restoration, steadfastness
**Nudge Types:** reflection, action, awareness
**Orientation-Aware Tone:** Messages adapt to human_focused / institution_focused / hybrid

**Rules:**
- No forced modals or hard interruptions
- No urgency language or red UI
- No raw weighting math exposed to tenants
- Maximum 3 nudges per session
- Sorted by confidence DESC → direction weight → recency
- System errors auto-open Compass via 'cros:system-error' custom event from operatorErrorCapture
- Error email digest checks both user_roles AND tenant_users for Gmail-connected admins`,
      },
    ],
  },
  {
    id: 'providence-engine',
    title: '24. Providence Engine (Phase 24)',
    sections: [
      {
        id: 'providence-overview',
        title: '24.1 Overview',
        content: `The Providence Engine synthesizes long-arc tenant movement into seasonal reflections. It produces three outputs:
1. **Private Providence** — Deep Ignatian narrative for the tenant's internal use
2. **Shareable Providence** — Export-ready PDF for leadership or funders
3. **Constellation Signal** — Anonymized aggregate for Gardener ecosystem view

**Architecture:** Deterministic rule-based analysis (Stage 1 + 2) with a single AI call for narrative polish (Stage 3).`,
      },
      {
        id: 'providence-tables',
        title: '16.2 Database Tables',
        content: `**providence_reports** — Tenant-scoped seasonal arc reports
- Columns: id, tenant_id, season_label, dominant_direction, classification, arc_summary_json, narrative_private, narrative_shareable, generated_at, period_start, period_end, trigger_type, version, created_by
- RLS: is_tenant_member(tenant_id, auth.uid())
- Versioned: regeneration increments version, never overwrites

**providence_constellation_signals** — Anonymized aggregate for Gardener
- Columns: id, region_key, archetype, dominant_direction, classification, intensity, generated_at
- NO tenant_id, NO PII
- RLS: admin-only read/insert`,
      },
      {
        id: 'providence-engine-stages',
        title: '16.3 Engine Stages',
        content: `**Stage 1 — Structural Arc Analysis (No AI)**
- Direction Frequency Matrix (30/90/180/365 day breakdown)
- Life Event Distribution (clusters, first occurrences)
- Relationship Movement (new entities, reactivations, closures)
- Territory Movement (activations, contractions)
- Signal Rhythm (burst patterns, silence detection, cadence)

**Stage 2 — Season Classification (Rule-Based)**
Classifications: Threshold Crossing, Restorative Season, Expansion Cycle, Quiet Faithfulness, Deep Care, Reawakening, Burst Season, Steady Movement

**Stage 3 — AI Narrative Polish (Single Call)**
- Input: structured arc summary + orientation + archetype
- Output: privateNarrative + shareableNarrative
- Model: google/gemini-2.5-flash
- Constraint: No fact invention, no numeric exaggeration, Ignatian tone`,
      },
      {
        id: 'providence-triggers',
        title: '16.4 Trigger Logic',
        content: `**Quarterly:** On first login after quarter end or scheduled job
**Arc-Shift:** Dominant direction change persisting 30+ days
**Manual:** "Generate Providence" button in Compass (Steward/Shepherd only)

Reports are never auto-opened. Compass shows a collapsible section.
Versioning: same-quarter regeneration increments version number.`,
      },
      {
        id: 'providence-revelation',
        title: '16.5 Subtle Revelation Layer',
        content: `**Purpose:** When Providence detects a meaningful arc shift, the system marks a 30-day "revelation window" that subtly influences Compass tone and weighting.

**Database Columns (on providence_reports):**
- revelation_start TIMESTAMPTZ NULL
- revelation_end TIMESTAMPTZ NULL
- revelation_type TEXT NULL — one of: threshold_crossing, re_emergence, first_activation, restorative_shift

**Qualifying Classifications:**
- Threshold Crossing → threshold_crossing
- Reawakening → re_emergence
- Expansion Cycle (with territory activation) → first_activation
- Restorative Season (with death cluster) → restorative_shift

**Compass Behavior During Active Window:**
1. Dominant direction nudges get +5% confidence bias (capped at 70%)
2. Exactly one reflective nudge inserted per session (moderate confidence, contemplative tone)
3. Tone adjusts by orientation: human → reflective, institution → strategic recognition, hybrid → balanced contemplative
4. Max 3 nudges per session maintained; revelation replaces lowest-confidence if needed

**Guardrails:**
- One active window per tenant at a time
- No stacking — regeneration during active window does not create a second
- Auto-expires after 30 days with zero residual state
- Never triggers notifications, modals, or workflow interruptions
- Never exposes raw metrics or counts`,
      },
      {
        id: 'phase-26-first-30-day-calibration',
        title: '16.6 First 30-Day Experience Calibration',
        content: `**Purpose:** Tunes the first 30 days of a new tenant experience to increase interpretive sensitivity, prevent emotional quietness, generate one meaningful narrative reflection, and encourage momentum without artificial signals.

**Utility (src/lib/tenantAge.ts):**
- \`getTenantAgeDays(createdAt)\` — whole days since tenant creation
- \`isFirstMonth(createdAt)\` — true for days 0–30
- \`isFirstTwoWeeks(createdAt)\` — true for days 0–14
- \`getWeeklyReflectionPrompt(createdAt)\` — rotating reflection prompt per week

**Compass Sensitivity (Phase B):**
- During first month: signal weight multiplied by 1.25
- Minimum directional shift threshold lowered from 3 actions to 1
- All adjustments are runtime-only — no stored modified values

**Foundational Posture (Phase C):**
- Days 0–14 with no dominant direction: Compass inserts a soft Care nudge ("You're at the beginning of something")
- Confidence: low (0.35), presentation-layer only — not stored

**Foundational Providence (Phase D):**
- Days 21–30: auto-generates first Providence entry if tenant has ≥3 meaningful actions and no existing report
- trigger_type = "foundational", classification = "Foundational"
- AI prompt is shorter, grounded, affirming — no season classification
- Stored with \`foundational = true\` flag on providence_reports

**Dead Surface Prevention (Phase E):**
- If no signal-driven nudges exist during month 1, one weekly reflection prompt surfaces
- Examples: "What feels most alive in your work right now?", "Who received the most of your attention this week?"
- These are reflection-only — no tasks, no performance tone

**Auto-Sunset (Phase F):**
- All calibration deactivates at day 31+ via pure runtime age check
- No feature flags, no stored state

**Guardrails:**
- No artificial events created
- No inflated confidence values
- No Constellation changes
- No archive logic changes
- AI call volume increase < 5% baseline`,
      },
    ],
  },
  {
    id: 'generosity',
    title: 'Generosity — Relational Financial Memory',
    sections: [
      {
        id: 'generosity-overview',
        title: 'Overview',
        content: `Generosity is a CROS Core feature for relational memory of financial giving. It is NOT donor management.

**Architecture:**
- \`contacts.has_given_financially\` (boolean toggle)
- \`generosity_records\` table: gift_date, amount, is_recurring, recurring_frequency, note
- RLS: tenant-scoped via is_tenant_member()
- Generosity data lives in a separate domain layer — firewalled from NRI narrative, drift detection, and journey chapters

**NRI Firewall:**
- NRI must NOT prioritize people by gift size
- NRI must NOT generate donor optimization prompts
- NRI must NOT use amounts in narrative output
- Compass may answer factual queries only (who gave, when, totals)

**NRI Org-Level Generosity Rhythm Signal (Firewall-Safe):**
- \`nri-generate-signals-weekly\` generates a quarterly aggregate "generosity_rhythm" signal per tenant
- Queries only aggregate counts + recurring percentage — NO per-person data, NO amounts, NO rankings
- Signal kind: "celebration" — e.g. "Generosity rhythm is steady" or "Your community is holding this work together"
- Evidence contains only: total_gifts_quarter, recurring_pct, time_window
- Dedupe key: \`generosity_rhythm:{tenant_id}:{week_start}\`

**Board Report:**
- "Those Who Gave" at /reports/those-who-gave
- Timeframe-filtered, alphabetical, printable
- No charts, no KPIs, no retention analytics

**Dec 31 Compass Prompt:**
- First login of Dec 31: "These are the people who chose to give this year."
- Offers action: "Draft a note of gratitude" → links to report

**Bridge Migration Mode:**
- "Retain core giving history only" imports: person, email, phone, date+amount, recurring, lifetime total
- Discards: campaigns, appeals, segmentation, wealth scores, pledges, fund accounting

**Giving Adapters (normalizeGiving) — 5 adapters:**
- ConnectorAdapter extended with optional normalizeGiving() method
- NormalizedGiving: { date, amount, is_recurring, recurring_interval, note, warnings }
- Bloomerang: REST API, Bearer auth, offset pagination, filters Donation + RecurringDonationPayment
- NeonCRM: REST v2.11, HTTP Basic (OrgID:APIKey), page-based, filters SUCCEED/Settled
- DonorPerfect: Legacy XML API, apikey param, date-window chunking (max 500), MM/DD/YYYY → ISO conversion
- Little Green Light: REST, Bearer token, offset/limit, amount is string (must cast), 300 calls/5min rate limit
- CiviCRM: APIv4, Contributions entity, contribution_status_id:label = Completed filter, frequency_unit mapping (month→monthly, year→annually, week→weekly; "day" has no CROS equivalent — emits normalization warning)

**Giving CSV Importers:**
- GivingCSVImporter: generic with auto-detection for giving columns
- BloomerangGivingImporter: preset for FundName, CampaignName, IsRecurring columns
- NeonCRMGivingImporter: preset for donationDate, donationStatus columns
- DonorPerfectGivingImporter: preset for gift_date, record_type, gl_code columns
- LGLGivingImporter: preset for received_on, fund_name, appeal_name columns
- normalizeCsvColumns extended with 'giving' CsvType

**Integration Audit Report:**
- PDF export at Reports → Integration Audit button
- Documents all ${String(31)}+ connectors, confidence rungs, giving support, known gaps`,
      },
    ],
  },
  {
    id: 'nri-financial-event-signals',
    title: 'NRI Financial & Event Signal Integration',
    sections: [
      {
        id: 'nri-event-attendance-signals',
        title: 'Event Attendance Journey Signals',
        content: `NRI generates story signals from event registrations to surface community gathering momentum.

**Edge Function:** nri-generate-signals-weekly
**Source Table:** event_registrations (joined with events for paid status)

**Signal: Community Gathering (celebration)**
- Fires when ≥5 registrations across ≥2 events in a week
- Evidence: registration_count, event_count, time_window
- Dedupe: \`event_gathering:{tenant_id}:{week_start}\`

**Signal: Paid Event Attendance (connection)**
- Fires when ≥1 paid event registration in a week
- Evidence: paid_registration_count, paid_event_count, time_window
- Dedupe: \`paid_event_attendance:{tenant_id}:{week_start}\`

**Firewall Compliance:** Signals use counts only — no individual names, amounts, or rankings.`,
      },
      {
        id: 'nri-generosity-rhythm',
        title: 'Org-Level Generosity Rhythm Signal',
        content: `NRI generates a quarterly aggregate generosity rhythm signal per tenant.

**Edge Function:** nri-generate-signals-weekly
**Source Table:** generosity_records (aggregate queries only)
**Signal Kind:** celebration

**Triggers when:** ≥3 generosity records in trailing 90 days
**Evidence:** total_gifts_quarter, recurring_pct (percentage), time_window
**Dedupe:** \`generosity_rhythm:{tenant_id}:{week_start}\`

**FIREWALL — Strictly enforced:**
- NO per-person data in evidence
- NO gift amounts in signal output
- NO donor rankings or prioritization
- Only aggregate count + recurring percentage`,
      },
      {
        id: 'operator-paid-event-maturity',
        title: 'Paid-Event Team Maturity (Operator/Scientia)',
        content: `The Operator receives insight notes when tenants adopt paid events.

**Edge Function:** nri-analytics-sense
**Target Table:** operator_insight_notes
**Signal Type:** maturity_signal

**Triggers when:** Any tenant creates a paid event in trailing 7 days
**Evidence:** tenants_with_paid_events count, paid_events_created count
**Deep Link:** /operator/scientia/adoption

**Purpose:** Helps the Operator understand growing financial maturity across the ecosystem.`,
      },
    ],
  },
  {
    id: 'tone-charter',
    title: 'Tone & Language Charter',
    sections: [
      {
        id: 'tone-overview',
        title: 'Charter Overview',
        content: `The CROS™ Tone & Language Charter (src/lib/toneCharter.ts) governs all user-facing copy, system messaging, Compass language, and friction moments.

**Core Identity:** Pastoral, steady, human-centered.
**Never:** Corporate, gamified, transactional, urgent, manipulative.

**Foundational Principles:**
1. Assume good intent
2. Never shame
3. Never rush
4. Never gamify
5. Never exaggerate urgency
6. Always preserve dignity
7. Prefer continuity over productivity`,
      },
      {
        id: 'tone-vocabulary',
        title: 'CROS Vocabulary',
        content: `SaaS terms are replaced with CROS equivalents:
- Saved → Held
- Success → Noted
- Completed → Follow-through recorded
- Deleted → Removed
- No data → Every relationship begins somewhere
- Overdue → Waiting
- Inactive → The thread is still here
- Loading → Still gathering the thread…

**Banned Words:** Boost, Optimize, Crush, Dominate, High-performing, Top donor, Pipeline, Major donor, High-value

**Confirmation Words (only these):** Noted. Held. Updated. Recorded.`,
      },
      {
        id: 'tone-utilities',
        title: 'Implementation Utilities',
        content: `**crosToast (src/lib/crosToast.ts):**
Charter-compliant toast notifications. Import instead of raw sonner toast.
- crosToast.held() — autosave / save confirmation
- crosToast.noted(desc) — generic acknowledgment
- crosToast.updated(desc) — update confirmation
- crosToast.recorded(desc) — action recorded
- crosToast.removed(desc) — deletion
- crosToast.gentle(msg) — error replacement (no alarm)

**useAutosave (src/hooks/useAutosave.ts):**
Universal autosave hook with debounced sessionStorage, draft recovery, and "Held." confirmation. Wire into any form with long-form text.

**calmMode (src/lib/calmMode.ts):**
Expanded with charter vocabulary. Maps harsh system language to warm phrasing.`,
      },
    ],
  },
  {
    id: 'accessibility-mode',
    title: '25. Accessibility Mode (WCAG 2.2 AA)',
    sections: [
      {
        id: 'a11y-overview',
        title: '25.1 Overview',
        content: `CROS provides a platform-wide Accessibility Mode that activates WCAG 2.2 AA compliant overrides across all surfaces.

**Activation:** User menu toggle → persists to localStorage (key: cros_a11y_mode)
**Implementation:** useAccessibilityMode hook (src/hooks/useAccessibilityMode.ts) manages the .a11y-mode class on <html>
**CSS Overrides:** src/index.css — all rules scoped under html.a11y-mode

No database tables required — purely client-side with localStorage persistence.`,
      },
      {
        id: 'a11y-visual',
        title: '25.2 Visual Overrides',
        content: `**High-Contrast Theme Tokens:**
- --background: 230 25% 8% (deep navy)
- --foreground: 0 0% 100% (white)
- --primary: 50 100% 50% (yellow — high-contrast accent)
- --accent: 50 100% 50% (matches primary for consistency)
- All token overrides defined in index.css under html.a11y-mode

**Focus Rings (WCAG 2.4.11):**
- 3px solid hsl(50 100% 50%) with 3px offset on all :focus-visible elements
- :focus:not(:focus-visible) suppressed to avoid mouse-click outlines

**Motion Suppression (WCAG 2.3.3):**
- animation-duration: 0.001ms !important on all elements
- transition-duration: 0.001ms !important
- scroll-behavior: auto !important
- Also independently respects @media (prefers-reduced-motion: reduce)

**Target Size (WCAG 2.5.8):**
- All buttons, [role="button"], checkboxes, radios: min 44×44px
- Icon-only buttons: min 36×36px
- Compass voice button: 48×48px in a11y mode

**Typography:**
- Base font: 16px, line-height 1.6, letter-spacing 0.04em
- .text-xs bumped to 0.875rem
- .text-[10px] bumped to 0.75rem

**Additional:**
- Links always underlined (text-decoration: underline, 3px offset)
- Status badges and stage badges gain 2px solid currentColor border
- Cards get increased padding`,
      },
      {
        id: 'a11y-compass',
        title: '25.3 NRI Compass Accessibility',
        content: `**Skip Navigation:**
- SkipToContent component (src/components/layout/SkipToContent.tsx) renders a sr-only link that becomes visible on focus
- MainLayout adds id="main-content" and role="main" to content area

**Compass Drawer ARIA:**
- SheetContent has aria-label="CROS Companion — NRI Assistant"
- Chat history wrapped in role="log" aria-live="polite" aria-relevant="additions"
- Each message bubble: role="article" with aria-label ("You said" / "NRI responded")
- Loading indicator: role="status" aria-label="NRI is thinking…" with sr-only text
- Screen reader live region (role="status" aria-live="polite" aria-atomic="true") announces:
  - New NRI responses (truncated to 200 chars)
  - Voice input start/stop/capture states
  - Voice input errors

**Keyboard Navigation:**
- Auto-focus to textarea on drawer open (300ms delay for render)
- Arrow keys navigate between nudge cards (NudgeCard onKeyDown handler)
- Arrow keys navigate between quick prompt buttons
- Enter/Space activates focused elements (native behavior)
- Escape closes the drawer (Sheet component default)

**Nudge Cards:**
- Each NudgeCard: tabIndex={0}, role="article", aria-label includes direction + message
- Feed container: role="feed" aria-label="Movement signals"
- Count announcement: sr-only aria-live="polite" with visible nudge count

**Voice Input:**
- Mic button: aria-label toggles between "Start voice input" / "Stop voice input"
- aria-pressed reflects isListening state
- Visible hint text (.a11y-voice-hint) shown only in a11y mode via CSS

**NRI Response Adaptation:**
- Messages prefixed with [accessibility_mode] when a11y mode is active
- System prompt detects this flag and switches to:
  - Bullet-point formatting over prose
  - Max ~15 words per sentence
  - No decorative emoji (only 📋/✅ functional indicators)
  - Numbered lists for multiple options
  - Clear "Next step:" action labels
- The prefix is stripped before display (handled in profunda-ai edge function)`,
      },
      {
        id: 'a11y-css-classes',
        title: '25.4 CSS Class Reference',
        content: `**Key CSS selectors added for a11y-mode Compass:**
- html.a11y-mode .compass-drawer — 3px left border in yellow
- html.a11y-mode .compass-nudge-card — 2px border, 1rem padding, yellow focus ring
- html.a11y-mode [role="log"] .bg-muted — 1px border for assistant bubbles
- html.a11y-mode [role="log"] .bg-primary — 2px border for user bubbles
- html.a11y-mode [aria-label="Suggested prompts"] button — 48px min-height, 2px border
- html.a11y-mode button[aria-label*="voice"] — 48×48px min size
- html.a11y-mode .a11y-voice-hint — display: block (normally hidden)

**Components with a11y enhancements:**
- AccessibilityToggle (src/components/layout/AccessibilityToggle.tsx) — menu toggle
- SkipToContent (src/components/layout/SkipToContent.tsx) — skip navigation link
- AIChatDrawer — full ARIA, keyboard nav, voice, and response adaptation
- TodaysMovementSection — ARIA feed, keyboard nav, nudge announcements
- AIChatButton — aria-label on compass launcher`,
      },
    ],
  },
  {
    id: 'indoles',
    title: 'Indoles — Personality Intelligence Module',
    sections: [
      {
        id: 'indoles-overview',
        title: 'Overview',
        content: `The Indoles module adds personality intelligence to CROS, enabling birthday tracking, zodiac auto-derivation, Enneagram assessments, CliftonStrengths/DISC manual entry, and bio/skills/languages enrichment across Profiles, Contacts, and Volunteers.

**Key Components:**
- \`src/lib/zodiac.ts\` — Client-side zodiac derivation utility
- \`src/components/indoles/EnneagramAssessment.tsx\` — 36-question Likert-scale Enneagram assessment
- \`src/components/indoles/PersonalityStrengthsPanel.tsx\` — Reusable self-fetching panel for Indoles data
- \`src/pages/EnneagramAssessmentPage.tsx\` — Standalone assessment route

**Database Columns Added (contacts, profiles, volunteers):**
date_of_birth, zodiac_sign, zodiac_element, zodiac_modality, enneagram_type, enneagram_wing, enneagram_confidence, enneagram_scores, enneagram_source, clifton_strengths, disc_profile, bio, skills, languages, interests, comfort_areas (volunteers), availability_notes (volunteers), personality_visibility (profiles)

**Database Trigger:** \`derive_zodiac_from_dob()\` — fires on INSERT/UPDATE of date_of_birth, auto-populates zodiac_sign, zodiac_element, zodiac_modality.

**Birthday Nudges:** The Compass session engine queries contacts with upcoming birthdays (14-day window) and generates care-direction nudges, excluding care_completed contacts.

**Computed Age:** \`computeAge(dob)\` utility in both client (\`src/lib/zodiac.ts\`) and server (\`_shared/indolesContext.ts\`) computes age from DOB. Age is injected into NRI prompt context for relational awareness.

**Privacy:** personality_visibility defaults to 'private'. Zodiac data is NRI-internal only.

**Cross-Tenant Isolation:** All Indoles data (personality assessments, DOB, bio, skills) is stored on tenant-scoped tables (contacts, volunteers) or user-scoped tables (profiles). RLS policies enforce strict tenant isolation — no personality data is ever shared cross-tenant. Communio does NOT include personality fields. The NRI prompt injection only loads contacts belonging to the current user's tenant via the existing tenant-scoped query pipeline.`,
      },
    ],
  },
  {
    id: 'companion-absorption',
    title: '17. Companion → Tenant Absorption',
    sections: [
      {
        id: 'absorption-overview',
        title: '17.1 Overview',
        content: `The Companion Absorption system allows free Companion accounts to join any existing tenant organization while preserving relationship ownership, privacy, and dignity.

**Core Principle:** No silent migration. The Companion must always explicitly choose how to handle their personal relationships when joining an organization.

**Three Strategies:**
- **Private** (default): All personal relationships remain untouched in Companion space. No data transfers.
- **Move**: Selected relationships transfer into the tenant. Ownership moves to tenant. Records no longer live in personal space.
- **Copy**: Selected relationships are duplicated into the tenant. Original remains in personal space. Copy belongs to tenant.`,
      },
      {
        id: 'absorption-schema',
        title: '17.2 Data Model',
        content: `**companion_absorption_requests**: Tracks each absorption request with relationship_strategy (private/move/copy), selected_opportunity_ids, selected_contact_ids, and status (pending/processing/completed/failed).

**Relationship Provenance (opportunities & contacts):**
- origin_type enum: tenant (default), personal, moved, copied
- source_user_id: Links back to original Companion owner
- source_opportunity_id / source_contact_id: For copied records, links to original

**tenant_users additions:**
- joined_from_companion (boolean): Flags members who joined via absorption
- absorption_request_id: Foreign key to audit trail

**RLS:** Users can manage their own requests. Tenant admins/stewards can view absorption details for their organization members.`,
      },
      {
        id: 'absorption-edge-function',
        title: '17.3 Edge Function (companion-absorb)',
        content: `**Endpoint:** POST /functions/v1/companion-absorb
**Auth:** Bearer token required (validates user via getUser)
**Input:** { invite_id, relationship_strategy?, selected_opportunity_ids?, selected_contact_ids? }

**Flow:**
1. Validate invite exists and belongs to user's email
2. Create absorption request record
3. Process strategy:
   - private: No data operations
   - move: UPDATE opportunities/contacts SET tenant_id, origin_type='moved'
   - copy: INSERT duplicated records with origin_type='copied', source links
4. Add user to tenant_users with joined_from_companion=true
5. Mark invite as accepted
6. Return { ok: true, tenant_id, tenant_slug }

**Safety:** Default strategy is always 'private'. Invalid strategies rejected with 400.`,
      },
      {
        id: 'absorption-ui',
        title: '17.4 UI (Settings → Organizations Tab)',
        content: `**Location:** Settings page, "Organizations" tab (OrganizationsTab.tsx)

**Sections:**
- Your Organizations: Cards showing current memberships with role and join date
- Pending Invitations: Cards with Accept/Decline actions

**Absorption Dialog (on Accept):**
- Three pastoral options: Keep private, Move selected, Copy selected
- Multi-select relationship picker when Move or Copy is chosen
- Calm, dignified language throughout
- Default selection: "Keep all relationships private"

**Tenant View (Team Management):**
- ♥ Companion badge on members who joined via absorption
- No exposure of private Companion relationships`,
      },
    ],
  },
];


