# Crescere Zone — Build Specification

> **Purpose:** Standalone instructions to build the "Growth & Economics" administrative zone for a multi-tenant platform operator. This spec is platform-agnostic — adapt naming, styling, and database to your stack.

---

## Overview

Crescere is the **growth and economics zone** of an operator console. It answers one question:

> *"Is the ecosystem growing well?"*

It covers: tenant management, partner pipeline, geographic territory management, ecosystem intelligence, people/contact search, event discovery, activity logging, outreach tracking, scheduling, SEO monitoring, announcements, and operator settings.

---

## Architecture Principles

1. **Operator ≠ Tenant.** The operator sees across ALL tenants but never modifies tenant-owned data directly.
2. **Calm UX.** No aggressive dashboards. Narrative-first, spacious cards, gentle language.
3. **Separate data boundaries.** The operator's own pipeline (partners) lives in a separate table from tenant opportunities.
4. **Progressive disclosure.** Show summaries first; details on drill-in.

---

## Pages to Build (16 surfaces)

### 1. Dashboard (Overview)
**Route:** `/operator`  
**Purpose:** Platform-wide health at a glance.

**Panels to include:**
- **Today Panel** — What happened today across the ecosystem (new signups, events, activities).
- **Platform Health** — Active tenants count, automation run status, error rate.
- **Adoption Pulse** — Which features tenants are actually using (heatmap or bar).
- **Quiet Tenant Radar** — Tenants with no activity in 14+ days, displayed gently ("These communities have been quiet").
- **Onboarding Status** — How many tenants are mid-onboarding, completed, stalled.
- **Narrative Balance** — Ratio of narrative/reflective content vs. transactional data across the platform.
- **Ecosystem Pulse** — Aggregated metro-level growth signals.
- **Export Stats** — CSV/PDF export volume trends.

**Data sources:**
- Tenant stats table (aggregated view)
- Automation runs table
- Activity counts per tenant
- Feature usage flags per tenant

**Key interactions:**
- Refresh button to re-fetch stats
- Click tenant name → navigate to tenant detail
- Tab layout for grouping panels (Health, Adoption, Economy)

---

### 2. Tenants
**Route:** `/operator/tenants`  
**Purpose:** Master list of every organization on the platform.

**Features:**
- Filterable table: All / Paid / Operator-Sponsored
- Columns: Name, Tier, Archetype, Status, Created date, Billing mode
- Badge for operator-sponsored tenants
- "Create Free Tenant" modal (operator can grant free accounts)
- Click row → navigate to tenant detail page

**Tenant Detail Page** (`/operator/tenants/:id`):
- Subscription info, usage meters
- Activation checklist progress
- Activity timeline
- Assigned operator/gardener

---

### 3. Partners (Operator Pipeline)
**Route:** `/operator/partners`  
**Purpose:** The operator's own CRM — organizations being cultivated.

**CRITICAL:** This is NOT tenant data. Partners live in a separate `operator_opportunities` table.

**Features:**
- Search + stage filter
- Card or table view with: Organization, Stage, Source, Metro, Last activity date
- "Add Partner" dialog: Organization name, website, notes, stage, metro, source
- Click → Partner Detail page

**Partner Detail Page** (`/operator/partners/:id`):
- 6-tab layout mirroring a relationship journey:
  1. **The Partner** — Basic info, website, enrichment data
  2. **The Story** — Narrative timeline of interactions
  3. **The Pulse** — Activity frequency, engagement signals
  4. **The People** — Contacts associated with this partner
  5. **The Impact** — What this partnership could/does produce
  6. **The Next Move** — Suggested actions, follow-ups

**Pipeline stages:**
```
Researching → Contacted → Discovery Scheduled → Discovery Held →
Proposal Sent → Agreement Pending → Agreement Signed → Onboarding →
Active Customer → Closed - Not a Fit
```

---

### 4. Metros (Geographic Territories)
**Route:** `/operator/metros`  
**Purpose:** Full CRUD for geographic regions.

**Features:**
- Search + filter by status (active/emerging/dormant) and region
- Create metro dialog: Name, Region assignment
- Edit → navigate to metro detail
- Delete with confirmation dialog
- Columns: Name, Region, Status, Tenant count, Expansion priority

**Metro Detail Page:**
- Tenant list within metro
- Growth velocity metrics
- Local event/pulse data
- Expansion interest signals

---

### 5. Scheduling
**Route:** `/operator/scheduling`  
**Purpose:** Operator-scoped calendar.

**Features:**
- Calendar view (week/month)
- Event types: Outreach meetings, demos, onboarding calls, platform events
- Create/edit events
- Integration point for external calendar sync (Google Calendar)

---

### 6. People
**Route:** `/operator/people`  
**Purpose:** Browse all contacts across the ecosystem.

**Features:**
- Searchable table: Name, Email, Organization, Metro
- Click → contact detail (read-only cross-tenant view)
- Respect data boundaries — operator can view but not edit tenant contacts

---

### 7. Find People (Cross-Tenant Search)
**Route:** `/operator/find-people`  
**Purpose:** Search contacts across all tenants.

**Features:**
- Full-text search by name, email, organization, metro
- Results show which tenant owns each contact
- Useful for deduplication and relationship mapping

---

### 8. Find Events (Cross-Tenant Event Search)
**Route:** `/operator/find-events`  
**Purpose:** Discover events across the ecosystem.

**Features:**
- Search by title, date range, metro, tenant
- Overlap detection (multiple tenants hosting similar events)
- Useful for coordination and outreach planning

---

### 9. Activities
**Route:** `/operator/activities`  
**Purpose:** Operator-scoped activity log.

**Features:**
- Log calls, meetings, emails, touchpoints at the platform level
- Filter by type, date, partner
- Link activities to partners or tenants

---

### 10. Outreach
**Route:** `/operator/outreach`  
**Purpose:** Signup tracking links for campaigns.

**Features:**
- Create branded tracking links with UTM parameters
- Track conversion sources
- Measure campaign performance (clicks → signups → activations)

---

### 11. Ecosystem Intelligence
**Route:** `/operator/ecosystem`  
**Purpose:** Aggregated metro-level growth intelligence.

**Features:**
- Metros grouped by ecosystem status:
  - **Active** — Established metros with tenants
  - **Emerging** — New metros showing growth signals
  - **Expansion Pipeline** — Metros under evaluation
  - **Dormant** — Inactive metros
- Per-metro metrics: Tenant count, growth velocity, overlap score
- Expansion watchlist with priority ranking
- Activation movement tracking

---

### 12. SEO
**Route:** `/operator/seo`  
**Purpose:** Platform SEO management.

**Features:**
- Monitor search visibility for public-facing pages
- Meta configuration management
- Organic discovery tracking

---

### 13. Announcements
**Route:** `/operator/announcements`  
**Purpose:** Broadcast banners to tenants.

**Features:**
- Create announcement: Title, body, type (info/warning/celebration), target audience
- Target: All tenants, specific archetypes, specific metros
- Schedule or publish immediately
- Auto-dismiss after date
- Soft, neutral tone — never alarming

---

### 14. Operator Settings
**Route:** `/operator/settings`  
**Purpose:** Personal operator workspace configuration.

**Features:**
- Email/calendar integration settings
- Notification preferences
- Workspace configuration
- API key management

---

### 15. Ecosystem Overview Panels (Dashboard sub-components)

Build these as reusable components:

| Panel | Purpose |
|-------|---------|
| **Adoption Pulse** | Feature usage heatmap across tenants |
| **Quiet Health** | Gentle surfacing of at-risk tenants |
| **Value Moments** | Recent high-value interactions |
| **Onboarding Status** | Funnel: invited → started → completed |
| **Narrative Economy** | Content creation velocity across platform |
| **Connector Confidence** | Integration health per connector |
| **Narrative Balance** | Ratio of reflective vs transactional data |

---

### 16. Territory Management
**Route:** `/operator/expansion`  
**Purpose:** Unified territory model beyond just metros.

**Features:**
- Support for: Metros, County bundles, States, Countries, Mission fields
- Fair rural pricing (county bundles of up to 5 = 1 slot)
- Assign operators to territories
- Track expansion readiness per territory

---

## Database Schema (Minimum Required)

### Core Tables

```sql
-- Tenants (organizations on the platform)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'core',
  archetype TEXT,
  status TEXT DEFAULT 'active',
  billing_mode TEXT DEFAULT 'standard',
  is_operator_granted BOOLEAN DEFAULT FALSE,
  operator_grant_reason TEXT,
  operator_granted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Operator's own pipeline (NOT tenant data)
CREATE TABLE operator_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization TEXT NOT NULL,
  website TEXT,
  notes TEXT,
  stage TEXT DEFAULT 'Researching',
  status TEXT DEFAULT 'active',
  metro TEXT,
  source TEXT,
  primary_contact_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Geographic territories
CREATE TABLE metros (
  id TEXT PRIMARY KEY,
  metro TEXT NOT NULL,
  region_id TEXT,
  ecosystem_status TEXT DEFAULT 'emerging',
  expansion_priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Aggregated tenant stats (materialized view or table)
CREATE TABLE operator_tenant_stats (
  tenant_id UUID PRIMARY KEY,
  tenant_name TEXT,
  active_users INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  feature_flags JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Operator activities
CREATE TABLE operator_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL,
  title TEXT,
  notes TEXT,
  partner_id UUID REFERENCES operator_opportunities(id),
  tenant_id UUID REFERENCES tenants(id),
  activity_date TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  announcement_type TEXT DEFAULT 'info',
  target_audience JSONB DEFAULT '{"scope": "all"}',
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Outreach tracking links
CREATE TABLE outreach_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  campaign_name TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Row-Level Security

All tables MUST have RLS enabled. Operator access should be gated by a role check:

```sql
-- Example: Only operators can read tenant stats
CREATE POLICY "operators_read_tenant_stats"
ON operator_tenant_stats FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'operator'));
```

---

## UX Guidelines

### Tone
- **Gentle, not urgent.** "These communities have been quiet" not "WARNING: 5 INACTIVE TENANTS"
- **Narrative-first.** Explain *why* something matters before showing controls.
- **Spacious.** Cards should breathe. No crowded tables.

### Visual
- Use semantic design tokens (e.g., `--primary`, `--muted`, `--accent`)
- Subtle status badges, not aggressive color coding
- Icons should be small and supportive, never dominant
- Prefer card layouts over dense tables for overview pages

### Interactions
- Search should be instant (client-side filter on loaded data)
- Modals for create actions, full pages for detail views
- Confirmation dialogs for destructive actions (delete)
- Toast notifications for success/error feedback

### Empty States
- Always provide a calm empty state message
- Example: "No partners yet. When you begin cultivating relationships, they'll appear here."

---

## Navigation Structure

```
Operator Console
├── Dashboard (Overview)          /operator
├── Tenants                       /operator/tenants
│   └── Tenant Detail             /operator/tenants/:id
├── Partners                      /operator/partners
│   └── Partner Detail            /operator/partners/:id
├── Metros                        /operator/metros
├── Ecosystem                     /operator/ecosystem
├── People                        /operator/people
├── Find People                   /operator/find-people
├── Find Events                   /operator/find-events
├── Activities                    /operator/activities
├── Scheduling                    /operator/scheduling
├── Outreach                      /operator/outreach
├── SEO                           /operator/seo
├── Announcements                 /operator/announcements
├── Territory Management          /operator/expansion
└── Settings                      /operator/settings
```

---

## Tech Stack Recommendations

| Layer | Recommendation |
|-------|---------------|
| Framework | React + TypeScript |
| Styling | Tailwind CSS with semantic tokens |
| State | TanStack Query for server state |
| Routing | React Router v6+ |
| UI Components | shadcn/ui (Radix primitives) |
| Backend | Supabase (Postgres + RLS + Edge Functions) |
| Auth | Supabase Auth with role-based access |
| Icons | Lucide React |

---

## Build Order (Recommended)

1. **Auth + Role gating** — Operator role check, protected routes
2. **Tenants page** — Foundation for everything else
3. **Dashboard** — Requires tenant stats
4. **Metros** — Geographic foundation
5. **Partners** — Operator's own pipeline
6. **People + Find People** — Cross-tenant search
7. **Activities** — Operator activity logging
8. **Ecosystem** — Aggregated intelligence
9. **Announcements** — Tenant communication
10. **Outreach** — Campaign tracking
11. **Scheduling** — Calendar integration
12. **SEO** — Last priority
13. **Settings** — Personal config
14. **Territory Management** — Advanced feature

---

## What This Spec Does NOT Include

- Tenant-facing features (their own dashboards, CRM, etc.)
- AI/intelligence layers (build separately)
- Integration connectors (Stripe, Google, etc.)
- Notification systems
- Audit logging (add as cross-cutting concern)

These should be built as separate zones/modules with clear boundaries.
