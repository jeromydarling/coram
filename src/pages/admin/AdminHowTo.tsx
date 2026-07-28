/**
 * AdminHowTo — In-app admin guide for the CROS administrative console.
 *
 * WHAT: Practical reference guide for tenant admin tools, with operator sections visible only to stewards.
 * WHERE: /:tenantSlug/admin/how-to
 * WHY: Admins need quick, contextual guidance without leaving the app.
 */

import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import {
  Activity,
  FlaskConical,
  Eye,
  Shield,
  Heart,
  Link2,
  BookOpen,
  Compass,
  Sparkles,
  Users,
  HelpCircle,
  Settings,
  FileText,
  MapPin,
  Upload,
  Lock,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function SectionTooltip({ what, where, why }: { what: string; where: string; why: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-4 w-4 text-muted-foreground inline ml-1.5 cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
          <p><strong>What:</strong> {what}</p>
          <p><strong>Where:</strong> {where}</p>
          <p><strong>Why:</strong> {why}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface GuideSection {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge: string;
  operatorOnly?: boolean;
  items: Array<{ q: string; a: string }>;
}

// ── TENANT ADMIN SECTIONS ──
const tenantSections: GuideSection[] = [
  {
    id: 'user-management',
    icon: Users,
    title: 'User Management',
    badge: 'Admin Only',
    items: [
      {
        q: 'How do I approve new users?',
        a: 'Go to Admin → Users tab. New registrations appear with a "Pending" badge. Click "Manage" on any user, then click "Approve" to grant them access. Until approved, they cannot see any data.',
      },
      {
        q: 'How do I assign roles?',
        a: 'Click "Manage" on a user → select a role from the dropdown → click "Assign." Available roles: Admin (full access), Leadership (read-focused, all regions), Regional Lead (scoped to assigned region), Staff (scoped to assigned region).',
      },
      {
        q: 'How do I assign a user to a region?',
        a: 'Click "Manage" on a user → select their region from the Region dropdown. Regional Leads and Staff will only see data in their assigned region. Admins and Leadership see all regions automatically.',
      },
      {
        q: 'Can I revoke access?',
        a: 'Yes. Click "Manage" → "Revoke Approval." The user loses all access immediately but their account isn\'t deleted. You can re-approve later.',
      },
    ],
  },
  {
    id: 'territories',
    icon: MapPin,
    title: 'Territories & Service Areas',
    badge: 'Admin Only',
    items: [
      {
        q: 'What are territories?',
        a: 'Territories are the unified geography layer in CROS. They replace the old metro-only model with support for metros, county bundles, states, countries, and mission fields. Each territory type has different activation slot costs.',
      },
      {
        q: 'What is a county bundle?',
        a: 'A county bundle groups up to 5 counties within the same state into 1 activation slot. This ensures fair pricing for rural organizations that serve multiple counties rather than a single metro area.',
      },
      {
        q: 'How do activation slots work?',
        a: '1 metro = 1 slot. Up to 5 counties (same state) = 1 slot. 1 state = 2 slots. 1 country = 1 slot. Mission fields under an activated country are free. Solo caregivers don\'t use activation slots.',
      },
      {
        q: 'What about missionary organizations?',
        a: 'Missionary orgs select a country as their primary territory during onboarding. They can optionally add a city and region/province. Mission fields can be added later as free sub-territories under the activated country.',
      },
      {
        q: 'What if I\'m a solo caregiver?',
        a: 'Solo caregivers set a private base location (state and optional city) during onboarding. This is never displayed publicly, never shown on Atlas, and never consumes an activation slot. It\'s used only for private movement insights and the Caregiver Network.',
      },
      {
        q: 'How do I add more territories after onboarding?',
        a: 'Go to Settings → Territories. You can add additional metros, counties, states, or countries based on your plan\'s available activation slots.',
      },
    ],
  },
  {
    id: 'configuration',
    icon: Settings,
    title: 'Sectors, Tags & Alignments',
    badge: 'Admin Only',
    items: [
      {
        q: 'What are Sectors?',
        a: 'Sectors categorize the industries your partner organizations serve (e.g., Education, Healthcare, Workforce). They appear as filter options on the Opportunities page and in reports.',
      },
      {
        q: 'What are Grant Alignments?',
        a: 'Grant Alignments tag opportunities with grant-related themes so you can track which partnerships connect to which funding sources. Useful for reporting to funders.',
      },
      {
        q: 'What are Mission Snapshots and Partnership Angles?',
        a: 'Mission Snapshots capture what an organization does (their mission). Partnership Angles describe how you work together. Both are managed lists that appear as dropdowns on opportunity records.',
      },
      {
        q: 'What are Grant Types?',
        a: 'Grant Types categorize funding (Operating, Program, Capital, Emergency, Capacity Building). They help filter and report on your grant pipeline.',
      },
    ],
  },
  {
    id: 'ai-knowledge',
    icon: Sparkles,
    title: 'AI Knowledge Base',
    badge: 'Admin Only',
    items: [
      {
        q: 'What is the AI Knowledge Base?',
        a: 'It stores your organization\'s canonical identity — company profile, email tone & style, and approved claims. This context is automatically injected into all AI features (NRI suggestions, narrative generation, campaign drafts) so they always sound like your organization.',
      },
      {
        q: 'How do I update it?',
        a: 'Go to Admin → AI Knowledge Base tab. Edit any document, then click Save. Changes are versioned — you can see the history and revert if needed. Updates take effect immediately across all AI features.',
      },
      {
        q: 'What\'s the difference between Company KB and Organization Knowledge?',
        a: 'Company KB is your organization\'s identity (one set, shared across all AI). Organization Knowledge is per-partner — it describes what you know about each partner organization. Both are used by AI but at different levels.',
      },
    ],
  },
  {
    id: 'audit-log',
    icon: FileText,
    title: 'Audit Log',
    badge: 'Admin Only',
    items: [
      {
        q: 'What does the Audit Log show?',
        a: 'Every create, update, and delete action across the system — who did what, when, and what changed. Useful for compliance, troubleshooting, and understanding team activity patterns.',
      },
      {
        q: 'Can I export audit data?',
        a: 'The audit log is viewable in-app with filtering by entity type and action. For bulk export needs, contact your platform operator.',
      },
    ],
  },
  {
    id: 'community-health',
    icon: Heart,
    title: 'Community Health',
    badge: 'Admin Only',
    items: [
      {
        q: 'What does Community Health show?',
        a: 'Two panels: Volunteer Ingestion Stats (email-based hour submissions, processing results) and Import Center Stats (CSV import history, row counts, error rates). Together they show how data flows into your workspace.',
      },
      {
        q: 'What are volunteer ingestion stats?',
        a: 'When volunteers submit hours via email (HOURS: YYYY-MM-DD | 3.5 | warehouse), the system processes these automatically. The stats panel shows how many submissions were received, parsed, and matched to volunteers.',
      },
    ],
  },
  {
    id: 'subscription',
    icon: Lock,
    title: 'Subscription & Plan',
    badge: 'Admin Only',
    items: [
      {
        q: 'Where do I see my current plan?',
        a: 'Go to Admin → Subscription tab. You\'ll see your tier (Core, Insight, or Story), seat count, active add-ons (like Bridge or Campaigns), and billing status.',
      },
      {
        q: 'How do I upgrade?',
        a: 'Tier changes are managed through your subscription settings. Contact your platform operator for add-on purchases like Relatio Campaigns™, additional metros, or Guided Activation™ sessions.',
      },
    ],
  },
  {
    id: 'import',
    icon: Upload,
    title: 'Import Center & Data Migration',
    badge: 'Admin Only',
    items: [
      {
        q: 'How do I import data from another CRM?',
        a: 'Go to Import Center (sidebar → Community → Import Center). Select your source system (HubSpot, Salesforce, Microsoft Dynamics 365, Generic CSV), choose what to import (organizations, contacts, or volunteers), upload your CSV, and map columns. Always preview before importing.',
      },
      {
        q: 'What about deduplication?',
        a: 'The import system checks for existing records by name and email. Duplicates are flagged during preview so you can decide whether to skip or merge them.',
      },
      {
        q: 'What is two-way sync?',
        a: 'For HubSpot, Salesforce, and Microsoft Dynamics 365, CROS supports bi-directional sync. Changes you make in CROS can be written back to your external CRM automatically. If both systems edited the same record, a conflict is flagged for your review — CROS never overwrites without your consent.',
      },
      {
        q: 'How do I resolve sync conflicts?',
        a: 'When a conflict is detected, it appears in the Integrations page under your connector. You can choose to accept the CROS version, the external CRM version, or merge them manually. Conflicts are always flagged — never silently overwritten.',
      },
    ],
  },
  // ── SHARED SECTIONS (visible to all admins) ──
  {
    id: 'communio',
    icon: Heart,
    title: 'Communio Governance',
    badge: 'Core',
    items: [
      {
        q: 'What is Communio?',
        a: 'Communio is the cooperative sharing layer between organizations on CROS. You can form groups, share anonymized signals, co-sense community momentum, and discover shared patterns — all without exposing private data.',
      },
      {
        q: 'How do groups work?',
        a: 'Any admin can create a group and invite other organizations. Groups have governance settings: visibility (invite-only vs open discovery), and toggles for sharing events, signals, reflections, and story heatmaps.',
      },
      {
        q: 'What gets shared?',
        a: 'Only anonymized counts and signal types. Never emails, phones, names, organization titles, or freeform notes. The privacy sanitizer strips all PII before any data crosses organizational boundaries.',
      },
    ],
  },
  {
    id: 'security',
    icon: Shield,
    title: 'Security & Access Control',
    badge: 'Admin Only',
    items: [
      {
        q: 'How are roles managed?',
        a: 'Roles are stored in a dedicated user_roles table (never on profiles) to prevent privilege escalation. Available roles: Admin, Regional Lead, Staff, Leadership. Role checks use security-definer functions for safe RLS evaluation.',
      },
      {
        q: 'How does data isolation work?',
        a: 'Every record has a tenant_id. Row Level Security policies ensure you can only see data belonging to your organization. Cross-organization data access is impossible at the database level.',
      },
      {
        q: 'What about the Do Not Email list?',
        a: 'Admin → Do Not Email manages email suppression. Any email address added here will be excluded from all campaigns. Use it for opt-out requests or compliance needs.',
      },
      {
        q: 'What about Email Providers?',
        a: 'Admin → Email Providers configures which email service your organization uses for outreach campaigns. Currently Gmail is the supported provider with OAuth-based connection.',
      },
    ],
  },
];

// ── OPERATOR-ONLY SECTIONS ──
const operatorSections: GuideSection[] = [
  {
    id: 'operator',
    icon: Activity,
    title: 'Operator Console (Control Plane)',
    badge: 'Steward Only',
    operatorOnly: true,
    items: [
      {
        q: 'What does it show?',
        a: 'The Operator Console provides a bird\'s-eye view of platform health: tenant ecosystem counts, archetype adoption, narrative signal flow, integration status, and Communio network activity. It is not a KPI dashboard — it\'s a way to sense how the community is breathing.',
      },
      {
        q: 'When should I click "Refresh Metrics"?',
        a: 'Refresh when you want up-to-the-minute data. The console normally reflects the last operator-refresh run. Clicking Refresh triggers a fresh aggregation across all operator tables. Use it before board meetings or when investigating an anomaly.',
      },
      {
        q: 'How do I read the Confidence Score?',
        a: 'The Connector Confidence score (0–100) blends three signals: real integration success rate (50%), simulation test pass rate (30%), and recent uptime (20%). Above 80 = healthy. 50–80 = monitor. Below 50 = needs investigation.',
      },
      {
        q: 'What do drift flags mean?',
        a: 'Drift flags appear when a metro\'s narrative signals shift — topics change, engagement patterns move, or partner activity slows. It\'s not alarming — it\'s an invitation to pay attention.',
      },
    ],
  },
  {
    id: 'demo-lab',
    icon: FlaskConical,
    title: 'Demo Lab & Scenario Testing',
    badge: 'Steward Only',
    operatorOnly: true,
    items: [
      {
        q: 'How do I create a demo tenant?',
        a: 'Go to Demo Lab → Demo Tenants tab → fill in a slug, a name, and choose a seed profile (small/medium/large). Click "Create Demo Tenant." The system creates an isolated workspace with sample data.',
      },
      {
        q: 'What are seed profiles?',
        a: 'Seed profiles control how much sample data gets created: Small (12 orgs, 40 contacts), Medium (60 orgs, 300 contacts), Large (200 orgs, 1200 contacts). Use Small for quick demos, Large for performance testing.',
      },
      {
        q: 'What is Simulation Mode?',
        a: 'Simulation Mode uses connector simulation profiles (deterministic fixtures) to test mapping and import logic WITHOUT calling any external CRM API. Toggle it on, select a profile, and run tests.',
      },
    ],
  },
  {
    id: 'impersonation',
    icon: Eye,
    title: 'Operator Impersonation',
    badge: 'Steward Only',
    operatorOnly: true,
    items: [
      {
        q: 'How does impersonation work?',
        a: 'Operators can enter a tenant workspace as admin during Guided Activation™ sessions. This requires the tenant to have purchased activation and granted explicit consent. Sessions are time-limited (60 minutes) and fully audited.',
      },
      {
        q: 'Is this safe?',
        a: 'Yes. Every session is logged with operator ID, target tenant, timestamp, and reason. Sessions auto-expire. The operator keeps their own auth session — no tokens are shared.',
      },
    ],
  },
  {
    id: 'integrations',
    icon: Link2,
    title: 'Integration Health & Connectors',
    badge: 'Steward Only',
    operatorOnly: true,
    items: [
      {
        q: 'How do I test a new connector?',
        a: 'Use the Integration Health page or Demo Lab → Migration Harness → enable Simulation Mode. Run Smoke Test first, then Dry Run. The system validates mapping, handles schema drift, and produces a confidence score.',
      },
      {
        q: 'What is the nightly sweep?',
        a: 'The integration-sweep-nightly function runs automatically and tests all active connectors using simulation profiles. Results update the Connector Confidence score in the Operator Console.',
      },
      {
        q: 'Which connectors support two-way sync?',
        a: 'HubSpot, Salesforce, and Microsoft Dynamics 365 support full bi-directional sync. This includes contacts, accounts/companies, tasks, events, and notes/activities. Outbound sync runs via the relatio-outbound-sync Edge Function directly to the vendor API.',
      },
      {
        q: 'How does conflict detection work?',
        a: 'When an outbound update is triggered, the Edge Function fetches the remote record and compares fields. If differences are found (e.g., email or name changed in both systems), a conflict is flagged in the sync_conflicts table for Steward review. No data is overwritten without human approval.',
      },
    ],
  },
  {
    id: 'compass-companion',
    icon: Compass,
    title: 'CROS Companion & Compass Posture',
    badge: 'All Roles',
    items: [
      {
        q: 'What is the compass icon in the bottom-right corner?',
        a: 'That is the CROS Companion — your personal guide to the platform. Tap it to open a conversation where you can ask questions, log activities, or request help with anything in CROS.',
      },
      {
        q: 'Why does the compass sometimes glow?',
        a: 'A soft glow means the companion noticed something you might want help with — like a recently created record, an import that just finished, or something you deleted. It fades on its own after a couple of minutes. It is never urgent.',
      },
      {
        q: 'What are the posture labels inside the companion drawer?',
        a: 'The companion shows one of four postures: Care (when you are doing work), Narrative (when reviewing reports or stories), Discernment (in settings or integrations), or Restoration (after deleting or restoring something). This helps the assistant orient its suggestions to what you are doing.',
      },
      {
        q: 'Can I turn off the glow?',
        a: 'The glow respects your organization\'s privacy settings. If your admin disables recent action tracking, the glow will not appear. You can also simply ignore it — it fades naturally.',
      },
      {
        q: 'Does the companion track what I do?',
        a: 'The companion reads only allowlisted action breadcrumbs (like "record created" or "import completed") — never your content, notes, or personal information. These breadcrumbs exist to help with undo and restore, not surveillance.',
      },
    ],
  },
];

// ── MOVEMENT INTELLIGENCE SECTION ──
const intelligenceSection: GuideSection = {
  id: 'movement-intelligence',
  icon: Activity,
  title: 'Movement Intelligence',
  badge: 'All Roles',
  items: [
    {
      q: 'What is Movement Intelligence?',
      a: 'Movement Intelligence replaces the old analytics dashboard with a territory-aware view of your organization\'s care, presence, relationships, and narrative threads. It adapts to your archetype — solo caregivers see "Care Rhythm" instead of "Territory Vitality."',
    },
    {
      q: 'What sections are on the dashboard?',
      a: 'Seven sections: Territory Vitality (or Care Rhythm), Care & Presence Flow, Relationship Formation, Activation & Engagement, Discovery & Discernment, Restoration & Memory, and Narrative Threads. Each pulls live data from a unified time window (default: last 30 days).',
    },
    {
      q: 'How does the Compass integrate?',
      a: 'The Narrative Threads section shows your dominant Compass direction (Care, Narrative, Discernment, or Restoration) based on recent activity patterns. Providence summaries also surface here when available.',
    },
    {
      q: 'Where did the old analytics go?',
      a: 'Legacy pipeline charts, anchor metrics, and volume KPIs have been removed. If you navigate to the old /analytics URL, you will be redirected to /intelligence automatically.',
    },
    {
      q: 'How is performance managed?',
      a: 'The dashboard loads all data in ≤3 database roundtrips using parallel queries. Each card shows its own loading skeleton so the page never blocks entirely. A soft performance warning appears in development mode if queries exceed 800ms.',
    },
    {
      q: 'What about archetype differences?',
      a: 'Solo caregivers see "Care Rhythm" instead of Territory Vitality. Missionaries see country-based groupings (never Metro labels). Rural organizations never see "Metro Readiness." These guards are enforced automatically.',
    },
  ],
};

export default function AdminHowTo() {
  const { roles } = useAuth();
  const isSteward = roles.includes('steward' as any) || roles.includes('admin');

  const allSections = isSteward
    ? [...tenantSections, intelligenceSection, ...operatorSections]
    : [...tenantSections, intelligenceSection];

  return (
    <MainLayout
      title="Admin Console Guide"
      subtitle="How to use the administrative tools in your workspace."
    >
      <div className="max-w-3xl space-y-6 pb-12">
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <BookOpen className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Admin Guide
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This guide covers every administrative tool available to you — user management,
                  configuration, security, and governance. Each section includes practical answers
                  to common questions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {allSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  {section.title}
                  <Badge variant="outline" className="text-xs ml-auto">{section.badge}</Badge>
                  <SectionTooltip
                    what={`Guide section for ${section.title}`}
                    where="Admin Console Guide"
                    why="Quick reference for operating this admin module"
                  />
                </CardTitle>
                {section.operatorOnly && (
                  <p className="text-xs text-muted-foreground mt-1">
                    This section covers platform-level tools accessible only from the Operator Console.
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {section.items.map((item, idx) => (
                    <AccordionItem key={idx} value={`${section.id}-${idx}`} className="border-b-0">
                      <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </MainLayout>
  );
}
