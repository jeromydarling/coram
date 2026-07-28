import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { generateHelpPdf } from '@/lib/helpPdf';
import { generateOpportunityCardsPdf } from '@/lib/opportunityCardsPdf';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DocumentLibrary } from '@/components/documents/DocumentLibrary';
import { HelpNavDropdown, helpSections } from '@/components/help/HelpNavDropdown';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { canUse, getFeaturesForPlan } from '@/lib/features';
import { brand, modules } from '@/config/brand';

import {
  LayoutDashboard, 
  MapPin, 
  Building2, 
  GitBranch, 
  Anchor, 
  Calendar, 
  Users, 
  FileText,
  Bell,
  Search,
  Settings,
  Shield,
  DollarSign,
  Play,
  CheckCircle2,
  BookOpen,
  Map,
  PenTool,
  Heart,
  Upload,
  Sparkles,
  Globe,
  Compass,
  Lock,
  Radar,
  Workflow,
  CalendarDays,
  Activity,
  Trash2,
  Book,
  BarChart3,
  HelpCircle,
  MessageSquare,
} from 'lucide-react';

const changelog = [
  {
    date: 'Jul 16, 2026',
    type: 'feature' as const,
    title: 'CROS Federation Email Tracker (Propria pilot)',
    changes: [
      'NEW: Gardener SCIENTIA page “Federation Campaigns” — /operator/scientia/federation-campaigns',
      'NEW: CSV audience import with dry-run preview (email + optional name/organization/role/city/state; supports {{first_name}} merge tags)',
      'NEW: Per-recipient tracking for opens, clicks, replies, signups, and paid conversions on federated apps',
      'NEW: Tracked Gmail send that rewrites links through /track-click and injects a /track-open pixel with UTM + cros_sid for Propria',
      'NEW: Federation signup ingest endpoint (HMAC-authed) matches signups back to the person we emailed',
      'NEW: Scheduled Gmail reply sweep (every 15 min for the first 7 days, daily thereafter)',
      'NEW: “Unmatched signups” panel to reconcile Federation signups that couldn’t be tied to a recipient',
    ],
  },
  {
    date: 'Mar 20, 2026 - 11:30 PM',
    type: 'fix' as const,
    title: 'Verification Round 3 — Demo Role Enforcement, Chat Rendering & Delete Toast',
    changes: [
      'FIX: Delete in demo mode no longer shows misleading "Removed" toast — onSuccess checks __demo flag (BT-004)',
      'FIX: AI Companion chat now renders user + AI messages in demo mode by injecting into query cache (BT-009)',
      'FIX: ProtectedRoute now enforces requiredRoles in demo mode — Companions can no longer access admin pages (BT-011/SEC-006)',
      'UPD: Demo lens→role mapping: Steward gets admin/leadership/staff; Shepherd gets staff; Companion/Visitor get none',
    ],
  },
  {
    date: 'Mar 20, 2026 - 11:00 PM',
    type: 'fix' as const,
    title: 'Browser Testing Remediation — Demo Mode, Mobile, Navigation & Feature Gates',
    changes: [
      'FIX: Delete operations in demo mode no longer show false "Removed" success toast (BT-004)',
      'FIX: Demo delete mutations now early-return when proxy is active — prevents navigation-away and audit logging',
      'FIX: FeatureGate denied state now wraps in MainLayout so sidebar remains visible (BT-006)',
      'FIX: AI Companion chat returns friendly demo message instead of edge function errors (BT-009)',
      'FIX: Provisions sidebar link now visible in demo mode regardless of tenant settings (BT-010)',
      'FIX: Contact create/update onSuccess handlers guard against null data from demo proxy',
      'FIX: Header actions (search, quick actions) hidden on sub-640px screens to prevent overflow',
      'UPD: Demo write proxy tests updated to expect fake row with generated ID instead of null',
    ],
  },
  {
    date: 'Mar 20, 2026 - 9:00 PM',
    type: 'improvement' as const,
    title: 'Security Audit — Full Remediation (SEC-001 through SEC-008)',
    changes: [
      'NEW: Shared CORS module (_shared/cors.ts) with origin allowlist — replaces wildcard Access-Control-Allow-Origin on sensitive endpoints',
      'NEW: Shared error envelope adopted by api-contacts, demo-gate-submit, google-oauth-callback',
      'NEW: Shared tenant scope validation (requireTenantId) enforced on api-contacts',
      'NEW: Shared rate limiter (guardPublicEndpoint) adopted by demo-gate-submit',
      'NEW: Created relatio_sync_config, qa_run_results, friction_events, and tenant_add_ons tables with proper RLS',
      'FIX: OAuth callback validates redirect URIs against an allowlist (SEC-001)',
      'FIX: API contacts endpoint requires and validates tenant ownership (SEC-003)',
      'FIX: Demo gate endpoint uses shared IP-based rate limiting (SEC-004)',
      'FIX: Tenant admin routes require admin or leadership role (SEC-005)',
      'FIX: Visitor route blocking is unconditional regardless of view mode (SEC-006)',
      'FIX: Essay card previews strip HTML tags before rendering (UI-001)',
      'FIX: OAuth error responses no longer leak raw error details',
    ],
  },
  {
    date: 'Mar 14, 2026 - 3:00 PM',
    type: 'feature' as const,
    title: 'Companion → Tenant Absorption — Join Organizations While Preserving Privacy',
    changes: [
      'NEW: "Your Organizations" tab in Settings — view memberships and pending invitations',
      'NEW: Companion absorption flow — free Companions can join any tenant organization',
      'NEW: Relationship handling during absorption — keep private, move, or copy',
      'NEW: Multi-select for choosing which relationships to move or copy',
      'NEW: Relationship provenance tracking (origin_type: personal, moved, copied, tenant)',
      'NEW: companion-absorb edge function for secure server-side absorption logic',
      'NEW: Tenant admin visibility — ♥ Companion badge for members who joined via absorption',
      'NEW: Privacy-first defaults — all relationships remain private unless explicitly changed',
      'UPD: Settings page — new Organizations tab added to tabbed layout',
      'UPD: Team Management — shows companion origin for absorbed members',
    ],
  },
  {
    date: 'Mar 12, 2026 - 12:00 AM',
    type: 'feature' as const,
    title: 'Enterprise Audit — Security, Diagnostics, Data Integrity, Bulk Ops & Polish',
    changes: [
      'NEW: Content Security Policy (CSP) meta tag with strict source allowlists',
      'NEW: Idle session timeout — auto-logout after 30 min of inactivity',
      'NEW: Rate-limit detection with automatic retry and user-facing toast',
      'NEW: Health-check edge function returning system status, latency, and version',
      'NEW: Correlation-ID tracing across frontend requests and edge functions',
      'NEW: Performance metrics hook tracking page load, navigation, and memory usage',
      'NEW: Orphan foreign-key sweeper — detects broken relationships across tables',
      'NEW: Data completeness scoring per tenant (contacts + opportunities)',
      'NEW: Schema versions table for migration metadata tracking',
      'NEW: Bulk select, update, and soft-delete operations with audit logging',
      'NEW: Saved Filter Views — persistent per-user filter presets',
      'NEW: Fuzzy duplicate contact detection (email + name matching)',
      'NEW: Field-level change history extracted from audit log diffs',
      'NEW: Skeleton loaders for lists, detail drawers, and command center',
      'NEW: Keyboard shortcuts overlay (press ? to view)',
      'NEW: Narrative-first empty states with optional CTAs',
      'NEW: Toast deduplication to prevent notification spam',
      'UPD: QueryClient defaults — 30s stale time, 5m garbage collection for smoother transitions',
    ],
  },
  {
    date: 'Mar 8, 2026 - 10:00 PM',
    type: 'fix' as const,
    title: 'Google Analytics OAuth — Live Site Connection Fix',
    changes: [
      'FIX: Resolved OAuth redirect URI mismatch preventing GA4 connection on published site',
      'FIX: Iframe detection guard in GASection — disables connect button in preview mode with clear guidance',
      'UPD: OAuth callback redirect now properly returns user to analytics page after authorization',
      'UPD: Edge function google-oauth-start hardened with role checks and property_id validation',
      'DOC: Full GA4 OAuth integration blueprint documented for reuse across CROS instances',
    ],
  },
  {
    date: 'Mar 5, 2026 - 7:00 AM',
    type: 'feature' as const,
    title: 'Indoles — Personality & Strengths Intelligence',
    changes: [
      'NEW: Enneagram assessment — self-guided 36-question Likert-scale assessment with Ignatian design language',
      'NEW: Personality & Strengths panel — collapsible panel on People, Volunteers, and Profile pages for Enneagram, CliftonStrengths, DISC, and bio data',
      'NEW: Birthday tracking with automatic zodiac derivation via database trigger (zodiac metadata is system-internal)',
      'NEW: Extended bio fields — skills, languages, interests, comfort areas, and availability notes',
      'NEW: NRI personality context injection — Compass receives birthday nudges (14-day window) and personality data for relational pairing suggestions',
      'NEW: Privacy controls — personality visibility defaults to private, configurable in Settings',
      'NEW: Ignatian color palette and Source Serif 4 typography for the Indoles module',
    ],
  },
  {
    date: 'Mar 4, 2026 - 3:00 AM',
    type: 'feature' as const,
    title: 'NRI Accessibility — Compass for Everyone',
    changes: [
      'NEW: Full keyboard navigation in Compass drawer — Arrow keys between nudges, Tab through actions, Escape to close',
      'NEW: Screen reader support — role="log" chat history, aria-live announcements for NRI responses and nudges',
      'NEW: High-contrast Compass surfaces — visible borders, enhanced nudge cards, chat bubble contrast in a11y mode',
      'NEW: Voice input accessibility — announced start/stop/capture states, larger touch targets, visible usage hint',
      'NEW: Simplified NRI responses in accessibility mode — bullet points, short sentences, no decorative emoji',
      'NEW: Auto-focus to input when Compass opens for immediate keyboard interaction',
      'NEW: Nudge count announced to screen readers via aria-live status region',
    ],
  },
  {
    date: 'Mar 4, 2026 - 1:00 AM',
    type: 'feature' as const,
    title: 'Accessibility Mode — WCAG 2.2 AA',
    changes: [
      'NEW: Accessibility Mode toggle in user menu — persists to localStorage',
      'NEW: High-contrast dark theme with 4.5:1+ contrast ratios when enabled',
      'NEW: Enhanced focus rings (3px solid, high visibility) for all interactive elements',
      'NEW: Minimum 44×44px touch targets for buttons and controls',
      'NEW: All animations and transitions disabled when active',
      'NEW: "Skip to main content" link for keyboard navigation (WCAG 2.4.1)',
      'NEW: Links always underlined in a11y mode (not color-only indicators)',
      'NEW: Independent prefers-reduced-motion support regardless of toggle',
      'NEW: Typography enhancements — larger minimum sizes, increased line-height and letter-spacing',
      'FIX: Ambiguous FK query on Event Detail page (contacts↔opportunities 300 error)',
      'FIX: Subscription status polling reduced from 60s to 5min interval',
    ],
  },
  {
    date: 'Mar 3, 2026 - 10:00 AM',
    type: 'improvement' as const,
    title: 'NRI Help Knowledge Base + Local Pulse Visibility Fix',
    changes: [
      'NRI assistant now serves as a comprehensive help resource — can answer questions about any app section, feature, or workflow',
      'NRI honesty guardrails: assistant never claims it performed an action it didn\'t — distinguishes queued (📋) from immediate (✅) actions',
      'NRI failure transparency: if an action attempt fails, the assistant explicitly tells you instead of silently dropping it',
      'NRI tenant isolation reinforced: assistant only knows about your organization\'s data, never speculates about other tenants',
      'NRI help query optimization: platform questions use a lightweight retrieval path for faster responses',
      'Local Pulse fix: newly discovered events awaiting AI parsing are now visible in the Pulse tab (previously filtered out by date requirement)',
      'Local Pulse query updated to include items with null event_date alongside future-dated events',
    ],
  },
  {
    date: 'Mar 2, 2026 - 3:00 AM',
    type: 'improvement' as const,
    title: 'Race Condition Fix, Gemini Tracking, Chapter Renumbering',
    changes: [
      'increment_usage_counter RPC rewritten as fully atomic single-statement upsert — mode and engine columns now increment inside the ON CONFLICT clause instead of separate UPDATE statements, eliminating concurrent race conditions',
      'Added ai_calls_gemini column to tenant_usage_counters for Providence Engine (Stage 3 narrative polish) cost tracking',
      'intelligenceGovernance.ts now routes engine="gemini" to the new ai_calls_gemini counter',
      'Technical Architecture Reference: chapters 14–16 (Relational Orientation, Compass Convergence, Providence Engine) renumbered to 22–24, resolving merge-artifact duplication with Recovery & Restoration (14), Calm Digest (15), and Familia (16)',
      'Updated RPC documentation to describe the fully atomic increment model with four engine counters and rate cards',
    ],
  },
  {
    date: 'Mar 2, 2026 - 2:00 AM',
    type: 'improvement' as const,
    title: 'Pricing Logic, Founding Garden, Audit Fixes',
    changes: [
      'Founding Garden now visually applies annual rates when toggled — prices update immediately on the page',
      'Annual billing correctly applies "2 months free or 10% off" (whichever is higher) to all tiers AND add-ons',
      'Removed AI top-up add-ons (Advanced NRI, Expanded AI Usage) — AI is managed at the platform level',
      'Removed Team Capacity Expansion (200) block — organizations needing 200+ use multiple 75 blocks',
      'Technical Architecture Reference updated: CiviCRM added as 5th giving adapter, Section 6.1 expanded to 31+ connectors with correct categories, Gardener Studio tabs corrected (5 tabs, Notifications/Switches moved to Platform Config), RBAC roles clarified (database keys mapped to functional roles)',
      'Two-way sync connector list updated to 7 connectors (added Google Contacts, Outlook, CiviCRM) with Blackbaud SKY API barriers documented',
    ],
  },
  {
    date: 'Mar 2, 2026 - 12:15 AM',
    type: 'feature' as const,
    title: 'CiviCRM Integration + Breadcrumb Repositioning',
    changes: [
      'NEW: CiviCRM connector — APIv4 two-way sync for contacts & activities, read-only contributions, events, cases, CiviVolunteer',
      'CiviCRM onboarding guide added — 6-step TurboTax-style setup with AuthX, API user creation, and permission assignment',
      'Gardener Console updated with CiviCRM field mappings and migration caveats',
      'Dry-run test coverage extended to CiviCRM (credential fields: key, url)',
      'Marketing integrations page now lists 31 total connectors (7 with two-way sync)',
      'Donor Humanity page updated with CiviCRM in CRM list and FAQ',
      'Breadcrumbs repositioned below hero into content sections across all marketing pages',
      'Technical documentation bumped to v2.16.0',
    ],
  },
  {
    date: 'Mar 1, 2026 - 11:30 PM',
    type: 'feature' as const,
    title: '5 New Connectors + Donor Humanity Page + Why CROS Page',
    changes: [
      'NEW: Google Contacts connector — OAuth2, two-way sync via People API (contacts, groups, labels)',
      'NEW: Microsoft Outlook Contacts connector — OAuth2, two-way sync via Microsoft Graph (contacts, folders, categories)',
      'NEW: Apple Contacts / iCloud connector — vCard/CSV migration (no public API)',
      'NEW: Monica CRM connector — API key, one-way sync (contacts, activities, notes, reminders, tasks)',
      'NEW: Contacts+ connector — API key, one-way sync (contacts, tags, notes, social profiles)',
      'NEW: /cros-donor-humanity SEO landing page — relational donor stewardship philosophy',
      'NEW: /why-cros page — three pillars, relational capital vs financial capital section',
      'UPD: Connector registry expanded to 30 connectors (6 with two-way sync)',
      'UPD: Marketing integrations page updated with all 5 new connectors',
      'UPD: Setup guides added for all 5 new connectors with step-by-step onboarding',
      'UPD: Dry-run credential mappings updated for new connectors',
      'UPD: Technical documentation v2.15.0 — connector count and two-way sync list expanded',
    ],
  },
  {
    date: 'Mar 1, 2026 - 12:00 AM',
    type: 'feature' as const,
    title: 'Bi-Directional Sync — Blackbaud RE NXT, HubSpot + Shepherd Toggle',
    changes: [
      'NEW: Blackbaud RE NXT outbound adapter — constituents, gifts, actions, events, notes via SKY API',
      'NEW: HubSpot outbound adapter — contacts, companies, deals, tasks, notes via CRM API v3',
      'NEW: Shepherd-controlled sync direction toggle — switch between read-only and two-way per connector',
      'NEW: Sync Direction tab in Operator Integrations with conflict resolution strategy selector',
      'NEW: relatio_sync_config table — per-tenant, per-connector sync direction with Shepherd-only write RLS',
      'NEW: Conflict resolution strategies — Flag for review (default), CROS wins, Remote wins',
      'UPD: 4 connectors now support full two-way sync: Salesforce, Dynamics 365, HubSpot, Blackbaud RE NXT',
      'UPD: Marketing integrations page updated with Blackbaud RE NXT and revised two-way sync messaging',
      'UPD: Technical documentation v2.14.0 — bi-directional sync chapter expanded',
      'UPD: Connector registry updated with Blackbaud RE NXT (25 total connectors)',
    ],
  },
  {
    date: 'Feb 28, 2026 - 10:15 PM',
    type: 'improvement' as const,
    title: 'NRI Marketing Page — Recognize · Synthesize · Prioritize Rewrite',
    changes: [
      'REWRITE: Full /nri page restructured into unified narrative flow: philosophical → practical → trustworthy → inviting',
      'NEW: "Recognize · Synthesize · Prioritize" core loop section with 3-column cards and real workflow examples',
      'NEW: Adoption bridge section addressing "I don\'t want another app" and "I\'m uneasy about AI" objections',
      'NEW: Human principles section — Subsidiarity, Solidarity, Common Good — framed as universal, not sectarian',
      'NEW: Trust & Boundaries section (reusable across Security + AI Transparency pages)',
      'NEW: Restoration paragraph — "Nothing is lost here"',
      'NEW: Centralized NRI content file (src/content/nriMarketingContent.ts) with hero variants, micro-copy, and FAQ',
      'NEW: 6 micro-copy snippets for in-product tooltips and onboarding',
      'UPD: features.ts nriPage content updated with Recognize/Synthesize/Prioritize framing',
      'UPD: Technical documentation v2.12.0 — NRI description expanded with core loop and trust boundaries',
    ],
  },
  {
    date: 'Feb 27, 2026 - 11:30 PM',
    type: 'feature' as const,
    title: 'Deep Insight Governance — Essential vs Deep Intelligence Layers',
    changes: [
      'NEW: Phase 27 — Caregiver → Companion archetype reframe across all UI copy, marketing, guides, and documentation',
      'NEW: 13 Companion-specific sector tags (Mentoring, Recovery Sponsorship, Spiritual Direction, Coaching, etc.)',
      'NEW: /for-companions marketing page with sponsor-specific language block',
      'NEW: /help/companions guide rewritten for mentors, sponsors, caregivers, and spiritual directors',
      'UPD: All "Caregiver" UI labels replaced with "Companion" — database keys unchanged',
      'UPD: Gardener How-To updated with expanded companion archetype awareness and adoption guidance',
      'UPD: Technical documentation v2.11.0 — Companion System chapter rewritten',
      'NEW: Monthly Deep allowances by tier — Core: 100, Insight: 250, Story: 600',
      'NEW: Graceful degradation — when Deep exhausted, Perplexity research skipped, Essential mode continues seamlessly',
      'NEW: AI Observatory (Machina) — full burn monitoring, engine breakdown, workflow attribution, tenant intensity matrix, governance controls',
      'NEW: ✦ Deep Insight badge — transparent indicator on Deep-consuming actions',
      'NEW: Gentle awareness banners at 80%, 95%, and 100% Deep usage thresholds',
      'NEW: operator_ai_budget governance — force_essential_mode, pause_drift_detection, configurable per-tier allowances',
      'NEW: ai_workflow_usage attribution — per-call tracking by workflow, engine, and intelligence mode',
      'UPD: neighborhood-insights — governance-aware, skips Perplexity in Essential mode',
      'UPD: profunda-ai — tracks deep_mode_calls and essential_mode_calls in usage counters',
      'UPD: Technical documentation updated with governance architecture details',
    ],
  },
  {
    date: 'Feb 27, 2026 - 9:00 PM',
    type: 'feature' as const,
    title: 'NRI Draft Campaign Action + Enrichment Reliability Fix',
    changes: [
      'NEW: NRI assistant can now draft email campaigns — say "Draft a campaign for those new orgs — write an intro about our program"',
      'NEW: Campaign targeting: "recent" (last 24h imports), "metro" (by metro name), or specific org names',
      'NEW: AI generates subject, HTML body, and preheader from your prompt — campaign is always created as draft',
      'NEW: Audience is auto-populated and filtered against suppression lists',
      'FIX: Auto-enrichment now reliably fires on all approval paths (single, bulk, bundle, add-and-draft) — previously fetch() calls were not awaited and Deno runtime shut down before completion',
      'FIX: All enrichment calls now use 10s timeout with AbortSignal and log response status for debugging',
    ],
  },
  {
    date: 'Feb 27, 2026 - 5:00 PM',
    type: 'feature' as const,
    title: 'NRI Bulk Intake with URLs + Approve All + Auto-Enrichment',
    changes: [
      'NEW: NRI assistant supports bulk org intake with website URLs — e.g. "Add Habitat for Humanity (habitat.org), Goodwill (goodwill.org)"',
      'NEW: Bulk contact + org intake with URLs — contacts and orgs created together with enrichment URLs stored',
      'NEW: website_url column on ai_suggestions — persists URLs extracted during assistant conversation',
      'NEW: "Approve All" button on Quick Add — approves every pending suggestion across all bundles in one click',
      'NEW: Auto-enrichment on approval — when an opportunity with a website_url is approved, enrichment is triggered automatically',
    ],
  },
  {
    date: 'Feb 27, 2026 - 4:00 PM',
    type: 'improvement' as const,
    title: 'Gardener Console Structure — Studio / Platform Config Split',
    changes: [
      'UPD: Garden Studio now focuses on editorial work: Library, Playbooks, Voice & Tone, Communio Directory, Atlas',
      'UPD: Platform Config now houses admin settings: Switches, Gardeners, Notifications, Keywords, Archetypes, Metro News',
      'UPD: Content Pipeline (/operator/nexus/content) documented as raw draft list companion to Studio',
      'UPD: How-To guide updated with corrected Studio tabs, Platform Config tabs, and Content Pipeline description',
      'UPD: Field guides (manualData.ts) updated with Studio/Config split, Content Pipeline module, and Platform Config module',
      'UPD: Garden Studio zone corrected from MACHINA to SCIENTIA in How-To guide',
    ],
  },
  {
    date: 'Feb 27, 2026 - 3:00 PM',
    type: 'fix' as const,
    title: 'QA Test 36 — Momentum Map Login Verification',
    changes: [
      'FIX: Test 36 now verifies login actually succeeded before navigating — prevents false passes on login screen screenshots',
      'FIX: Explicit post-login assertion for authenticated UI elements',
      'FIX: Added milestone screenshots at post-login, trigger-missing, and momentum-page stages',
    ],
  },
  {
    date: 'Feb 27, 2026 - 2:00 PM',
    type: 'feature' as const,
    title: 'Signum Territory-Aware Discovery',
    changes: [
      'REFACTOR: Discovery (FindPage) now filters by activated territories instead of metros only',
      'NEW: useTenantTerritories hook — fetches activated territories for current tenant',
      'NEW: Territory relevance scoring lib — archetype-sensitive, rural-fair weighting',
      'NEW: Archetype-aware scope labels — missionary orgs see "fields of service", caregivers see "your area"',
      'UPDATED: DiscoveryBriefingPanel accepts territoryId alongside legacy metroId',
      'UPDATED: Entity creation from discovery results resolves metro_id from territory backing',
      'UPDATED: UI copy replaces "All metros" with territory-appropriate language per archetype',
    ],
  },
  {
    date: 'Feb 27, 2026 - 6:00 AM',
    type: 'feature' as const,
    title: 'Territory Foundation — Unified Geography Layer (Phase 1–3)',
    changes: [
      'NEW: territories table — unified abstraction for metro, county, state, country, mission_field, and custom_region',
      'NEW: tenant_territories table — replaces tenant_metros with bundle_id and activation_slots support',
      'NEW: County bundle activation — up to 5 counties within a single state = 1 activation slot (fair rural pricing)',
      'NEW: State activation — 1 state = 2 activation slots',
      'NEW: Country activation — 1 country = 1 activation slot',
      'NEW: Mission field — free territory children under activated parent country',
      'NEW: missionary_org archetype — country-level activation with optional city/region for mission fields',
      'NEW: Territory Selection Step in onboarding — metro, county bundle, state, or country mode selector',
      'NEW: Solo Caregiver Base Location Step — private state/city collection (never displayed publicly)',
      'NEW: Caregiver Network opt-in toggle — approximate region visibility for future caregiver network',
      'NEW: calculate_territory_slots() — SQL function and TypeScript utility for fair activation pricing',
      'NEW: useTerritories hook — fetch territories by type, US states, and country',
      'UPD: Existing 95 metros migrated to territories table with territory_type = metro',
      'UPD: Onboarding wizard now routes to correct territory step based on archetype',
      'UPD: Compass excludes solo caregivers from territorial rollups',
      'ARCH: Territory hierarchy via parent_id (country → mission_field, state → county)',
      'PRIVACY: Solo caregiver base location fields never render on Atlas or consume activation slots',
    ],
  },
  {
    date: 'Feb 27, 2026 - 2:00 AM',
    type: 'feature' as const,
    title: 'Bi-Directional CRM Sync — Salesforce, Microsoft Dynamics 365 & HubSpot',
    changes: [
      'NEW: Direct outbound sync via Edge Function (relatio-outbound-sync) — no external orchestration dependency',
      'NEW: Salesforce two-way sync — contacts, accounts, tasks, events, and notes flow both directions',
      'NEW: Microsoft Dynamics 365 two-way sync — full OData v4 field mapping for all entity types',
      'NEW: HubSpot two-way sync — contacts, companies, deals, and notes synchronized bidirectionally',
      'NEW: Conflict detection — field-level diff engine flags records edited in both CROS and external CRM',
      'NEW: sync_conflicts table — flag-for-review resolution with accept_cros / accept_remote / merged options',
      'NEW: sync_direction_config table — per-tenant bidirectional sync configuration and credential storage',
      'NEW: Demo Lab migration tests updated with Dynamics 365 inbound fixtures, outbound denormalization, and conflict detection',
      'UPD: Marketing Integrations page — all three CRM connectors now show two-way sync badge',
      'UPD: Pricing comparison tables highlight CRM two-way sync across tiers',
      'ARCH: Direct Edge Function → Vendor API architecture (no n8n for outbound)',
      'PRIVACY: Conflict data tenant-scoped with steward-only management via RLS',
    ],
  },
  {
    date: 'Feb 27, 2026 - 10:00 AM',
    type: 'fix' as const,
    title: 'Caregiver Network — Archetype Gating & Moderation Polish',
    changes: [
      'FIX: Route and sidebar now gated to caregiver_solo and caregiver_agency archetypes only',
      'FIX: Non-caregiver tenants redirected to Communio hub instead of seeing an empty page',
      'FIX: Browse panel now has pagination controls (previous/next)',
      'FIX: Report resolution now records resolved_by user ID for audit trail',
      'FIX: Gardener can now add a custom resolution note when resolving reports',
      'FIX: Report flag failure on messages now logs warning instead of silently failing',
    ],
  },
  {
    date: 'Feb 27, 2026 - 8:00 AM',
    type: 'fix' as const,
    title: 'Caregiver Network — 14-Issue Audit & Fix',
    changes: [
      'FIX: Reported messages now flag reported=true so Gardener RLS policy can see content',
      'FIX: Incoming requests now show sender display name instead of your own name',
      'FIX: Message threads deduplicated — no more duplicate conversation entries',
      'FIX: Duplicate request prevention via unique partial index on active requests',
      'FIX: Blocked users cannot send new requests (trigger enforcement)',
      'FIX: Self-request prevention — cannot send a request to your own profile',
      'FIX: Status regression guard — only valid forward transitions allowed (e.g., no accepted→pending)',
      'FIX: Auto-update updated_at trigger on caregiver_profiles',
      'FIX: Browse panel now paginated (20 per page) instead of unbounded',
      'FIX: Friendly error messages for duplicate/blocked/self-request attempts',
      'NEW: Caregiver Network link added to Communio sidebar group',
      'NOTE: Cross-tenant browsing is intentional — caregivers across all tenants can discover each other',
    ],
  },
  {
    date: 'Mar 1, 2026 - 12:00 AM',
    type: 'feature' as const,
    title: 'Virtuous CRM & Oracle CRM Connectors',
    changes: [
      'NEW: Oracle CRM ConnectorAdapter — OAuth 2.0 Client Credentials, contacts, accounts, opportunities, activities, campaigns, households',
      'NEW: Oracle CRM setup guide — 5-step guided onboarding with screenshots (Confidential Application, Client Secret, API Scopes)',
      'UPDATED: Virtuous CRM setup guide — expanded to 5-step flow with screenshots, permissions, and webhook configuration',
      'NEW: Virtuous webhook support enabled — Contact Created, Contact Updated, Gift Created, Tag Added events',
      'UPDATED: Marketing integrations page — both connectors now listed with full domain coverage',
      'UPDATED: Technical documentation — connector list expanded to 25+ registered adapters',
    ],
  },
  {
    date: 'Feb 27, 2026 - 6:00 AM',
    type: 'feature' as const,
    title: 'Caregiver Network — Privacy-First Opt-In Companion Network',
    changes: [
      'NEW: caregiver_profiles table — opt-in network presence with display name, approximate region, bio, availability tags',
      'NEW: caregiver_network_requests — mediated connection requests with accept/decline/block flow',
      'NEW: caregiver_network_messages — threaded messaging between accepted connections (relay-only by default)',
      'NEW: caregiver_network_reports — abuse reporting with gardener moderation panel',
      'NEW: CaregiverNetworkPage at /:tenantSlug/communio/caregiver-network — browse, requests, messages, presence tabs',
      'NEW: NetworkPresenceCard — big opt-in toggle, hide-me-instantly, display name, bio, availability tags, contact visibility',
      'NEW: BrowsePanel — card-based directory with state filter, send-a-gentle-note, report profile',
      'NEW: RequestsPanel — incoming/outgoing request management with accept/decline/block',
      'NEW: MessagesPanel — threaded mediated messaging with per-message report button',
      'NEW: Gardener moderation tab on /operator/communio — aggregate stats, open reports, profile disable',
      'NEW: Onboarding integration — solo caregiver profile created during onboarding with network_opt_in from base location step',
      'PRIVACY: Default OFF — no participation unless opted-in; location approximate (city/state only); mediated messaging',
      'PRIVACY: Gardener sees message content only for reported messages; no access to conversation threads',
      'SAFETY: Report/block controls on profiles, requests, and messages; hide-me-instantly toggle',
      'RLS: 14 policies enforcing owner-only write, opt-in browse, participant-only messaging, admin moderation',
    ],
  },
  {
    date: 'Feb 27, 2026 - 12:00 AM',
    type: 'feature' as const,
    title: 'Microsoft Dynamics 365 Inbound Connector',
    changes: [
      'NEW: Full Dynamics 365 ConnectorAdapter — OData v4 field mapping for accounts, contacts, tasks, events, activities',
      'NEW: OutboundAdapter interface — denormalizes CROS entities back to vendor format for write-back',
      'NEW: Dynamics 365 outbound adapter — supports CROS → Dynamics write-back for all entity types',
      'NEW: Salesforce outbound adapter — supports CROS → Salesforce write-back for all entity types',
      'NEW: sync_conflicts table — flag-for-review conflict resolution when records edited in both systems',
      'NEW: sync_direction_config table — per-tenant bidirectional sync configuration',
      'ARCH: Webhook-driven sync cadence via n8n orchestration',
      'PRIVACY: Conflict data tenant-scoped with steward-only management via RLS',
    ],
  },
  {
    date: 'Feb 26, 2026 - 11:45 PM',
    type: 'feature' as const,
    title: 'Life Events — Cross-Archetype Narrative Ontology',
    changes: [
      'NEW: life_events table — structured, privacy-aware life events on People (marriage, birth, death, sobriety, etc.)',
      'NEW: LifeEventsSection on Person Detail — add, view, remove life events with dignity-first UX',
      'NEW: Compass integration — life event types map to directional weights (N/E/S/W)',
      'NEW: 14 event types supporting faith, nonprofit, caregiver, and recovery archetypes',
      'PRIVACY: Private events never appear in Compass publicly, Communio, or marketing embeds',
    ],
  },
  {
    date: 'Feb 26, 2026 - 11:30 PM',
    type: 'feature' as const,
    title: 'Caregiver System — Solo Tier + Agency Archetype + Care Logging',
    changes: [
      'NEW: Caregiver (Solo) tier — free-forever private workspace for independent caregivers',
      'NEW: Caregiver Agency archetype — choose during standard onboarding, invite caregivers as Companions',
      'NEW: Care activity types — Care Visit, Care Check-in, Home Support, Transport, Appointment Support, Respite',
      'NEW: Per-activity Privacy Toggle — caregivers can mark individual logs as private (leadership sees counts only)',
      'NEW: Season Summaries — versioned, AI-assisted narrative summaries with themes, excerpts, and gratitude',
      'NEW: Care Completion Ritual — dignified closing flow with optional date of passing and closing reflection',
      'NEW: /for-caregivers marketing page — two-path positioning (solo + agency)',
      'NEW: hours_logged optional field on activities (decimal, never required)',
      'NEW: care_status, completion_date, date_of_passing, closing_reflection fields on contacts',
      'PRIVACY: Solo workspaces default to private mode; agency visibility controls enforce metadata-only leadership access',
    ],
  },
  {
    date: 'Feb 26, 2026 - 10:00 PM',
    type: 'feature' as const,
    title: 'Impact Dimensions — Tenant-Configurable Structured Metrics',
    changes: [
      'NEW: impact_dimensions table — tenants define structured metrics per entity type (event, activity, provision)',
      'NEW: impact_dimension_values table — per-entity numeric/boolean values with upsert logic',
      'NEW: ImpactDimensionsPage — settings page for managing dimensions with guardrails (max 12 per type)',
      'NEW: ImpactDimensionsPanel — reusable input panel that appears on Events, Activities, and Prōvīsiō forms',
      'NEW: ImpactDimensionsSection — aggregated totals in Reports with time-window filtering',
      'NEW: impactNarrative.ts — keyword-based NRI phrase generator for care-oriented labels',
      'NEW: Public movement sharing support — is_public_eligible flag, counts only, never PII',
      'GUARDRAIL: Max 12 dimensions per entity type, label length < 60, auto-slugified keys',
    ],
  },
  {
    date: 'Feb 26, 2026 - 9:00 PM',
    type: 'feature' as const,
    title: 'Multi-Gardener Assignment + Routing System',
    changes: [
      'NEW: gardeners table — team roster with is_active, is_on_call, is_primary flags',
      'NEW: gardener_scopes table — metro, archetype, and specialty scope assignments per gardener',
      'NEW: tenant_gardener_assignments — explicit gardener-to-tenant primary/secondary/temporary overrides',
      'NEW: gardener_notification_settings — per-gardener push, digest, severity, and ticket-type preferences',
      'NEW: Routing Ladder — 6-step deterministic routing (explicit → metro → archetype → specialty → on-call → primary)',
      'NEW: Gardener Inbox (/operator/nexus/inbox) — calm metadata-only ticket view with assignment and snooze',
      'NEW: Studio Gardeners tab — add team members, assign scopes, toggle on-call status',
      'PRIVACY: Gardener inbox shows tenant name and ticket metadata only — no record names or PII',
    ],
  },
  {
    date: 'Feb 26, 2026 - 8:00 PM',
    type: 'security' as const,
    title: 'Operator Privacy Hardening — Database-Enforced Payload Isolation',
    changes: [
      'NEW: recycle_bin_payloads table — sensitive data (entity names, snapshots) split from metadata',
      'NEW: RLS enforced — operators cannot SELECT from recycle_bin_payloads',
      'NEW: recycle_bin_tenant_v view for tenant self-service with full record names',
      'NEW: safeOperatorQueries.ts — centralized metadata-only query helpers for operator surfaces',
      'NEW: sanitizeRecoveryContext.ts — strips PII from recovery ticket breadcrumbs before write',
      'NEW: Operator privacy boundary tests (operator-privacy-boundary.test.ts)',
      'UPD: Tenant recycle bin now queries tenant view for entity names',
      'UPD: Recovery tickets panel uses safe query helper — descriptions hidden from operator',
      'UPD: Technical documentation updated with database-enforced privacy boundary details',
      'SECURITY: Operators see metadata only — record names are architecturally inaccessible',
    ],
  },
  {
    date: 'Feb 26, 2026 - 2:00 AM',
    type: 'feature' as const,
    title: 'Phase 21AI — Shared Intelligence Governance (Marketing Update)',
    changes: [
      'NEW: Homepage "Intelligence, governed with intention" section — shared capacity philosophy',
      'NEW: Features page "Shared Intelligence" governance block',
      'NEW: Pricing "Shared Intelligence Capacity" info block + FAQ item',
      'NEW: Security page "AI Stewardship" section — private breadcrumbs, shared limits, human review',
      'NEW: "Stewardship of Intelligence" principle added to Our Story page',
      'NEW: CompassEmbedIndicator tooltip on ConstellationEmbedSection',
      'UPD: Signum subtitle → "Tenant-aware discovery guided by shared intelligence capacity"',
      'UPD: NRI/Discovery — added discernment-first discovery line',
      'UPD: Communio — added public profile privacy line',
      'UPD: Site-wide language replacements: "AI-powered" → "Intelligence supported", "Automation engine" → "Discernment support", "Usage limits" → "Gentle safeguards"',
    ],
  },
  {
    date: 'Feb 26, 2026 - 1:30 AM',
    type: 'fix' as const,
    title: 'Audit Sweep — Runtime Fixes + Scheduled Cleanup + Recovery Surface',
    changes: [
      'FIX: eventStream privacy cache now has 5-minute TTL — prevents stale tenant data on context switch',
      'FIX: eventStream uses getSession() instead of getUser() — eliminates network call per breadcrumb',
      'FIX: Recycle bin restore only invalidates relevant entity type query — stops mass cache flush',
      'FIX: CompassEmbedIndicator uses semantic design tokens instead of hardcoded Tailwind colors',
      'NEW: NarrativeErrorBoundary wraps all overlay layers (Compass, Providence, Restoration) — crash isolation',
      'NEW: RecoveryTicketsPanel — Gardener can now view and action recovery tickets filed via NRI Guide',
      'NEW: Recovery page has two tabs: Recycle Bin + Recovery Requests',
      'INFRA: Scheduled pg_cron jobs for cleanup_old_app_events, cleanup_old_restoration_signals, purge_recycle_bin, archive_old_automation_runs, archive_old_living_signals — all run daily at 3–4 AM UTC',
    ],
  },
  {
    date: 'Feb 26, 2026 - 1:00 AM',
    type: 'feature' as const,
    title: 'Phase 21Ω — Compass Overlay for Gardener Atlas',
    changes: [
      'NEW: Compass directional overlay — Narrative (North), Discernment (East), Care (South), Restoration (West)',
      'NEW: Compass toggle in Garden Pulse header — persists preference locally',
      'NEW: Compass blends with Providence layer without competing visually',
      'NEW: CompassEmbedIndicator for marketing embed windows',
      'UPD: ConstellationEmbedSection — now includes fourth Compass window',
      'UPD: Help changelog updated with Phase 21Ω details',
    ],
  },
  {
    date: 'Feb 26, 2026 - 12:30 AM',
    type: 'feature' as const,
    title: 'Phase 21AC — Providence Overlay + Public Movement Constellation',
    changes: [
      'NEW: Public Movement Constellation opt-in — tenants share anonymous movement signals',
      'NEW: PublicMovementOptInCard onboarding step with HIPAA-aware toggles',
      'NEW: Providence overlay (Gardener-only) — narrative threads connecting moments of care',
      'NEW: providence_signals table + validation triggers for thread types',
      'NEW: ConstellationEmbedSection on homepage — Atlas, Constellation, Providence windows',
      'NEW: public_movement_cache table for rate-limited marketing endpoints',
      'UPDATE: Garden Pulse page — "Show narrative threads" toggle + Providence card',
      'UPDATE: Garden Pulse header copy — "This is not a map of organizations. It is a map of movement."',
      'UPDATE: Marketing copy — "A living constellation of care" section',
      'PRIVACY: Only aggregated counts, never PII. HIPAA disables excerpt sharing.',
      'TONE: Ignatian calm — "The quiet threads connecting moments"',
    ]
  },
  {
    date: 'Feb 26, 2026 - 12:00 AM',
    type: 'feature' as const,
    title: 'Phase 21AB — Restoration Narrative Layer',
    changes: [
      'NEW: restoration_signals table — calm narrative signals generated when entities are restored',
      'NEW: Restoration threads appear as soft gold accents in Garden Pulse',
      'NEW: useRestorationSignals + useEmitRestorationSignal hooks',
      'NEW: Aggregated restoration narrative phrases (no PII, no entity names)',
      'UPDATE: Recycle bin restore emits restoration signals + action breadcrumbs',
      'PRIVACY: No personal exposure, no blame, no gamification',
      'PRIVACY: 90-day retention with automatic cleanup',
      'TONE: "Moments of restoration — care remembered."',
    ]
  },
  {
    date: 'Feb 25, 2026 - 11:55 PM',
    type: 'feature' as const,
    title: 'Phase 21AA — Recovery Intelligence ("Nothing Is Lost Here")',
    changes: [
      'NEW: Privacy-safe action breadcrumb layer — logs what you did (not content) to help undo mistakes',
      'NEW: Recovery tickets — assistant can open emergency recovery requests with context attached',
      'NEW: NRI Guide now shows recent actions and offers restore/undo guidance when you ask',
      'NEW: "I accidentally deleted something" quick prompt in assistant',
      'NEW: Emergency recovery request button in assistant panel',
      'NEW: tenant_privacy_settings — tenants can opt out of recent-action tracking',
      'NEW: Welcome overlay now says "Nothing is lost here" with recovery trust signal',
      'UPDATED: Security marketing page — added recovery & restore section',
      'UPDATED: Trust copy — "Nothing is lost — recovery & restoration are built into every surface"',
      'PRIVACY: Action breadcrumbs use strict allowlist — no PII, no content, no free-text',
      'PRIVACY: 30-day retention with automatic cleanup',
    ]
  },
  {
    date: 'Feb 25, 2026 - 11:45 PM',
    type: 'feature' as const,
    title: 'Phase 21Z — Gardener Studio (Safe, Versioned Editing)',
    changes: [
      'NEW: Garden Studio (/operator/nexus/studio) — unified safe editing workspace for the Gardener',
      'NEW: Library tab — full essay CRUD with draft-first workflow, publishing controls, SEO metadata',
      'NEW: Playbooks tab — markdown editor for ai_knowledge_documents with automated versioning',
      'NEW: Voice & Tone tab — NRI editorial calibration with Do/Don\'t rules and Before/After examples',
      'NEW: Notifications tab — operator push, email, and critical event notification management',
      'NEW: Communio Directory tab — moderation panel for public-facing group profiles',
      'NEW: Switches tab — bounded feature toggles (seed simulation, RSS ingestion, familia suggestions)',
      'NEW: AI Assist panel — Ignatian-safe companion editing (Refine Tone, Simplify, Add Reflection, etc.)',
      'NEW: gardener_audit_log — every Studio action is tracked (actor, entity, diff)',
      'NEW: editor_ai_suggestions — AI proposals require explicit human acceptance before applying',
      'SAFETY: Draft-first, version history, rollback, audit log on every edit surface',
      'PRIVACY: All Studio tables use admin-only RLS policies',
    ]
  },
  {
    date: 'Feb 25, 2026 - 11:15 PM',
    type: 'feature' as const,
    title: 'Phase 21Z+ — Calm Digest System + Living Pulse',
    changes: [
      'NEW: user_digest_preferences table — per-user frequency (daily/weekly/monthly/off) and section toggles',
      'NEW: tenant_local_pulse_view — tenant-level movement aggregation (visits, projects, voice notes, narrative signals)',
      'NEW: Enhanced DigestPreferencesCard — section toggles for Visits, Projects, Narratives, Network, Essays, Living Pulse, System',
      'NEW: notifications-generate-digest edge function — role-aware Ignatian digest (Noticing → Reflection → Insight → Invitation)',
      'NEW: Digest content adapts to ministry role (Visitor, Companion, Shepherd, Steward)',
      'NEW: Living Pulse monthly digest stream for ecosystem-wide narrative reflection',
      'UPDATE: Digest frequency now includes "off" option for complete silence',
      'PRIVACY: All digests respect tenant isolation — no cross-tenant data exposure',
    ]
  },
  {
    date: 'Feb 25, 2026 - 8:00 PM',
    type: 'feature' as const,
    title: 'Phase 21 — Visits + Projects as Activities (No Standalone Module)',
    changes: [
      'REMOVED: Standalone Projects nav item — Projects now live inside Activities as a first-class filter',
      'UPDATE: Activities page — added Visits and Projects filters, New Project button, project status badges',
      'UPDATE: useUnifiedActivities — includes Projects and Visits in the main feed, excludes child notes',
      'UPDATE: Project cards show inside Activities timeline with warm left-border accent',
      'UPDATE: Clicking a Project in Activities navigates to the detail page',
      'PRESERVED: ProjectDetail page, CreateProjectDialog, VisitsHelpCard (Care History) all remain intact',
      'PRESERVED: parent_activity_id linking for Visit Notes and Project Notes',
      'QA: Updated Playwright tests for new Activities-centric flow',
    ]
  },
  {
    date: 'Feb 25, 2026 - 11:05 PM',
    type: 'feature' as const,
    title: 'Garden Pulse + Living Digests + Silent Mode',
    changes: [
      'NEW: /operator/nexus/garden-pulse — five-layer visual ecosystem view (Constellation, Atlas, Timeline, Seasonal Rhythm, Storybook)',
      'NEW: Constellation layer — tenant nodes grouped by Familia, glow intensity reflects movement',
      'NEW: Atlas layer — geographic metro presence with activity density',
      'NEW: Living Timeline — horizontal narrative ribbon with Noticing → Reflection → Movement rhythm',
      'NEW: Seasonal Rhythm — liturgical/seasonal calendar replacing analytics calendars',
      'NEW: Storybook panel — essay drafts and published reflections from Living Library',
      'NEW: Silent Mode toggle — removes all labels, lets visuals breathe contemplatively',
      'NEW: Living Pulse Digest preferences — daily/weekly/monthly email digest settings per user',
      'NEW: user_digest_preferences table with RLS and frequency validation',
      'NEW: ecosystem_garden_pulse_view — aggregated tenant signals for Garden Pulse',
      'NEW: DigestPreferencesCard in Settings — gentle digest frequency selector',
    ]
  },
  {
    date: 'Feb 25, 2026 - 6:45 PM',
    type: 'feature' as const,
    title: 'Familia Stewardship Layer — Walking Together',
    changes: [
      'NEW: familia_sharing_enabled toggle — opt-in aggregated care signals across Familia',
      'NEW: familia_provision_rollups view — anonymized, HAVING ≥ 2 tenants, SECURITY INVOKER',
      'NEW: Settings → "Walking Together" card — share stewardship patterns with your Familia',
      'NEW: FamiliaStewardshipCard — gentle narrative of collective care patterns in Prōvīsiō',
      'NEW: NRI signal types — shared_resource_pattern, regional_need_shift, collective_response_emerging',
      'NEW: Gardener insight type: familia_stewardship — calm signals for household-level care',
      'PRESERVED: Local provisioning remains private; Familia sees only narrative patterns',
    ]
  },
  {
    date: 'Feb 25, 2026 - 5:30 PM',
    type: 'feature' as const,
    title: 'Prōvīsiō Evolution — Archetype-Aware Stewardship Modes',
    changes: [
      'NEW: Provision Modes — Care Tracking (default), Stewardship, and Social Enterprise',
      'NEW: tenant_provision_settings table with tenant-scoped RLS',
      'NEW: Settings → Shared Resources card — choose mode, enable catalog and pricing toggles',
      'NEW: Dynamic sidebar — Prōvīsiō appears under Partners only when mode exceeds simple care',
      'NEW: NRI resource stewardship signals — care_pattern_emerging, supply_pressure_warning, community_need_shift',
      'NEW: Gardener insight type: resource_stewardship — calm signals for resource patterns',
      'UPDATE: Archetype-aware defaults — housing/workforce default to stewardship, social enterprise to enterprise',
      'PRESERVED: All existing Profunda provision/device-order workflows remain intact',
    ]
  },
  {
    date: 'Feb 25, 2026 - 4:30 AM',
    type: 'feature' as const,
    title: 'Familia™ — Organizational Kinship & NRI Detection (Phase 21F)',
    changes: [
      'NEW: familias, familia_memberships, familia_suggestions tables with tenant-scoped RLS',
      'NEW: NRI Kinship Detection Engine — deterministic scoring (geo, name, archetype, enrichment, communio)',
      'NEW: Onboarding optional "Are you part of a larger household?" discernment step',
      'NEW: Settings → Familia card — create, join, leave, view NRI suggestions',
      'NEW: Gardener insight type: familia_kinship — calm signals for emerging households',
      'UPDATE: Privacy Policy — Familia & Organizational Kinship section added',
      'UPDATE: Metro-toggle safe — "nearby" language adapts when metro intelligence is off',
    ]
  },
  {
    date: 'Feb 25, 2026 - 3:30 AM',
    type: 'feature' as const,
    title: 'Projects Documentation & Marketing — Help, Changelog, and Positioning Updates',
    changes: [
      'NEW: Full "Projects (Good Work)" section added to Help page with project types, impact tracking guidance, and downstream signal explanations',
      'NEW: Changelog entry for Projects feature launch',
      'UPDATE: App Sections registry — added Projects under Scheduling nav group',
      'UPDATE: Marketing differentiators — added "Projects capture the good work your community does" bullet',
    ]
  },
  {
    date: 'Feb 25, 2026 - 2:30 AM',
    type: 'feature' as const,
    title: 'Projects → NRI + Testimonium + Communio + Gardener Integration',
    changes: [
      'NEW: activity_impact table — lightweight impact snapshots (people_helped, attendance_count, outcome_note) per project',
      'NEW: ProjectImpactCard — calm, optional impact input on project detail page',
      'NEW: Testimonium rollup fields — projects_count, project_notes_count, people_helped_sum, helpers_involved_count',
      'NEW: NRI narrative signals — "Good work in motion" detected from 3+ projects/week with story density tracking',
      'NEW: Communio aggregate signals — anonymized "good_work_pulse" shared across opted-in workspaces',
      'NEW: Gardener "Good Work Pulse" card — calm awareness of project activity, people helped, and story density',
      'NEW: Drift detection — flags when project creation is healthy but story capture (notes) is dropping',
    ]
  },
  {
    date: 'Feb 25, 2026 - 2:00 AM',
    type: 'feature' as const,
    title: 'Projects (Good Work) — Community Service Tracking',
    changes: [
      'NEW: Projects page — calm containers for good work (food drives, home repairs, mission trips, etc.)',
      'NEW: Project detail with reflections timeline, helper tracking, and voice note support',
      'NEW: CreateProjectDialog — title, date, location, optional contacts and participants',
      'NEW: Project type categories tailored by organization archetype for year-end reporting',
      'NEW: parent_activity_id on activities table — hierarchical project → notes model',
      'NEW: activity_type expanded with "Project" and "Project Note" types',
      'NEW: project_status field (Planned, In Progress, Done) with validation trigger',
      'NEW: Help History card on contact pages — unified visits + projects timeline',
      'NEW: QA spec for project navigation, creation, and reflection entry',
    ]
  },
  {
    date: 'Feb 23, 2026 - 4:15 PM',
    type: 'security' as const,
    title: 'System Sweep — Security Hardening & Seed Expansion',
    changes: [
      'SECURITY: Converted all 10 Security Definer Views to SECURITY INVOKER — views now respect RLS of the querying user',
      'SECURITY: Tightened 6 soft-delete RLS policies on contacts, events, opportunities, volunteers, grants, metros — now scoped to tenant_id or metro access',
      'SECURITY: Locked down archetype_interest_signals insert policy — requires authentication',
      'SECURITY: Revoked anonymous API access to materialized views (org_action_effectiveness_mv, story_events_cache)',
      'FIX: Resolved forwardRef warnings on Landing and SeoHead components',
      'FIX: Removed debug console.log statements from Opportunities page',
      'SEED: Expanded demo-tenant-seed to include 6 missing entity types: Reflections, Volunteers, Provisions, Local Pulse Sources, Grants, Anchors',
      'SEED: All 11 entity types now seeded deterministically with re-run safety (batchUpsert/batchInsert helpers)',
    ]
  },
  {
    date: 'Feb 23, 2026 - 6:00 AM',
    type: 'fix' as const,
    title: 'QA Runner — Crash Diagnostics & Output Capture',
    changes: [
      'FIX: Runner now captures both stdout and stderr from Playwright crashes — no more silent failures',
      'FIX: Spec crashes (exit code 1 with no results file) now correctly report as "failed" instead of "passed"',
      'FIX: Crash details are included in page_errors and notes fields for operator visibility',
      'FIX: Resolved "Assignment to constant variable" error in runner failure counter logic',
    ]
  },
  {
    date: 'Feb 22, 2026 - 11:30 PM',
    type: 'feature' as const,
    title: 'QA Employee — Full Automation Suite (v3)',
    changes: [
      'NEW: QA Employee page in Operator Console (/operator/qa) with batch run management',
      'NEW: 57 Playwright spec files covering login, navigation, CRUD, page loads, and edge cases',
      'NEW: GitHub Actions workflow (qa.yml) — dispatches Playwright runs via BrowserBase',
      'NEW: qa-run-suite edge function — creates run rows and dispatches to GitHub Actions',
      'NEW: qa-run-batch edge function — sequential batch execution with automatic chaining',
      'NEW: qa-run-callback edge function — receives results, stores steps, chains next suite',
      'NEW: qa-suite-config edge function — serves suite config to runner without exposing service keys',
      'NEW: qa-sync-suites edge function — syncs spec files from GitHub repo into qa_test_suites table',
      'NEW: qa-seed-user edge function — creates/resets QA demo auth user for test isolation',
      'NEW: qa-failure-notify edge function — sends repair pack emails via Resend on failures',
      'NEW: Runner v3 with Playwright JSON reporter parsing, screenshot upload, and structured step results',
      'NEW: Batch chaining — each completed suite automatically triggers the next in sequence',
      'NEW: Consolidated email report with pass/fail summary, failure details, and paste-ready Lovable fix prompts',
      'NEW: "Seed QA User" and "Sync Suites" operator controls',
      'Infrastructure: qa_test_suites, qa_test_runs, qa_batch_runs, qa_test_steps, qa_known_issues tables',
    ]
  },
  {
    date: 'Feb 21, 2026 - 11:00 PM',
    type: 'feature' as const,
    title: 'Simple Intake (Email Notes) — Role-Agnostic Discovery Flow',
    changes: [
      'NEW: Simple Intake — one-click email intake for anyone on your team (social workers, field staff, partners, volunteers)',
      'NEW: EmailIntakeSetupCard for onboarding — enable in under 10 seconds with immediate shareable copy',
      'NEW: SimpleIntakeCard in Settings — shows intake address, status, and share-copy buttons',
      'NEW: Share copy registry (emailIntakeShareCopy.ts) with quick message, staff version, and bulletin version',
      'NEW: Adoption Hub section — "How to include people who prefer email" with 3-step steward guide',
      'NEW: Operator Nexus Activation suggestion card for early-stage tenant email intake enablement',
      'All messaging uses role-agnostic, calm mode language — no technical jargon',
    ]
  },
  {
    date: 'Feb 21, 2026 - 10:30 PM',
    type: 'feature' as const,
    title: 'Visitor Lens — Simplified UI Toggle for Higher Roles',
    changes: [
      'NEW: tenant_user_preferences table — per-user-per-tenant UI lens preference (default / visitor)',
      'NEW: Visitor Lens toggle in user avatar menu for Steward, Shepherd, Companion roles',
      'NEW: useVisitorLens hook — persists lens across sessions, saves last full route on toggle',
      'Sidebar adapts to visitor lens — shows only Visits, Field Notes, People, Calendar, Help, Settings',
      'Toggling ON redirects to /:tenantSlug/visits; toggling OFF returns to saved route or dashboard',
      'Native Visitor role users see no toggle — they always land in visitor experience',
      'NEW: QA test suite for visitor lens toggle and role behavior',
      'RLS: users can only read/write their own preference row',
    ]
  },
  {
    date: 'Feb 21, 2026 - 10:00 PM',
    type: 'feature' as const,
    title: 'Household / Family — Lightweight Relational Context for People',
    changes: [
      'NEW: contact_household_members table — name, relationship, notes, optional linked contact',
      'NEW: HouseholdCard on Person Detail — add, edit, remove household members inline',
      'NEW: useHouseholdMembers hook with CRUD mutations and query invalidation',
      'NEW: "Household: X" badge on People list when household members exist',
      'NEW: useHouseholdCounts hook — batch-fetches counts to prevent N+1 queries',
      'NEW: CSV import support — parses embedded household formats (parentheses, pipe, dash delimiters)',
      'NEW: parseHousehold utility with multi-column support (household_member_N_name pattern)',
      'NEW: Deduplication via normalized signature (name + relationship)',
      'Household members do NOT require full person records — no forced categorization',
      'Import pipeline automatically inserts household rows alongside contact upserts',
      'RLS: tenant-scoped, mirrors contacts access policies',
    ]
  },
  {
    date: 'Feb 20, 2026 - 9:00 PM',
    type: 'feature' as const,
    title: 'Phase 8E: Guided Activation™ — Checklist, Operator Console & Impersonation',
    changes: [
      'NEW: Guided Activation™ — human-led onboarding add-on with customer-facing preparation checklist',
      'NEW: activation_offers table — tracks purchase status, consent, scheduling, and meeting links per tenant',
      'NEW: activation_checklist_templates — operator-managed global templates (base, gmail, outlook, hubspot, salesforce, campaigns, metros, communio)',
      'NEW: activation_checklists — per-tenant instantiated checklists with readiness scoring',
      'NEW: activation_checklist_items — normalized items with category (Access, Data, Decisions, Goals), completion tracking',
      'NEW: operator_impersonation_sessions — auditable, time-limited operator sessions into tenant environments',
      'NEW: activation-bootstrap edge function — idempotently creates checklist from tenant entitlements + connectors',
      'NEW: activation-recompute edge function — recalculates readiness_score after item changes',
      'NEW: operator-impersonate-start edge function — creates time-limited (60m) session with consent verification',
      'NEW: operator-impersonate-end edge function — ends session and updates audit log',
      'NEW: Customer "Prepare for Guided Activation" page at /:tenantSlug/admin/guided-activation',
      'Calm category sections: "Bring your keys" (Access), "Bring your story" (Data), "Bring your compass" (Decisions), "Bring your focus" (Goals)',
      'Progress meter with "Mark as Ready" (≥90% required items) and "Request Help" actions',
      'NEW: Operator Activation Console at /operator/activation with readiness dashboard',
      'Operator can view checklists, schedule sessions, and enter tenant as admin (time-limited, consent-required)',
      'Impersonation audit log visible in operator console — last 20 sessions',
      'RLS: tenant-scoped for customers, admin-only for operator tables',
      'Seed templates: 8 templates with gentle, human copy covering all onboarding scenarios',
    ]
  },
  {
    date: 'Feb 20, 2026 - 6:00 PM',
    type: 'feature' as const,
    title: 'Guided Activation™ Checkout + Stripe Integration',
    changes: [
      'NEW: activation_sessions table — tracks purchased activation sessions with Stripe checkout references',
      'NEW: Two session types: single 90-minute session and Guided Activation Plus™ (two sessions)',
      'NEW: Stripe checkout integration for activation session purchases',
      'NEW: Customer scheduling preferences and time request flow',
      'NEW: Operator service queue for managing activation sessions across tenants',
    ]
  },
  {
    date: 'Feb 20, 2026 - 3:00 PM',
    type: 'feature' as const,
    title: 'CROS™ Brand & Multi-Tenant Architecture',
    changes: [
      'NEW: Tenant onboarding with mission archetype selection (Church, Digital Inclusion, Social Enterprise, Workforce, Refugee Support, Education, Library)',
      'NEW: Subscription tier system — CROS Core, Insight, Story, Bridge with cumulative feature gating',
      'NEW: SubscriptionGate and FeatureGate components for dynamic tier-based access control',
      'NEW: Communio™ — collaborative groups for inter-tenant signal sharing and community intelligence',
      'NEW: communio_groups, communio_memberships, communio_shared_events, communio_shared_signals tables',
      'NEW: Archetype profiles with behavior profiles, narrative styles, and communio defaults',
      'NEW: Tenant entitlements system for add-on purchases (Campaigns, Metros, AI, Local Pulse, NRI)',
      'Brand constants centralized in src/config/brand.ts — CROS, Neary (NRI), Latin module names',
    ]
  },
  {
    date: 'Feb 20, 2026 - 12:00 PM',
    type: 'feature' as const,
    title: 'Operator Console: How-To Guide, Tenants, Time Machine & Global Overrides',
    changes: [
      'NEW: Operator Console at /operator with full admin platform management',
      'NEW: How-To Guide at /operator/how-to — master documentation for all operator modules',
      'NEW: Tenants management with tier overview, activation status, and impersonation',
      'NEW: Time Machine — audit timeline for all platform-level changes',
      'NEW: Global Overrides — feature kill switches and platform-wide flags',
      'NEW: Announcements — broadcast messages to tenants with scheduling',
      'NEW: Ecosystem Intelligence Spine — cross-tenant signal aggregation',
    ]
  },
  {
    date: 'Feb 19, 2026 - 8:00 PM',
    type: 'feature' as const,
    title: 'Phase 8D: Testimonium™ & Impulsus™ Modules',
    changes: [
      'NEW: Testimonium™ — narrative storytelling and insight layer for creating impact reports from relationship data',
      'NEW: Impulsus™ — private impact scrapbook journal for capturing field moments (photos, notes, voice memos)',
      'NEW: Momentum Heatmap with narrative overlays — geographic visualization of community engagement',
      'NEW: Drift Detection scoring with qualitative labels across metro narratives',
      'Feature-gated: Testimonium requires Insight tier, Impulsus requires Story tier',
    ]
  },
  {
    date: 'Feb 19, 2026 - 4:00 PM',
    type: 'feature' as const,
    title: 'Phase 8C: Relatio™ Marketplace & Integration Connectors',
    changes: [
      'NEW: Relatio™ Marketplace at /relatio — browse and connect integration connectors',
      'NEW: integration_connectors table with connector profiles (HubSpot, Salesforce, Bloomerang, Blackbaud, etc.)',
      'NEW: tenant_integrations table — tracks active connections per tenant with config and health status',
      'NEW: Connector simulation profiles for demo environments',
      'Feature-gated: Relatio requires Bridge tier',
    ]
  },
  {
    date: 'Feb 19, 2026 - 12:00 PM',
    type: 'feature' as const,
    title: 'Phase 8B: Billing Products & Subscription Management',
    changes: [
      'NEW: billing_products table — Stripe product/price mappings for all tiers and billing intervals',
      'NEW: check-subscription edge function — periodic subscription status refresh',
      'NEW: Subscription settings page with tier display, usage, and upgrade flow',
      'NEW: Add-on purchase toggles for Campaigns, Civitas, and capacity upgrades',
    ]
  },
  {
    date: 'Feb 19, 2026 - 10:00 AM',
    type: 'feature' as const,
    title: 'Phase 7: Operator CRM Workspace — Partners, Metros, Scheduling, Outreach',
    changes: [
      'NEW: Operator Partners at /operator/partners — full list/filter/search of all opportunities across tenants',
      'NEW: Operator Partner Detail at /operator/partners/:slug — subscription info, contacts, activities, journey, reflections',
      'NEW: "Convert to Customer" flow — operator-convert-customer edge function bootstraps tenant from opportunity',
      'NEW: Operator Metros at /operator/metros — full CRUD metro management reusing existing hooks',
      'NEW: Operator Scheduling at /operator/scheduling — calendar view with operator-scoped events',
      'Three new event types for operator: outreach_meeting, demo_session, onboarding_call',
      'NEW: Operator Outreach at /operator/outreach — signup link campaigns with tracking',
      'NEW: operator_signup_links table — campaign-tagged links with default archetype assignment',
      'NEW: operator-signup-track edge function — creates lead opportunity from campaign link click',
      'NEW: Operator sidebar reorganized: Dashboard, Partners, Metros, Scheduling, Outreach, Tenants, Demo Lab, Testimonium, Communio',
      'System tools (Intake, Automation, Integrations, Platform, Sweeps, Tour, How-To) collapsed into System group',
      'RLS: operator_signup_links admin-only, operator edge functions validate admin JWT',
    ]
  },
  {
    date: 'Feb 19, 2026 - 8:00 AM',
    type: 'feature' as const,
    title: 'Pricing Page, Stripe Checkout & Onboarding Flow',
    changes: [
      'NEW: Pricing page at /pricing — interactive tier selector for Core, Insight, Story, Bridge with feature comparison',
      'NEW: Add-on configurator: Additional Users, Expanded AI, Expanded Local Pulse, Advanced NRI, Campaigns, Expansion Capacity',
      'NEW: Guided Activation™ upsell during checkout with session type selection',
      'NEW: create-checkout edge function — builds Stripe checkout session with base tiers + add-ons + one-time items',
      'NEW: customer-portal edge function — redirects authenticated users to Stripe billing portal',
      'NEW: stripe-webhook edge function — processes checkout.session.completed and subscription lifecycle events',
      'NEW: Onboarding flow at /onboarding — post-checkout archetype selection and tenant bootstrap',
      'NEW: onboarding-start edge function — creates tenant with selected archetype and tier entitlements',
      'NEW: tenant-bootstrap edge function — provisions database, seeds archetype defaults, creates initial metro',
      'NEW: Stripe price IDs mapped in src/config/stripe.ts for all tiers and add-ons',
    ]
  },
  {
    date: 'Feb 19, 2026 - 6:00 AM',
    type: 'feature' as const,
    title: 'Scenario Lab & Demo Tenant System',
    changes: [
      'NEW: Scenario Lab at /operator/scenario-lab — sandbox for testing archetype simulations',
      'NEW: demo-tenant-create edge function — provisions isolated demo tenant with seed data',
      'NEW: demo-tenant-reset edge function — wipes and re-seeds demo tenant to clean state',
      'NEW: demo-tenant-seed edge function — populates demo tenant with realistic archetype-specific data',
      'NEW: Archetype simulation runs table — tracks simulation tick execution with stats and error capture',
      'NEW: archetype-simulate-tick edge function — advances simulation state for demo tenants',
      'Operator can create, reset, and observe demo tenants for each mission archetype',
    ]
  },
  {
    date: 'Feb 18, 2026 - 4:00 PM',
    type: 'improvement' as const,
    title: 'Voluntārium + Hours Ingest Stabilization Pass',
    changes: [
      'Event matching safety: ambiguous event matches (>1 result) now warn instead of auto-selecting — stored in parsed_json',
      'Gmail ingestion idempotency: composite unique index on (source_email_message_id, volunteer_id, shift_date)',
      'Reliability label config: thresholds extracted to shared volunteerConfig.ts — no longer hardcoded',
      'Inbox badge: Voluntārium nav item shows needs_review count (refreshes every 60s)',
      'Import Center guardrails: preview capped at 200 rows, CSVs with >50k rows rejected before preview',
      'Performance: added index on volunteers(last_volunteered_at DESC)',
      'Deno test: duplicate gmail_message_id returns ok:true + duplicate status',
    ]
  },
  {
    date: 'Feb 18, 2026 - 2:00 PM',
    type: 'feature' as const,
    title: 'Phase 6A Completion: Gmail Wiring, Event Volunteers, Admin Observability',
    changes: [
      'Gmail pipeline wired: gmail-sync and scheduled-gmail-sync auto-detect volunteer hours (subject or HOURS: keyword)',
      'Inbound emails matching volunteer patterns automatically forwarded to volunteer-hours-ingest edge function',
      'NEW: EventVolunteerHours component — view and log shifts directly from Event detail pages',
      'NEW: "Log Hours" dialog on Event pages with volunteer picker and minutes input',
      'NEW: Community Health section on Admin page with two observability widgets',
      'NEW: VolunteerIngestionStats widget — parsed vs needs_review counts for today and last 7 days',
      'NEW: ImportCenterStats widget — import run history with total rows processed',
      'Admin nav dropdown updated with Community Health tab',
    ]
  },
  {
    date: 'Feb 18, 2026 - 10:00 AM',
    type: 'feature' as const,
    title: 'Phase 6A: Voluntārium + Hours from Gmail + CRM Exit Ramp',
    changes: [
      'NEW: Volunteer management system — track volunteers with profiles, status, reliability labels',
      'NEW: volunteers table with auto-computed lifetime_minutes and last_volunteered_at via triggers',
      'NEW: volunteer_shifts table for logging hours (warehouse or event-linked) with email deduplication',
      'NEW: volunteer_hours_inbox review queue for email parsing results (admin/staff only)',
      'NEW: volunteer-hours-ingest edge function — deterministic HOURS: line parser (no AI required)',
      'Format: "HOURS: YYYY-MM-DD | 3.5 | warehouse" or "HOURS: YYYY-MM-DD | 2 | event: Name"',
      'NEW: Volunteers list page (/volunteers) with reliability labels: Recent helper, Steady helper, Returning soon',
      'NEW: Volunteer detail page (/volunteers/:id) with shift history and "Log Hours" form',
      'NEW: Volunteer Hours Inbox page (/volunteer-hours-inbox) — review, approve, or reject parsed emails',
      'NEW: Import Center (/import) — CSV upload with auto-mapping, field mapping UI, and preview',
      'Supports Organizations, People, Volunteers, Activities, Tasks, and Deals import types',
      'Source system presets: Generic CSV, HubSpot Export, Salesforce, Zoho, Pipedrive',
      'NEW: Importer interface skeleton (src/lib/importers/Importer.ts) for future API connectors',
      'NEW: HubSpotCSVImporter preset with auto-mapping for common HubSpot export columns',
      'NEW: Community sidebar group with Volunteers and Import Center (admin-only)',
      'RLS: strict role-based access on all 3 volunteer tables + import tables',
      'Deno tests: CORS, auth guards, missing fields validation (3 tests passing)',
    ]
  },
  {
    date: 'Feb 17, 2026 - 4:00 PM',
    type: 'feature' as const,
    title: 'System Sweep & Admin Observability Dashboard',
    changes: [
      'NEW: System Jobs Registry (system_jobs) — canonical catalog of all background processes',
      'NEW: Job Runs Log (system_job_runs) — execution history with stats, outputs, and error tracking',
      'NEW: Suggestion Ledger (system_suggestions) — canonical backend for relationship nudges and insights',
      'NEW: system-sweep edge function — audits all metros for data freshness across news, events, narratives, and drift',
      'Metro health statuses: Healthy (recent run with results), Quiet (recent run, no results), Stale (no run within threshold)',
      'Configurable staleness threshold via computeHealthStatus() pure function',
      'Heartbeat dashboard: last sweep run, metros processed, suggestions this week, quiet/stale counts',
      'Metro health table with per-module status indicators',
      'Manual "Run Sweep" trigger from admin panel',
      'Suggestion ledger with type/metro filtering and dismiss capability',
      'Deno tests: computeHealthStatus unit tests + auth guard integration tests',
    ]
  },
  {
    date: 'Feb 17, 2026 - 10:00 AM',
    type: 'feature' as const,
    title: 'Metro News Keywords Engine & Source Administration',
    changes: [
      'NEW: Global News Keywords (global_news_keywords) — mission-first defaults covering need_signals, education, policy, etc.',
      'NEW: Metro News Keywords (metro_news_keywords) — per-metro overrides for local term weighting',
      'NEW: metroKeywordCompiler — merges global + metro keywords, deduplicates (metro overrides win), bundles into 6-10 search queries',
      'NEW: Admin Global Keywords page (/admin/global-keywords) for managing mission-wide search terms',
      'NEW: Keywords tab on Metro Detail page for per-metro overrides',
      'NEW: Metro News Sources management on Metro Detail page — add URLs, monitor auto-discovered sources',
      'NEW: Source health tracking — auto-disables after 3 consecutive crawl failures with 7-day retry window',
      'NEW: metro-news-sources edge function — GET for fetching enabled sources, POST for registering discovered URLs',
      'NEW: metro-news-run edge function — executes geo-targeted search queries and persists results to discovery_highlights',
      'NEW: MetroNewsPulseCard — surfaces news signal strength (0-100), articles found/persisted, and health status per metro',
      'NEW: Metro Narratives feed (/metros/narratives) — browsable community stories across all metros with metro filter',
      'Drift Detection: statistical diffs of topics/signals across metros with drift_score (0-100) and qualitative labels',
      'Narrative fallback: when external news is sparse, uses internal relationship highlights to ensure continuity',
    ]
  },
  {
    date: 'Feb 16, 2026 - 2:00 PM',
    type: 'feature' as const,
    title: 'Prōvīsiō: Copy for Spreadsheet (TSV Export)',
    changes: [
      'NEW: "Copy for Spreadsheet" button on Provision detail page — generates tab-separated value (TSV) string',
      'Strict 21-column header order matching finance master template',
      'Sanitizes internal whitespace and newlines to prevent column breakage',
      'Calculates per-line totals (quantity × unit cost) inline',
      'TSV format enables direct paste into Excel/Google Sheets finance templates',
      'Replaces standard CSV export for finance workflow compatibility',
      'Invoice fields: invoice_type, invoice_date, business_unit, client details, payment info',
      'Export tracking: exported_at timestamp and export_count incremented on each copy',
    ]
  },
  {
    date: 'Feb 15, 2026 - 3:00 PM',
    type: 'feature' as const,
    title: 'Prōvīsiō System: Full Lifecycle for Partner Support',
    changes: [
      'NEW: Prōvīsiō module at /provisions — internal request tracking for partner device distribution',
      'NEW: 24-item provision catalog seeded from Oct 2025 PDF (Desktop, Laptop, Add-on, Accessory tiers)',
      'NEW: Create Provision flow — select opportunity, choose catalog items with quantity stepper, live total',
      'NEW: Provision Detail page with summary header, items table, tracking block, conversation thread',
      'NEW: Status lifecycle: Draft → Submitted → In Progress → Ordered → Shipped → Delivered (or Canceled)',
      'NEW: Staff-editable tracking: carrier dropdown, tracking number, delivery status selector',
      'NEW: Conversation thread per provision with chronological messages and compose box',
      'NEW: Paste-and-Parse flow — paste text, AI extracts structured items via provision-parse edge function',
      'NEW: Catalog match indicators (green check, yellow warning, red X) during parse review',
      'NEW: 6 edge functions: provision-create, provision-submit, provision-update, provision-message-create, provision-parse, provision-import-bulk',
      'NEW: Notification types: provision_assigned, provision_message, provision_tracking_added, provision_delivery_update, provision_status_changed',
      'NEW: Prōvīsiō section on Opportunity Impact Tab with lifetime total spend and last 90 days',
      'Full RLS: metro-scoped access, warehouse_manager denied via route guard + RLS',
      'Sidebar: Prōvīsiō added to Partners nav group between Anchors and People',
    ]
  },
  {
    date: 'Feb 15, 2026 - 10:00 AM',
    type: 'feature' as const,
    title: 'Human Impact Reports & Narrative Board Export',
    changes: [
      'NEW: Reports page refactored to "Human Impact Reports" — narrative-driven executive briefings',
      'NEW: Five report sections: Executive Summary, Community Impact, Relationship Growth, Support Delivered, Momentum & Signals',
      'Replaced corporate CRM labels (e.g., "Pipeline") with mission-centric language (e.g., "What We Made Possible")',
      'Journey stages visualized as chapters with narrative progression framing',
      'Provision data integrated as "Support Delivered" section with unit counts and partner averages',
      'NEW: Narrative Impact Export at /reports/impact-export — full-screen executive view for board meetings',
      'NEW: Board-ready PDF export via jsPDF with print-friendly palette and professional typography',
      'Region and metro filtering with scope label in export header',
      'Deterministic builder for qualitative summaries while maintaining quantitative data integrity',
      'Privacy guards: only aggregated counts and thematic summaries — raw reflections and email content excluded',
      'Print-optimized CSS with @media print rules for clean browser printing',
    ]
  },
  {
    date: 'Feb 14, 2026 - 2:00 PM',
    type: 'feature' as const,
    title: 'Email-Derived Recommendations in Command Center + UX Fixes',
    changes: [
      'NEW: "From Your Sent Emails" card on Command Center — surfaces email-extracted task suggestions scoped by user',
      'Suggestions ordered by due date (soonest first), then created_at — max 10 items',
      'Each suggestion shows: title, org name, metro, excerpt (≤180 chars), optional due date',
      'Inline Accept (create task) and Dismiss actions with optimistic UI',
      'Click-through navigates to the parent opportunity for full context',
      'Single source of truth: email_task_suggestions table renders in both Dashboard and Opportunity Story',
      'FIX: "Next Week\'s Top 3 Priorities" renamed to "Next Week\'s Top 3 Events" in Friday Weekly Scorecard',
      'FIX: Push notification deep links corrected from /command-center to / — eliminates 404 on notification tap',
      'Added /command-center redirect route to preserve any legacy or cached deep links',
      'Updated 5 edge functions (profunda-notify, profunda-ai, notification-dispatcher, read-ai-webhook, check-task-due-dates) with corrected deep link paths',
    ]
  },
  {
    date: 'Feb 14, 2026 - 6:00 AM',
    type: 'fix' as const,
    title: 'Epic Sweep: RLS Patches & n8n Workflow Fixes',
    changes: [
      'FIX: Locked down notification_events, notification_deliveries, notification_queue — restricted from PUBLIC to service_role only',
      'FIX: Unlocked enrichment_jobs and enrichment_results — added metro-scoped SELECT for authenticated users',
      'FIX: narrative_partner_suggestions RLS now includes regional_lead role',
      'FIX: org_knowledge_current_v and resend_candidates_v1 views recreated with security_invoker = on',
      'FIX: n8n search-people and search-grants callback nodes switched from httpHeaderAuth to dual-header (Bearer + X-Api-Key)',
      'FIX: partner-enrich webhook trigger — removed orphan responseMode causing execution errors',
      'Updated WorkflowDownloads page with all 24 n8n workflow JSONs organized by category',
    ]
  },
  {
    date: 'Feb 14, 2026 - 4:00 AM',
    type: 'feature' as const,
    title: 'Phase 4B: Metro Narrative Engine',
    changes: [
      'NEW: metro_narratives table — synthesized community stories per metro',
      'Blends external community signals (Perplexity news/policy) with internal partner data',
      'Sections: community shifts, partner responses, emerging patterns, outlook',
      'NEW: metro-narrative-build edge function — aggregates briefings, momentum, highlights, and signals',
      'NEW: metro-narrative-callback — ingests external community signals into discovery_highlights',
      'Calm tone enforcement: filters urgency keywords (critical, act now, red alert)',
      'Deterministic fallback when external data is thin — uses internal relationship highlights',
      'Metro Story panel in Metro Detail view with collapsible narrative sections',
    ]
  },
  {
    date: 'Feb 14, 2026 - 3:00 AM',
    type: 'feature' as const,
    title: 'Phase 4A: Relationship Stories & Partner Check-In Suggestions',
    changes: [
      'NEW: relationship_story_chapters table — 6 stable chapter families (Leadership, Programs, Ecosystem, Funding, Events, Relationship)',
      'NEW: relationship_story_updates table — evolving narrative records with delta-type badges',
      'NEW: narrative_partner_suggestions table — AI-generated check-in suggestions when narrative themes align with org knowledge',
      'Chapters seeded idempotently via ensure_story_chapters function',
      'Suggestion types: check_in, offer_support, introduce_partner, share_resource',
      'Pre-filled friendly email drafts requiring human approval before sending',
      'Capped at 5 suggestions per narrative run, deduped by (narrative_id, opportunity_id, suggestion_type)',
      'Relationship Story tab on Opportunity Detail with collapsible chapter cards and evidence links',
      'Journal entries undergo AI extraction — signals and themes blended into stories (never verbatim quotes)',
    ]
  },
  {
    date: 'Feb 14, 2026 - 12:00 AM',
    type: 'fix' as const,
    title: 'Phase 3E: Notification Constraint + Owner Resolution Fix',
    changes: [
      'FIX: proactive_notifications CHECK constraint now accepts "relationship_action_high_priority"',
      'Previously, high-priority action notifications were silently rejected by the DB constraint',
      'FIX: Owner resolution for notifications — priority order: 1) opportunity owner_id, 2) metro assignments, 3) admin/regional_lead fallback',
      'User IDs deduplicated via Set to prevent duplicate notifications to the same user',
      'Max 5 users notified per action, capped across all resolution tiers',
      'Smoke-tested end-to-end: insert confirmed, idempotency verified (no duplicates on rerun)',
      'Negative test confirmed: invalid notification_type values still rejected by DB constraint',
    ]
  },
  {
    date: 'Feb 13, 2026 - 11:00 PM',
    type: 'feature' as const,
    title: 'Phase 3E: Relationship Intelligence Layer',
    changes: [
      'NEW: relationship_actions table — prioritized, evidence-based tasks per opportunity',
      'Action types: reach_out, attend_event, apply_grant, follow_up, introduce',
      'Priority scoring: Leadership change (75+), Upcoming event (60-70), Momentum spike (65), Grant discovery (55)',
      'Priority labels: high (≥70), normal (40-69), low (<40)',
      'Deduplication via unique constraint on (opportunity_id, action_type, title) WHERE status=open',
      'Title normalization (trim + whitespace collapse) ensures stable dedupe across reruns',
      'NEW: relationship-actions-generate edge function — builds actions from signals, momentum, and discovered items',
      'Scope modes: single opportunity or entire metro (batch up to 200 opportunities)',
      'Evidence-based: all actions grounded in DB signals, discovery items, and momentum data',
      'Grant pipeline fix: first_seen_at correctly selected and filtered (≤30 days)',
      'NEW: High-priority notification pipeline — fires ONLY on true new inserts (created_at ≈ updated_at within 2s)',
      'Deterministic dedupe_key in notification payload prevents duplicate alerts',
      'NEW: relationship-briefing-generate edge function — weekly AI-generated summaries per metro/opportunity',
      'Authenticated users can update action status (Done/Dismissed) via RLS; creation is service-role only',
      '80/80 Deno tests passing across all Phase 3E edge functions',
    ]
  },
  {
    date: 'Feb 13, 2026 - 9:00 PM',
    type: 'feature' as const,
    title: 'Phase 3D: People Roster Tracking, Event Co-Attendance & Proactive Notifications',
    changes: [
      'NEW: people_roster_snapshots table — stores roster JSON per opportunity per enrichment run',
      'NEW: people_roster_diffs table — tracks added/removed/changed people per opportunity per run',
      'NEW: event_co_attendance table — detects partners attending the same events (shared presence signals)',
      'Co-attendance enrichment: runs on attendee import, capped at 50 attendees per batch',
      'NEW: discovery_orchestration table — scheduled recurring research per metro or opportunity',
      'Orchestration config: cadence (weekly/monthly), last_run tracking, auto-queue for n8n dispatch',
      'NEW: Proactive notification types: upcoming_event, leadership_change, threshold_crossed',
      'Notifications: deduplicated per user+reference entity, daily cap of 5 per user',
      'Owner resolution: opportunity owner_id → metro assignments → admin/regional_lead fallback',
      'NEW: proactive-notification-engine edge function — evaluates events, roster diffs, and thresholds',
      'Push notifications (T1): delivered to device if Web Push is enabled',
      'Deno tests: auth guards, valid/invalid payloads, deduplication',
    ]
  },
  {
    date: 'Feb 13, 2026 - 7:00 PM',
    type: 'feature' as const,
    title: 'Phase 3C: Proactive Discovery',
    changes: [
      'NEW: discovery_orchestration table for scheduling recurring research',
      'Cadence options: weekly, monthly, or manual',
      'Research covers: People, Events, Grants by metro or opportunity scope',
      'Auto-queue for n8n dispatch on schedule trigger',
      'Results tracked in discovery_runs with status and stats',
    ]
  },
  {
    date: 'Feb 13, 2026 - 2:00 PM',
    type: 'feature' as const,
    title: 'Neighborhood Insights & Action Effectiveness',
    changes: [
      'NEW: Neighborhood Insights — census and demographic context for partner locations',
      'NEW: org_action_effectiveness materialized view — tracks action completion rates by type',
      'NEW: Follow-up suggestions from reply patterns and watchlist signals',
      'Event follow-up campaigns with AI-generated templates from Company KB',
    ]
  },
  {
    date: 'Feb 13, 2026 - 10:00 AM',
    type: 'feature' as const,
    title: 'Phase F: Campaign Replies, Outcomes & Follow-Up Intelligence',
    changes: [
      'Gmail sync detects inbound replies to campaign emails',
      'Reply rating: Useful / Neutral / Not Useful — human judgment only',
      'Follow-up suggestions from: unanswered replies (7d), watchlist signals without outreach (30d), event imports without campaigns',
      'One-click "Create Draft Campaign" from suggestion',
      'Outcomes logged for future learning',
    ]
  },
  {
    date: 'Feb 12, 2026 - 6:00 PM',
    type: 'feature' as const,
    title: 'Phase 4: Intelligence Loop — Next Best Actions & Org Knowledge',
    changes: [
      'NEW: Next Best Actions engine with evidence-based scoring',
      'NEW: Organization Knowledge Bootstrap from partner websites',
      'NEW: Company AI Knowledge Base for authoritative identity + tone',
      'NEW: Email template presets for consistent outreach',
      'NEW: Alert system for high-score actions and stuck automations',
    ]
  },
  {
    date: 'Feb 11, 2026 - 4:00 PM',
    type: 'feature' as const,
    title: 'Phase 6: Discovery Search & Watchlist',
    changes: [
      'Find People / Events / Grants with AI-powered web search',
      'Saved searches with "new result" highlighting',
      'Watchlist monitoring with signal detection',
      'Attendee enrichment after event import',
      'Daily budget controls and timeout handling',
    ]
  },
  {
    date: 'Feb 10, 2026 - 2:00 PM',
    type: 'feature' as const,
    title: 'Phase 3: Gmail Outreach & Campaign Intelligence',
    changes: [
      'Per-RIM Gmail campaigns with merge tags and audience building',
      'Failure analytics and subject performance tracking',
      'Watchlist-driven campaign suggestions',
      'Send guardrails: daily caps, confirmation on failures',
      'Campaign analytics with failure categorization',
    ]
  },
  {
    date: 'Feb 9, 2026 - 8:00 AM',
    type: 'feature' as const,
    title: 'Grant Tracking Module',
    changes: [
      'Full grant lifecycle management from Researching through Awarded or Closed',
      'Track funder details, amounts requested vs. awarded, and multi-year terms',
      'Star rating system (1-5) for prioritizing grant opportunities',
      'Internal strategy notes visible only to Admin and Leadership roles',
      'Grant types configurable via Admin panel (Operating, Program, Capital, etc.)',
      'Activity timeline for logging research, applications, and follow-ups',
      'CSV import with automatic Metro and Organization matching',
      'Grant KPI cards on Dashboard showing pipeline value and success rates',
      'Grants appear as related list in Opportunity detail modals',
      'Searchable via global search (⌘K) and included in report builder',
    ]
  },
  {
    date: 'Jan 29, 2026 • 7:00 AM',
    type: 'improvement' as const,
    title: 'Mobile Help Page Improvements',
    changes: [
      'Fixed Document Library header stacking on mobile devices',
      'Title and Upload button now stack vertically on small screens',
      'Improved changelog entry layout with proper badge and title wrapping',
    ]
  },
  {
    date: 'Jan 29, 2026 • 6:30 AM',
    type: 'improvement' as const,
    title: 'Calendar Overflow Events Popover',
    changes: [
      'Days with more than 3 events now show a clickable "+X more" link',
      'Popover displays all events for that day with scrollable list',
      'Events in popover are clickable to view full details',
      'Quick "Schedule a meeting" shortcut in popover footer',
    ]
  },
  {
    date: 'Jan 28, 2026 • 10:00 PM',
    type: 'feature' as const,
    title: 'Core CRM Foundation & Authentication',
    changes: [
      'User authentication with email signup/login and Google Sign-In',
      'Role-based access control (Admin, Leadership, Regional Lead, Staff)',
      'Dashboard with KPI cards and trend sparklines',
      'Metro management with readiness scoring',
      'Opportunity tracking with stage progression',
      'Contact & activity tracking with tasks',
      'Events & Calendar with Google Calendar sync',
      'Pipeline & Anchor management with Kanban board',
      'Global search (⌘K), notifications, reports, document library',
      'Bug reports & feature requests, CSV import/export',
    ]
  },
  {
    date: 'Jan 22, 2026 • 10:00 AM',
    type: 'setup' as const,
    title: 'Initial Setup',
    changes: [
      'Project scaffolding with React, Vite, TypeScript',
      'Backend database integration',
      'Tailwind CSS styling with shadcn/ui components',
      'Routing and layout structure'
    ]
  }
];

// ── SECTION DEFINITIONS ──
// Each section has an optional `requiredFeature` for tier-gating.
// Sections without `requiredFeature` are visible to all tenants.

interface HelpSectionDef {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  content: string;
  requiredFeature?: string; // feature key from src/lib/features.ts
  requiredRole?: 'admin'; // only visible to users with this role
}

const allSections: HelpSectionDef[] = [
  {
    id: 'overview',
    icon: LayoutDashboard,
    title: 'Platform Overview',
    description: `How ${brand.appName}™ supports relationship-building across communities.`,
    content: `${brand.appName}™ is built for community-centered organizations — people who spend their days building genuine partnerships. It is not a sales CRM. It is a relationship memory system, powered by ${brand.assistantFullName}.

The platform rests on three pillars:

## Relationship Memory

Every conversation, reflection, event, and campaign touch becomes part of a living story for each partnership. ${brand.appName}™ remembers so you can focus on the relationship, not the record-keeping.

- **Reflections** capture your observations after meetings, calls, and events — private by default, team-visible when you choose
- **Gmail integration** quietly records sent emails and campaign touches as part of the relationship timeline
- **Story Chapters** organize the relationship narrative into human themes (How we connected, The conversation, What we've shared)
- **Task suggestions** from your sent emails surface commitments you made, so nothing falls through the cracks

## Community Awareness (${modules.civitas.label})

${brand.appName}™ watches the communities where you work — not with urgency, but with curiosity.

- **Local Pulse** discovers events happening near your Home Metro every Monday, including RSS feeds, calendar sources, and web pages you add
- **Metro Narratives** blend community news with your partnership data to tell the story of each city
- **Drift Detection** tracks how community themes shift week over week across all your metros
- **Neighborhood Insights** provide census and historical context for the places where your partners operate

## Narrative Relational Intelligence (${brand.assistantName}™)

Rather than dashboards full of numbers, ${brand.appName}™ builds stories from data:

- **Human Impact Reports** present your work as a mission narrative for board meetings
- **Journey Chapters** track partnership progression using human language (Found → First Conversation → Discovery → Growing Together)
- **Momentum & Heat Maps** celebrate community engagement without ranking or evaluating anyone
- **Story Suggestions** match community themes with organization profiles to suggest natural check-ins

---

## What's Built

**Foundation**: Core data model — Metros, Opportunities, The People, Events, Grants, Anchors. Role-based access. Audit logging. Google Calendar sync.

**Workflow Automation**: Opportunity-to-Anchor conversion, Event ROI scoring, Grant-Anchor impact linking, Smart activity logging.

**Outreach**: Gmail-native campaigns with merge tags, audience building, failure intelligence, watchlist-driven suggestions, reply tracking, and follow-up recommendations.

**Intelligence**: Next Best Action engine, Organization Knowledge profiles, Company AI Knowledge Base, Template Presets, Neighborhood Insights.

**${modules.provisio.label}**: Technology request tracking with 24-item catalog, AI paste-and-parse, conversation threads, and delivery journey tracking.

**Relationship Memory**: Reflections, Gmail sent history, campaign touches, event reflections — all blended into Story timelines with privacy-safe AI extraction.

**Community Awareness (${modules.civitas.label})**: Local Pulse weekly discovery, Metro Narrative engine, Drift Detection, Momentum Heatmap with narrative overlays.

**Human Impact Reports**: Board-ready narrative exports with journey chapters, support delivered, and momentum signals — no raw data exposed.

**Notifications**: Tiered push notifications (T1 direct, T2 bundled, T3 digest) with quiet hours, caps, and mission-first copywriting.

**Discovery (${modules.signum.label})**: AI-powered web search for People, Events, and Grants. Watchlist monitoring with signal detection. Proactive research scheduling.

**${modules.voluntarium.label}**: Volunteer tracking with email-based hours auto-logging, reliability labels, and review queue. Import Center for CRM exit ramp (CSV imports with auto-mapping).

**System Sweep & Observability**: Admin monitoring of background jobs, metro health auditing, and system-generated suggestion ledger.

**Multi-Tenant Architecture**: Mission archetype selection, subscription tiers (Core → Insight → Story → Bridge), feature gating, and Communio™ collaborative groups.

**Guided Activation™**: Human-led onboarding with preparation checklists, operator console, and secure time-limited impersonation.`
  },
  {
    id: 'command-center',
    icon: LayoutDashboard,
    title: 'Command Center',
    description: 'Your daily starting point — context, not pressure.',
    content: `The Command Center is where your day begins. It is designed to offer clarity, not urgency — showing you what matters most without telling you what to do.

**Two Views:**

**Operational View**
The detail-dense view for when you need specifics: focus items, stale next steps, email suggestions, and quick action cards. Everything you need to plan your week.

**Human Overview**
A calmer, story-first view that highlights relationship momentum, community signals, and gentle suggestions. Designed for days when you want the big picture, not the task list.

**Key Features:**

**Relationship Suggestions**
- Suggestions from your sent emails ("From Your Sent Emails") — commitments you made, surfaced for follow-through
- Follow-up suggestions based on reply patterns, watchlist signals, and event imports
- Accept to create a task or draft campaign, Dismiss to remove, or click through for context

**Weekly AI Focus Plan**
- 5-10 prioritized actions for the week, scored by overdue items, grant deadlines, near-win partnerships, and inactive relationships
- Focus Mode (Mon-Thu) for action, Review Mode (Fri-Sun) for reflection
- Mark items done as you complete them — progress persists all week

**Next Best Actions**
- Evidence-based recommendations ranked by signal strength and predicted success
- Execute, Dismiss (suppresses 30 days), or Snooze

**Community Signals**
- Metro momentum indicators and narrative drift alerts
- Local Pulse highlights from your Home Metro
- Watchlist signals from partner website changes

**Tips:**
- Switch between Operational and Human Overview using the mode toggle
- The Command Center adapts to your day — it never demands action`
  },
  {
    id: 'intelligence',
    icon: LayoutDashboard,
    title: 'Movement Intelligence',
    description: 'Territory-aware movement metrics — care, presence, relationships, and narrative threads.',
    content: `Movement Intelligence gives you a contemplative view of how your community work is moving — not through dashboards and KPIs, but through four human dimensions.

**Four Dimensions:**
- **Care**: Activities, visits, provisions, and volunteer hours — how you're showing up
- **Presence**: Events attended, local pulse engagement, community visibility
- **Relationships**: Partner journey movement, new contacts, deepening connections
- **Narrative**: Reflections written, story threads formed, seasonal echoes detected

**Territory-Aware:**
All metrics are scoped to your activated territories. Filter by metro, county, state, or country to see movement in specific areas.

**Time Windows:**
Switch between 7-day, 30-day, and 90-day views to see momentum trends.

**Tips:**
- Movement Intelligence replaces traditional analytics dashboards with human-centered awareness
- Check weekly for a gentle sense of where energy is flowing
- The system never pressures you — it simply reflects what's happening`
  },
  {
    id: 'metros',
    icon: MapPin,
    title: 'Metros',
    description: 'Geographic territories where your organization operates.',
    content: `Metros represent the metropolitan areas where you're building community partnerships.

**Key Metrics:**
- **Waitlist Size**: Number of households waiting for service
- **Referrals/Month**: Monthly referral volume
- **Staff Coverage (1-5)**: Internal capacity rating
- **Partner Counts**: Workforce, Housing/Refugee, Schools/Libraries

**Status Levels:**
- **Expansion Ready**: Readiness score ≥75
- **Anchor Build**: Readiness score 50-74
- **Ecosystem Dev**: Readiness score <50

**Tips:**
- Click any metro row to view detailed information
- Metros are grouped by Region for regional managers`
  },
  {
    id: 'opportunities',
    icon: Building2,
    title: 'Opportunities',
    description: 'Partner organizations and the relationships you\'re building.',
    content: `Each opportunity represents a community organization you're getting to know — from first discovery through sustained partnership.

**Detail Page Tabs:**

Your opportunity detail page is organized around six human-centered tabs:

- **The Partner**: Who they are — organization knowledge, neighborhood insights, mission alignment
- **The Story**: How this partnership has grown — reflections, emails, campaign touches, event history blended into a narrative timeline
- **The Pulse**: What's happening around them — watchlist signals, discovery results, community context
- **The People**: Relationships and contacts at this organization
- **The Impact**: What you've done together — provisions, grants, reflections on shared work
- **The Next Move**: Gentle guidance — suggested actions, outreach drafts, follow-up recommendations
- **Admin** (role-gated): Technical diagnostics visible only to admins and leadership

**Journey Chapters:**
Partnership progression uses human language instead of sales stages:
- Found → First Conversation → Discovery → Pricing Shared → Account Setup → First Devices → Growing Together
- "Not the Right Time" replaces "Closed - Not a Fit"

**Enrichment:**
- Organization Knowledge Bootstrap auto-generates a profile from the partner's website
- Neighborhood Insights provide census and historical context
- Intelligence Profiles are created automatically for targeted discovery

**Tips:**
- Open the Story tab to see the full relationship narrative
- Reflections you add from meetings and events appear in the Story timeline
- Journey chapter changes are tracked automatically`
  },
  {
    id: 'pipeline',
    icon: GitBranch,
    title: 'Journey',
    description: 'Visualize where each partnership is in its journey toward sustained impact.',
    content: `The Journey view shows where your partnerships stand — not as a sales funnel, but as a progression of deepening relationship.

**Journey Chapters:**
- **Found**: You've identified a potential partner
- **First Conversation**: You've made contact
- **Discovery**: You're learning about each other's work
- **Pricing Shared**: You've discussed what partnership looks like
- **Account Setup**: Agreements are forming
- **First Devices**: Technology is reaching the community
- **Growing Together**: A sustained, producing partnership

**Key Metrics:**
- **Probability**: Likelihood of successful partnership formation (0-100%)
- **Estimated Monthly Volume**: Projected devices per month
- **Target First Volume Date**: Expected go-live date
- **Days in Chapter**: Automatically tracked to identify relationships that may need attention

**Automation:**
- Journey entries are auto-created when an Opportunity reaches "Discovery"
- Chapter changes automatically update the entry date
- At "Account Setup", click "Convert to Anchor" to mark sustained partnership

**Tips:**
- Amber highlighting indicates partnerships that may need a check-in (>30 days in chapter)
- Journey milestones trigger supportive notifications`
  },
  {
    id: 'anchors',
    icon: Anchor,
    title: 'Anchors',
    description: 'Organizations that have reached first device distribution.',
    content: `Anchors are your primary KPI—organizations that have achieved their first volume of device distribution.

**Key Dates:**
- First Contact Date
- Discovery Date
- Agreement Signed Date
- First Volume Date (defines "Anchor Formed")
- Stable Producer Date

**Metrics:**
- **Anchor Tier**: Strategic, Standard, or Pilot
- **Monthly Volume**: Devices distributed
- **Growth Trend**: Up, Flat, or Down
- **Risk Level**: Low, Medium, or High
- **Strategic Value (1-5)**: Importance rating

**Note:**
Anchors are created through the Pipeline conversion process to ensure data integrity and proper lifecycle tracking.`
  },
  {
    id: 'grants',
    icon: DollarSign,
    title: 'Grants',
    description: 'Track funding opportunities from research through award.',
    content: `The Grants module manages your organization's funding pipeline from initial research through award and reporting.

**Stages:**
1. Researching → Prospecting → Cultivating
2. Application Prep → Submitted → Under Review
3. Awarded or Closed/Declined

**Key Fields:**
- **Funder Name & Type**: Foundation, Corporate, Government, or Individual
- **Grant Name**: Specific program or opportunity title
- **Amounts**: Requested vs. Awarded
- **Star Rating (1-5)**: Priority ranking for your team
- **Fiscal Year**: Budget cycle alignment
- **Grant Types**: Operating, Program, Capital, Emergency, Capacity Building

**Terms & Reporting:**
- Multi-year grant support with term start/end dates
- Match required flag for matching fund requirements
- Reporting frequency tracking (Monthly, Quarterly, Annually)

**Activity Tracking:**
Log research, funder meetings, application submissions, and follow-ups with the built-in activity timeline.

**Internal Notes:**
Strategy notes are visible only to Admin and Leadership roles for sensitive planning discussions.

**Integrations:**
- Link grants to specific Metros and Opportunities
- View related grants from Opportunity detail modals
- Import via CSV with automatic Metro and Organization matching
- Dashboard KPI cards show grant pipeline metrics

**Tips:**
- Use star ratings to prioritize high-value opportunities
- Stage changes automatically update the stage entry date
- Filter by grant type or fiscal year to focus your pipeline`
  },
  {
    id: 'events',
    icon: Calendar,
    title: 'Events',
    description: 'Community outreach events and partner engagements.',
    content: `Events track community activities, partner meetings, and outreach efforts.

**Event Types:**
Customizable via Admin settings (e.g., Distribution, Community Fair, Partner Meeting)

**Planning Fields:**
- Priority, Status, Travel Required
- Expected Households/Referrals
- Cost Estimate, Staff Deployed

**Results Fields (after event):**
- Households Served, Devices Distributed
- Internet Signups, Referrals Generated
- Anchor Identified, Follow-up Meeting Scheduled

**Features:**
- Multi-day events with end dates
- Recurring event patterns
- External registration URLs
- Strategic Lane and PCS Goal tagging

**Tips:**
- Toggle "Attended" to mark events as completed
- Results fields reset to zero for future events to prevent stale data`
  },
  {
    id: 'people',
    icon: Users,
    title: 'The People',
    description: 'The individuals you\'re building relationships with at partner organizations.',
    content: `The People section is where you track the humans behind the partnerships — the program directors, executive leaders, and community coordinators you work with every day.

**Key Fields:**
- Name, Title, Email, Phone
- Linked Opportunity (organization)
- Primary Contact flag
- Met at Event (how you first connected)

**Pretty Permalinks:**
Each person has a unique URL based on their name (e.g., /people/john-smith) for easy sharing and bookmarking.

**Detail Page Features:**
- **Email History**: View synced Gmail conversations with this person
- **Meeting History**: All meetings (CRM + Google Calendar) with this person
- **Call History**: Log and track phone conversations
- **Tasks**: Manage tasks with due dates and overdue alerts

**AI Integration:**
- **OCR Scanner**: Scan business cards to auto-fill fields
- **Email Insights**: AI suggests new people from your emails
- **Read.ai**: Meeting action items auto-create tasks
- **Manual Text Intake**: Paste business card or signature text for AI extraction

**Tips:**
- Use the searchable selector when linking people to opportunities
- Reflections support rich text formatting (bold, lists, headings)
- Draft people (not linked to an opportunity) are visible only to you`
  },
  {
    id: 'campaigns',
    icon: FileText,
    title: 'Relatio Campaigns™',
    description: 'Build and send relationship-first email campaigns directly from your Gmail.',
    requiredFeature: 'outreach_campaigns',
    content: `Create targeted email campaigns that send directly from your connected Gmail account.

**Campaign Workflow:**
1. Create a new campaign with subject and email body
2. Build your audience using filters (metros, stages, partner tiers)
3. Add individual contacts or import from opportunity filters
4. Review audience list and preview recipient count
5. Send test email to yourself, then send the full campaign

**Audience Building:**
- **Opportunity Filters**: Target by stage, partner tier, mission snapshot, metro
- **Organization People**: All contacts linked to matching opportunities
- **Manual Entry**: Add individual email addresses directly
- Recipients are snapshotted at build time (list won't change during send)

**Personalization Tags:**
Use merge tags in your email body for personalized content:
- \`{{ contact.FIRSTNAME }}\` → First name
- \`{{ contact.LASTNAME }}\` → Last name
- \`{{ contact.FULLNAME }}\` → Full name
- \`{{ contact.EMAIL }}\` → Recipient's email address

**Gmail Integration:**
- Emails sent from YOUR connected Gmail account
- Each user sends campaigns as themselves—recipients see your real email
- Gmail must be connected in Settings with send permission
- Batched sending (25 at a time) with built-in rate limiting

**Send Guardrails:**
- Send blocked if subject or body is empty
- Send blocked if audience count is zero
- Confirmation required if prior attempt had failures
- Server-side daily caps: soft cap (500/day) and hard cap (2,000/day)

**Campaign Analytics:**
- **Subject Performance**: Track sent/failed counts per subject line
- **Failure Breakdown**: Distribution of failure categories
- **Campaign Replies**: Detected inbound replies with human rating (Useful / Neutral / Not Useful)
- **Follow-Up Suggestions**: System-suggested follow-ups from reply patterns and watchlist signals

**Tips:**
- Send a test email to yourself first to verify formatting
- Relatio Campaigns™ is a paid add-on — not included in any base plan
- Rate campaign replies to improve future outreach recommendations`
  },
  {
    id: 'reports',
    icon: FileText,
    title: 'Reports',
    description: 'Custom reports, scheduled delivery, and narrative impact exports.',
    content: `Build reports that tell the story of your work — not just the numbers.

**Report Builder:**
- KPI Overview, Journey by Chapter, Anchor Trends, Recent Wins
- Upcoming Events, Metro Summary
- Filter by Region or Metro

**Scheduling:**
- Daily, Weekly, or Monthly delivery
- Set specific day/time
- Multiple email recipients

**Human Impact Reports:**
- Narrative-driven board-ready exports (see dedicated section)
- Executive View at /reports/impact-export
- PDF download with professional typography

**Export:**
- PDF generation for offline sharing
- Email delivery via scheduled automation`
  },
  {
    id: 'search',
    icon: Search,
    title: 'Global Search',
    description: 'Find anything quickly across the application.',
    content: `Use the search bar in the header or press ⌘K (Mac) / Ctrl+K (Windows) to open global search.

**Searchable:**
- Opportunities (by organization or contact name)
- The People (by name or email)
- Events (by name or city)
- Journey items (by organization or metro)

**Tips:**
- Type at least 2 characters to see results
- Click a result to navigate to that section`
  },
  {
    id: 'intel-feed',
    icon: Play,
    title: 'Intelligence Feed',
    description: 'Prioritized daily summary of signals, connections, and strategic opportunities.',
    content: `The Daily Intelligence Feed provides a prioritized timeline of significant signals and new connections to guide your daily outreach.

**What It Shows:**
- Search results that surfaced new people, events, or grants
- Relationship edges connecting organizations across your metro
- Watchlist signals indicating partner website changes
- Discovery highlights from proactive research runs

**Priority Scoring:**
Items are ranked by signal confidence, recency, metro relevance, and relationship momentum context.

**Tips:**
- Check the Intel Feed daily for the highest-impact outreach opportunities
- Items link directly to the relevant opportunity, contact, or event for quick action`
  },
  {
    id: 'discovery',
    icon: Search,
    title: `Discovery (${modules.signum.label})`,
    description: 'Territory-aware discovery — finds partners, events, and grants within your activated territories.',
    content: `The Discovery system provides territory-aware search across three areas, filtered by your activated territories with archetype-sensitive relevance scoring.

**Find People** (/people/find)
Search for staff, leadership, and team members at target organizations with intent-enforced queries and role focus biasing.

**Find Events** (/events/find)
Discover conferences, summits, webinars, and community events with ticketing/commerce suppression.

**Find Grants** (/grants/find)
Find grant opportunities, RFPs, and funding sources with course/template blocking.

**Territory-Aware Scoring:**
Results are scored by proximity to your activated territories:
- Metro organizations score highest (1.0)
- County results score 0.85 (fair rural weighting)
- State-level results score 0.7
- Results outside your territories appear in an "Explore beyond" section

**How Search Works:**
1. Enter your query — the system appends required intent keywords automatically
2. Results are scoped to your activated territories by default
3. Micro-Crawl: top 5 URLs are scraped for deeper extraction
4. LLM extracts structured results from the crawled content

**Saved Searches:**
- Save any search for re-running later
- "New result" highlighting — URLs are deduplicated across runs
- Private to the creator (per-user RLS)

**Tips:**
- Click sample phrases on the Find People page to get started quickly
- Sector tags from your organization add relevance weighting without filtering
- Solo caregivers are locked to their base state for discovery`
  },
  {
    id: 'watchlist',
    icon: Bell,
    title: 'Watchlist Monitoring',
    description: 'Automated website monitoring for partner organizations with signal detection.',
    content: `The Watchlist system monitors partner websites for changes and surfaces actionable signals.

**Signal Types:**
- **Hiring**: New job postings, leadership openings
- **Expansion**: New locations, service areas, programs announced
- **Funding**: Grant awards, fundraising milestones
- **Leadership Change**: New executives, board appointments
- **Program Update**: New programs, service changes

**Signal → Action Flow:**
- Signals with confidence ≥ 0.4 auto-generate campaign suggestions
- Anti-spam: suggestions suppressed for orgs dismissed/snoozed in last 7 days
- Push notifications (T1) deliver signals directly to your device

**Tips:**
- Signals appear on Organization detail pages and the Dashboard
- Deep Dive is useful before key meetings to get fresh intel`
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notifications',
    description: 'Stay on top of milestones, signals, and gentle reminders.',
    content: `${brand.appName}™ has two notification systems: in-app notifications and push notifications.

**In-App Notifications (Bell Icon):**
- Overdue actions and pipeline milestones
- High-score Next Best Actions (score ≥ 12)
- Reactivation of snoozed actions
- Automation health alerts (admin only)

**Proactive Notifications:**
- Upcoming events within 14 days
- Leadership changes detected in org rosters
- High-priority relationship actions (score ≥ 70)
- Daily cap of 5 proactive notifications per user

**Push Notifications — Tiered System:**
- **Tier 1 (Direct)**: Watchlist signals, campaign suggestions, enrichment, automation failures
- **Tier 2 (Bundled)**: Campaign send summaries (opt-in)
- **Tier 3 (Digest)**: Daily digest 8:30am, weekly summary Monday 9am (opt-in)
- Smart delivery: quiet hours 9pm–8am, hourly caps
- Enable in Settings → Push Notifications`
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Settings',
    description: 'Personalize your experience, configure integrations, and manage workspace preferences.',
    content: `Configure your personal preferences, workspace settings, and integrations.

**Profile:**
- Display Name, Nickname, Timezone

**Appearance:**
- Theme (Light, Dark, or System preference)

**Relational Orientation:**
- Choose how your workspace emphasizes relationships: Human-focused, Institution-focused, or Hybrid
- Controls UI richness density, compass signal weighting, and narrative phrasing
- Auto-manage mode lets richness follow orientation defaults
- Changes are audited for transparency

**AI & Integrations:**
- **Gmail AI Settings**: Enable AI analysis of your emails for contact/task suggestions
- **Gmail Outreach**: Connect Gmail with send permission for email campaigns
- **Read.ai Integration**: Connect Read.ai via Zapier for automatic meeting note capture
- **Ignored Email Domains**: Filter internal emails from AI analysis
- **Manual Intake**: Paste text (business cards, email signatures) for AI extraction
- **Simple Intake**: Enable email-based intake for team members who prefer email over the app

**Discovery Keywords:**
- Manage your organization's discovery keyword stack for Local Pulse and Signum
- Add mission-specific terms to improve community event and partner discovery
- Keywords flow through a 4-layer stack: global → archetype → enriched → your keywords

**Notifications:**
- Push Notifications with per-type toggles
- Quiet hours configuration (default 9pm–8am)
- Calm Digest preferences: daily, weekly, monthly, or off — with section toggles

**Familia:**
- View and manage organizational kinship (parent-child or sibling relationships)
- NRI-detected kinship suggestions appear here for review

**Security:**
- Change Password with strength indicator
- Sign Out All Sessions
- Delete Account (contact admin)

**Tips:**
- Your timezone affects how all dates and times display
- Enable Gmail AI only when you're ready — it processes emails after that point
- Relational orientation can be changed at any time — no data is lost, only presentation adapts`
  },
  {
    id: 'relationship-stories',
    icon: BookOpen,
    title: 'Your Relationship Story',
    description: 'How each partnership grows over time — told through reflections, emails, and shared moments.',
    content: `Every partnership has a story. ${brand.appName}™ helps you see it.

The Story tab on each opportunity weaves together everything that's happened in the relationship — your reflections, emails you've sent, campaigns that reached this partner, events you attended together — into a living narrative.

**What Feeds the Story:**
- **Reflections**: Your observations after meetings, calls, and visits — the richest source of relationship memory
- **Email History**: Sent emails are quietly recorded as touchpoints
- **Campaign Touches**: When a campaign email reaches this partner, it becomes part of the story
- **Event Reflections**: When you mark an event as attended and write a reflection, that moment enters the story
- **Tasks from Emails**: Commitments you made in sent emails are surfaced as task suggestions

**Story Chapters:**
- "How we connected" — the earliest recorded interaction
- "The conversation" — email exchanges and ongoing dialogue
- "What we've shared" — campaigns and outreach efforts
- "Reflections along the way" — your personal observations over time

**Privacy:**
- Your reflections are never quoted verbatim in shared narratives
- Only extracted topics and themes are used by AI systems
- Email bodies are never injected into metro narratives or reports

**Tips:**
- Write reflections regularly — they are the heart of the story
- The Story tab grows richer over time as more touchpoints accumulate`
  },
  {
    id: 'metro-narratives',
    icon: Map,
    title: 'Metro Narrative',
    description: 'A living community story — not news, but awareness.',
    content: `Metro Narratives tell the story of what's happening in each community where you work. This is not a news feed. It's a slow-building awareness of community shifts, partner responses, and emerging patterns.

**What It Includes:**
- **Community Shifts**: External signals — policy changes, program launches, demographic trends
- **Partner Responses**: How your tracked organizations are responding
- **Emerging Patterns**: Cross-partner themes across your metro
- **Outlook**: Forward-looking context for planning

**Calm Tone:**
Metro Narratives are never urgent. The engine filters out alarmist language and presents everything with a calm, reflective voice focused on community progress.

**Where to Find It:**
- Metro Detail view → "Metro Story" panel
- Narratives feed at /metros/narratives
- Drift Detection highlights appear on the Momentum Heatmap

**Tips:**
- Check Metro Narratives weekly for a holistic view of your community
- The narrative gets richer as more reflections and signals accumulate`
  },
  {
    id: 'journaling',
    icon: PenTool,
    title: 'Reflections',
    description: 'Your personal observations that quietly enrich every story.',
    content: `Reflections are how you record what matters — after a meeting, a community event, or just a conversation that stuck with you. They are the most human part of ${brand.appName}™.

**What Reflections Are:**
- Free-form text (up to 6,000 characters) capturing your observations
- Private by default — only you can see them unless you choose team visibility
- Tied to opportunities, events, or standalone as personal journaling

**How They Feed the System:**
1. You write a reflection
2. ${brand.assistantName}™ extracts topics, signals, and organization mentions (never quoting your words)
3. These extracted themes provide "narrative color" to Relationship Stories and Metro Narratives

**Privacy Guarantee:**
- Reflection text is NEVER quoted verbatim in shared views
- Only extracted signals (topics, themes) are used
- RLS enforcement ensures only you (or your team, if shared) can read the full text

**Tips:**
- Write about what surprised you, what you learned, or what feels important
- Regular reflections make every narrative richer and more grounded`
  },
  {
    id: 'local-pulse',
    icon: MapPin,
    title: 'Local Pulse',
    description: 'Community event discovery powered by your mission keywords.',
    content: `Local Pulse discovers community events and resources relevant to your mission — using a hybrid approach of AI-powered search and web scraping.

**How It Works:**
1. The system searches for events using your organization's keyword stack (mission-specific terms)
2. Perplexity AI discovers relevant community happenings in your territories
3. Promising results are scraped by Firecrawl for deeper extraction (dates, locations, details)
4. Events appear in your Pulse tab with confidence indicators

**Keyword Tuner:**
Your discovery is driven by keywords you control:
- **Global baseline**: Standard nonprofit/community terms (always included)
- **Archetype keywords**: Terms specific to your mission type (e.g., "digital inclusion" for tech nonprofits)
- **Enriched keywords**: Automatically extracted from your organization's website
- **Your keywords**: Terms you add manually via the inline Keyword Tuner (up to 20)

**Event States:**
- **Confirmed**: Date and details verified
- **Awaiting AI parsing**: Discovered but still being enriched — visible in your Pulse
- **Low confidence date**: Date extracted but uncertain — flagged for your review

**Running Pulse:**
- Scheduled runs happen automatically for your metro
- Manual "Run Pulse" button available in Gardener Settings (CRESCERE zone)
- Long-tail refresh includes stable recurring services (annual programs, ongoing classes)

**Tips:**
- Tune your keywords to improve discovery relevance — more specific terms yield better results
- Items marked "Awaiting AI parsing" will update automatically as enrichment completes
- Dismiss irrelevant events to improve future discovery`
  },
  {
    id: 'provisions',
    icon: Heart,
    title: modules.provisio.label,
    description: 'Providing technology to the partners and communities you serve.',
    content: `${modules.provisio.label} manages technology requests for partner organizations — from catalog selection through delivery.

**Provision Lifecycle:**
Draft → Submitted → In Progress → Ordered → Shipped → Delivered (or Canceled)

**Key Features:**
- **24-Item Catalog**: Desktop, Laptop, Add-on, and Accessory tiers
- **Paste-and-Parse**: Paste text and AI extracts structured items
- **Conversation Thread**: Per-provision messaging for coordination
- **Tracking**: Carrier, tracking number, and delivery status
- **Impact Integration**: Provision totals appear on the Opportunity Impact Tab

**Tips:**
- Use the catalog picker for structured requests
- Paste-and-Parse is useful for forwarded emails with equipment lists
- TSV export ("Copy for Spreadsheet") generates finance-ready data`
  },
  {
    id: 'impact-reports',
    icon: FileText,
    title: 'Human Impact Reports',
    description: 'Board-ready narrative exports that tell the story of your work.',
    content: `Human Impact Reports present your organization's work as a story of community impact — not just metrics.

**Report Sections:**

- **Executive Summary**: Active partners, devices provisioned, events attended, momentum trend
- **Community Impact**: Themes emerging across metros, signal counts, local pulse indicators
- **Relationship Growth**: Journey chapters visualized as story progression
- **Support Delivered**: Provision units, breakdown by status, average per partner
- **Momentum & Signals**: Rising, falling, and stable partner counts

**Board Report Export:**
Click "Executive View" for a full-screen, distraction-free layout:
- Download as PDF with professional typography
- Print directly from browser with optimized CSS
- Privacy guards: only aggregated data — no raw reflections or email content

**Tips:**
- Use the Impact tab for daily review, Executive View for board presentations
- Filter to a specific metro for localized board reports`
  },
  {
    id: 'volunteers',
    icon: Heart,
    title: modules.voluntarium.label,
    description: 'Track volunteers, log hours, and celebrate community helpers.',
    content: `The ${modules.voluntarium.label} module tracks community members who donate their time. It is not a corporate HR tool — it is designed for simplicity and gratitude.

**Volunteers List (/volunteers)**
- View all volunteers with name, email, last volunteered date, lifetime hours, and status
- Gentle reliability labels: "Recent helper" (≤14 days), "Steady helper" (≤30 days), "Returning soon" (≤90 days)
- Filter by status (Active / Inactive)

**How Volunteers Submit Hours by Email:**
\`HOURS: YYYY-MM-DD | 3.5 | warehouse\`
\`HOURS: YYYY-MM-DD | 2 | event: Some Event Name\`

**Event Integration:**
- Event detail pages include a "Volunteer Hours" section
- Log hours for any volunteer directly from an event page

**Tips:**
- Reliability labels use configurable thresholds — they are not urgency signals
- Hours are rounded to the nearest 5 minutes`
  },
  {
    id: 'import-center',
    icon: Upload,
    title: 'Import Center',
    description: `CSV import for transitioning into ${brand.appName}™.`,
    content: `The Import Center makes it easy for organizations to leave their legacy CRM and transition into ${brand.appName}™.

**Import Types:**
- Organizations / Partners → creates opportunities
- People / Contacts → creates contacts
- Volunteers → creates volunteer records

**Source Systems:**
- Generic CSV — works with any CSV export
- HubSpot Export — auto-maps common column names
- Salesforce, Zoho, Pipedrive — CSV presets

**Import Flow:**
1. Select import type and source system
2. Upload a CSV file (max 50,000 rows)
3. Auto-detect and map columns
4. Preview first 200 rows to verify mapping
5. Import with deduplication rules

**Tips:**
- Use the HubSpot Export preset when importing from HubSpot
- Always preview before importing to verify column mapping`
  },
  {
    id: 'radar',
    icon: Radar,
    title: 'Radar',
    description: 'Prioritized partner attention signals — who needs a check-in, and why.',
    content: `The Radar surfaces partnerships that may need attention — organized by urgency, not by alarm.

**Urgency Levels:**
- **Critical**: Overdue actions + declining signals
- **High**: Stale next steps or missed milestones
- **Medium**: Approaching deadlines or follow-up windows
- **Low**: Steady partnerships worth a gentle check-in

**Signal Types:**
- Overdue Next Actions
- Stale Pipeline Entries (>30 days in chapter)
- Watchlist signals (website changes, hiring, expansion)
- Upcoming events needing confirmation

**Tabs:**
- **Partners**: All opportunities sorted by urgency score
- **Signals**: Raw signal feed with type filtering

**Tips:**
- Check Radar weekly during planning
- Click any partner row to jump to their detail page
- Radar is not a pressure tool — it's a gentle nudge system`
  },
  {
    id: 'relationship-graph',
    icon: Workflow,
    title: 'Relationship Graph',
    description: 'Visualize how organizations, people, grants, and events connect across your network.',
    content: `The Relationship Graph renders your entire relationship ecosystem as an interactive network visualization.

**Node Types:**
- **Organizations**: Your partner opportunities
- **People**: Contacts linked to organizations
- **Grants**: Funding tied to specific partners or metros
- **Events**: Community events with partner connections

**Interactions:**
- Click nodes to highlight their connections
- Zoom and pan to explore the network
- Filter by node type to simplify the view
- Search for specific organizations or people

**What It Reveals:**
- Clusters of tightly connected partners
- Isolated organizations that could benefit from introductions
- People who bridge multiple organizations
- Grant–partner relationships across metros

**Tips:**
- Use the Graph to prepare for community meetings — see who connects to whom
- Look for isolated nodes — they may represent untapped relationships`
  },
  {
    id: 'calendar',
    icon: CalendarDays,
    title: 'Calendar',
    description: 'Month and week views for meetings, events, and touchpoints.',
    content: `The Calendar provides a visual overview of all your scheduled activities — meetings, events, and touchpoints.

**Views:**
- **Month View**: See the full month at a glance with event dots
- **Week View**: Detailed daily breakdown with time slots

**Key Features:**
- Create meetings directly from the calendar
- Link meetings to contacts and metros
- Mark meetings as attended
- Add notes and next actions

**Google Calendar Sync:**
- Connect your Google Calendar in Settings
- Two-way sync keeps your CRM calendar and Google Calendar aligned
- Synced events show a Google icon indicator

**Tips:**
- Click any day to see its events in detail
- Use the + button to create a meeting on a specific date
- The calendar respects your timezone setting`
  },
  {
    id: 'activities',
    icon: Activity,
    title: 'Activities',
    description: 'Unified log of all meetings, calls, tasks, and touchpoints.',
    content: `The Activities page is a chronological log of every touchpoint across your relationships — meetings, calls, tasks, and notes.

**Activity Types:**
- **Meeting**: In-person or virtual meetings with contacts
- **Call**: Phone conversations
- **Task**: Follow-up items and action commitments
- **Email**: Logged email interactions
- **Site Visit**: Field visits to partner locations
- **Check-In**: Quick status updates

**Filtering:**
- Search by notes, contact name, or organization
- Filter by type (meetings, calls, tasks)
- Filter by source (manual, Google Calendar, Read.ai)

**Features:**
- Edit or update any activity inline
- Link activities to contacts, opportunities, and metros
- Track outcomes (Completed, Follow-Up Needed, No Response)
- Activities feed into the Relationship Story timeline

**Tips:**
- Activities created from Google Calendar sync are read-only
- Use the "attended" flag to mark completed meetings`
  },
  {
    id: 'projects',
    icon: Heart,
    title: 'Projects (Good Work)',
    description: 'Community service projects — organizing good work your team does together.',
    content: `Projects are containers for the good work your community does together — painting a house, running a food drive, organizing a cleanup day, or hosting a mission trip.

**Project Types:**
Projects can be categorized by type to help with year-end reporting and narrative storytelling. Types vary by organization archetype:

- **Direct Service**: Home Repair, Food/Clothing Drive, Meal Delivery, Transportation Assistance
- **Community Care**: Neighborhood Cleanup, Community Garden, Holiday Gift Drive, Back-to-School Event
- **Education & Empowerment**: Tutoring/Mentoring, Literacy Workshop, Financial Literacy, Job Readiness Training
- **Shelter & Housing**: Shelter Night, Furniture Setup, Welcome Kit Assembly, Housing Navigation
- **Spiritual & Pastoral**: Hospital/Care Facility Visit, Grief Support Group, Prayer Walk, Mission Trip
- **Advocacy & Outreach**: Voter Registration Drive, Listening Session, Resource Fair, Community Forum

**How It Works:**
1. Create a project with a title, date, and optional location
2. Add helpers (volunteers and staff) as participants
3. Record reflections and voice notes as the work unfolds
4. Optionally log impact — people helped, attendance count, and outcome notes

**Impact Tracking:**
Each project includes a calm, optional impact snapshot:
- **People Helped**: How many community members were served
- **Attendance Count**: How many helpers participated
- **Outcome Note**: A brief narrative of what happened and what it meant

**Downstream Signals:**
- Projects feed into **Narrative Threads** as weekly story chapters
- Impact data flows into **Testimonium** rollups for year-end reporting
- Story density (notes per project) is tracked to encourage reflection capture
- If Communio is enabled, anonymized aggregate signals are shared across the network

**Tips:**
- Projects are not project management — they're story containers for good work
- Voice notes captured during a project become part of the project's narrative
- Even a brief outcome note makes your year-end reporting dramatically richer
- Helpers can be linked to contacts or volunteers for relationship tracking`
  },
  {
    id: 'recycle-bin',
    icon: Trash2,
    title: 'Recently Deleted',
    description: 'Recover accidentally deleted records within 7 days.',
    content: `The Recently Deleted section appears on your Command Center and provides a safety net for accidental deletions.

**How It Works:**
- When you delete an opportunity, contact, metro, event, grant, or volunteer, the record is soft-deleted
- Soft-deleted records are hidden from all views but preserved in the database
- You can restore any record within 7 days with one click

**What's Recoverable:**
- Opportunities (partners)
- Contacts (people)
- Metros
- Events
- Grants
- Volunteers

**Restoration:**
- Click "Restore" next to any recently deleted item
- The record reappears exactly as it was — all linked data intact
- After 7 days, records move to a 90-day archive (recoverable by your administrator)

**Tips:**
- The Recently Deleted widget shows your last 10 deletions
- Don't panic if you accidentally delete something — it's always recoverable`
  },
  {
    id: 'nri-guide',
    icon: Sparkles,
    title: `${brand.assistantName}™ Guide`,
    description: 'Your AI relationship assistant — answers questions, surfaces insights, and helps you take action.',
    content: `The ${brand.assistantName}™ Guide is your AI-powered relationship assistant — it knows the platform deeply, understands your organization's context, and can help with both questions and actions.

**How to Access:**
- Click the sparkle button (✦) in the bottom-right corner of any page
- The assistant opens as a slide-over drawer

**What It Can Help With:**
- **Platform questions**: "How do I add a volunteer?" "What does Local Pulse do?" "How do I connect my email?"
- **Relationship context**: Summaries of partner history, recent activity, and suggested next steps
- **Quick actions**: Add organizations and contacts by name ("Add Habitat for Humanity"), draft email campaigns, log reflections
- **Bulk intake**: Add multiple organizations at once with website URLs for auto-enrichment
- **Recovery help**: "I accidentally deleted something" — the assistant can guide you through recovery

**Honesty Guardrails:**
- ${brand.assistantName}™ never claims it did something it didn't do
- Actions are clearly labeled: 📋 means queued for your review, ✅ means completed immediately
- If an action fails, the assistant tells you explicitly and suggests alternatives

**Conversation History:**
- Conversations are saved across sessions
- Start a new conversation anytime
- Previous context helps the assistant give better answers

**Privacy:**
- The assistant only knows about your organization's data
- It cannot see, access, or speculate about other organizations on the platform
- Your conversations are private to your workspace

**Tips:**
- Ask ${brand.assistantName}™ about any feature — it knows every section of the platform
- Use it before meetings: "Summarize my relationship with [partner name]"
- Try bulk intake: "Add these orgs: Habitat for Humanity (habitat.org), Goodwill (goodwill.org)"
- The assistant learns from your organization's AI Knowledge Base`
  },
  {
    id: 'playbooks',
    icon: Book,
    title: 'Playbooks',
    description: 'Shared guides and best practices for your team.',
    content: `Playbooks are living reference documents your team creates and shares — field guides for common scenarios and best practices.

**Categories:**
- **General**: Best practices and standard operating procedures
- **Metro**: Region-specific guides and local knowledge
- **Anchor Type**: Strategies by partner tier (Strategic, Standard, Pilot)
- **Grant Type**: Grant-specific application and reporting guides

**Features:**
- Rich text editing with formatting, lists, and headings
- Search across all playbooks
- Filter by category
- Link playbooks to specific metros

**Access:**
Find Playbooks from the user menu (top-right avatar → Playbooks).

**Tips:**
- Create metro-specific playbooks for onboarding new team members to a region
- Update playbooks regularly as you learn what works`
  },
  {
    id: 'my-activity',
    icon: BarChart3,
    title: 'My Stats',
    description: 'Personal activity metrics and engagement tracking.',
    content: `My Stats provides a personal dashboard of your activity across the platform — a gentle reflection of your engagement, not a performance scorecard.

**What It Tracks:**
- Reflections written
- Meetings logged
- Campaigns sent
- People added
- Events attended

**Access:**
Find My Stats from the user menu (top-right avatar → My Stats).

**Tips:**
- Check My Stats weekly to see your own rhythm
- It's designed for self-awareness, not management oversight`
  },
  {
    id: 'feedback',
    icon: HelpCircle,
    title: 'Help Requests',
    description: 'Submit questions, report issues, and track your support requests.',
    content: `The Help Requests page lets you submit questions or report issues directly to the platform operator.

**How It Works:**
1. Click "Help / Report something" from the user menu (top-right avatar)
2. Describe your question or issue
3. Submit — your request is tracked with a status

**Request Statuses:**
- **New**: Just submitted, awaiting review
- **In Progress**: Being looked at by the operator
- **Resolved**: Issue addressed or question answered

**Tips:**
- Include specific details (what page, what you expected, what happened)
- Check back to see status updates on your requests`
  },
  {
    id: 'visits',
    icon: MapPin,
    title: 'Visits',
    description: 'Simplified mobile-first visit tracking for Visitors and Companions.',
    content: `Visits provides a streamlined way to record partner visits directly from your phone.

**Who Uses Visits:**
- **Visitors**: Field team members whose primary role is visiting partner organizations
- **Companions**: Support team members who accompany visitors

**How It Works:**
1. Open Visits from the home screen
2. Select the partner organization you're visiting
3. Add a brief reflection or notes about the visit
4. Submit — the visit is logged with time, location, and your notes

**What Gets Recorded:**
- Visit date and time
- Partner organization visited
- Notes and reflections
- Any follow-up actions identified

**Tips:**
- Visits are designed to be completed in under 60 seconds
- Your visit history builds the relationship story over time
- Visit data feeds into Narrative Threads and relationship insights`
  },
  {
    id: 'narrative-threads',
    icon: BookOpen,
    title: 'Narrative Threads',
    description: 'Weekly story threads assembled from reflections, visits, and signals.',
    content: `Narrative Threads weave together your team's weekly activity into coherent story arcs.

**How Threads Form:**
Each week, the system gathers reflections, visit notes, event attendance, and relationship signals to create a narrative summary of what happened across your community.

**What You'll See:**
- **Weekly Summaries**: A gentle narrative of the week's meaningful moments
- **Connection Patterns**: Relationships that deepened or new ones that formed
- **Community Movement**: Shifts in engagement, new volunteers, or emerging themes

**How to Use Threads:**
- Review threads weekly during team meetings for shared awareness
- Use threads as the basis for reports or stakeholder updates
- Let threads surface patterns you might not notice day-to-day

**Tips:**
- Threads are richer when team members consistently log reflections and visits
- The narrative improves over time as the system learns your community's rhythm
- Threads are private to your organization — they never leave your workspace`
  },
  {
    id: 'help-adoption',
    icon: Heart,
    title: 'Adoption & Daily Rhythm',
    description: 'Narrative-first formation space for building daily rhythm across roles.',
    content: `The Adoption & Daily Rhythm guide helps your team build sustainable habits with ${brand.appName}™.

**Daily Rhythm by Role:**

**Stewards (Admins):**
- Morning: Review Command Center signals and team activity
- Midday: Check Narrative Threads for emerging patterns
- Weekly: Review reports and adjust team focus areas

**Shepherds (Regional Leads):**
- Morning: Check radar for partner attention signals
- During visits: Log reflections and visit notes
- Weekly: Review journey progress and upcoming events

**Companions (Staff):**
- Before visits: Review partner context and recent activity
- After visits: Log visit notes and reflections
- Weekly: Update activities and follow-up actions

**Visitors (Field Team):**
- Each visit: Use the Visits page to quickly log your visit
- After meaningful conversations: Add a reflection
- Weekly: Review your visit history and patterns

**Building Momentum:**
- Start with one habit per role — consistency matters more than coverage
- Use Playbooks to guide new team members through their first week
- Celebrate small milestones — every logged reflection strengthens the story

**Tips:**
- Adoption is a rhythm, not a checklist
- The system becomes more valuable as more team members participate
- Focus on reflections and visits first — everything else builds from there`
  },
  {
    id: 'find-discovery',
    icon: Search,
    title: 'Find Pages (People, Events, Grants)',
    description: 'AI-powered discovery pages for finding new partners, events, and funding opportunities.',
    content: `The Find pages use AI-powered web search to discover new connections for your organization.

**Find People** (Partners → Find People):
Search the web for potential partner contacts at organizations you're exploring. Results include names, titles, and contact information when publicly available.

**Find Events** (Scheduling → Find Events):
Discover community events, conferences, and gatherings relevant to your mission and metro areas. Results are filtered by your organization's archetype and geographic focus.

**Find Grants** (Grants → Find Grants):
Search for funding opportunities matching your organization's mission. Results include grant names, funders, deadlines, and eligibility summaries.

**How Discovery Works:**
1. Enter a search query or let the system suggest searches based on your context
2. Review results — each includes a relevance summary
3. Save promising results to your workspace for follow-up
4. Dismissed results won't appear again

**Tips:**
- More specific searches yield better results
- Discovery learns from your saves and dismissals over time
- Results are refreshed regularly — check back for new opportunities`
  },
  // ── TIER-GATED SECTIONS ──
  {
    id: 'testimonium',
    icon: BookOpen,
    title: `${modules.testimonium.label}™`,
    description: 'Narrative storytelling and insight layer for creating impact reports from relationship data.',
    requiredFeature: 'testimonium',
    content: `${modules.testimonium.label}™ transforms your accumulated relationship data into structured impact narratives.

**What It Does:**
- Generates insight reports from reflections, signals, and community data
- Creates narrative arcs that show how partnerships evolve over time
- Identifies cross-partner themes and emerging community patterns

**Key Features:**
- **Story Generation**: AI-assisted narrative creation from multiple data sources
- **Drift Detection**: Track how community themes shift week over week
- **Heat Map Overlays**: Geographic visualization of narrative density and community engagement
- **Export**: PDF exports for sharing with stakeholders

**Tips:**
- ${modules.testimonium.label}™ requires the Insight plan
- The more reflections you write, the richer the narratives become`
  },
  {
    id: 'impulsus',
    icon: PenTool,
    title: `${modules.impulsus.label}™`,
    description: 'Private impact scrapbook journal for capturing field moments.',
    requiredFeature: 'impulsus',
    content: `${modules.impulsus.label}™ is your private impact journal — a scrapbook of moments, observations, and field experiences that matter to you.

**What It Is:**
- A personal space for capturing photos, notes, and observations from the field
- Private by default — your scrapbook, your stories
- Feeds into executive storytelling tools when you choose to share

**Key Features:**
- **Field Moments**: Quick-capture photos, notes, and voice memos from community visits
- **Executive Storytelling**: Transform field moments into polished impact narratives
- **Narrative Exports**: Board-ready storytelling from your collected moments

**Tips:**
- ${modules.impulsus.label}™ requires the Story plan
- Capture moments as they happen — they become the raw material for powerful narratives`
  },
  {
    id: 'momentum-map',
    icon: Map,
    title: 'Momentum Heatmap',
    description: 'Geographic visualization of community engagement and narrative density.',
    requiredFeature: 'momentum_map_overlays',
    content: `The Momentum Heatmap provides a geographic view of community engagement across your metros.

**What It Shows:**
- Engagement density by metro with color-coded intensity
- Narrative overlay showing story themes per region
- Anchor formation milestones marked on the map
- Drift Detection indicators for shifting community themes

**How It Works:**
The heatmap aggregates anchor counts, event participation, orders, and narrative signals to compute a normalized momentum score per metro. Higher scores indicate more active community engagement.

**Momentum Status:**
- **Rising**: Increasing engagement and new partnerships
- **Steady**: Consistent community activity
- **Cooling**: Declining signals — may need attention

**Tips:**
- Requires the Insight plan for full narrative overlays
- Click any metro marker to see detailed momentum data`
  },
  {
    id: 'relatio',
    icon: Globe,
    title: `${modules.relatio.label}™ Marketplace`,
    description: 'Browse and connect 31+ integration connectors for CRM migration and data sync.',
    requiredFeature: 'relatio_marketplace',
    content: `${modules.relatio.label}™ is the integration marketplace — connecting ${brand.appName}™ to your existing tools with 31+ connectors.

**Two-Way Sync (7 connectors):**
- **HubSpot**: Contacts, companies, deals, tasks, notes
- **Salesforce**: Contacts, accounts, tasks, events, notes
- **Microsoft Dynamics 365**: Full OData v4 sync for all entity types
- **Blackbaud RE NXT**: Constituents, gifts, actions, events, notes via SKY API
- **Google Contacts**: People API sync for contacts, groups, labels
- **Outlook Contacts**: Microsoft Graph sync for contacts, folders, categories
- **CiviCRM**: APIv4 sync for contacts, activities, contributions, events

**One-Way Import (24+ connectors):**
Bloomerang, Virtuous, Oracle CRM, Flocknote, Little Green Light, DonorPerfect, Kindful, Network for Good, Aplos, Monica CRM, Contacts+, Apple Contacts (CSV), and more.

**Sync Direction Control:**
- Stewards can toggle between read-only and two-way sync per connector
- Conflict resolution strategies: Flag for review (default), CROS wins, or Remote wins
- Sync conflicts are surfaced for human review — never auto-resolved silently

**How It Works:**
1. Browse available connectors in the marketplace
2. Follow the guided setup (TurboTax-style step-by-step onboarding)
3. Run a Dry-Run preview to see what will be imported before committing
4. Configure sync direction and conflict resolution preferences
5. Monitor connection health in the integrations panel

**CRM Migration Tools:**
- Guided data mapping from source fields to ${brand.appName}™ fields
- Validation and deduplication during import
- Rollback support for recent imports

**Tips:**
- ${modules.relatio.label}™ requires the Bridge plan
- Always use Dry-Run before your first full sync
- Start with a small batch import to verify field mapping before full migration`
  },
  {
    id: 'communio',
    icon: Users,
    title: 'Communio™',
    description: 'Collaborative groups for inter-organization signal sharing.',
    requiredFeature: 'communio_opt_in',
    content: `Communio™ enables organizations on ${brand.appName}™ to share community signals and event intelligence with trusted peers.

**What It Is:**
- Collaborative groups where multiple organizations share selected signals
- Privacy-first: you control exactly what's shared (events, signals, reflections)
- No data leaves your tenant without explicit sharing actions

**Key Features:**
- **Groups**: Create or join groups with other ${brand.appName}™ organizations
- **Shared Events**: Share community event discoveries across group members
- **Shared Signals**: Surface anonymized community trends across metro areas
- **Signal Metrics**: Weekly rollups of shared signal volume and types

**Privacy Controls:**
- Per-group settings control what can be shared (events, signals, reflections, heatmap)
- Sharing levels: metadata-only, summary, or full detail
- Activity log tracks all sharing actions

**Tips:**
- Communio™ requires the Bridge plan
- Start with event sharing before enabling signal sharing`
  },
  {
    id: 'guided-activation',
    icon: Sparkles,
    title: 'Guided Activation™',
    description: 'Human-led onboarding to help you get started with confidence.',
    content: `Guided Activation™ is a paid, human-led onboarding service. An experienced operator walks you through setup, data migration, and configuration while screen-sharing.

**What's Included:**
- **Single Session**: 90-minute guided setup with a platform operator
- **Guided Activation Plus™**: Two sessions for more complex migrations

**Preparation Checklist:**
Before your session, you'll be asked to prepare a few things organized by category:

- **🔑 Bring your keys (Access)**: Admin logins for your current CRM, export permissions
- **📖 Bring your story (Data)**: Your 25 most important partners, contact lists
- **🧭 Bring your compass (Decisions)**: Email provider choice, campaign preferences
- **🎯 Bring your focus (Goals)**: What success looks like after 30 days

**How It Works:**
1. Purchase Guided Activation from your subscription settings
2. Grant operator access consent (required for the session)
3. Complete the preparation checklist at your own pace
4. Schedule your session — the operator will join via video call
5. The operator guides you through setup while you watch and learn

**Security:**
- Operator access is time-limited (60 minutes by default)
- Every operator session is logged and auditable
- You can revoke access at any time
- The operator can only access your workspace — never other tenants

**Tips:**
- Complete the preparation checklist before your session for the best experience
- Your checklist progress is saved automatically
- You can request help at any time during preparation`
  },
  {
    id: 'metro-news',
    icon: MapPin,
    title: 'Metro Narratives & Community News',
    description: 'Community stories, news sources, keywords, and drift detection across metros.',
    content: `Metro Narratives blend community news with internal partner data to tell living stories about each city.

**Metro Narratives Feed (/metros/narratives)**
- Browse community stories across all metros
- Filter by metro to focus on a specific city
- Each narrative card shows: metro badge, headline, story snippet, AI indicator

**News Sources (Metro Detail → Sources Tab)**
- View all news sources with crawl health indicators
- Sources auto-disable after 3 consecutive failures

**News Keywords (Metro Detail → Keywords Tab)**
- Per-metro keyword overrides for local term weighting
- Metro keywords take priority over global defaults

**Drift Detection:**
- Tracks how community themes shift week over week
- Drift score (0-100) with qualitative labels

**Tips:**
- News sources are the foundation — add reliable local news URLs for each metro
- The narrative feed is designed for browsing during weekly planning`
  },
  {
    id: 'system-sweep',
    icon: Shield,
    title: 'System Sweep & Observability',
    description: 'Admin monitoring of background jobs and system health.',
    content: `The System Sweep provides admin visibility into all background intelligence processes.

**Heartbeat Dashboard:**
- Last Sweep Run, Metros Processed, Suggestions This Week
- Quiet Metros (recent runs, no results) and Stale Metros (no recent run)

**Metro Health Table:**
Per-metro status across News, Events, Narrative, and Drift dimensions with Healthy/Quiet/Stale indicators.

**Suggestion Ledger:**
System-generated relationship nudges with type/metro filtering and dismiss capability.

**Tips:**
- Check the heartbeat weekly to ensure background processes are running
- Stale metros may need their news sources refreshed`
  },
  {
    id: 'admin',
    icon: Shield,
    title: 'Admin (Administrators Only)',
    description: 'System configuration, user management, AI Knowledge Base, and org knowledge.',
    content: `Admin settings are available to users with the Administrator role.

**Sections:**
- **Audit Log**: View all create/update/delete actions
- **Grant Alignments**: Configure grant tags for opportunities
- **Regions & Metros**: Manage geographic structure
- **Sectors**: Configure industry sectors

**Community Health:**
Admin visibility into volunteer and import operations with ingestion stats and import run history.

**AI Knowledge Base (Company-Level):**
Stores canonical organizational identity used by all AI features — Company Profile, Email Tone & Style, Approved Claims. Versioned and injected into all AI prompts automatically.

**Organization Knowledge (Per-Org):**
Bootstrap from website, edit knowledge, view version history. Injected as secondary context into AI prompts.

**User Management:**
- Approve new user registrations
- Assign roles (Admin, Leadership, Regional Lead, Staff)
- Assign region/metro access

**Tips:**
- AI Knowledge Base is admin-only — other users benefit from it through AI outputs
- Organization Knowledge is per-target-org, separate from the Company KB`
  },
  // ── OPERATOR ADMIN SECTIONS ──
  {
    id: 'operator-partners',
    icon: Building2,
    title: 'Operator: Partners',
    description: 'Manage all partner organizations across tenants from the operator console.',
    requiredRole: 'admin' as const,
    content: `The Operator Partners module at /operator/partners gives platform operators a unified view of every opportunity across all tenants.

**Key Features:**
- **List View**: Search, filter, and sort all opportunities across the platform
- **Partner Detail**: Full view of subscription info, contacts, activities, journey, and reflections
- **Subscription Block**: View and manage subscription_status, plan_tier, seats, onboarding_state, Stripe customer ID
- **Convert to Customer**: One-click tenant provisioning from a qualified partner record

**Convert to Customer Flow:**
1. Click "Convert to Customer" on a partner without a tenant_slug
2. The operator-convert-customer edge function bootstraps a new tenant
3. Tenant slug, subscription status, plan tier, and seat allocation are written back
4. Partner record becomes the single source of truth — tenant detail is a read-only mirror

**Tips:**
- The Partner record is always the source of truth — tenant pages link back to it
- Conversion requires the partner to have no existing tenant_slug`
  },
  {
    id: 'operator-metros',
    icon: MapPin,
    title: 'Operator: Metros',
    description: 'Full CRUD metro management from the operator console.',
    requiredRole: 'admin' as const,
    content: `Operator Metros at /operator/metros provides the same metro management capabilities as the tenant view but scoped for platform-wide administration.

**Key Features:**
- Create, edit, and delete metros
- Search and filter across all metros
- View metro health and narrative status
- Assign metros to regions

**Tips:**
- Uses the same hooks as the tenant Metros page
- Changes here affect the global metro catalog available to all tenants`
  },
  {
    id: 'operator-scheduling',
    icon: Calendar,
    title: 'Operator: Scheduling',
    description: 'Calendar view for operator-scoped meetings, demos, and onboarding calls.',
    requiredRole: 'admin' as const,
    content: `Operator Scheduling at /operator/scheduling provides a dedicated calendar for platform operator activities.

**Operator Event Types:**
- **Outreach Meeting**: Initial conversations with prospective partners
- **Demo Session**: Live platform demonstrations for interested organizations
- **Onboarding Call**: Post-signup setup sessions with new customers

**Key Features:**
- Calendar view filtered to operator-created events
- Create, edit, and manage events with the standard event system
- Link events to specific partner opportunities

**Tips:**
- These event types are specific to operator workflows — tenant users see their own event types`
  },
  {
    id: 'operator-outreach',
    icon: Globe,
    title: 'Operator: Outreach Campaigns',
    description: 'Create tracked signup links for marketing campaigns.',
    requiredRole: 'admin' as const,
    content: `Operator Outreach at /operator/outreach manages campaign-tagged signup links that track how new organizations discover ${brand.appName}™.

**Signup Links:**
- Each link has a unique slug, campaign name, and optional default archetype
- When clicked, the operator-signup-track edge function creates a lead opportunity with conversion_source set to the campaign
- Links redirect to /pricing for self-service signup

**Key Features:**
- **Create Links**: Set slug, campaign name, and default archetype
- **Copy to Clipboard**: Quick-copy link URLs for sharing
- **Performance Stats**: Count of opportunities with matching conversion_source

**Tips:**
- Use descriptive campaign names for clear attribution reporting
- Default archetype pre-selects the mission type during onboarding`
  },
  {
    id: 'operator-scenario-lab',
    icon: Compass,
    title: 'Operator: Scenario Lab',
    description: 'Sandbox environment for testing archetype simulations with demo tenants.',
    requiredRole: 'admin' as const,
    content: `The Scenario Lab at /operator/scenario-lab provides a sandbox for testing how different mission archetypes behave in ${brand.appName}™.

**Demo Tenant System:**
- **Create**: Provision isolated demo tenants with seed data for any archetype
- **Reset**: Wipe and re-seed a demo tenant to its clean starting state
- **Simulate**: Run archetype simulation ticks to advance demo tenant state

**Edge Functions:**
- demo-tenant-create — provisions the demo tenant with archetype-specific configuration
- demo-tenant-reset — wipes all data and re-seeds from scratch
- demo-tenant-seed — populates with realistic sample data
- archetype-simulate-tick — advances simulation state with stats tracking

**Tips:**
- Use the Scenario Lab before onboarding a new archetype to understand the default experience
- Simulation runs are logged with stats and error capture for debugging`
  },
  {
    id: 'operator-activation',
    icon: Sparkles,
    title: 'Operator: Activation Console',
    description: 'Manage Guided Activation sessions, checklists, and operator impersonation.',
    requiredRole: 'admin' as const,
    content: `The Activation Console at /operator/activation is the operator's hub for managing Guided Activation™ sessions.

**Readiness Dashboard:**
- View all tenants with purchased activation sessions
- See checklist completion progress and readiness scores
- Filter by status: pending, scheduled, in-progress, completed

**Checklist Management:**
- View tenant preparation checklists with per-item completion status
- Categories: Access (🔑), Data (📖), Decisions (🧭), Goals (🎯)
- Readiness score auto-computed by activation-recompute edge function

**Session Scheduling:**
- Schedule sessions from the dashboard
- Set meeting links and notes
- View upcoming and past sessions

**Operator Impersonation:**
- Enter a tenant workspace as admin (time-limited, 60 minutes)
- Requires tenant consent (granted during Guided Activation purchase)
- Every session is logged in operator_impersonation_sessions
- Audit log visible in the console — last 20 sessions

**Security:**
- Impersonation sessions are time-bounded and auditable
- Consent is verified before each session

**Tips:**
- Always check readiness score before scheduling a session
- Review the audit log regularly for compliance`
  },
  {
    id: 'operator-tenants',
    icon: Users,
    title: 'Operator: Tenant Management',
    description: 'View and manage all tenants, tiers, activation status, and free account provisioning.',
    requiredRole: 'admin' as const,
    content: `Tenant Management at /operator/tenants provides a complete view of all organizations on the platform.

**Tenant Overview:**
- Tier, activation status, seat usage, and last activity
- Link to the source Partner record (single source of truth)
- Communio group membership status

**Free Account Provisioning:**
- Operators can grant free accounts via operator-create-free-tenant
- Free tenants are flagged internally to prevent Stripe invoice sync
- Useful for pilot programs, nonprofits in need, or strategic partnerships

**Tips:**
- Tenant detail pages are read-only mirrors — edit data on the Partner record
- Use the free account flow sparingly and document the reason`
  },
  {
    id: 'accessibility',
    icon: Shield,
    title: 'Accessibility Mode',
    description: 'WCAG 2.2 AA compliant experience for all users — high contrast, keyboard navigation, screen readers, and voice input.',
    content: `CROS is committed to serving everyone, including users who rely on assistive technology. Accessibility Mode is a platform-wide toggle that transforms the experience to meet WCAG 2.2 AA standards.

## How to Enable

Open your user menu (top-right avatar) and toggle **Accessibility Mode**. Your preference is saved automatically and persists across sessions.

## What Changes

**Visual:**
- High-contrast dark theme with 4.5:1+ contrast ratios on all text
- Enhanced focus rings (3px solid yellow) on every interactive element
- Links are always underlined — never relying on color alone
- Badges and status indicators gain visible borders
- Cards and sections have increased spacing for readability

**Motion:**
- All animations and transitions are suppressed instantly
- This also respects the browser's prefers-reduced-motion setting independently

**Touch & Click:**
- Minimum 44×44px touch targets on all buttons and controls
- Voice input button grows to 48×48px in a11y mode

**Typography:**
- Base font size increases to 16px minimum
- Line height increases to 1.6 for readability
- Letter spacing increased to 0.04em
- Small text (10px, 12px) is bumped to readable sizes

**Keyboard:**
- "Skip to main content" link appears on Tab focus (WCAG 2.4.1)
- Full keyboard navigation through all interactive elements
- Escape closes modals and drawers

## NRI Companion Accessibility

The CROS Companion (Compass) is designed to be the primary interaction surface for accessibility users:

**Keyboard Navigation:**
- Arrow keys navigate between nudge cards and quick prompts
- Tab moves through all interactive elements within the drawer
- Enter activates buttons and prompts
- Escape closes the Compass

**Screen Reader Support:**
- Chat history uses role="log" for proper screen reader context
- New NRI responses are announced via aria-live regions
- Nudge count is announced when the Compass opens
- Each message bubble is labelled as "You said" or "NRI responded"
- Loading state announces "NRI is composing a response…"

**Voice Input:**
- Click the microphone button to speak your message instead of typing
- Screen readers announce "Listening for your voice…" when active
- Captured text is announced before sending
- Error states are clearly announced if voice capture fails

**Simplified Responses:**
- When Accessibility Mode is active, NRI adjusts its communication style
- Responses use bullet points instead of prose paragraphs
- Sentences are shorter (max ~15 words each)
- No decorative emoji — only functional indicators (📋 queued, ✅ immediate)
- Numbered lists when offering multiple options
- Clear "Next step:" labels for action items

## Tips

- The Compass auto-focuses the text input when opened — start typing immediately
- Use voice input for longer messages or when typing is difficult
- Quick prompts are navigable with arrow keys — press Enter to send
- All nudge signals include descriptive aria-labels with direction and content`
  }
];

export default function Help() {
  const { t } = useTranslation('help');
  const [activeSection, setActiveSection] = useState('documents');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { tenant, featureFlags } = useTenant();
  const { isAdmin } = useAuth();
  const plan = tenant?.tier ?? 'core';

  // Filter sections based on tenant's plan/features and user role
  const sections = allSections.filter((section) => {
    if (section.requiredRole === 'admin' && !isAdmin) return false;
    if (!section.requiredFeature) return true;
    const flagOverride = featureFlags[section.requiredFeature] ?? undefined;
    return canUse(section.requiredFeature, plan, flagOverride);
  });

  const scrollToSection = (sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  };

  // Update active section based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const sectionIds = helpSections.map(s => s.id);
      
      for (const id of sectionIds) {
        const element = sectionRefs.current[id];
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom > 150) {
            setActiveSection(id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <MainLayout
      title={t('page.title')}
      subtitle={`Learn how to use ${brand.appName}™ · ${brand.fullName}`}
      data-testid="help-root"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Navigation Dropdown */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('page.jumpTo')}</span>
            <HelpNavDropdown 
              activeSection={activeSection} 
              onSectionClick={scrollToSection} 
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateHelpPdf(changelog, sections)}
              className="gap-1.5"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t('page.helpPdf')}</span>
              <span className="sm:hidden">{t('page.helpPdfShort')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateOpportunityCardsPdf()}
              className="gap-1.5"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t('page.partnerCards')}</span>
              <span className="sm:hidden">{t('page.partnerCardsShort')}</span>
            </Button>
          </div>
        </div>

          {/* Changelog removed from tenant view — internal development history lives in Operator console */}

          {/* Document Library */}
          <div ref={(el) => sectionRefs.current['documents'] = el} id="documents">
            <DocumentLibrary />
          </div>

          {/* Platform Overview */}
          <div ref={(el) => sectionRefs.current['overview'] = el} id="overview">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                   <span>{t('page.platformOverview.title')}</span>
                   <Badge variant="outline">{brand.appName}™ · {brand.assistantName}™ Active</Badge>
                </CardTitle>
                <CardDescription>
                  {brand.positioning}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{brand.fullName}</Badge>
                  <Badge variant="secondary">Relationship Memory</Badge>
                  <Badge variant="secondary">Community Awareness</Badge>
                  <Badge variant="secondary">Narrative Intelligence</Badge>
                  <Badge variant="secondary">{modules.provisio.label}</Badge>
                  <Badge variant="secondary">{modules.voluntarium.label}</Badge>
                  <Badge variant="secondary">{modules.signum.label}</Badge>
                  <Badge variant="secondary">Guided Activation™</Badge>
                  <Badge variant="secondary">Communio™</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="font-medium text-sm">Relationship Memory</p>
                    <p className="text-xs text-muted-foreground">Reflections, story chapters, email history, campaign touches</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="font-medium text-sm">{modules.civitas.label} · Community</p>
                    <p className="text-xs text-muted-foreground">Local Pulse, Metro Narratives, Drift Detection, Momentum</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="font-medium text-sm">{brand.assistantName}™ · Intelligence</p>
                    <p className="text-xs text-muted-foreground">Next Best Actions, org knowledge, AI knowledge base, story signals</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="font-medium text-sm">{modules.signum.label} · Discovery</p>
                    <p className="text-xs text-muted-foreground">Find People/Events/Grants, watchlist monitoring, enrichment</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="font-medium text-sm">{modules.provisio.label} · Support</p>
                    <p className="text-xs text-muted-foreground">Catalog ordering, lifecycle tracking, paste-and-parse AI</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="font-medium text-sm">{modules.voluntarium.label} · Community</p>
                    <p className="text-xs text-muted-foreground">Volunteer tracking, email hours logging, reliability labels</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="font-medium text-sm text-primary">{modules.testimonium.label}™ · Insight</p>
                    <p className="text-xs text-muted-foreground">Narrative storytelling, drift detection, heat map overlays</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="font-medium text-sm text-primary">{modules.impulsus.label}™ · Story</p>
                    <p className="text-xs text-muted-foreground">Private impact journal, executive storytelling exports</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="font-medium text-sm text-primary">Guided Activation™</p>
                    <p className="text-xs text-muted-foreground">Human-led onboarding, preparation checklists, operator sessions</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('page.platformOverview.seeAppSections')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Application Sections */}
          <div ref={(el) => sectionRefs.current['app-sections'] = el} id="app-sections">
            <Card>
              <CardHeader>
                <CardTitle>{t('page.appSections.title')}</CardTitle>
                <CardDescription>{t('page.appSections.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {sections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <AccordionItem key={section.id} value={section.id}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-start sm:items-center gap-3 text-left">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold break-words">{section.title}</div>
                              <div className="text-sm text-muted-foreground font-normal break-words">
                                {section.description}
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-0 sm:pl-11 prose prose-sm dark:prose-invert max-w-none">
                            {section.content.split('\n\n').map((paragraph, i) => (
                              <p key={i} className="whitespace-pre-line text-muted-foreground break-words">
                                {paragraph}
                              </p>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          </div>

          {/* User Roles & Permissions */}
          <div ref={(el) => sectionRefs.current['roles'] = el} id="roles">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  {t('page.roles.title')}
                </CardTitle>
                <CardDescription>
                  {t('page.roles.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Mobile card layout */}
                <div className="space-y-3 sm:hidden">
                  {[
                    { role: 'Steward', variant: 'destructive' as const, desc: 'Platform operator with cross-tenant access', access: 'All tenants, all data (operator console)', admin: true },
                    { role: 'Admin', variant: 'destructive' as const, desc: 'Organization administrators with full access', access: 'All data within their organization', admin: true },
                    { role: 'Leadership', variant: 'secondary' as const, desc: 'Executive leadership and stakeholders', access: 'All data within their organization (read-focused)', admin: false },
                    { role: 'Regional Lead', variant: 'default' as const, desc: 'Managers responsible for specific regions', access: 'Data filtered to assigned region', admin: false },
                    { role: 'Staff', variant: 'outline' as const, desc: 'Team members working in the field', access: 'Data filtered to assigned region', admin: false },
                  ].map((item) => (
                    <div key={item.role} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={item.variant}>{item.role}</Badge>
                        {item.admin ? (
                          <Badge variant="default" className="bg-success text-xs">{t('page.roles.adminAccess')}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">{t('page.roles.noAdmin')}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{item.desc}</p>
                      <p className="text-xs text-muted-foreground/80">{item.access}</p>
                    </div>
                  ))}
                </div>
                
                {/* Desktop table layout */}
                <div className="overflow-x-auto hidden sm:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 sm:px-4 font-medium">{t('page.roles.tableRole')}</th>
                        <th className="text-left py-3 px-2 sm:px-4 font-medium">{t('page.roles.tableDescription')}</th>
                        <th className="text-left py-3 px-2 sm:px-4 font-medium">{t('page.roles.tableDataAccess')}</th>
                        <th className="text-left py-3 px-2 sm:px-4 font-medium">{t('page.roles.tableAdmin')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { role: 'Steward', variant: 'destructive' as const, desc: 'Platform operator with cross-tenant access', access: 'All tenants, all data (operator console)', admin: true },
                        { role: 'Admin', variant: 'destructive' as const, desc: 'Organization administrators with full access', access: 'All data within their organization', admin: true },
                        { role: 'Leadership', variant: 'secondary' as const, desc: 'Executive leadership and stakeholders', access: 'All data within their organization (read-focused)', admin: false },
                        { role: 'Regional Lead', variant: 'default' as const, desc: 'Managers responsible for specific regions', access: 'Data filtered to assigned region', admin: false },
                        { role: 'Staff', variant: 'outline' as const, desc: 'Team members working in the field', access: 'Data filtered to assigned region', admin: false },
                      ].map((item) => (
                        <tr key={item.role} className="border-b last:border-b-0">
                          <td className="py-3 px-2 sm:px-4"><Badge variant={item.variant}>{item.role}</Badge></td>
                          <td className="py-3 px-2 sm:px-4 text-muted-foreground">{item.desc}</td>
                          <td className="py-3 px-2 sm:px-4 text-muted-foreground">{item.access}</td>
                          <td className="py-3 px-2 sm:px-4">
                            <Badge variant={item.admin ? 'default' : 'outline'} className={item.admin ? 'bg-success' : ''}>
                              {item.admin ? t('page.roles.adminYes') : t('page.roles.adminNo')}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  {t('page.roles.rolesNote')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recovery & Restoration */}
          <div ref={(el) => sectionRefs.current['restoration'] = el} id="restoration">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">{t('page.restoration.title')}</CardTitle>
                <CardDescription>{t('page.restoration.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Undo</h4>
                  <p>
                    Many actions can be undone immediately using the undo toast that appears after deletions.
                    The window is brief — act while it's still visible.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Soft-Delete & Restore</h4>
                  <p>
                    Deleted records (Partners, People, Events, Volunteers, Grants) are kept safely for 90 days.
                    You can restore them from the Recycle Bin in your activity feed, or ask the NRI assistant.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Emergency Recovery</h4>
                  <p>
                    If something disappears and you can't find it, open the NRI assistant and say
                    "I accidentally deleted something." The assistant will review your recent actions
                    and offer to restore or open an emergency recovery request.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">What "Recent Actions" Means</h4>
                  <p>
                    CROS keeps a small, private breadcrumb trail of <em>actions</em> (not content) —
                    like "you deleted a Partner" or "you published an essay." This helps the assistant
                    guide you to the right fix. No notes, emails, names, or personal content are ever stored.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Restoration Narrative</h4>
                  <p>
                    When something is restored, it quietly becomes part of the story. Restoration moments
                    appear as soft golden threads in the Gardener's view — a reminder that care remembered
                    is care continued.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Opting Out</h4>
                  <p>
                    Tenants can disable the recent-actions feature in Settings → Privacy.
                    This removes the assistant's ability to see recent actions, but restore
                    and recycle bin features remain available.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Keyboard Shortcuts */}
          <div ref={(el) => sectionRefs.current['shortcuts'] = el} id="shortcuts">
            <Card>
              <CardHeader>
                <CardTitle>{t('page.keyboardShortcuts.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">{t('page.keyboardShortcuts.globalHeading')}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                      <span>{t('page.keyboardShortcuts.openSearch')}</span>
                      <kbd className="px-2 py-1 rounded bg-background border text-xs font-mono">⌘K</kbd>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                      <span>{t('page.keyboardShortcuts.openHelp')}</span>
                      <kbd className="px-2 py-1 rounded bg-background border text-xs font-mono">?</kbd>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                      <span>{t('page.keyboardShortcuts.closeModal')}</span>
                      <kbd className="px-2 py-1 rounded bg-background border text-xs font-mono">Esc</kbd>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">{t('page.keyboardShortcuts.navigationHeading')}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                    {[
                      ['Dashboard', 'D'], ['Opportunities', 'O'], ['New Opportunity', 'N'],
                      ['Journey', 'P'], ['Events', 'E'], ['The People', 'C'],
                      ['New Contact', 'K'], ['Metros', 'M'], ['Anchors', 'A'],
                      ['Reports', 'R'], ['Settings', 'S'],
                    ].map(([label, key]) => (
                      <div key={key} className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                        <span>{label}</span>
                        <div className="flex gap-1">
                          <kbd className="px-2 py-1 rounded bg-background border text-xs font-mono">G</kbd>
                          <kbd className="px-2 py-1 rounded bg-background border text-xs font-mono">{key}</kbd>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
        </div>
      </div>
    </MainLayout>
  );
}
