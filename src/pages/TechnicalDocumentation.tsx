import { useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';

export default function TechnicalDocumentation() {
  const generatePDF = () => {
    const doc = new jsPDF();
    let y = 20;
    const lineHeight = 6;
    const pageHeight = 280;
    const marginLeft = 15;
    const marginRight = 195;
    const maxWidth = marginRight - marginLeft;

    const addPage = () => {
      doc.addPage();
      y = 20;
    };

    const checkPageBreak = (height: number) => {
      if (y + height > pageHeight) {
        addPage();
      }
    };

    const addTitle = (text: string, size: number = 16) => {
      checkPageBreak(15);
      doc.setFontSize(size);
      doc.setFont('helvetica', 'bold');
      doc.text(text, marginLeft, y);
      y += lineHeight * 2;
    };

    const addSubtitle = (text: string) => {
      checkPageBreak(12);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(text, marginLeft, y);
      y += lineHeight * 1.5;
    };

    const addParagraph = (text: string) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        checkPageBreak(lineHeight);
        doc.text(line, marginLeft, y);
        y += lineHeight;
      });
      y += lineHeight * 0.5;
    };

    const addBullet = (text: string) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const bulletText = `• ${text}`;
      const lines = doc.splitTextToSize(bulletText, maxWidth - 5);
      lines.forEach((line: string, idx: number) => {
        checkPageBreak(lineHeight);
        doc.text(idx === 0 ? line : `  ${line}`, marginLeft, y);
        y += lineHeight;
      });
    };

    const addCode = (text: string) => {
      doc.setFontSize(9);
      doc.setFont('courier', 'normal');
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        checkPageBreak(lineHeight);
        doc.text(line, marginLeft + 5, y);
        y += lineHeight * 0.9;
      });
      y += lineHeight * 0.5;
    };

    // ==================== DOCUMENT CONTENT ====================
    
    // Title Page
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Profunda', marginLeft, 40);
    doc.setFontSize(16);
    doc.text('Technical Architecture & Security Audit Guide', marginLeft, 52);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('For ChatGPT Code Review & Loophole Detection', marginLeft, 65);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, marginLeft, 78);
    doc.text('Version: 15.0 — System Sweep + Metro News + Provisions TSV', marginLeft, 88);
    
    addPage();

    // Table of Contents
    addTitle('Table of Contents', 18);
    const toc = [
      '1. Executive Summary',
      '2. Technology Stack',
      '3. Application Architecture',
      '4. Database Schema & Relationships',
      '5. Authentication & Authorization',
      '6. Row-Level Security (RLS) Policies',
      '7. Edge Functions (Backend)',
      '8. Core Features & Workflows',
      '9. Data Flow Patterns',
      '10. Known Security Considerations',
      '11. Potential Vulnerability Areas',
      '12. Testing Recommendations',
      '13. Intelligence Loop (Phase 4)',
      '14. Org Knowledge System',
      '15. Company AI Knowledge Base',
      '16. Template Preset System',
      '17. Signal → Insight → Action Loops (Phase F)',
      '18. Push Notification System (T1/T2/T3)',
      '19. Discovery Search System',
      '20. Watchlist Monitoring & Signal Detection',
      '21. Proactive Discovery System (Phase 3C)',
      '22. Discovery Pipeline (Phase 3D)',
      '23. Relationship Intelligence Layer (Phase 3E)',
      '24. Provisions System (Phase 5)',
      '25. Narrative Intelligence Engine (Phase 5B)',
      '26. Human Impact Reports (Phase 5C)',
      '27. Narrative Privacy Model',
      '28. Volunteers & Hours Ingestion (Phase 6A)',
      '29. CRM Exit Ramp / Import Center (Phase 6A)',
      '30. Provisions TSV Export',
      '31. System Sweep & Admin Observability',
      '32. Metro News Keywords & Source Administration',
    ];
    toc.forEach(item => addBullet(item));
    
    addPage();

    // Section 1: Executive Summary
    addTitle('1. Executive Summary');
    addParagraph('Profunda is a relationship memory and community awareness platform built for PCs for People, a nonprofit focused on digital equity. It serves Regional Impact Managers who build genuine partnerships with community organizations for technology distribution and internet access programs.');
    addParagraph('The platform rests on three architectural pillars: Relationship Memory (reflections, email history, campaign touches blended into living partnership stories), Community Awareness (Local Pulse discovery, Metro Narratives, Drift Detection), and Narrative Intelligence (story-driven dashboards, human impact reports, journey chapters).');
    addSubtitle('Core Business Functions:');
    addBullet('Track partnership opportunities from initial contact through anchor production');
    addBullet('Manage grants and funding sources with lifecycle tracking');
    addBullet('Schedule and track community events with ROI scoring');
    addBullet('Maintain contact relationships across organizations');
    addBullet('Provide AI-assisted email analysis and suggestions');
    addBullet('Send targeted Gmail campaigns with analytics and failure intelligence');
    addBullet('Surface watchlist-driven outreach suggestions for proactive engagement');
    addBullet('Generate reports and analytics for leadership');
    addBullet('Track internal device provisions with full lifecycle and delivery journey');
    addBullet('Generate narrative-driven Human Impact Reports for board presentations');
    addBullet('Track volunteers with email-based hours auto-logging and reliability labels');
    addBullet('Import Center for one-way CRM transitions (CSV upload with auto-mapping)');

    addPage();

    // Section 2: Technology Stack
    addTitle('2. Technology Stack');
    addSubtitle('Frontend Framework:');
    addBullet('React 18.3.1 with TypeScript');
    addBullet('Vite for build tooling and development server');
    addBullet('React Router DOM 6.30.1 for client-side routing');
    addBullet('TanStack React Query 5.83.0 for server state management');
    
    addSubtitle('Styling & UI:');
    addBullet('Tailwind CSS with custom semantic design tokens');
    addBullet('shadcn/ui component library (Radix UI primitives)');
    addBullet('Lucide React for iconography');
    addBullet('Framer Motion patterns for animations');
    addBullet('Custom CSS variables for theming (HSL color system)');
    
    addSubtitle('Backend (Lovable Cloud / Supabase):');
    addBullet('PostgreSQL database with Row-Level Security');
    addBullet('Supabase Auth for authentication');
    addBullet('Deno Edge Functions for serverless backend logic');
    addBullet('Supabase Realtime for live updates');
    addBullet('Supabase Storage for file uploads');
    
    addSubtitle('Integrations:');
    addBullet('Google Calendar API (OAuth 2.0)');
    addBullet('Gmail API for email sync, analysis, and campaign sending (gmail.send scope)');
    addBullet('OpenAI/Anthropic for AI features (via Lovable AI proxy)');
    addBullet('n8n workflow automation for watchlist monitoring and signal processing');
    
    addSubtitle('Key Libraries:');
    addBullet('jsPDF for PDF generation');
    addBullet('Recharts for data visualization');
    addBullet('@hello-pangea/dnd for drag-and-drop');
    addBullet('TipTap for rich text editing');
    addBullet('date-fns for date manipulation');
    addBullet('Zod for schema validation');
    addBullet('React Hook Form for form management');

    addPage();

    // Section 3: Application Architecture
    addTitle('3. Application Architecture');
    addSubtitle('Directory Structure:');
    addCode('src/\n  ├── components/     # React components organized by feature\n  │   ├── ui/         # Reusable UI primitives (shadcn)\n  │   ├── layout/     # MainLayout, Sidebar, Header\n  │   ├── modals/     # Detail and edit modals\n  │   ├── dashboard/  # Dashboard widgets and charts\n  │   ├── ai/         # AI chat, insights, OCR\n  │   └── [feature]/  # Feature-specific components\n  ├── pages/          # Route components\n  ├── hooks/          # Custom React hooks (data fetching)\n  ├── contexts/       # React contexts (AuthContext)\n  ├── lib/            # Utility functions\n  ├── types/          # TypeScript type definitions\n  └── integrations/   # Supabase client & types');
    
    addSubtitle('Routing Pattern:');
    addParagraph('All authenticated routes are wrapped in ProtectedRoute component. Admin routes require "admin" role. Routes use slug-based URLs for People, Opportunities, and Events.');
    addCode('/ → CommandCenter (home)\n/intelligence → Movement Intelligence\n/opportunities → Opportunities list\n/opportunities/:slug → OpportunityDetail\n/people → People list\n/people/:slug → PersonDetail\n/people/find → FindPeople (discovery)\n/events → Events list\n/events/:slug → EventDetail\n/events/find → FindEvents (discovery)\n/grants → Grants list\n/grants/find → FindGrants (discovery)\n/pipeline → Journey Pipeline\n/anchors → Sustained Partners\n/calendar → Calendar view\n/activities → Activity feed\n/outreach/campaigns → Email Campaigns\n/outreach/campaigns/:id → Campaign Builder\n/provisions → Provisions list\n/volunteers → Volunteers list\n/volunteers/:id → Volunteer detail\n/volunteer-hours-inbox → Volunteer Hours Inbox (admin/staff)\n/import → Import Center (admin/leadership)\n/reports → Reports hub\n/reports/impact-export → Narrative Impact Export (Board Report)\n/momentum → Momentum Map\n/momentum-rankings → Momentum Rankings\n/graph → Relationship Graph\n/radar → Radar\n/intel-feed → Intel Feed\n/admin → Admin panel (admin only)\n/admin/automation-health → Automation Health\n/admin/workflows → Workflow Dashboard\n/settings → User settings\n/help → Help & Documentation');
    
    addSubtitle('State Management Pattern:');
    addBullet('Server state: TanStack Query with query keys for caching');
    addBullet('Auth state: React Context (AuthContext)');
    addBullet('Form state: React Hook Form with Zod validation');
    addBullet('UI state: Local useState/useReducer');
    addBullet('URL state: React Router useSearchParams');

    addPage();

    // Section 4: Database Schema
    addTitle('4. Database Schema & Relationships');
    addSubtitle('Core Entity Tables:');
    
    addParagraph('METROS - Geographic regions where Regional Impact Managers operate');
    addCode('metros {\n  id: uuid (PK)\n  metro_id: text (unique business key)\n  metro: text (display name)\n  region_id: uuid (FK → regions)\n  referrals_per_month, partner_inquiries_per_month: int\n  distribution_partner_yn, storage_ready_yn: boolean\n  staff_coverage_1to5: int (1-5 scale)\n  recommendation: enum (Invest/Build Anchors/Hold/Triage)\n  notes: text\n}');
    
    addParagraph('OPPORTUNITIES - Partner organizations being cultivated');
    addCode('opportunities {\n  id: uuid (PK)\n  opportunity_id: text (business key)\n  organization: text\n  metro_id: uuid (FK → metros)\n  stage: enum (Target Identified → Stable Producer)\n  status: enum (Active/On Hold/Closed Won/Lost)\n  partner_tier: enum (legacy single value)\n  partner_tiers: text[] (new multi-select)\n  grant_alignment: text[]\n  mission_snapshot: text[]\n  best_partnership_angle: text[]\n  primary_contact_id: uuid (FK → contacts)\n  owner_id: uuid (FK → auth.users)\n  next_action_due: timestamp\n  next_step, notes: text\n}');
    
    addParagraph('CONTACTS - People at partner organizations (referred to as "The People" in UI)');
    addCode('contacts {\n  id: uuid (PK)\n  contact_id: text\n  slug: text (URL-safe name)\n  name: text (required)\n  title, email, phone: text\n  opportunity_id: uuid (FK → opportunities)\n  met_at_event_id: uuid (FK → events)\n  is_primary: boolean\n  created_by: uuid (FK → auth.users)\n  notes: text\n}');
    
    addParagraph('ANCHOR_PIPELINE - Opportunities being actively developed toward anchor status');
    addCode('anchor_pipeline {\n  id: uuid (PK)\n  anchor_pipeline_id: text\n  opportunity_id: uuid (FK → opportunities)\n  metro_id: uuid (FK → metros)\n  owner_id: uuid (FK → auth.users)\n  stage: enum (Target Identified → First Volume)\n  stage_entry_date: date\n  probability: int (0-100)\n  estimated_monthly_volume: int\n  target_first_volume_date: date\n  next_action, next_action_due, notes: text\n}');

    addPage();
    
    addParagraph('ANCHORS - Converted partners producing volume');
    addCode('anchors {\n  id: uuid (PK)\n  anchor_id: text\n  opportunity_id: uuid (FK)\n  metro_id: uuid (FK)\n  anchor_tier: enum (Strategic/Standard/Pilot)\n  first_contact_date, discovery_date: date\n  agreement_signed_date, first_volume_date: date\n  stable_producer_date: date\n  last_30_day_volume, avg_monthly_volume: int\n  peak_monthly_volume: int\n  growth_trend: enum (Up/Flat/Down)\n  risk_level: enum (Low/Medium/High)\n  strategic_value_1to5: int\n  notes: text\n}');
    
    addParagraph('EVENTS - Community events and partner meetings');
    addCode('events {\n  id: uuid (PK)\n  event_id: text\n  slug: text\n  event_name: text\n  event_date: date, end_date: date\n  metro_id: uuid (FK)\n  host_opportunity_id: uuid (FK)\n  event_type: text\n  city: text\n  status: text (Scheduled/Completed/Cancelled)\n  attended: boolean\n  households_served, devices_distributed: int\n  internet_signups, referrals_generated: int\n  staff_deployed: int, cost_estimated: decimal\n  anchor_identified_yn, followup_meeting_yn: boolean\n  grant_narrative_value: enum (High/Medium/Low)\n  roi_score: decimal (computed)\n  google_calendar_event_id: text (sync link)\n  pcs_goals, strategic_lanes, target_populations: text[]\n}');
    
    addParagraph('GRANTS - Funding opportunities and awards');
    addCode('grants {\n  id: uuid (PK)\n  grant_id: text\n  grant_name, funder_name: text\n  funder_type: text\n  metro_id: uuid (FK)\n  opportunity_id: uuid (FK)\n  owner_id: uuid (FK → auth.users)\n  stage: enum (Researching → Awarded/Closed)\n  grant_type: text\n  amount_requested, amount_awarded: decimal\n  deadline: date\n  award_start_date, award_end_date: date\n  fiscal_year: int\n  star_rating: int (1-5)\n  internal_strategy_notes: text (admin only)\n  notes: text\n}');

    addPage();
    
    addSubtitle('Activity & Communication Tables:');
    addCode('activities {\n  activity_id: text\n  opportunity_id, metro_id, contact_id: uuid (FKs)\n  activity_date_time: timestamp\n  activity_type: enum (Call/Email/Meeting/Event/Site Visit/Intro/Other)\n  outcome: enum (Connected/No Response/Follow-up Needed/Moved Stage/Not a Fit)\n  attended: boolean\n  notes, next_action: text\n  next_action_due: timestamp\n  google_calendar_event_id: text (sync)\n}\n\nemail_communications {\n  gmail_message_id: text (unique)\n  user_id: uuid\n  contact_id: uuid (FK)\n  sender_email, recipient_email: text\n  subject, body_preview, snippet: text\n  sent_at, synced_at: timestamp\n  ai_analyzed_at: timestamp\n  ai_run_id: uuid\n}\n\ngoogle_calendar_events {\n  google_event_id: text\n  user_id: uuid\n  contact_id: uuid (FK)\n  title, description, location: text\n  start_time, end_time: timestamp\n  is_all_day, attended: boolean\n}');
    
    addSubtitle('AI & Suggestions Tables:');
    addCode('ai_suggestions {\n  id: uuid (PK)\n  user_id: uuid\n  suggestion_type: text (new_contact/task/followup)\n  source: text (email/ocr/calendar)\n  source_id: text\n  source_snippet: text\n  suggested_name, suggested_email, suggested_phone: text\n  suggested_title, suggested_organization: text\n  suggested_opportunity_id: uuid\n  task_title, task_description: text\n  task_due_date: date, task_priority: text\n  confidence_score: decimal\n  ai_reasoning: text\n  status: text (pending/approved/dismissed)\n  suggestion_hash: text (dedup)\n  created_entity_id: uuid, created_entity_type: text\n}\n\nweekly_plans (new Feb 2026) {\n  id: uuid (PK)\n  user_id: uuid (FK → auth.users)\n  week_start_date: date\n  plan_json: jsonb (array of WeeklyPlanItem)\n  generated_at: timestamptz\n  source_snapshot_hash: text\n  UNIQUE (user_id, week_start_date)\n}\n\nai_user_settings {\n  user_id: uuid (PK)\n  gmail_ai_enabled: boolean\n  gmail_ai_enabled_at: timestamp\n  gmail_ai_start_at: timestamp (forward-only)\n  ignored_email_domains: text[]\n  auto_approve_threshold: decimal (0.95 default)\n  chat_context_window: int\n}');

    addPage();

    addSubtitle('Email Campaign Tables (Phase 3):');
    addCode('email_campaigns {\n  id: uuid (PK)\n  created_by: uuid\n  name, subject: text\n  html_body: text\n  from_email, from_name, reply_to: text\n  preheader: text\n  status: enum (draft/audience_ready/sending/paused/sent/failed)\n  audience_count, sent_count, failed_count: int\n  segment_id: uuid (FK → email_segments)\n  scheduled_at, last_sent_at: timestamptz\n  metadata: jsonb\n}\n\nemail_campaign_audience {\n  id: uuid (PK)\n  campaign_id: uuid (FK)\n  contact_id: uuid (FK, nullable)\n  opportunity_id: uuid (nullable)\n  email: text, name: text\n  source: text (segment/manual)\n  status: text (queued/sent/failed/skipped)\n  sent_at: timestamptz\n  error_message: text\n  failure_category: text (quota/invalid_address/bounce/provider_temp/provider_perm/unknown)\n  failure_code: text\n  failure_raw: text (truncated raw error)\n  provider_message_id: text\n  fingerprint: text (dedup key)\n}\n\nemail_campaign_events {\n  id: uuid (PK)\n  campaign_id: uuid (FK)\n  audience_id: uuid (FK, nullable)\n  event_type: text (send_started/recipient_sent/recipient_failed/send_complete/failed/auth_failed/paused/resumed/requeued_failed/cap_warning/cap_blocked)\n  message: text\n  meta: jsonb\n}\n\ncampaign_subject_stats {\n  id: uuid (PK)\n  created_by: uuid\n  subject: text\n  sent_count, failed_count: int\n  last_used_at: timestamptz\n  UNIQUE (created_by, subject)\n}');

    addSubtitle('Campaign Suggestions (Watchlist-Driven):');
    addCode('campaign_suggestions {\n  id: uuid (PK)\n  org_id: uuid\n  source_type: text (watchlist_signal)\n  source_id: uuid\n  suggestion_type: text (website_change_outreach)\n  title, subject, body_template, reason: text\n  confidence: numeric (default 0.6)\n  status: text (open/dismissed/snoozed/converted)\n  snoozed_until: timestamptz\n  converted_campaign_id: uuid (FK → email_campaigns)\n  created_by: uuid\n  UNIQUE (org_id, source_type, source_id, suggestion_type)\n}\n\ncampaign_suggestion_items {\n  id: uuid (PK)\n  suggestion_id: uuid (FK)\n  signal_id: uuid\n}');

    addSubtitle('Next Best Action & Alert Tables (Phase 4):');
    addCode('org_next_actions {\n  id: uuid (PK)\n  org_id: uuid (FK → opportunities)\n  source_type: text check (signal, insight, suggestion)\n  source_id: uuid\n  action_type: text\n  summary: text\n  severity: int (1-5)\n  confidence: numeric\n  predicted_success_rate: numeric\n  score: numeric\n  status: text (open/executed/dismissed/snoozed)\n  snoozed_until: timestamptz\n  last_evaluated_at: timestamptz\n  UNIQUE (org_id, source_id) where status=\'open\'\n}\n\nuser_alerts {\n  id: uuid (PK)\n  user_id: uuid\n  alert_type: text\n  ref_type: text\n  ref_id: uuid\n  message: text\n  created_at: timestamptz\n  read_at: timestamptz\n  UNIQUE (user_id, ref_id) where read_at IS NULL\n}');

    addSubtitle('Org Knowledge Tables (Phase 4):');
    addCode('org_knowledge_snapshots {\n  id: uuid (PK)\n  org_id: uuid (FK → opportunities, nullable)\n  external_org_key: text (nullable)\n  source_url: text\n  captured_at: timestamptz\n  model: text\n  content_hash: text\n  raw_excerpt: text (capped 50k)\n  structured_json: jsonb\n  created_by: uuid\n  version: int (default 1)\n  source_type: text (admin_curated/perplexity_research)\n  is_authoritative: boolean (default true)\n  active: boolean (default true)\n  replaced_by: uuid (self-ref)\n  notes: text\n  UNIQUE (org_id) where active=true AND is_authoritative=true\n}\n\norg_knowledge_sources {\n  id: uuid (PK)\n  snapshot_id: uuid (FK → org_knowledge_snapshots)\n  url: text\n  title: text\n  snippet: text\n  content_hash: text\n  retrieved_at: timestamptz\n}');

    addSubtitle('Company AI Knowledge Base Tables:');
    addCode('ai_knowledge_documents {\n  id: uuid (PK)\n  key: text (unique) -- e.g. company_profile, email_tone, approved_claims\n  title: text\n  content_markdown: text\n  content_json: jsonb (nullable)\n  active: boolean (default true)\n  version: int (default 1)\n  source_urls: text[] (default \'{}\')\n  created_by: uuid\n  created_at, updated_at: timestamptz\n}\n\nai_knowledge_document_versions {\n  id: uuid (PK)\n  document_id: uuid (FK → ai_knowledge_documents, cascade)\n  version: int\n  content_markdown: text\n  content_json: jsonb (nullable)\n  source_urls: text[] (default \'{}\')\n  created_by: uuid\n  created_at: timestamptz\n  UNIQUE (document_id, version)\n}');

    addSubtitle('Email Template Preset Tables:');
    addCode('email_template_presets {\n  id: uuid (PK)\n  key: text (unique) -- e.g. conference_followup_intro_call_warm_short_v1\n  template_type: text -- e.g. conference_followup\n  name: text\n  active: boolean (default true)\n  defaults: jsonb -- { ask_type, tone, length, subject_variants, constraints }\n  created_at, updated_at: timestamptz\n}');

    addSubtitle('Outreach Reply & Follow-Up Tables (Phase F):');
    addCode('outreach_replies {\n  id: uuid (PK)\n  campaign_id: uuid (FK → email_campaigns)\n  contact_id: uuid (FK → contacts, nullable)\n  thread_id: text\n  gmail_message_id: text (unique)\n  direction: text (default inbound)\n  received_at: timestamptz\n  outcome: text (useful | neutral | not_useful, nullable)\n  acknowledged_by: uuid (nullable)\n  acknowledged_at: timestamptz (nullable)\n  created_at: timestamptz\n}\n\nfollow_up_suggestions {\n  id: uuid (PK)\n  org_id: uuid\n  source_type: text (reply | watchlist | event)\n  source_id: uuid (nullable)\n  campaign_id: uuid (FK → email_campaigns, nullable)\n  contact_id: uuid (FK → contacts, nullable)\n  reason: text\n  suggested_template_key: text (nullable)\n  suggested_audience_type: text (nullable)\n  status: text (pending | accepted | dismissed | snoozed)\n  snoozed_until: timestamptz (nullable)\n  acted_on_at: timestamptz (nullable)\n  created_at, updated_at: timestamptz\n}');

    addSubtitle('Database Views:');
    addCode('resend_candidates_v1 (security_invoker)\n  -- Surfaces failed audience rows eligible for retry\n  -- Includes: quota, provider_temp, unknown categories\n  -- Excludes: invalid_address, bounce, provider_perm\n  -- Condition: sent_at IS NULL OR sent_at < now() - 24h\n\norg_knowledge_current_v\n  -- Active authoritative snapshot per org\n  -- Fields: org_id, snapshot_id, version, structured_json, raw_excerpt, source_type\n\naction_type_effectiveness_v\n  -- Success rates by action_type\n  -- Fields: action_type, total_actions, success_rate, avg_confidence\n\nsignal_type_effectiveness_v\n  -- Actions generated/executed per signal_type\n  -- Fields: signal_type, actions_generated, actions_executed, success_rate\n\norg_action_history_v\n  -- Unified action + outcome timeline per org\n  -- Fields: org_id, action_type, outcome_type, observed_at');

    addPage();
    
    addSubtitle('User & Profile Tables:');
    addCode('profiles {\n  id: uuid (PK)\n  user_id: uuid (FK → auth.users, unique)\n  display_name, nickname: text\n  timezone: text\n  is_approved: boolean (account activation)\n  gmail_email_address: text (connected Gmail for outreach)\n  google_refresh_token: text (encrypted OAuth token)\n}\n\nuser_roles {\n  id: uuid (PK)\n  user_id: uuid (FK → auth.users)\n  role: enum (admin/leadership/regional_lead/staff)\n}\n\nuser_metros {\n  id: uuid (PK)\n  user_id: uuid (FK)\n  metro_id: uuid (FK)\n  -- Junction table for metro access\n}');
    
    addSubtitle('Lookup Tables (Admin Configurable):');
    addCode('regions, sectors, grant_alignments, grant_types,\nmission_snapshots, partnership_angles,\nevent_types, event_pcs_goals,\nevent_strategic_lanes, event_target_populations');

    addPage();

    // Section 5: Authentication & Authorization
    addTitle('5. Authentication & Authorization');
    addSubtitle('Authentication Flow:');
    addBullet('Supabase Auth with email/password and Google Sign-In (OAuth 2.0)');
    addBullet('Email verification required before first login');
    addBullet('Password reset via email link');
    addBullet('Session persisted in localStorage with auto-refresh');
    addBullet('AuthContext provides user, session, profile, and roles');
    
    addSubtitle('User Approval Workflow:');
    addBullet('New signups create profile with is_approved = false');
    addBullet('Unapproved users see "Account Pending Approval" screen');
    addBullet('Admins approve users in Admin → Users panel');
    addBullet('Approved users can then access the application');
    
    addSubtitle('Role Hierarchy:');
    addCode('admin:\n  - Full access to all data across all metros\n  - Access to Admin panel for configuration\n  - Can approve users and assign roles\n  - Can view internal grant strategy notes\n  - Can delete any record\n\nleadership:\n  - Full read access across all metros\n  - Can view reports and analytics\n  - Cannot access Admin configuration\n\nregional_lead:\n  - Access to assigned metros only\n  - Full CRUD within their metro scope\n  - Can create/manage opportunities, contacts, events\n\nstaff:\n  - Limited access to assigned metros\n  - Can create activities and log interactions\n  - Read access to opportunities and contacts');
    
    addSubtitle('Metro-Based Access Control:');
    addParagraph('Users are assigned to specific metros via user_metros junction table. All metro-scoped entities (opportunities, events, activities, pipeline, anchors) are filtered by metro_id.');
    addCode('-- Helper function used in RLS policies\nhas_metro_access(user_id uuid, metro_id uuid) → boolean\n-- Returns true if user has access to the specified metro');

    addPage();

    // Section 6: RLS Policies
    addTitle('6. Row-Level Security (RLS) Policies');
    addParagraph('All tables have RLS enabled. Policies use a combination of role checks and metro access verification.');
    
    addSubtitle('Common Policy Patterns:');
    addCode('-- Admin/Leadership bypass (SELECT on most tables)\nhas_any_role(auth.uid(), ARRAY[\'admin\', \'leadership\'])\n\n-- Metro-scoped access\nhas_metro_access(auth.uid(), metro_id)\n\n-- Owner-based access\nowner_id = auth.uid() OR created_by = auth.uid()');
    
    addSubtitle('Critical Tables & Their Policies:');
    
    addParagraph('OPPORTUNITIES:');
    addBullet('SELECT: Admins/Leadership see all; others need metro access');
    addBullet('INSERT: Must have metro access to the target metro');
    addBullet('UPDATE: Owner or metro access required');
    addBullet('DELETE: Admin/Leadership only');
    
    addParagraph('CONTACTS:');
    addBullet('SELECT: See contacts for accessible opportunities OR own created contacts');
    addBullet('INSERT: created_by must match auth.uid()');
    addBullet('UPDATE: Own contacts OR contacts on accessible opportunities');
    addBullet('DELETE: Admin/Leadership only');
    
    addParagraph('GRANTS:');
    addBullet('SELECT: Admin/Leadership see all; others see by metro/owner');
    addBullet('INSERT: Need metro access');
    addBullet('UPDATE: Admin/Leadership or owner');
    addBullet('DELETE: Admin only');
    
    addParagraph('AI_SUGGESTIONS (hardened Jan 31, 2026):');
    addBullet('SELECT: user_id = auth.uid() only');
    addBullet('INSERT: user_id = auth.uid() only');
    addBullet('UPDATE: ONLY for status = "pending" suggestions');
    addBullet('DELETE: Hard delete ONLY for status in ("pending", "dismissed")');
    addBullet('Approved suggestions are permanent—cannot be deleted to preserve CRM integrity');
    
    addParagraph('EMAIL_COMMUNICATIONS, AI_USER_SETTINGS:');
    addBullet('All operations: user_id = auth.uid() only');
    addBullet('Users can only see/manage their own AI data');
    
    addParagraph('EDGE_FUNCTION_RATE_LIMITS (new Jan 31, 2026):');
    addBullet('No RLS (internal table for service role only)');
    addBullet('Tracks per-user, per-function rate windows');
    
    addParagraph('AUDIT_LOG:');
    addBullet('SELECT: Admin only');
    addBullet('INSERT: Authenticated users via triggers (no direct access)');
    addBullet('DELETE: Admin only');

    addPage();

    // Section 7: Edge Functions
    addTitle('7. Edge Functions (Backend)');
    addParagraph('Deno-based serverless functions deployed to Supabase Edge. All functions use service role key for database access.');
    
    addSubtitle('Unified AI Gateway (Jan 31, 2026):');
    addParagraph('All AI operations now route through a single shared callLovableAI() wrapper in profunda-ai:');
    addBullet('Consistent auth, headers, model selection, and error handling');
    addBullet('Modes: analyze (email), ocr (business cards), chat, manual (text paste)');
    addBullet('Model: google/gemini-3-flash-preview via Lovable AI proxy');
    addBullet('No external API keys required');
    
    addSubtitle('Rate Limiting (Jan 31, 2026):');
    addParagraph('DB-backed atomic rate limiting prevents abuse across all AI modes:');
    addBullet('edge_function_rate_limits table with UPSERT-based counting');
    addBullet('check_and_increment_rate_limit() RPC with epoch-based 5-min windows');
    addBullet('Per-mode limits: chat 30, analyze 10, ocr 20, manual 30 requests/5min');
    addBullet('Returns 429 Too Many Requests when limit exceeded');
    addBullet('Returns 503 Service Unavailable on DB errors (fail-closed for AI modes)');
    
    addSubtitle('Function Inventory:');
    
    addParagraph('profunda-ai (Unified AI Gateway):');
    addBullet('Mode: chat - Streaming AI responses for chat interface');
    addBullet('Mode: analyze - Email analysis for contact/task suggestions');
    addBullet('Mode: ocr - Business card image extraction');
    addBullet('Mode: manual - Text paste extraction');
    addBullet('Mode: generate-plan-reasoning - AI reasoning for weekly focus plan items (new)');
    addBullet('Mode: stats - AI suggestion statistics');
    addBullet('Mode: approve/dismiss - Suggestion status updates');
    addBullet('All modes use shared callLovableAI() wrapper');
    addBullet('Rate limited per mode (generate-plan-reasoning: 20/5min)');
    
    addParagraph('gmail-sync (Email Sync)');
    addBullet('Fetches emails from Gmail API using stored OAuth tokens');
    addBullet('Filters by ignored_email_domains setting');
    addBullet('Stores in email_communications table');
    addBullet('Handles token refresh automatically');
    addBullet('NEW (Phase F): Detects inbound replies to campaign emails');
    addBullet('Matches sender email against email_campaign_audience sent records');
    addBullet('Creates outreach_replies rows for detected campaign replies');
    
    addParagraph('google-calendar-sync (Calendar Sync)');
    addBullet('Syncs Google Calendar events to google_calendar_events table');
    addBullet('Matches attendee emails to existing contacts');
    addBullet('Two-way event linking with CRM events');
    
    addParagraph('read-ai-webhook (Meeting Notes)');
    addBullet('Receives Read.ai summaries via Zapier webhook');
    addBullet('Creates meeting_notes with action items');
    addBullet('Auto-marks meetings as attended');
    addBullet('Extracts tasks assigned to user (name/alias matching)');
    
    addParagraph('suggest-grant-matches (Grant Suggestions)');
    addBullet('AI-powered matching of opportunities to grants');
    addBullet('Based on grant_alignment, metro, and mission overlap');
    
    addParagraph('gmail-campaign-send (Gmail Campaign Sending)');
    addBullet('Sends email campaigns directly from connected Gmail account');
    addBullet('Per-RIM sending: each user sends as themselves');
    addBullet('Mints OAuth access token on-demand (never stored)');
    addBullet('Merge tag replacement: {{ contact.FIRSTNAME }}, {{ contact.LASTNAME }}, etc.');
    addBullet('Batched sending: 25 emails per batch with 300ms delay');
    addBullet('Pause/resume/retry support for campaign lifecycle management');
    addBullet('Failure normalization: normalizeGmailFailure() categorizes errors into 6 types');
    addBullet('Categories: quota, invalid_address, bounce, provider_temp, provider_perm, unknown');
    addBullet('Subject stats: upserts to campaign_subject_stats on send completion');
    addBullet('Daily cap enforcement: soft cap (500, warning) and hard cap (2000, blocked)');
    addBullet('Caps checked server-side via usage_events before any recipient is sent');
    addBullet('Status transitions: draft → audience_ready → sending → paused/sent/failed');
    addBullet('Warehouse Manager role blocked (checked via user_roles table)');
    addBullet('Rate limited: 10 requests per minute via check_and_increment_rate_limit');
    addBullet('Logs all events to email_campaign_events table');
    
    addParagraph('campaign-audience (Audience Building)');
    addBullet('Builds audience from opportunity filters or manual emails');
    addBullet('Snapshots recipients to email_campaign_audience table');
    addBullet('Deduplication via lowercase email normalization');
    addBullet('Remove recipients action for individual/bulk removal');
    addBullet('Updates audience_count on email_campaigns table');
    addBullet('Logs audience_built event with filter metadata');

    addParagraph('campaign-suggestion-convert (Watchlist → Outreach)');
    addBullet('Converts watchlist-driven campaign suggestions into draft campaigns');
    addBullet('Actions: convert (creates draft + audience), dismiss, snooze (7 days)');
    addBullet('On convert: creates email_campaigns row + populates audience from org contacts (up to 5)');
    addBullet('Updates suggestion status and sets converted_campaign_id');
    addBullet('RBAC enforced: only authenticated users with campaign access');

    addParagraph('n8n-ingest (Automation Ingest - includes suggestion generation)');
    addBullet('Processes watchlist_change signals from n8n workflows');
    addBullet('Auto-creates campaign_suggestions from qualifying signals (confidence >= 0.4)');
    addBullet('Anti-spam: suppresses suggestions for orgs dismissed/snoozed in last 7 days');
    addBullet('Grouping: signals within 48h for same org reuse existing open suggestion');
    addBullet('Idempotent via unique constraint on (org_id, source_type, source_id, suggestion_type)');

    addParagraph('create-event-followup-campaign (Event → Draft Campaign)');
    addBullet('Creates draft email campaign from event attendees after import');
    addBullet('Defaults to AI-generated templates via email-template-generate (company_kb mode)');
    addBullet('Falls back to static template if AI generation fails');
    addBullet('Resolves attendees by event_id + optional import_batch_id');
    addBullet('Deduplicates by lowercase email');
    addBullet('Stores subject_variants and citations in campaign metadata');
    addBullet('Returns campaign_id + audience_count + subject_variants');

    addParagraph('email-template-generate (AI Template Engine — NEW)');
    addBullet('Generates email templates using Lovable AI (google/gemini-3-flash-preview)');
    addBullet('Loads active preset from email_template_presets for template_type defaults');
    addBullet('Always injects Company KB (company_profile, email_tone, approved_claims)');
    addBullet('Optional org snapshot included as secondary TARGET_ORG_PROFILE context');
    addBullet('Output: subject, 3 subject_variants, body_html, plain_text, allowed_tokens_used, citations');
    addBullet('Validates: 3 subject variants with event name, no scripts in HTML');
    addBullet('Personalization tokens limited to {{ contact.FIRSTNAME }}');
    addBullet('Provenance: citations include company_kb_versions + org_snapshot_id');

    addParagraph('org-knowledge-refresh (Admin Only — Perplexity Research)');
    addBullet('Researches org website via Perplexity sonar-pro (mission, programs, impact, community)');
    addBullet('AI extraction to structured JSON via Lovable AI (google/gemini-3-flash-preview)');
    addBullet('Creates versioned snapshot: version = prior + 1, deactivates previous');
    addBullet('Fields: org_name, mission, positioning, who_we_serve, programs, key_stats, tone_keywords, approved_claims, disallowed_claims, sources');
    addBullet('No TTL — snapshots are permanent until explicitly refreshed');
    addBullet('Admin role enforced via user_roles check');

    addParagraph('org-knowledge-update (Admin Only — Manual Curation)');
    addBullet('Patches structured_json on current active snapshot');
    addBullet('Creates new version with source_type=admin_curated');
    addBullet('Deactivates prior snapshot (active=false, replaced_by=new_id)');
    addBullet('Schema validation enforced');

    addParagraph('org-knowledge-get (Auth — Org-Scoped Read)');
    addBullet('Returns current active snapshot + version history for an org');
    addBullet('Any authenticated user who can view the org can read');

    addParagraph('provision-create (Provisions — Draft Creation)');
    addBullet('Creates provision record + provision_items from catalog selections');
    addBullet('Auto-assigns metro_id from linked opportunity');
    addBullet('Calculates total_cents and total_quantity from catalog prices');
    addBullet('Sets status = draft, source = manual');

    addParagraph('provision-submit (Provisions — Status Transition)');
    addBullet('Transitions provision from draft → submitted');
    addBullet('Sets submitted_at timestamp');
    addBullet('Validates current status is draft before transition');

    addParagraph('provision-update (Provisions — Field Updates)');
    addBullet('Updates provision fields: status transitions, tracking info, notes');
    addBullet('Enforces valid status transitions (draft→submitted→ordered→shipped→delivered)');
    addBullet('Sets timestamp columns (ordered_at, shipped_at, delivered_at) on status change');

    addParagraph('provision-message-create (Provisions — Conversation Thread)');
    addBullet('Creates threaded messages on provision records');
    addBullet('Links sender via auth.uid()');
    addBullet('Used for requester↔staff communication');

    addParagraph('provision-parse (Provisions — AI Paste & Parse)');
    addBullet('Accepts raw text (pasted order details, email snippets)');
    addBullet('AI extracts structured line items: device category, tier, quantity');
    addBullet('Matches extracted items against provision_catalog_items');
    addBullet('Returns suggested items for user review before creation');
    
    addParagraph('neighborhood-insights (Neighborhood Context Engine — NEW Phase F)');
    addBullet('Generates community analysis for org locations via Lovable AI');
    addBullet('Sources: Census QuickFacts via deterministic FIPS-based URL generation + Perplexity neighborhood research');
    addBullet('Research via Perplexity sonar-pro (neighborhood demographics + community needs)');
    addBullet('Output: brief_history, current_trends, current_struggles, community_needs, program_opportunities');
    addBullet('Stored in org_neighborhood_insights with org_neighborhood_insight_sources');
    addBullet('Cached 30 days (fresh_until), manual refresh replaces snapshot');
    addBullet('Emits neighborhood_insights_generated usage event');
    
    addBullet('scheduled-gmail-sync: Auto-syncs Gmail every 4 hours for all connected users');
    addBullet('cleanup-old-emails: Removes emails older than 30 days AND rate limits older than 7 days (daily at 3 AM)');
    addBullet('check-overdue-actions: Flags overdue next_action_due dates');
    addBullet('check-stale-opportunities: Marks opportunities stale after 30 days');
    addBullet('check-task-due-dates: Sends reminders for upcoming tasks');
    addBullet('notify-pipeline-milestone: Alerts on pipeline stage changes');
    addBullet('send-weekly-digest: Weekly summary email to users');
    addBullet('send-scheduled-report: Delivers scheduled report exports');

    addPage();

    // Section 8: Core Features
    addTitle('8. Core Features & Workflows');
    
    addSubtitle('Command Center (Home Dashboard):');
    addBullet('AI-powered daily insight banner');
    addBullet('Weekly AI Focus Plan - prioritized list of 5-10 actions for the week');
    addBullet('Deterministic scoring: overdue (+40), grant deadlines (+35), near-wins (+30), inactive (+25)');
    addBullet('Focus/Review mode: Mon-Thu action mode, Fri-Sun review mode');
    addBullet('Weekly Snapshot showing activity counts');
    addBullet('Top 5 Focus Items (stale opps, near wins, grant deadlines)');
    addBullet('Friday Scorecard for weekly goal tracking');
    addBullet('Anchor Velocity metrics');
    addBullet('Email Insights card for AI suggestions');
    addBullet('Quick Log buttons for common activity types');
    
    addSubtitle('Weekly Focus Plan (new Feb 2026):');
    addBullet('Stored in weekly_plans table with JSONB plan_json column');
    addBullet('One plan per user per week (UNIQUE user_id + week_start_date)');
    addBullet('Regenerate replaces entire plan with fresh scoring');
    addBullet('Items have status: open, done, dismissed');
    addBullet('Open count badge shows only open items');
    addBullet('AI generates ai_reasoning for each item via profunda-ai edge function');
    addBullet('Category diversity enforced: max 3 items per category');
    
    addSubtitle('Opportunity Lifecycle (Journey Chapters):');
    addCode('Found (Target Identified) → First Conversation (Contacted) → Discovery (Scheduled/Held)\n  → Pricing Shared (Proposal Sent) → Account Setup (Agreement Pending/Signed)\n  → First Devices (First Volume) → Growing Together (Stable Producer)\n  → Not the Right Time (Closed - Not a Fit)');
    addBullet('Opportunities can be converted to Anchors at "Agreement Signed"');
    addBullet('Conversion wizard pre-fills anchor record from opportunity');
    addBullet('Closes opportunity as "Won" and removes pipeline record');
    
    addSubtitle('Grant Tracking:');
    addCode('Researching → Identified → Applied → Under Review → Awarded/Closed');
    addBullet('Fiscal year tracking for multi-year grants');
    addBullet('Duplicate for next year feature');
    addBullet('Year-over-year comparison view');
    addBullet('Star rating for prioritization');
    addBullet('Link grants to anchors for impact visibility');
    
    addSubtitle('Event Management:');
    addBullet('Event types, target populations, strategic lanes configurable');
    addBullet('ROI scoring based on households, devices, signups, contacts');
    addBullet('Post-event outcome tracking');
    addBullet('Google Calendar integration for scheduling');
    addBullet('Link people to "met at event"');

    addPage();
    
    addSubtitle('AI Features:');
    addParagraph('Chat Assistant:');
    addBullet('Natural language queries about CRM data');
    addBullet('Streaming responses with typing indicator');
    addBullet('Context-aware (knows user\'s opportunities, contacts, events)');
    addBullet('Session history stored per user');
    
    addParagraph('Email Insights:');
    addBullet('Gmail sync imports external emails (filters internal domain)');
    addBullet('AI analyzes for new contacts, follow-up tasks, reminders');
    addBullet('Sent email scanning detects self-commitments (e.g., "I\'ll send the proposal")');
    addBullet('Tasks extracted from sent emails auto-link to recipient contact');
    addBullet('Confidence scores determine auto-approve vs. review');
    addBullet('Dependency chaining (create contact → then create task for that contact)');
    addBullet('Bulk approve/dismiss from Command Center');
    addBullet('Mobile-optimized UI uses native scrolling to prevent viewport clipping');
    
    addParagraph('OCR Scanner:');
    addBullet('Capture business card images in contact form');
    addBullet('Extracts name, title, email, phone, organization');
    addBullet('Pre-fills contact form fields');
    addBullet('File validation: 10MB max, jpeg/png/webp/heic/heif only');
    
    addParagraph('Manual Text Intake (new Jan 31, 2026):');
    addBullet('Paste unstructured text (business cards, email signatures)');
    addBullet('AI extracts structured contact data');
    addBullet('Creates pending suggestion for review');
    addBullet('3-2000 character limit per submission');
    addBullet('Uses shared callLovableAI() wrapper');
    
    addSubtitle('Reporting:');
    addBullet('Report Builder with entity selection and filters');
    addBullet('Export to PDF or CSV');
    addBullet('Schedule recurring reports via email');
    addBullet('My Activity report for personal metrics');
    
    addSubtitle('Email Campaigns (Outreach):');
    addBullet('Campaign Builder with rich text editor (TipTap)');
    addBullet('Audience building via opportunity filters or manual email entry');
    addBullet('Recipients snapshotted at build time (list frozen during send)');
    addBullet('Gmail-native sending: each RIM sends from their own connected Gmail');
    addBullet('Merge tags: {{ contact.FIRSTNAME }}, {{ contact.LASTNAME }}, {{ contact.FULLNAME }}, {{ contact.EMAIL }}');
    addBullet('Batched sending: 25 emails per batch with rate limiting');
    addBullet('Pause/resume/retry lifecycle controls');
    addBullet('Test email support before full campaign send');
    addBullet('Status workflow: Draft → Audience Ready → Sending → Paused/Sent/Failed');
    addBullet('Send guardrails: blocks empty subject/body, zero audience, enforces daily caps');
    addBullet('Server-side daily caps: soft (500, shows warning) and hard (2,000, blocks send)');
    addBullet('Full audit trail in email_campaign_events table');
    addBullet('Warehouse Manager role blocked from all outreach features');

    addSubtitle('Campaign Intelligence:');
    addBullet('Subject Performance: tracks sent/failed per subject line across campaigns');
    addBullet('Failure Normalization: Gmail errors mapped to 6 categories (quota/invalid/bounce/temp/perm/unknown)');
    addBullet('Failure Breakdown panel: distribution of error categories with top raw errors');
    addBullet('Suggested Resend: deterministic identification of transient failures eligible for retry');
    addBullet('Resend eligibility: quota + provider_temp + unknown only; permanent failures excluded');
    addBullet('Bulk requeue from Monitor tab with checkbox selection');
    addBullet('Recipient CSV export (filter by sent/failed/queued/skipped)');
    addBullet('Quota Hit badge when Gmail returns 429 rate limit errors');

    addSubtitle('Watchlist → Outreach Suggestions:');
    addBullet('Watchlist change signals auto-generate campaign suggestions');
    addBullet('Deterministic templates: subject + body pre-filled from signal data');
    addBullet('One-click "Create Draft Campaign" converts suggestion into draft + audience');
    addBullet('Audience auto-built from up to 5 org contacts');
    addBullet('Anti-spam: suppresses for orgs dismissed/snoozed in last 7 days');
    addBullet('Grouping: multiple signals within 48h for same org reuse existing suggestion');
    addBullet('UI: Outreach Suggestions card on Org pages, Suggested Outreach feed on Dashboard');
    addBullet('Actions: Create Draft, Dismiss, Snooze (7 days)');

    addSubtitle('Campaign Replies & Follow-Up Suggestions (Phase F):');
    addBullet('Gmail sync detects inbound replies to campaign emails → outreach_replies table');
    addBullet('Human acknowledgement: rate replies as useful/neutral/not_useful');
    addBullet('Campaign detail → Replies panel with outcome rating buttons');
    addBullet('Action Effectiveness: scores actions by template + audience + subject');
    addBullet('Scoring: +3 useful reply, +1 any reply, −1 no reply after 14 days');
    addBullet('Follow-up suggestions triggered by: reply + no follow-up (7d), watchlist + no outreach (30d), event + no campaign');
    addBullet('Each suggestion: reason, suggested template preset, CTA to create draft');
    addBullet('Accept/Dismiss/Snooze controls with outcome logging');
    addBullet('Never auto-sends — all actions require human confirmation');

    addSubtitle('Neighborhood Insights (Phase F):');
    addBullet('AI-generated community analysis: history, trends, struggles, needs, program opportunities');
    addBullet('Sources: Wikipedia + Census QuickFacts via deterministic URL + Firecrawl scraping');
    addBullet('org_neighborhood_insights table with org_neighborhood_insight_sources');
    addBullet('Cached 30 days, manual refresh button on Organization pages');
    addBullet('Read-only context for opportunity views and email template generation');

    // Section 9: Data Flow
    addTitle('9. Data Flow Patterns');
    
    addSubtitle('React Query Patterns:');
    addCode('// Query key convention\n[\'entity-type\'] - list queries\n[\'entity-type\', id] - single entity\n[\'entity-type\', filter] - filtered list\n\n// Invalidation on mutation\nqueryClient.invalidateQueries({ queryKey: [\'opportunities\'] })');
    
    addSubtitle('Optimistic Updates:');
    addBullet('Delete with undo uses optimistic removal + toast with restore action');
    addBullet('8-second undo window before permanent deletion');
    
    addSubtitle('Audit Logging:');
    addCode('useLogAudit hook → audit_log table\n{\n  action: \'create\' | \'update\' | \'delete\',\n  entity_type: \'opportunity\' | \'contact\' | ...,\n  entity_id: uuid,\n  entity_name: string,\n  changes: { field: { from, to } } // for updates\n}');
    
    addSubtitle('Real-time Updates:');
    addParagraph('Currently not implemented for most entities. Could be added for:');
    addBullet('Pipeline stage changes');
    addBullet('New AI suggestions');
    addBullet('Collaborative editing conflicts');

    addPage();

    // Section 10: Security Considerations
    addTitle('10. Known Security Considerations');
    
    addSubtitle('Properly Implemented:');
    addBullet('RLS on all user-facing tables');
    addBullet('Service role key only in Edge Functions (not exposed to client)');
    addBullet('OAuth tokens stored server-side only');
    addBullet('Email verification required for new accounts');
    addBullet('Admin approval workflow for new users');
    addBullet('Audit trail for all CRUD operations');
    addBullet('DB-backed rate limiting on all AI Edge Functions (Jan 31, 2026)');
    addBullet('OCR file validation: 10MB limit, allowed types only (jpeg, png, webp, heic, heif)');
    addBullet('Hard delete restrictions on ai_suggestions (approved records protected)');
    addBullet('Automatic rate limit cleanup (7-day retention)');
    addBullet('Gmail access token minted on-demand, never persisted (only refresh_token stored)');
    addBullet('Server-side daily send caps enforced in edge function (not client-only)');
    addBullet('Campaign audience table is SELECT-only via RLS; all writes via service role');
    addBullet('Failure normalization truncates raw errors to prevent info leakage');
    addBullet('Warehouse Manager role blocked at DB (RLS), edge function (RBAC), route, and sidebar levels');
    addBullet('Campaign suggestion idempotency via unique constraint prevents duplicate suggestions');
    
    addSubtitle('Areas Requiring Attention:');
    addBullet('No CSRF protection (Supabase handles via tokens)');
    addBullet('Session timeout not explicitly configured');
    addBullet('No IP-based access restrictions');
    
    addSubtitle('Sensitive Data:');
    addBullet('internal_strategy_notes on grants (admin-only column)');
    addBullet('Email body_preview contains PII');
    addBullet('Contact phone/email is PII');
    addBullet('OAuth refresh tokens in secure storage');
    addBullet('gmail_email_address stored in profiles (used as campaign FROM address)');

    addPage();

    // Section 11: Potential Vulnerability Areas
    addTitle('11. Potential Vulnerability Areas');
    addParagraph('Areas for security review and potential loophole detection:');
    
    addSubtitle('RLS Policy Gaps:');
    addBullet('Verify DELETE policies on all tables (some may be too permissive)');
    addBullet('Check if metro_id NULL records are accessible to non-admins');
    addBullet('Junction table policies (grant_anchor_links, user_metros) need review');
    addBullet('Orphaned records when parent is deleted');
    
    addSubtitle('Edge Function Security:');
    addBullet('Verify auth token validation in each function');
    addBullet('Check for SQL injection in raw queries');
    addBullet('Validate input parameters before use');
    addBullet('Error messages may leak internal information');
    
    addSubtitle('Data Validation:');
    addBullet('Zod schemas should match database constraints');
    addBullet('Enum values validated on frontend but verify backend');
    addBullet('URL slugs should be sanitized to prevent XSS');
    addBullet('Rich text (notes) uses DOMPurify but verify coverage');
    
    addSubtitle('Business Logic Flaws:');
    addBullet('Can a user approve their own account? (is_approved)');
    addBullet('Can a user grant themselves admin role?');
    addBullet('Can deleted records be accessed via direct ID?');
    addBullet('Race conditions in bulk operations');
    addBullet('Undo window allows data restoration - verify RLS still applies');

    addPage();

    // Section 12: Testing Recommendations
    addTitle('12. Testing Recommendations');
    
    addSubtitle('Security Testing Checklist:');
    addBullet('Test each RLS policy with different role combinations');
    addBullet('Attempt cross-metro data access');
    addBullet('Try to access admin-only fields as regular user');
    addBullet('Test unapproved user access attempts');
    addBullet('Verify audit log captures all mutations');
    
    addSubtitle('Edge Function Testing:');
    addBullet('Call functions with invalid/missing auth tokens');
    addBullet('Send malformed JSON payloads');
    addBullet('Test timeout handling for long operations');
    addBullet('Verify error responses don\'t leak sensitive info');
    
    addSubtitle('Integration Testing:');
    addBullet('OAuth token refresh flow');
    addBullet('Email sync with large mailboxes');
    addBullet('Concurrent AI analysis requests');
    addBullet('Bulk operations with partial failures');
    
    addSubtitle('Campaign-Specific Testing:');
    addBullet('Daily cap enforcement: verify soft cap warning and hard cap block');
    addBullet('Retry/resume does not double-bill usage_events');
    addBullet('Failure normalization maps all known Gmail error patterns');
    addBullet('Resend candidates only include transient failure categories');
    addBullet('Subject stats increment correctly and are retry-safe');
    addBullet('Campaign suggestion grouping within 48h window');
    addBullet('Anti-spam: snoozed/dismissed orgs suppressed for 7 days');
    
    addSubtitle('Regression Testing Focus:');
    addBullet('Authentication state after session expiry');
    addBullet('Navigation guards on protected routes');
    addBullet('Form validation edge cases');
    addBullet('Delete cascade behavior');
    addBullet('Undo functionality timing');

    addPage();

    // Section 13: Intelligence Loop
    addTitle('13. Intelligence Loop (Phase 4)');
    addSubtitle('Next Best Action Engine:');
    addBullet('org_next_actions table stores ranked recommendations from signals, insights, suggestions');
    addBullet('Deterministic scoring: (severity×3) + (confidence×2) + (predicted_success_rate×4) − recency − dismissal');
    addBullet('predicted_success_rate from org_action_effectiveness_v (default 0.35)');
    addBullet('Status: open → executed/dismissed/snoozed');
    addBullet('Unique constraint: one open action per (org_id, source_id)');
    addBullet('Dismissal suppresses regeneration for 30 days');

    addSubtitle('In-App Alerts:');
    addBullet('user_alerts table — passive notifications, no email/push');
    addBullet('Triggers: high-score next actions, expiring send intents, stuck workflows');
    addBullet('Deduplication: unique per user + ref_id where unread');
    addBullet('AlertsDropdown in Header with unread count badge');

    addSubtitle('Learning Dashboards:');
    addBullet('action_type_effectiveness_v: success rates by action type');
    addBullet('signal_type_effectiveness_v: which signals generate executed actions');
    addBullet('org_action_history_v: unified action + outcome timeline');
    addBullet('UI panels: "What Works Best", "Signals Without Actions"');

    addPage();

    // Section 14: Org Knowledge
    addTitle('14. Org Knowledge System');
    addSubtitle('Architecture:');
    addBullet('Permanent, versioned snapshots — no TTL/expiration');
    addBullet('One active authoritative snapshot per org_id (unique partial index)');
    addBullet('source_type: firecrawl_bootstrap (scraped) or admin_curated (manually edited)');
    addBullet('structured_json schema: org_name, mission, positioning, who_we_serve, programs, key_stats, tone_keywords, approved_claims, disallowed_claims, sources');

    addSubtitle('AI Auto-Injection:');
    addBullet('Shared helper: getOrgKnowledgeContext() + buildOrgKnowledgeSystemBlock()');
    addBullet('Injected into ALL AI prompts when org_id is known');
    addBullet('System instruction: "Do not contradict. Do not invent claims not supported."');
    addBullet('Provenance: AI outputs store org_knowledge_snapshot_id + version');
    addBullet('Graceful fallback: if no snapshot exists, AI proceeds without it (logs warning)');

    addSubtitle('Event Followup Campaigns:');
    addBullet('create-event-followup-campaign edge function');
    addBullet('import_batch_id tracks contacts from each import session');
    addBullet('One-click draft campaign with deduped audience');
    addBullet('Defaults to AI-generated templates (company_kb mode) via email-template-generate');
    addBullet('Falls back to static template if AI unavailable');
    addBullet('Subject variants stored in campaign metadata for UI switching');

    addPage();

    // Section 15: Company AI Knowledge Base
    addTitle('15. Company AI Knowledge Base');
    addSubtitle('Purpose:');
    addParagraph('Global, canonical PCs for People identity context. Distinct from per-org knowledge snapshots (which describe target organizations). The Company KB is injected into ALL AI generations to ensure consistent, grounded outputs.');

    addSubtitle('Architecture:');
    addBullet('ai_knowledge_documents: versioned markdown docs keyed by function (company_profile, email_tone, approved_claims)');
    addBullet('ai_knowledge_document_versions: full version history with content and source URLs');
    addBullet('Shared helper: companyKbContext.ts — getCompanyKbContext() + buildCompanyKbSystemBlock()');
    addBullet('formatCompanyKbForPrompt(): deterministic prompt block with version numbers for provenance');

    addSubtitle('AI Injection:');
    addBullet('System prompt block: "AUTHORITATIVE COMPANY KNOWLEDGE BASE — Do not contradict."');
    addBullet('Includes COMPANY PROFILE, EMAIL TONE & STYLE, APPROVED CLAIMS sections');
    addBullet('Injected into: profunda-ai (all modes), email-template-generate, create-event-followup-campaign');
    addBullet('Provenance: company_kb_versions { key: version } stored with all AI outputs');

    addSubtitle('RLS:');
    addBullet('SELECT: admin/regional_lead/staff can read active documents');
    addBullet('INSERT/UPDATE/DELETE: admin only');

    addSubtitle('Admin UI:');
    addBullet('Admin panel "AI Knowledge Base" section');
    addBullet('Edit markdown content, manage source URLs, toggle active status');
    addBullet('Save creates new version (writes to versions table, bumps version number)');
    addBullet('Version history visible per document');

    addPage();

    // Section 16: Template Preset System
    addTitle('16. Template Preset System');
    addSubtitle('Purpose:');
    addParagraph('Server-stored deterministic template configurations that drive AI-generated email content. Ensures consistent outreach style across the team without per-user configuration.');

    addSubtitle('Architecture:');
    addBullet('email_template_presets table with JSONB defaults column');
    addBullet('Key-based lookup: template_type (e.g., conference_followup) selects active preset');
    addBullet('Defaults include: ask_type, tone, length, subject_variants (with {{ context.event_name }} tokens), constraints');

    addSubtitle('Default Preset:');
    addCode('key: conference_followup_intro_call_warm_short_v1\ntemplate_type: conference_followup\nname: Conference Follow-up (Intro Call · Warm · Short)\ndefaults:\n  ask_type: intro_call\n  tone: warm\n  length: short\n  subject_variants:\n    - Great meeting you at {{ context.event_name }}\n    - Following up from {{ context.event_name }}\n    - Quick follow-up from {{ context.event_name }}\n  constraints:\n    - Do not invent facts\n    - 4-5 short paragraphs max\n    - Ask for 15-20 min intro call\n    - Warm, human, professional. No hype.');

    addSubtitle('Integration Flow:');
    addBullet('1. User clicks "Email attendees" on event page');
    addBullet('2. create-event-followup-campaign calls email-template-generate');
    addBullet('3. email-template-generate loads active preset + Company KB');
    addBullet('4. AI generates subject, 3 variants, body_html, plain_text');
    addBullet('5. Campaign created with first variant as default subject');
    addBullet('6. Subject variants stored in metadata for UI switching');
    addBullet('7. User navigates to campaign builder to review/edit/send');

    addSubtitle('RLS:');
    addBullet('SELECT: all authenticated users can read active presets');
    addBullet('INSERT/UPDATE/DELETE: admin only');

    addPage();

    // Section 17: Phase F — Signal → Insight → Action Loops
    addTitle('17. Signal → Insight → Action Loops (Phase F)');
    addSubtitle('Purpose:');
    addParagraph('Phase F closes the feedback loop from outreach → replies → outcomes → learning. It compounds real-world results into better recommendations without AI guessing or auto-sending.');

    addSubtitle('F1 — Reply-Derived Outcomes:');
    addBullet('Gmail sync detects inbound replies by matching sender against email_campaign_audience');
    addBullet('outreach_replies table stores: campaign_id, contact_id, thread_id, gmail_message_id, direction');
    addBullet('Human acknowledgement UI: Useful (+3 score), Neutral (+1), Not Useful (0)');
    addBullet('No AI sentiment analysis — human judgment only, optional but first-class');
    addBullet('Campaign detail → Replies panel and Contact timeline');

    addSubtitle('F2 — Action Effectiveness Ranking:');
    addBullet('action_effectiveness table: action_key (hash of template + audience + subject), score, sample_count');
    addBullet('Incremental scoring: +3 useful reply, +1 any reply, −1 no reply after 14 days');
    addBullet('Read-only analytics: "Most Effective Outreach Actions (last 90 days)"');
    addBullet('Admin + leadership only visibility');
    addBullet('Feeds predicted_success_rate into Next Best Action scoring formula');

    addSubtitle('F3 — Auto-Suggested Follow-Ups:');
    addBullet('follow_up_suggestions table: source_type (reply/watchlist/event), reason, status, suggested_template_key');
    addBullet('Triggers: reply + no follow-up (7d), watchlist signal + no outreach (30d), event import + no campaign');
    addBullet('Each suggestion: human-readable reason, suggested template preset, suggested audience');
    addBullet('CTA: "Create Draft Campaign" — one-click draft creation');
    addBullet('Status: pending → accepted/dismissed/snoozed');
    addBullet('Never auto-sends — all actions require human approval');

    addSubtitle('F4 — Neighborhood Insights:');
    addBullet('org_neighborhood_insights table: org_id, location_key, summary, insights_json, generated_at, fresh_until, model');
    addBullet('org_neighborhood_insight_sources: url, title, snippet, content_hash');
    addBullet('Location key derivation: Zip → City/State via hardcoded FIPS + state normalization');
    addBullet('Sources: Wikipedia + Census QuickFacts via deterministic URL generation');
    addBullet('Scraping: Firecrawl (max 8 sources), LLM extraction via Lovable AI');
    addBullet('Output: brief_history, current_trends, current_struggles, community_needs, program_opportunities, helpful_articles');
    addBullet('Cached 30 days — manual "Get Neighborhood Insights" button on Org pages');
    addBullet('Read-only context for opportunity views and email template generation');
    addBullet('Emits neighborhood_insights_generated usage event');

    addSubtitle('Key Files (Phase F):');
    addCode('Hooks:\n  src/hooks/useOutreachReplies.ts\n  src/hooks/useFollowUpSuggestions.ts\n  src/hooks/useNeighborhoodInsights.ts\n\nComponents:\n  src/components/outreach/CampaignRepliesPanel.tsx\n  src/components/outreach/ActionEffectivenessPanel.tsx\n  src/components/suggestions/FollowUpSuggestionsCard.tsx\n\nEdge Functions:\n  supabase/functions/neighborhood-insights/\n  supabase/functions/gmail-sync/ (updated for reply detection)\n\nGeo Utilities:\n  src/lib/geo/stateFips.ts');

    addPage();

    // Section 18: Push Notification System
    addTitle('18. Push Notification System (T1/T2/T3)');
    addSubtitle('Purpose:');
    addParagraph('Tiered push notification system delivering strategic nudges and operational awareness to RIMs via Android Chrome Web Push. Uses RFC 8291 encryption with VAPID authentication.');

    addSubtitle('Tier Behavior:');
    addBullet('T1 (Direct): Immediate delivery — watchlist signals, campaign suggestions, attendee enrichment, automation failures (admin only)');
    addBullet('T2 (Bundled): Grouped by (user_id, org_id) within 45-minute windows — campaign send summaries (opt-in, default OFF)');
    addBullet('T3 (Digest): Daily digest 8:30am local (top 5 signals, draft suggestions, attendee matches), Weekly summary Monday 9am (opt-in)');

    addSubtitle('Smart Delivery:');
    addBullet('Quiet hours: default 9pm–8am local (fallback UTC) — events queued, delivered next window');
    addBullet('Hourly caps: soft cap 6 (warning logged), hard cap 10 (blocked) per user per hour');
    addBullet('Fingerprint deduplication: unique per (user_id, fingerprint) — identical events never spam');
    addBullet('Global kill switch: NOTIFICATIONS_ENABLED env var — logs events but blocks delivery');
    addBullet('Per-type toggles: notification_type_config table — disable types without deploy');

    addSubtitle('Database Tables:');
    addCode('notification_events {\n  id: uuid (PK)\n  event_type: text (watchlist_signal, campaign_suggestion_ready, event_enrichment_ready, campaign_send_summary, automation_failed)\n  user_id: uuid\n  org_id: text (nullable)\n  metadata: jsonb\n  priority: text (normal/high)\n  fingerprint: text\n  tier: text (T1/T2/T3)\n  bundle_key: text (nullable)\n  deep_link: text (nullable)\n  title: text\n  body: text\n  status: text (pending/dispatched/bundled/dropped)\n  created_at: timestamptz\n  UNIQUE (user_id, fingerprint)\n}\n\nnotification_deliveries {\n  id: uuid (PK)\n  event_id: uuid (FK → notification_events)\n  queue_id: uuid (FK → notification_queue, nullable)\n  user_id: uuid\n  status: text (sent/failed/dropped/queued_quiet)\n  sent_at: timestamptz\n  error: text (nullable)\n  deliver_after: timestamptz (quiet hours deferral)\n  created_at: timestamptz\n}\n\nnotification_queue {\n  id: uuid (PK)\n  user_id: uuid\n  bundle_key: text\n  event_ids: uuid[]\n  title: text\n  body: text\n  deep_link: text\n  status: text (pending/sent/failed)\n  deliver_after: timestamptz\n  created_at: timestamptz\n}\n\nnotification_type_config {\n  event_type: text (PK)\n  enabled: boolean (default true)\n  tier: text\n  default_on: boolean\n  admin_only: boolean (default false)\n  bundle_window_minutes: int (default 45)\n  updated_at: timestamptz\n}');

    addSubtitle('User Settings (extended):');
    addCode('user_notification_settings (extended columns):\n  notify_watchlist_signals: boolean (default true)\n  notify_campaign_suggestions: boolean (default true)\n  notify_event_enrichment: boolean (default true)\n  notify_campaign_summary: boolean (default false)\n  notify_automation_health: boolean (default true)\n  notify_daily_digest: boolean (default true)\n  notify_weekly_summary: boolean (default false)\n  quiet_hours_start: int (default 21, 0-23)\n  quiet_hours_end: int (default 8, 0-23)\n  timezone: text (default UTC)');

    addSubtitle('Edge Functions:');
    addParagraph('notification-dispatcher (NEW — 3 modes):');
    addBullet('Mode: emit — Creates notification_events row, enforces per-type toggle + admin-only check');
    addBullet('Mode: dispatch — Processes pending events: bundles T2 by bundle_key, dedupes by fingerprint, respects quiet hours + caps, calls profunda-notify for delivery');
    addBullet('Mode: digest — Generates T3 daily/weekly digests from recent events');
    addBullet('Kill switch: NOTIFICATIONS_ENABLED env var checked on all modes');
    addBullet('Auth: x-internal-key header OR service role key');

    addParagraph('profunda-notify (existing — push delivery):');
    addBullet('Web Push with VAPID authentication + RFC 8291 payload encryption');
    addBullet('HKDF key derivation: keyInfo = "WebPush: info\\0" || subscriber_public_key || server_public_key');
    addBullet('Device tokens stored in push_subscriptions table');
    addBullet('FCM delivery with detailed response logging');

    addSubtitle('Message Templates (per event_type):');
    addCode('watchlist_signal:\n  title: "📡 Website update: {org_name}"\n  body: "New changes detected — review when ready"\n  deep_link: /orgs/{org_id}/signals\n\ncampaign_suggestion_ready:\n  title: "💡 New outreach idea"\n  body: "Suggestion ready for {org_name} — if helpful, it\'s ready for review"\n  deep_link: /campaigns/suggestions\n\nevent_enrichment_ready:\n  title: "🎯 New attendee matches"\n  body: "{match_count} matches found from {event_name}"\n  deep_link: /events/{event_id}/attendees\n\nautomation_failed:\n  title: "⚠️ Workflow needs attention"\n  body: "{workflow_key} encountered an issue"\n  deep_link: /admin/automations\n\ncampaign_send_summary:\n  title: "📧 Campaign delivery update"\n  body: "{sent_count} sent, {failed_count} issues — {campaign_name}"\n  deep_link: /outreach/campaigns/{campaign_id}');

    addSubtitle('Copywriting Rules:');
    addBullet('No pressure language: never "you must", "act now", "don\'t miss"');
    addBullet('Use: "if helpful", "ready when you are", "new context available"');
    addBullet('Supportive, never performative — no metrics framing');

    addSubtitle('Governance:');
    addBullet('automation_failed alerts: admin/leadership ONLY (enforced at emit + dispatch)');
    addBullet('campaign_send_summary: default OFF, opt-in per user');
    addBullet('All other types follow existing RBAC + user preference toggles');

    addSubtitle('QA & Testing:');
    addBullet('Deno tests: supabase/functions/notification-dispatcher/__tests__/dispatcher_test.ts');
    addBullet('Fixtures: qa/fixtures/notifications/ (watchlist_signal, campaign_suggestion, event_enrichment, automation_failed, campaign_send_summary)');
    addBullet('Test coverage: bundling window merges, dedupe fingerprint, quiet hours queue, caps soft/hard, kill switch, per-type toggle, admin-only enforcement');

    addSubtitle('Key Files:');
    addCode('Edge Functions:\n  supabase/functions/notification-dispatcher/index.ts\n  supabase/functions/profunda-notify/index.ts\n  supabase/functions/_shared/notification-templates.ts\n\nFrontend:\n  src/components/settings/PushNotificationsCard.tsx\n  src/hooks/useNotificationSettings.ts\n  src/lib/notifications.ts\n\nQA:\n  supabase/functions/notification-dispatcher/__tests__/dispatcher_test.ts\n  qa/fixtures/notifications/*.json');

    addPage();

    // Section 19: Discovery Search System
    addTitle('19. Discovery Search System');
    addSubtitle('Purpose:');
    addParagraph('AI-powered web search system enabling RIMs to discover new people, events, grants, and organizations through intent-enforced queries with domain-specific filtering and Micro-Crawl extraction.');

    addSubtitle('Architecture:');
    addBullet('Three standalone pages: /people/find, /events/find, /grants/find');
    addBullet('Shared FindPage component with search type parameterization');
    addBullet('Intent profiles (search_intent_profiles table) enforce required keywords per module');
    addBullet('Enforced query preview shows user exactly what will be searched');
    addBullet('n8n-dispatch edge function maps search types to workflow keys: event→search_events, grant→search_grants, people→search_people');

    addSubtitle('Search Pipeline:');
    addBullet('1. User enters query + selects scope (metro/national)');
    addBullet('2. Client builds enforced query: raw_query + enforced_suffix + role_bias + metro_clause');
    addBullet('3. n8n-dispatch creates search_runs row and dispatches to n8n workflow');
    addBullet('4. n8n performs web search, selects top 5 URLs by module-specific path patterns');
    addBullet('5. Micro-Crawl: Firecrawl scrapes selected URLs for deeper content (12k char cap)');
    addBullet('6. Domain-specific pre-filtering eliminates junk results before LLM');
    addBullet('7. LLM extracts structured results from crawled content');
    addBullet('8. search-callback edge function stores results in search_results table');
    addBullet('9. UI polls for completion and displays results');

    addSubtitle('Domain-Specific Filtering:');
    addBullet('People: excludes greenhouse.io, lever.co, indeed., linkedin.com/jobs, /careers');
    addBullet('Events: suppresses Ticketmaster, StubHub, SeatGeek, "buy tickets", "parking pass"');
    addBullet('Grants: blocks Udemy, Coursera, Skillshare, "grant writing course", "template"');

    addSubtitle('Role Focus Biasing (People only):');
    addBullet('Predefined options: Leadership, Development, Program, Partnerships');
    addBullet('Custom option: user-provided phrases sanitized (alpha-only, 10-token cap)');
    addBullet('Bias clause appended as OR-joined terms to enforced query');

    addSubtitle('Saved Searches:');
    addBullet('saved_searches table: user_id, module, scope, metro_id, name, raw_query, enforced_query_template, max_results');
    addBullet('Edge functions: saved-searches/create, saved-searches/list, saved-searches/run, saved-searches/delete, saved-searches/update, saved-searches/results, saved-searches/mark-seen');
    addBullet('"New result" detection via URL deduplication (strips www, fragments, utm_* params)');
    addBullet('Private to creator via RLS (user_id = auth.uid())');

    addSubtitle('Timeout & Error Handling:');
    addBullet('Client-side watchdog: 30s → "Still processing" with re-dispatch option');
    addBullet('90s timeout → auto-fails run in database, clears UI locks');
    addBullet('n8n-dispatch concurrency limit: max 3 runs');
    addBullet('Micro-Crawl failure → fallback to search snippets (terminal callback always reached)');

    addSubtitle('Database Tables:');
    addCode('search_runs {\n  id: uuid (PK)\n  run_id: uuid (unique)\n  user_id: uuid\n  module: text (event, grant, people)\n  scope: text (metro, national)\n  metro_id: uuid (nullable)\n  raw_query: text\n  enforced_query: text\n  status: text (pending, running, completed, failed)\n  results_saved: int\n  people_added_count: int\n  opportunities_created_count: int\n  created_at: timestamptz\n}\n\nsearch_results {\n  id: uuid (PK)\n  run_id: uuid (FK → search_runs)\n  result_index: int\n  title: text\n  description: text\n  url: text\n  source: text\n  location: text\n  date_info: text\n  organization: text\n  contact_name: text\n  contact_email: text\n  contact_phone: text\n  confidence: numeric\n  payload: jsonb (type-specific metadata)\n  entity_created: boolean\n  created_entity_id: uuid\n  is_new: boolean\n  created_at: timestamptz\n}\n\nsearch_intent_profiles {\n  id: uuid (PK)\n  module: text (unique where active)\n  required_all: text[]\n  required_any: text[]\n  blocked_patterns: text[]\n  enforced_suffix: text\n  scope_mode: text\n  active: boolean\n}');

    addSubtitle('Key Files:');
    addCode('Pages:\n  src/pages/FindPeople.tsx\n  src/pages/FindEvents.tsx\n  src/pages/FindGrants.tsx\n\nComponents:\n  src/components/discovery/FindPage.tsx\n  src/components/discovery/SearchHistoryPanel.tsx\n\nHooks:\n  src/hooks/useIntentProfile.ts\n  src/hooks/useSavedSearches.ts\n  src/hooks/useSearchHistory.ts\n  src/hooks/useGlobalSearch.ts\n\nEdge Functions:\n  supabase/functions/n8n-dispatch/\n  supabase/functions/search-callback/\n  supabase/functions/saved-searches/\n  supabase/functions/search-history/');

    addPage();

    // Section 20: Watchlist Monitoring & Signal Detection
    addTitle('20. Watchlist Monitoring & Signal Detection');
    addSubtitle('Purpose:');
    addParagraph('Automated website monitoring for partner organizations using deterministic hash-based change detection, with LLM escalation for signal classification. Surfaces actionable signals that feed campaign suggestions, Next Best Actions, and push notifications.');

    addSubtitle('Ingestion Pipeline:');
    addBullet('1. get_due_watchlist RPC returns organizations due for crawl (cadence + budget rules)');
    addBullet('2. Firecrawl scrapes monitored URLs');
    addBullet('3. Content hashed via SHA-256 and compared against prior snapshots');
    addBullet('4. Diffs stored with change indicators');
    addBullet('5. Significant changes escalated to LLM for signal classification');
    addBullet('6. Signals stored in org_watchlist_signals with type and confidence');

    addSubtitle('Signal Types:');
    addBullet('hiring: New job postings, leadership openings');
    addBullet('expansion: New locations, service areas, programs');
    addBullet('funding: Grant awards, fundraising milestones');
    addBullet('leadership_change: New executives, board appointments');
    addBullet('program_update: New programs, service changes, partnerships');

    addSubtitle('Budget & Cadence Controls:');
    addBullet('Daily budget: default 50 organizations per day');
    addBullet('Cadence managed via get_due_watchlist RPC');
    addBullet('Crawl limits shared across watchlist_ingest, watchlist_diff, and watchlist_deep_dive workflows');
    addBullet('Prevents Firecrawl API abuse');

    addSubtitle('Deep Dive Workflow:');
    addBullet('Comprehensive scrape + deterministic signal extraction for individual orgs');
    addBullet('Reuses buildWatchlistPayload (requires org_id)');
    addBullet('Access restricted to Admin, Leadership, and Regional Lead roles');
    addBullet('Triggered manually from organization detail page');

    addSubtitle('Signal → Action Integration:');
    addBullet('Signals with confidence ≥ 0.4 auto-generate campaign_suggestions');
    addBullet('Anti-spam: suppresses suggestions for orgs dismissed/snoozed in last 7 days');
    addBullet('Multiple signals within 48h reuse existing open suggestion (grouping)');
    addBullet('Signals feed Next Best Action scoring via org_next_actions');
    addBullet('T1 push notifications for new watchlist signals');

    addSubtitle('Database Tables:');
    addCode('org_watchlist {\n  id: uuid (PK)\n  org_id: uuid (FK → opportunities)\n  url: text\n  cadence_hours: int\n  last_checked_at: timestamptz\n  next_check_at: timestamptz\n  status: text\n}\n\norg_watchlist_snapshots {\n  id: uuid (PK)\n  org_id: uuid\n  url: text\n  content_hash: text (SHA-256)\n  raw_content: text\n  captured_at: timestamptz\n}\n\norg_watchlist_diffs {\n  id: uuid (PK)\n  org_id: uuid\n  snapshot_id: uuid (FK)\n  prior_snapshot_id: uuid (FK)\n  changed: boolean\n  diff_summary: text\n  created_at: timestamptz\n}\n\norg_watchlist_signals {\n  id: uuid (PK)\n  org_id: uuid\n  diff_id: uuid (FK, nullable)\n  snapshot_id: uuid (FK, nullable)\n  signal_type: text\n  summary: text\n  confidence: numeric\n  created_at: timestamptz\n}');

    addSubtitle('Event Attendee Enrichment:');
    addBullet('event_attendee_enrich workflow: completeness scoring + data fill for event participants');
    addBullet('n8n-dispatch validates: event_id (UUID), attendee_ids (UUID array, capped at 50)');
    addBullet('Empty attendee_ids array → omitted from payload (processes all attendees)');
    addBullet('Completion triggers event_enrichment_ready notification');

    addSubtitle('Key Files:');
    addCode('Hooks:\n  src/hooks/useWatchlistSignals.ts\n\nn8n Workflows:\n  watchlist_ingest, watchlist_diff, watchlist_deep_dive\n  event_attendee_enrich\n\nEdge Functions:\n  supabase/functions/n8n-dispatch/ (shared dispatcher)\n  supabase/functions/n8n-ingest/ (signal ingestion + suggestion generation)');

    addPage();

    // Section 21: Proactive Discovery System (Phase 3C)
    addTitle('21. Proactive Discovery System (Phase 3C)');
    addSubtitle('Purpose:');
    addParagraph('Phase 3C automates recurring research for Grants, Events, and People across metros and opportunities. Supabase scheduling triggers n8n workflows that perform web searches, Firecrawl scraping, and LLM extraction — storing deduplicated results with AI-generated briefings and urgent highlights.');

    addSubtitle('Architecture:');
    addBullet('Scheduling: Supabase pg_cron triggers discovery-cron edge function (daily 07:00 UTC, weekly Monday 06:00 UTC)');
    addBullet('Orchestration: n8n workflows handle searching (Firecrawl) and LLM extraction');
    addBullet('Callback: discovery-callback edge function processes results idempotently');
    addBullet('Modules: grants, events, people — each with module-specific extraction rules');
    addBullet('Scopes: metro-level (broad) and opportunity-level (targeted)');

    addSubtitle('Discovery Runs:');
    addBullet('discovery_runs table tracks status: pending → running → completed/failed');
    addBullet('Query profiles stored per run for reproducibility');
    addBullet('Stats (items found, links created, errors) recorded on completion');
    addBullet('Scoped by metro_id and/or opportunity_id');

    addSubtitle('Discovered Items:');
    addBullet('discovered_items table: deduplicated by canonical_url (normalized, stripped of UTM params)');
    addBullet('Module-specific fields: event_date, organization_name, published_date');
    addBullet('Fingerprints (JSONB) for content change detection across runs');
    addBullet('is_active flag for soft-delete without data loss');
    addBullet('Items linked to metros/opportunities via discovery_item_links junction table');

    addSubtitle('Link Deduplication:');
    addBullet('Two partial unique indexes on discovery_item_links:');
    addBullet('  (discovered_item_id, metro_id) WHERE metro_id IS NOT NULL');
    addBullet('  (discovered_item_id, opportunity_id) WHERE opportunity_id IS NOT NULL');
    addBullet('Postgres 23505 errors treated as non-fatal deduplication events');

    addSubtitle('Discovery Briefings & Highlights:');
    addBullet('discovery_briefings: AI-generated markdown summaries per run (metro/opportunity scope)');
    addBullet('briefing_json stores structured sections: key findings, trends, gaps');
    addBullet('discovery_highlights: flagged urgent items (e.g., events < 14 days away)');
    addBullet('Highlight kinds: urgent, new_opportunity, trend, gap');

    addSubtitle('Discovery UI:');
    addBullet('Runs List page (/discovery/runs): filterable by module, scope, status');
    addBullet('Run Details: briefing card + highlights + linked discovered items');
    addBullet('Notification Inbox for proactive alerts from discovery results');

    addSubtitle('Scheduling:');
    addBullet('discovery-cron edge function supports { "job": "daily" } and { "job": "weekly" }');
    addBullet('Daily: refreshes high-priority metros and active opportunities');
    addBullet('Weekly: broader sweep across all monitored entities');
    addBullet('Configure via pg_cron or Supabase scheduled function invocation');

    addSubtitle('Database Tables (Phase 3C):');
    addCode('discovery_runs {\n  id: uuid (PK)\n  module: text (grants/events/people)\n  scope: text (metro/opportunity)\n  metro_id: uuid (FK, nullable)\n  opportunity_id: uuid (FK, nullable)\n  query_profile: jsonb\n  status: text (pending/running/completed/failed)\n  stats: jsonb\n  error: jsonb (nullable)\n  started_at, completed_at: timestamptz\n  created_at, updated_at: timestamptz\n}\n\ndiscovered_items {\n  id: uuid (PK)\n  module: text\n  canonical_url: text (unique-ish via fingerprinting)\n  title: text, snippet: text\n  organization_name: text\n  event_date: date, published_date: date\n  extracted: jsonb, fingerprints: jsonb\n  source_url: text\n  is_active: boolean (default true)\n  first_seen_at, last_seen_at: timestamptz\n  last_run_id: uuid (FK → discovery_runs)\n}\n\ndiscovery_item_links {\n  id: uuid (PK)\n  discovered_item_id: uuid (FK → discovered_items)\n  metro_id: uuid (FK, nullable)\n  opportunity_id: uuid (FK, nullable)\n  relevance_score: numeric\n  reason: text\n  created_at: timestamptz\n}\n\ndiscovery_briefings {\n  id: uuid (PK)\n  run_id: uuid (FK → discovery_runs)\n  scope: text, module: text\n  metro_id: uuid (FK, nullable)\n  opportunity_id: uuid (FK, nullable)\n  briefing_md: text\n  briefing_json: jsonb\n  created_at: timestamptz\n}\n\ndiscovery_highlights {\n  id: uuid (PK)\n  run_id: uuid (FK → discovery_runs)\n  module: text, kind: text\n  payload: jsonb\n  created_at: timestamptz\n}');

    addSubtitle('Edge Functions (Phase 3C):');
    addBullet('discovery-cron: scheduling dispatcher for daily/weekly discovery jobs');
    addBullet('discovery-callback: idempotent result ingestion, link creation, briefing/highlight storage');
    addBullet('n8n-dispatch: maps discovery module to n8n workflow key');

    addSubtitle('Key Files (Phase 3C):');
    addCode('Edge Functions:\n  supabase/functions/discovery-cron/\n  supabase/functions/discovery-callback/\n  supabase/functions/n8n-dispatch/\n\nFrontend:\n  src/pages/DiscoveryRuns.tsx\n  src/hooks/useDiscoveryRuns.ts\n  src/components/discovery/');

    addPage();

    // Section 22: Discovery Pipeline (Phase 3D)
    addTitle('22. Discovery Pipeline (Phase 3D)');
    addSubtitle('Purpose:');
    addParagraph('Phase 3D extends proactive discovery with people roster tracking, event co-attendance detection, and proactive notifications — closing the gap between raw discovery data and actionable intelligence.');

    addSubtitle('People Roster Snapshots & Diffs:');
    addBullet('people_roster_snapshots: versioned JSON roster per opportunity per discovery run');
    addBullet('people_roster_diffs: computed diff (added/removed/changed) per opportunity per run');
    addBullet('Heuristic leadership detection: C-suite, VP, Director, Board title patterns');
    addBullet('Leadership changes emit leadership_change signals into opportunity_signals');
    addBullet('Standard team changes logged as informational signals');
    addBullet('Unique constraints: (opportunity_id, run_id) on both tables for idempotency');

    addSubtitle('Event Co-Attendance Detection:');
    addBullet('event_attendance table: tracks org↔event engagement (attending, sponsoring, speaking)');
    addBullet('Generates event_attendance signals and relationship_edges between orgs and events');
    addBullet('Co-attendance detection: identifies other orgs linked to same event within 180-day window');
    addBullet('Creates org-to-org edges to highlight shared networks and partnership opportunities');
    addBullet('Unique constraint: (opportunity_id, event_discovered_item_id) prevents duplicates');

    addSubtitle('Proactive Notifications:');
    addBullet('proactive_notifications table with deterministic dedupe_key in JSONB payload');
    addBullet('Unique index: (user_id, notification_type, payload->>dedupe_key) WHERE dedupe_key IS NOT NULL');
    addBullet('Generation modes: run (immediate), daily_soon (events < 14 days), weekly_digest (metro-level)');
    addBullet('Daily cap: max 5 proactive notifications per user');
    addBullet('CHECK constraint on notification_type enforces allowed values');

    addSubtitle('Edge Functions (Phase 3D):');
    addBullet('people-roster-diff: compares current roster against prior snapshot, emits signals');
    addBullet('event-coattendance: detects shared event participation, creates relationship edges');
    addBullet('notifications-generate: creates proactive notifications with targeting + deduplication');
    addBullet('discovery-cron: supports daily and weekly job scheduling');
    addBullet('discovery-callback: updated to trigger roster-diff and co-attendance engines');

    addSubtitle('Database Tables (Phase 3D):');
    addCode('people_roster_snapshots {\n  id: uuid (PK)\n  opportunity_id: uuid (FK → opportunities)\n  run_id: uuid (FK → discovery_runs)\n  roster_json: jsonb\n  person_count: int\n  created_at: timestamptz\n  UNIQUE (opportunity_id, run_id)\n}\n\npeople_roster_diffs {\n  id: uuid (PK)\n  opportunity_id: uuid (FK → opportunities)\n  run_id: uuid (FK → discovery_runs)\n  prior_snapshot_id: uuid (FK → people_roster_snapshots, nullable)\n  added: jsonb, removed: jsonb, changed: jsonb\n  summary: text\n  created_at: timestamptz\n  UNIQUE (opportunity_id, run_id)\n}\n\nevent_attendance {\n  id: uuid (PK)\n  opportunity_id: uuid (FK → opportunities)\n  event_discovered_item_id: uuid (FK → discovered_items)\n  role: text (attending/sponsoring/speaking)\n  detected_at: timestamptz\n  run_id: uuid (FK → discovery_runs, nullable)\n  UNIQUE (opportunity_id, event_discovered_item_id)\n}\n\nproactive_notifications {\n  id: uuid (PK)\n  user_id: uuid (NOT NULL)\n  notification_type: text (CHECK constraint)\n  payload: jsonb\n  is_read: boolean (default false)\n  created_at: timestamptz\n  UNIQUE INDEX on (user_id, notification_type, payload->>dedupe_key)\n}');

    addSubtitle('RLS (Phase 3D):');
    addBullet('people_roster_snapshots, people_roster_diffs, event_attendance: RLS enabled, SELECT-only for authenticated users');
    addBullet('All writes via service-role edge functions only');
    addBullet('proactive_notifications: user_id = auth.uid() for SELECT; service-role for INSERT');

    addSubtitle('Test Coverage (Phase 3D):');
    addBullet('59 tests passing across 5 edge functions');
    addBullet('discovery-callback: 11 tests, discovery-dispatch: 11 tests');
    addBullet('event-coattendance: 10 tests, notifications-generate: 4 tests');
    addBullet('people-roster-diff: 23 tests');

    addPage();

    // Section 23: Relationship Intelligence Layer (Phase 3E)
    addTitle('23. Relationship Intelligence Layer (Phase 3E)');
    addSubtitle('Purpose:');
    addParagraph('Phase 3E synthesizes signals, discovery data, and momentum into prioritized relationship actions and weekly AI-generated briefings. This layer provides RIMs with concrete, evidence-based next steps ranked by urgency and impact.');

    addSubtitle('Relationship Actions:');
    addBullet('relationship_actions table: ranked tasks (reach_out, attend_event, apply_grant, follow_up, introduce)');
    addBullet('Priority score 0-100 with labels: high (≥70), normal (≥40), low (<40)');
    addBullet('Evidence-based: all actions grounded in DB signals, momentum, and discovered items');
    addBullet('Status lifecycle: open → done/dismissed (user-controlled via RLS)');
    addBullet('Creation is service-role only; users can only update status');

    addSubtitle('Priority Scoring Rules:');
    addBullet('Rule 1 — Leadership change: base 75, +10 if momentum rising (max 100)');
    addBullet('Rule 2 — Upcoming event within 14 days: 70 if ≤7 days, 60 if ≤14 days');
    addBullet('Rule 3 — Grant opportunity (first seen < 30 days): score 55');
    addBullet('Rule 4 — Momentum spike (delta ≥8 or trend rising): score 65');
    addBullet('Max 10 actions per opportunity, sorted by priority descending');

    addSubtitle('Deduplication:');
    addBullet('Unique constraint: (opportunity_id, action_type, title) for open actions');
    addBullet('Title normalization: trim + collapse internal whitespace before upsert');
    addBullet('Upsert with onConflict updates existing actions; 23505 errors treated as dedup');
    addBullet('isNewInsert detection: created_at ≈ updated_at within 2s window');

    addSubtitle('High-Priority Notifications:');
    addBullet('Fires ONLY on true new inserts (isNewInsert gate) with priority_label = high');
    addBullet('notification_type: relationship_action_high_priority (validated by DB CHECK constraint)');
    addBullet('User targeting priority: 1) opportunity owner_id, 2) metro assignments, 3) admin/regional_lead fallback');
    addBullet('Dedupe via Set<string> — no duplicate notifications to same user');
    addBullet('Capped at 5 users per action notification');
    addBullet('Deterministic dedupe_key: action_high:${oppId}:${action_type}:${normalizedTitle}');
    addBullet('Best-effort: notification failure does not block action generation');

    addSubtitle('Relationship Briefings:');
    addBullet('relationship_briefings table: weekly AI-generated summaries (metro or opportunity scope)');
    addBullet('Generated by relationship-briefings-generate edge function');
    addBullet('Assembles evidence from signals, momentum, discovered items, and relationship actions');
    addBullet('AI produces structured briefing with key developments, recommended actions, and risk flags');
    addBullet('Strictly grounded in existing DB evidence — no hallucinated facts');

    addSubtitle('Scheduling:');
    addBullet('relationship-intelligence-schedule edge function orchestrates batch processing');
    addBullet('job: nightly_actions — generates actions for all active opportunities per metro');
    addBullet('job: weekly_briefings — generates briefings for all metros');
    addBullet('Iterates metros (cap 50), calls sub-functions with 55s timeout per metro');
    addBullet('dry_run mode returns metro list without processing');

    addSubtitle('Database Tables (Phase 3E):');
    addCode('relationship_actions {\n  id: uuid (PK)\n  opportunity_id: uuid (FK → opportunities)\n  action_type: text (reach_out/attend_event/apply_grant/follow_up/introduce)\n  title: text\n  summary: text\n  priority_score: int (0-100)\n  priority_label: text (high/normal/low)\n  suggested_timing: text\n  due_date: date (nullable)\n  drivers: jsonb[]\n  evidence: jsonb\n  status: text (open/done/dismissed)\n  created_at, updated_at: timestamptz\n  UNIQUE (opportunity_id, action_type, title)\n}\n\nrelationship_briefings {\n  id: uuid (PK)\n  opportunity_id: uuid (FK, nullable)\n  metro_id: uuid (FK, nullable)\n  scope: text (opportunity/metro)\n  briefing_md: text\n  briefing_json: jsonb\n  generated_at: timestamptz\n  run_id: uuid\n}');

    addSubtitle('Edge Functions (Phase 3E):');
    addBullet('relationship-actions-generate: evidence gathering + rule-based action generation + upsert + notification');
    addBullet('relationship-briefings-generate: AI briefing assembly from multi-source evidence');
    addBullet('relationship-intelligence-schedule: nightly/weekly batch orchestrator');

    addSubtitle('RLS (Phase 3E):');
    addBullet('relationship_actions: SELECT for metro-scoped users; UPDATE (status only) for authenticated; INSERT/DELETE service-role only');
    addBullet('relationship_briefings: SELECT for metro-scoped users; all writes service-role only');

    addSubtitle('Key Files (Phase 3D/3E):');
    addCode('Edge Functions:\n  supabase/functions/people-roster-diff/\n  supabase/functions/event-coattendance/\n  supabase/functions/notifications-generate/\n  supabase/functions/discovery-cron/\n  supabase/functions/discovery-callback/\n  supabase/functions/relationship-actions-generate/\n  supabase/functions/relationship-briefings-generate/\n  supabase/functions/relationship-intelligence-schedule/\n\nQA:\n  qa/checklists/phase-3d-qa.md');

    addPage();
    
    // Section 24: Provisions System (Phase 5)
    addTitle('24. Provisions System (Phase 5)');
    addSubtitle('Purpose:');
    addParagraph('Internal device request tracking system for bulk technology provisions to partner organizations. Provisions are NOT orders — they are internal request records that track the lifecycle of technology support from request through delivery. Ordering happens in a separate external system.');

    addSubtitle('Lifecycle (Mission-Aligned Labels):');
    addCode('Preparing (draft) → Submitted → In Progress (ordered) → On the Way (shipped) → Delivered with Care (delivered)\n\nOptional: Canceled at any stage before delivery');

    addSubtitle('Catalog System:');
    addBullet('provision_catalog_items: 24-item catalog organized by category (PC/Laptop) × tier (Good/Better/Best)');
    addBullet('Each item has: name, description, sku, unit_price_cents, category, tier, active flag');
    addBullet('Admin-managed: only active items shown during provision creation');

    addSubtitle('AI Paste & Parse:');
    addBullet('provision-parse edge function accepts raw text (email snippets, order details)');
    addBullet('AI extracts structured line items and matches against catalog');
    addBullet('User reviews AI suggestions before creating provision');
    addBullet('Handles ambiguous text gracefully with confidence indicators');

    addSubtitle('Conversation Threads:');
    addBullet('provision_messages table enables requester↔staff communication per provision');
    addBullet('Messages linked to provision_id with sender identification');
    addBullet('Displayed as threaded conversation in provision detail view');

    addSubtitle('Delivery Tracking:');
    addBullet('tracking_carrier, tracking_number fields on provisions table');
    addBullet('delivery_status: pending → in_transit → delivered');
    addBullet('Timestamp columns: ordered_at, shipped_at, delivered_at for lifecycle audit');

    addSubtitle('Access Control:');
    addBullet('CRM roles (admin, rim, staff) can create and manage provisions');
    addBullet('warehouse_manager role is explicitly BLOCKED from provisions');
    addBullet('Provisions linked to opportunities via opportunity_id');
    addBullet('Metro scoping via metro_id (auto-derived from opportunity)');

    addSubtitle('Database Tables (Phase 5):');
    addCode('provisions {\n  id: uuid (PK)\n  opportunity_id: uuid (FK → opportunities)\n  metro_id: uuid (FK → metros, nullable)\n  requested_by: uuid (FK → auth.users)\n  assigned_to: uuid (FK → auth.users, nullable)\n  status: text (draft/submitted/ordered/shipped/delivered/canceled)\n  source: text (manual/ai_parsed)\n  external_order_ref: text (nullable)\n  notes: text\n  total_cents: int\n  total_quantity: int\n  tracking_carrier: text (nullable)\n  tracking_number: text (nullable)\n  delivery_status: text (nullable)\n  requested_at, submitted_at, ordered_at: timestamptz\n  shipped_at, delivered_at, canceled_at: timestamptz\n  created_at, updated_at: timestamptz\n}\n\nprovision_items {\n  id: uuid (PK)\n  provision_id: uuid (FK → provisions)\n  catalog_item_id: uuid (FK → provision_catalog_items)\n  quantity: int\n  unit_price_cents: int\n  created_at: timestamptz\n}\n\nprovision_catalog_items {\n  id: uuid (PK)\n  name: text\n  description: text\n  sku: text\n  unit_price_cents: int\n  category: text (PC/Laptop)\n  tier: text (Good/Better/Best)\n  active: boolean (default true)\n  created_at, updated_at: timestamptz\n}\n\nprovision_messages {\n  id: uuid (PK)\n  provision_id: uuid (FK → provisions)\n  sender_id: uuid (FK → auth.users)\n  body: text\n  created_at: timestamptz\n}');

    addSubtitle('Edge Functions (Phase 5):');
    addBullet('provision-create: draft creation with catalog item resolution and price calculation');
    addBullet('provision-submit: status transition draft → submitted with timestamp');
    addBullet('provision-update: field updates with enforced status transition rules');
    addBullet('provision-message-create: threaded conversation messages');
    addBullet('provision-parse: AI-powered text extraction and catalog matching');

    addSubtitle('Key Files (Phase 5):');
    addCode('Hooks:\n  src/hooks/useProvisions.ts\n\nComponents:\n  src/components/provisions/\n\nEdge Functions:\n  supabase/functions/provision-create/\n  supabase/functions/provision-submit/\n  supabase/functions/provision-update/\n  supabase/functions/provision-message-create/\n  supabase/functions/provision-parse/\n\nPages:\n  src/pages/Provisions.tsx');

    addPage();

    // Section 25: Narrative Intelligence Engine (Phase 5B)
    addTitle('25. Narrative Intelligence Engine (Phase 5B)');
    addSubtitle('Purpose:');
    addParagraph('The Narrative Intelligence Engine is a slow-building memory and awareness system that unifies Relationship Memory, Community Awareness, and Narrative Intelligence into a coherent architectural layer. It is NOT urgency-driven — it builds context over time.');

    addSubtitle('Input Sources:');
    addBullet('Reflections (opportunity_reflections): Private or team-visible observations (max 6000 chars), AI-extracted for topics/signals');
    addBullet('Gmail Sent History (email_communications): Subject, snippet (max 280 chars), sent_at — raw bodies NEVER enter narrative pipelines');
    addBullet('Campaign Touches (email_campaign_audience): Delivery records linking campaigns to partners');
    addBullet('Local Pulse Events (local_pulse_runs, local_events): Weekly discovery of community events near Home Metro');
    addBullet('Discovery Signals (discovered_items, org_watchlist_signals): Watchlist changes, proactive research results');
    addBullet('Journal Extractions (journal_extractions): Topics and signals extracted from journal_entries — raw text never quoted');
    addBullet('Neighborhood Insights (org_neighborhood_insights): Census/Wikipedia community context');

    addSubtitle('Processing Layer:');
    addBullet('AI Extraction: Reflections and journals undergo topic/signal extraction via Lovable AI (gemini-2.5-flash)');
    addBullet('Suggestion Engine: Story suggestions match community themes with org knowledge profiles (relationship_story_suggestions)');
    addBullet('Blending Rules: Story timeline weights — Reflections (3) > Tasks (2.5) > Emails (2) > Campaigns (1)');
    addBullet('Privacy Filters: Raw email bodies and reflection text NEVER enter shared narratives; only extracted signals/topics used');
    addBullet('Calm Tone Guard: cleanTone() strips urgency keywords ("critical", "act now", "red alert") from all AI outputs');

    addSubtitle('Output Systems:');
    addBullet('Story Tab Timeline: Blended chronological view of reflections, emails, campaigns, tasks per opportunity');
    addBullet('Human Overview Dashboard: Story-first Command Center mode showing momentum, suggestions, community signals');
    addBullet('Metro Narrative Summaries: AI-generated community stories blending external signals with internal partner data');
    addBullet('Momentum Heatmap: Story density overlays (quiet/active/growing/vibrant) with drift detection tinting');
    addBullet('Human Impact Reports: Board-ready narrative exports with journey chapters and support delivered');
    addBullet('Command Center Signals: Email task suggestions, follow-up recommendations, relationship action cards');

    addSubtitle('Local Pulse Architecture:');
    addBullet('Home Metro: User selects one metro from their assigned metros (stored in profiles)');
    addBullet('Weekly Cron: Monday 8:00 AM — local-pulse-worker discovers events within 50-mile radius');
    addBullet('Source Types: RSS (auto-subscribed), ICS (parsed directly), Web (Firecrawl scrape with preview)');
    addBullet('User-Added URLs: Saved to local_pulse_sources; RSS/ICS used directly, web pages get Firecrawl preview');
    addBullet('Extraction: local-pulse-extract performs async AI parsing of discovered pages');
    addBullet('Safety Caps: 60 events per run, 5 pages per source, recurring events flagged as low date_confidence');
    addBullet('Reflection Loop: Mark attended → write reflection → extracted themes feed Metro Narrative');

    addSubtitle('Gmail Task Extraction:');
    addBullet('Sent emails parsed via profunda-ai gateway (gemini-2.5-flash) for self-commitments');
    addBullet('Tasks created ONLY through email_task_suggestions table — never directly into CRM');
    addBullet('User reviews suggestions: Accept creates relationship_action, Dismiss removes');
    addBullet('Privacy: Only subject, snippet (280 chars), sent_at exposed — raw bodies never stored in suggestions');
    addBullet('Dedupe: deterministic dedupe_key (email_id + normalized_title) prevents duplicates across reruns');
    addBullet('Rate limits: governed by profunda-ai rate limiting (analyze mode: 10 req/5min)');

    addSubtitle('Drift Detection:');
    addBullet('Weekly detection across ALL metros via metro-narrative-drift edge function');
    addBullet('Compares periodic snapshots: topic counts, signal types, narrative themes');
    addBullet('Deterministic drift_score (0-100) with labels: Steady (<25), Shifting (25-50), Changing (50-75), Turning (>75)');
    addBullet('Weighted calculation: topic_change (40%) + acceleration (30%) + divergence (30%)');
    addBullet('Feeds: Momentum Heatmap overlays (soft tint), Metro Narrative alerts, Dashboard signals');
    addBullet('Stored in metro_narrative_drift_snapshots with metro_id + snapshot_date');

    addSubtitle('Opportunity Detail Tabs (Updated):');
    addCode('Tab 1: The Partner — Org knowledge, neighborhood insights, mission alignment\nTab 2: The Story — Reflections, emails, campaigns, tasks blended into narrative timeline\nTab 3: The Pulse — Watchlist signals, discovery results, community context\nTab 4: The People — Relationships and contacts\nTab 5: The Impact — Provisions, grants, reflections on shared work\nTab 6: The Next Move — Suggested actions, outreach drafts, follow-ups\nTab 7: Admin (role-gated) — Technical diagnostics for admin/leadership only');

    addSubtitle('Key Files (Phase 5B):');
    addCode('Relationship Memory:\n  src/hooks/useStoryEvents.ts\n  src/hooks/useOpportunityReflections.ts\n  src/components/story/StoryChaptersSection.tsx\n  src/components/story/StoryTimelineCard.tsx\n  supabase/functions/event-reflection-extract/\n\nCommunity Awareness:\n  src/hooks/useLocalPulse.ts\n  src/hooks/useMetroNarrative.ts\n  supabase/functions/local-pulse-worker/\n  supabase/functions/local-pulse-extract/\n  supabase/functions/metro-narrative-build/\n  supabase/functions/metro-narrative-drift/\n\nGmail Task Extraction:\n  src/hooks/useEmailTaskSuggestions.ts\n  supabase/functions/profunda-ai/ (analyze mode)\n\nMomentum & Heatmap:\n  src/pages/MomentumMap.tsx\n  src/hooks/useMomentumHeatmap.ts');

    addPage();

    // Section 26: Human Impact Reports (Phase 5C)
    addTitle('26. Human Impact Reports (Phase 5C)');
    addSubtitle('Purpose:');
    addParagraph('Narrative-driven executive reporting system that replaces corporate CRM terminology with mission-centric language. Produces board-ready PDF documents and a full-screen Executive View suitable for leadership presentations and stakeholder briefings.');

    addSubtitle('Report Sections:');
    addBullet('Executive Summary: headline metrics (communities served, relationships built, people supported)');
    addBullet('Community Impact: journey stage distribution visualized as chapters, not pipeline stages');
    addBullet('Relationship Growth: new connections, deepened partnerships, engagement trends');
    addBullet('Support Delivered: provision counts framed as "What We Made Possible"');
    addBullet('Momentum & Signals: metro-level momentum trends, rising/steady/cooling indicators');

    addSubtitle('Language Transformation:');
    addCode('Corporate CRM → Mission-Centric\n─────────────────────────────────\nPipeline        → Journey Chapters\nOpportunities   → Communities / Partners\nContacts        → Relationships\nStage           → Chapter\nProvisions      → Support Delivered\nAnchors         → Sustained Partnerships\nActivities      → Engagement Moments');

    addSubtitle('Executive View (/reports/impact-export):');
    addBullet('Full-screen narrative layout with region/metro filtering');
    addBullet('Print-optimized CSS for direct browser printing');
    addBullet('Toolbar with region/metro selectors, Print, and Download PDF buttons');
    addBullet('Cover header with scope label, date, and preparer name');

    addSubtitle('PDF Generation:');
    addBullet('generateImpactPDF() in src/lib/impactReportPdf.ts');
    addBullet('jsPDF with professional typography and print-friendly palette');
    addBullet('Sections: cover page, executive summary, community impact, journey growth, support delivered, momentum signals');
    addBullet('Deterministic qualitative summaries via builder pattern');
    addBullet('Quantitative data integrity maintained alongside narrative framing');

    addSubtitle('Privacy Guards:');
    addBullet('STRICT: Raw reflections (journal_entries.note_text) NEVER included in exports');
    addBullet('STRICT: Raw email content NEVER included — only aggregated counts and thematic summaries');
    addBullet('Only safe snippets (max 280 chars) and metadata used in shared narratives');
    addBullet('AI narratives use journal_extractions (topics/signals) not raw text');

    addSubtitle('Data Hook:');
    addBullet('useHumanImpactData hook aggregates data across metros/regions');
    addBullet('Scoped by regionId and/or metroId');
    addBullet('Returns: execSummary, communityImpact, journeyGrowth, supportDelivered, momentumSignals');

    addSubtitle('Key Files (Phase 5C):');
    addCode('Pages:\n  src/pages/ImpactExport.tsx\n\nComponents:\n  src/components/reports/ExecSummarySection.tsx\n  src/components/reports/CommunityImpactSection.tsx\n  src/components/reports/JourneyGrowthSection.tsx\n  src/components/reports/SupportDeliveredSection.tsx\n  src/components/reports/MomentumSignalsSection.tsx\n\nLib:\n  src/lib/impactReportPdf.ts\n  src/lib/reportPdf.ts\n\nHooks:\n  src/hooks/useHumanImpactData.ts');

    addPage();

    // Section 27: Narrative Privacy Model
    addTitle('27. Narrative Privacy Model');
    addSubtitle('Core Principle:');
    addParagraph('All AI-generated narratives, summaries, and shared intelligence outputs operate under a strict privacy boundary. Raw human-written content (reflections, email bodies, journal entries) is NEVER passed directly to shared narrative builders or exposed to other users. Instead, a structured extraction layer derives safe metadata — topics, signal types, timestamps, and counts — which feeds all downstream intelligence systems.');

    addSubtitle('Privacy Boundaries by Data Type:');
    addBullet('Reflections (opportunity_reflections): Raw note_text stored with private/team visibility. AI extracts topics and signals into journal_extractions. Only extracted metadata enters Metro Narrative or Story Chapter builders.');
    addBullet('Email Communications: Raw email bodies are NEVER stored in suggestion tables. Only subject lines and 280-character snippets are exposed. The sanitize-story-inputs shared module strips all banned keys (body, email_body, note_text, raw_body, html_body, full_text, content, message_body, reflection_body).');
    addBullet('Event Reflections: Private margin notes (max 6000 chars) stored with visibility flags. The event-reflection-extract function derives summary_safe (280 chars max) and structured topics/signals for narrative use.');
    addBullet('Campaign Touches: Only send metadata (subject, sent_at, status) enters shared timelines — never recipient-specific content.');

    addSubtitle('Enforcement Layers:');
    addBullet('Server-side: sanitizeStoryInputs() and stripPrivateFields() in supabase/functions/_shared/sanitize-story-inputs.ts');
    addBullet('Database: RLS policies scope all reflection/email queries by user metro and role');
    addBullet('AI Prompts: cleanTone() guard strips urgency keywords from all AI outputs');
    addBullet('Frontend: RichTextDisplay sanitizes HTML via DOMPurify before rendering');

    addSubtitle('Key Invariants:');
    addBullet('journal_entries.note_text is NEVER queried by narrative builders');
    addBullet('email_communications.body is NEVER passed to metro-narrative-build or story-chapter generators');
    addBullet('All AI narrative prompts receive ONLY: topics[], signal_types[], timestamps[], counts{}');
    addBullet('Visibility enum (private | team) is enforced at both RLS and application layer');
    addBullet('Maximum snippet length: 280 characters (hard-coded in extraction functions)');

    addSubtitle('Key Files:');
    addCode('Privacy Guards:\n  supabase/functions/_shared/sanitize-story-inputs.ts\n  supabase/functions/event-reflection-extract/index.ts\n  src/components/notes/NoteHistoryPanel.tsx (DOMPurify)\n\nExtraction Layer:\n  supabase/functions/event-reflection-extract/\n  supabase/functions/profunda-ai/ (analyze mode)\n\nNarrative Consumers (privacy-safe inputs only):\n  supabase/functions/metro-narrative-build/\n  supabase/functions/metro-narrative-drift/\n  src/hooks/useStoryEvents.ts');

    addPage();

    // Section 28: Volunteers & Hours Ingestion (Phase 6A)
    addTitle('28. Volunteers & Hours Ingestion (Phase 6A)');
    addSubtitle('Overview:');
    addParagraph('Phase 6A introduces a volunteer management system with email-based hours auto-logging. Volunteers submit hours via a structured email format that is parsed deterministically (no AI). Failed parses route to an admin review queue.');

    addSubtitle('Database Tables:');
    addCode('volunteers {\n  id: uuid (PK)\n  first_name, last_name: text (required)\n  email: text (unique, required)\n  phone, address, city, state, zip: text\n  status: text (active | inactive)\n  notes: text\n  last_volunteered_at: timestamptz (auto-computed)\n  lifetime_minutes: int (auto-computed)\n  created_at, updated_at: timestamptz\n}\n\nvolunteer_shifts {\n  id: uuid (PK)\n  volunteer_id: uuid (FK → volunteers, CASCADE)\n  kind: text (warehouse | event)\n  event_id: uuid (FK → events, SET NULL)\n  shift_date: date\n  minutes: int (1-1440)\n  source: text (manual | email)\n  source_email_message_id: text\n  raw_text: text\n  created_by: uuid\n  UNIQUE(source_email_message_id, volunteer_id, shift_date)\n}\n\nvolunteer_hours_inbox {\n  id: uuid (PK)\n  gmail_message_id: text (unique)\n  from_email: text\n  received_at: timestamptz\n  subject, snippet: text\n  raw_text: text\n  parsed_json: jsonb\n  parse_status: text (parsed | needs_review | rejected)\n  reason: text\n}');

    addSubtitle('Auto-Aggregation Triggers:');
    addBullet('After INSERT/UPDATE/DELETE on volunteer_shifts → recomputes volunteers.last_volunteered_at and lifetime_minutes');
    addBullet('Uses max(shift_date) and sum(minutes) for deterministic results');

    addSubtitle('Email Parsing Format:');
    addCode('HOURS: YYYY-MM-DD | 3.5 | warehouse\nHOURS: YYYY-MM-DD | 2 | event: Some Event Name');
    addBullet('Hours converted to minutes, rounded to nearest 5 (minimum 5)');
    addBullet('Event matching: ilike search with ambiguity guard (>1 match → warning, no auto-select)');

    addSubtitle('Edge Function: volunteer-hours-ingest');
    addBullet('Auth: service-role or N8N_SHARED_SECRET only');
    addBullet('Steps: dedupe by gmail_message_id → lookup volunteer by email → parse HOURS lines → create shifts + inbox record');
    addBullet('All failures route to needs_review — never crashes');

    addSubtitle('Gmail Pipeline Integration:');
    addBullet('gmail-sync and scheduled-gmail-sync check subject for "Volunteer Hours" or snippet for "HOURS:"');
    addBullet('Matching emails forwarded to volunteer-hours-ingest via internal fetch with service role auth');

    addSubtitle('Reliability Labels (Configurable):');
    addCode('≤14 days → "Recent helper" (green)\n≤30 days → "Steady helper" (blue)\n≤90 days → "Returning soon" (amber)\n>90 days → "Returning soon" (muted)\nNo shifts  → "New volunteer" (muted)');
    addBullet('Thresholds defined in src/lib/volunteerConfig.ts');

    addSubtitle('RLS Policies:');
    addBullet('volunteers: SELECT/INSERT/UPDATE/DELETE for authenticated users with appropriate roles');
    addBullet('volunteer_shifts: SELECT/INSERT for roles; UPDATE/DELETE restricted to admin/staff or creator');
    addBullet('volunteer_hours_inbox: SELECT/UPDATE for admin/staff only; INSERT by service role only');

    addSubtitle('Key Files (Phase 6A — Volunteers):');
    addCode('Pages:\n  src/pages/Volunteers.tsx\n  src/pages/VolunteerDetail.tsx\n  src/pages/VolunteerHoursInbox.tsx\n\nComponents:\n  src/components/events/EventVolunteerHours.tsx\n  src/components/admin/VolunteerIngestionStats.tsx\n  src/components/admin/ImportCenterStats.tsx\n\nHooks:\n  src/hooks/useVolunteers.ts\n\nConfig:\n  src/lib/volunteerConfig.ts\n\nEdge Functions:\n  supabase/functions/volunteer-hours-ingest/\n  supabase/functions/volunteer-hours-ingest/volunteer-hours-ingest_test.ts');

    addPage();

    // Section 29: CRM Exit Ramp / Import Center (Phase 6A)
    addTitle('29. CRM Exit Ramp / Import Center (Phase 6A)');
    addSubtitle('Overview:');
    addParagraph('The Import Center provides a one-way data migration path from any CRM into Profunda. It supports CSV uploads with auto-mapping, field mapping UI, preview, and import logging. API-based connectors are planned but not yet built.');

    addSubtitle('Database Tables:');
    addCode('import_runs {\n  id: uuid (PK)\n  user_id: uuid\n  source_system: text (generic_csv, hubspot_export, salesforce, etc.)\n  import_type: text (organizations, people, volunteers, etc.)\n  status: text (uploaded, mapped, previewed, importing, completed, failed)\n  stats: jsonb (row counts, created/updated/skipped)\n  error: jsonb\n  created_at, completed_at: timestamptz\n}\n\nimport_files {\n  id: uuid (PK)\n  run_id: uuid (FK → import_runs)\n  filename: text\n  storage_path: text\n  uploaded_at: timestamptz\n}\n\nimport_mappings {\n  id: uuid (PK)\n  run_id: uuid (FK → import_runs)\n  mapping: jsonb (source_col → target_field)\n  created_at: timestamptz\n}');

    addSubtitle('Importer Architecture:');
    addBullet('Interface: src/lib/importers/Importer.ts — detect(), map(), preview(), import()');
    addBullet('GenericCSVImporter: works with any CSV, no auto-mapping');
    addBullet('HubSpotCSVImporter: auto-maps Company name, Email, Job Title, etc.');
    addBullet('Future connectors plug in by implementing the Importer interface');

    addSubtitle('Import Flow:');
    addBullet('1. Select import type + source system');
    addBullet('2. Upload CSV (max 50k rows for preview)');
    addBullet('3. Auto-detect and map columns');
    addBullet('4. Preview first 200 rows');
    addBullet('5. Import with deduplication (email-based upsert for volunteers)');
    addBullet('6. View summary + import run history');

    addSubtitle('Guardrails:');
    addBullet('CSVs >50,000 rows rejected before preview');
    addBullet('Preview renders max 200 rows');
    addBullet('Volunteers import uses email-based upsert (ON CONFLICT email)');

    addSubtitle('Key Files (Phase 6A — Import Center):');
    addCode('Pages:\n  src/pages/ImportCenter.tsx\n\nLib:\n  src/lib/importers/Importer.ts\n  src/lib/volunteerConfig.ts\n\nAdmin Widgets:\n  src/components/admin/ImportCenterStats.tsx');

    addPage();

    // Section 30: Provisions TSV Export
    addTitle('30. Provisions TSV Export');
    addSubtitle('Purpose:');
    addParagraph('The TSV export generates a tab-separated value string for external spreadsheet ingestion, replacing standard CSV exports. The output follows a strict column order matching the finance master template, enabling a "Copy for Spreadsheet" workflow for direct pasting into finance processing tools.');

    addSubtitle('Column Schema (21 columns):');
    addCode('Invoice Type | Invoice Date | Business Unit | Client ID |\nBusiness Name | Business Address | Business City |\nBusiness State | Business Zip | Contact Name |\nContact Email | Item Description | Quantity | Unit Cost |\nLine Total | GL Account | Payment Due Date | Paid |\nDate Paid | Notes | Tracking Number');

    addSubtitle('Data Sanitization:');
    addBullet('Internal whitespace and newlines replaced with single spaces to prevent column breakage');
    addBullet('Per-line totals calculated as quantity × unit_price_cents / 100');
    addBullet('Empty fields output as empty strings (not null)');

    addSubtitle('Export Tracking:');
    addBullet('exported_at timestamp updated on each copy');
    addBullet('export_count integer incremented for audit visibility');

    addSubtitle('Key Files:');
    addCode('Provisions:\n  src/hooks/useProvisions.ts (Provision interface with invoice fields)\n  src/pages/Provisions.tsx (Copy for Spreadsheet button)');

    addPage();

    // Section 31: System Sweep & Admin Observability
    addTitle('31. System Sweep & Admin Observability');
    addSubtitle('Overview:');
    addParagraph('The System Sweep provides a "single pane of glass" for monitoring scheduled jobs, ingestion health, and system-generated suggestions. It ensures that background intelligence processes are observable and auditable by admins.');

    addSubtitle('Database Tables:');
    addCode('system_jobs {\n  id: uuid (PK)\n  key: text (unique) — e.g. "system_sweep"\n  name: text\n  description: text\n  owner: text — responsible team/person\n  schedule: text — cron expression or "manual"\n  enabled: boolean\n  created_at, updated_at: timestamptz\n}\n\nsystem_job_runs {\n  id: uuid (PK)\n  job_key: text (FK → system_jobs.key)\n  scope: text — "system" | "metro"\n  metro_id: uuid (nullable)\n  status: text — running | completed | failed\n  started_at, completed_at: timestamptz\n  duration_ms: int\n  stats: jsonb — { metros_processed, quiet_metros, stale_metros }\n  outputs: jsonb — { metro_results: MetroHealthRow[] }\n  errors: jsonb[]\n}\n\nsystem_suggestions {\n  id: uuid (PK)\n  scope: text\n  metro_id: uuid (nullable)\n  opportunity_id: uuid (nullable)\n  suggestion_type: text\n  title: text\n  summary: text\n  rationale: jsonb\n  confidence: numeric (0-1)\n  source_refs: jsonb[]\n  delivered_at, dismissed_at, acted_at: timestamptz\n  action_taken: text\n  dedupe_key: text\n}');

    addSubtitle('Edge Function: system-sweep');
    addBullet('Auth: admin role required (JWT verified)');
    addBullet('Audits all metros for data freshness across news, events, narratives, and drift');
    addBullet('Pure function computeHealthStatus(lastRun, persistedCount, thresholdDays) exported for testing');
    addBullet('Health labels: healthy (recent + results), quiet (recent + no results), stale (no recent run)');
    addBullet('Populates system_job_runs with per-metro health results and aggregate stats');

    addSubtitle('Frontend Hooks (useSystemSweep.ts):');
    addBullet('useSystemJobs() — list all registered jobs');
    addBullet('useSweepHeartbeat() — latest sweep run + aggregated health metrics');
    addBullet('useRecentJobRuns() — paginated run history');
    addBullet('useSystemSuggestions() — filtered suggestion ledger');
    addBullet('useTriggerSweep() — manual sweep trigger mutation');
    addBullet('useDismissSuggestion() — mark suggestion as dismissed');

    addSubtitle('Deno Tests:');
    addCode('supabase/functions/tests/system-sweep.test.ts:\n  - computeHealthStatus: no last run → stale\n  - computeHealthStatus: old run → stale\n  - computeHealthStatus: recent + 0 persisted → quiet\n  - computeHealthStatus: recent + content → healthy\n  - computeHealthStatus: custom threshold\n  - Auth guard: unauthenticated → 401\n  - Auth guard: anon key → 401/403');

    addPage();

    // Section 32: Metro News Keywords & Source Administration
    addTitle('32. Metro News Keywords & Source Administration');
    addSubtitle('Overview:');
    addParagraph('The News Keywords Engine powers automated community signal discovery for Metro Narratives. It uses a tiered keyword library where global defaults cover mission-first terms and per-metro overrides allow local customization. Sources are managed with health tracking and auto-disable logic.');

    addSubtitle('Keyword Architecture:');
    addCode('global_news_keywords {\n  id: uuid (PK)\n  keyword: text (unique)\n  category: text — need_signals | education | policy | community\n  weight: numeric — priority multiplier\n  active: boolean\n  created_at: timestamptz\n}\n\nmetro_news_keywords {\n  id: uuid (PK)\n  metro_id: uuid (FK → metros)\n  keyword: text\n  category: text\n  weight: numeric\n  active: boolean\n  UNIQUE(metro_id, keyword)\n}');

    addSubtitle('Query Compilation (metroKeywordCompiler):');
    addBullet('Merges global + metro keywords — metro overrides win on duplicate keyword');
    addBullet('Deduplicates by keyword text');
    addBullet('Bundles into 6-10 search queries using phrase, any, or all match modes');
    addBullet('Query format: ("Metro Name") AND ("keyword1" OR "keyword2")');

    addSubtitle('Source Management:');
    addCode('metro_news_sources {\n  id: uuid (PK)\n  metro_id: uuid (FK → metros)\n  url: text\n  source_type: text — rss | html | calendar\n  enabled: boolean\n  auto_disabled: boolean\n  failure_count: int (default 0)\n  last_status: text — ok | error\n  last_crawled_at: timestamptz\n  last_error: text\n  retry_after: timestamptz\n}');

    addSubtitle('Health Tracking:');
    addBullet('metro_news_source_record_success(id) — resets failure_count, sets last_status=ok');
    addBullet('metro_news_source_record_failure(id, error) — increments failure_count');
    addBullet('Auto-disable after 3 consecutive failures (auto_disabled=true, enabled=false)');
    addBullet('Self-healing: retry_after set to 7 days from disable time');

    addSubtitle('Edge Functions:');
    addBullet('metro-news-sources: GET (fetch enabled sources per metro), POST (register discovered URLs)');
    addBullet('metro-news-run: executes geo-targeted search queries, persists results to discovery_highlights');

    addSubtitle('News Signal Strength (0-100):');
    addBullet('Calculated from article volume and matches with high-priority need_signals keywords');
    addBullet('Stored in metro_narratives.news_signal_strength');
    addBullet('Validated via trigger: clamped to 0-100 range');

    addSubtitle('UI Components:');
    addCode('Pages:\n  src/pages/MetroNews.tsx — Narratives feed with metro filter\n  /admin/global-keywords — Global keyword management\n\nComponents:\n  MetroNewsPulseCard — signal strength + health status\n  Metro Detail → Sources tab — source management\n  Metro Detail → Keywords tab — per-metro overrides\n\nHooks:\n  src/hooks/useMetroNarratives.ts\n  src/hooks/useSystemSweep.ts');

    addPage();
    
    addTitle('Appendix: File Reference');
    addSubtitle('Key Files for Code Review:');
    addCode('Authentication:\n  src/contexts/AuthContext.tsx\n  src/components/auth/ProtectedRoute.tsx\n\nData Fetching:\n  src/hooks/useOpportunities.ts\n  src/hooks/useContacts.ts\n  src/hooks/useGrants.ts\n  src/hooks/useAnchorPipeline.ts\n  src/hooks/useVolunteers.ts\n\nVolunteers & Import (Phase 6A):\n  src/pages/Volunteers.tsx\n  src/pages/VolunteerDetail.tsx\n  src/pages/VolunteerHoursInbox.tsx\n  src/pages/ImportCenter.tsx\n  src/hooks/useVolunteers.ts\n  src/lib/volunteerConfig.ts\n  src/lib/importers/Importer.ts\n  src/components/events/EventVolunteerHours.tsx\n  src/components/admin/VolunteerIngestionStats.tsx\n  src/components/admin/ImportCenterStats.tsx\n  supabase/functions/volunteer-hours-ingest/\n\nSystem Sweep & Observability:\n  src/hooks/useSystemSweep.ts\n  supabase/functions/system-sweep/\n  supabase/functions/tests/system-sweep.test.ts\n\nMetro News & Narratives:\n  src/pages/MetroNews.tsx\n  src/hooks/useMetroNarratives.ts\n  supabase/functions/metro-news-sources/\n  supabase/functions/metro-news-run/\n\nDiscovery Search:\n  src/pages/FindPeople.tsx\n  src/pages/FindEvents.tsx\n  src/pages/FindGrants.tsx\n  src/components/discovery/FindPage.tsx\n  src/hooks/useIntentProfile.ts\n  src/hooks/useSavedSearches.ts\n  supabase/functions/n8n-dispatch/\n  supabase/functions/search-callback/\n\nOutreach / Campaigns:\n  src/hooks/useGmailCampaignSend.ts\n  src/hooks/useEmailCampaigns.ts\n  src/hooks/useCampaignAudience.ts\n  src/components/outreach/\n\nProvisions (Phase 5):\n  src/hooks/useProvisions.ts\n  src/pages/Provisions.tsx\n  supabase/functions/provision-create/\n  supabase/functions/provision-parse/\n\nNarrative Intelligence (Phase 5B):\n  src/hooks/useStoryEvents.ts\n  src/hooks/useMetroNarrative.ts\n  supabase/functions/metro-narrative-build/\n  supabase/functions/metro-narrative-drift/\n\nHuman Impact Reports (Phase 5C):\n  src/pages/ImpactExport.tsx\n  src/hooks/useHumanImpactData.ts\n  src/lib/impactReportPdf.ts\n\nEdge Functions:\n  supabase/functions/profunda-ai/\n  supabase/functions/gmail-sync/\n  supabase/functions/gmail-campaign-send/\n  supabase/functions/volunteer-hours-ingest/\n  supabase/functions/system-sweep/\n  supabase/functions/notification-dispatcher/\n  supabase/functions/profunda-notify/\n\nMain Pages:\n  src/pages/CommandCenter.tsx\n  src/pages/Opportunities.tsx\n  src/pages/People.tsx\n  src/pages/Grants.tsx\n  src/pages/Provisions.tsx\n  src/pages/Volunteers.tsx\n  src/pages/ImportCenter.tsx\n  src/pages/MetroNews.tsx\n  src/pages/Dashboard.tsx');

    // Save PDF
    doc.save('Profunda-CRM-Technical-Documentation.pdf');
  };

  return (
    <MainLayout title="Technical Documentation" subtitle="Export comprehensive documentation for code review">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Generate Technical Documentation PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              This will generate a comprehensive PDF document covering:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">• Technology stack and dependencies</li>
              <li className="flex items-center gap-2">• Application architecture and routing</li>
              <li className="flex items-center gap-2">• Complete database schema with relationships</li>
              <li className="flex items-center gap-2">• Authentication and authorization model</li>
              <li className="flex items-center gap-2">• Row-Level Security policies</li>
              <li className="flex items-center gap-2">• Edge Functions and backend logic</li>
              <li className="flex items-center gap-2">• Core features and workflows</li>
              <li className="flex items-center gap-2">• Security considerations and potential vulnerabilities</li>
              <li className="flex items-center gap-2">• Testing recommendations</li>
            </ul>
            <Button onClick={generatePDF} className="w-full gap-2" size="lg">
              <Download className="w-5 h-5" />
              Download PDF Documentation
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
