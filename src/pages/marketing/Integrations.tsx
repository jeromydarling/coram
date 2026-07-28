/**
 * Integrations — Public catalog of all supported CROS Bridge™ integrations.
 *
 * WHAT: Lists every connector with sync direction, coverage mode, and capabilities.
 * WHERE: /integrations (public marketing route).
 * WHY: Prospects need to see what systems CROS connects to — as companion or complete replacement.
 */

import { Link } from 'react-router-dom';
import integrationsHero from '@/assets/integrations-hero.webp';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Check, ArrowLeftRight, ArrowDown, Link2, FileSpreadsheet, Sparkles } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type CoverageMode = 'full' | 'partial' | 'minimal';

interface IntegrationEntry {
  key: string;
  name: string;
  category: 'crm' | 'chms' | 'nonprofit' | 'wordpress' | 'platform' | 'csv';
  categoryLabel: string;
  syncDirection: 'one-way' | 'two-way' | 'csv-only';
  coverageMode: CoverageMode;
  auth: string;
  domains: string[];
  polling: string;
  webhook: boolean;
  description: string;
}

const integrations: IntegrationEntry[] = [
  // CRMs
  { key: 'hubspot', name: 'HubSpot', category: 'crm', categoryLabel: 'CRM', syncDirection: 'two-way', coverageMode: 'full', auth: 'API Key', domains: ['contacts', 'companies', 'deals', 'tickets', 'activities'], polling: 'Hourly', webhook: false, description: 'Full bi-directional sync — contacts, companies, deals, and activities flow both ways.' },
  { key: 'salesforce', name: 'Salesforce', category: 'crm', categoryLabel: 'CRM', syncDirection: 'two-way', coverageMode: 'full', auth: 'OAuth 2.0', domains: ['contacts', 'accounts', 'opportunities', 'tasks', 'events', 'notes'], polling: 'Hourly', webhook: false, description: 'Full bi-directional sync — contacts, accounts, opportunities, tasks, and notes flow both ways with conflict detection.' },
  { key: 'dynamics365', name: 'Microsoft Dynamics 365', category: 'crm', categoryLabel: 'CRM', syncDirection: 'two-way', coverageMode: 'full', auth: 'OAuth 2.0', domains: ['contacts', 'accounts', 'tasks', 'events', 'activities'], polling: 'Hourly', webhook: false, description: 'Full bi-directional sync — contacts, accounts, tasks, appointments, and activities with conflict detection.' },
  { key: 'blackbaud', name: 'Blackbaud RE NXT', category: 'crm', categoryLabel: 'CRM', syncDirection: 'two-way', coverageMode: 'full', auth: 'OAuth 2.0', domains: ['constituents', 'gifts', 'actions', 'events', 'notes', 'households', 'campaigns'], polling: 'Hourly', webhook: true, description: 'Full bi-directional sync via SKY API — constituents, gifts, actions, events, and notes with conflict detection.' },
  { key: 'zoho', name: 'Zoho CRM', category: 'crm', categoryLabel: 'CRM', syncDirection: 'one-way', coverageMode: 'full', auth: 'OAuth 2.0', domains: ['contacts', 'accounts', 'deals', 'activities', 'notes'], polling: 'Hourly', webhook: false, description: 'One-way sync of contacts, accounts, deals, and activity history.' },
  { key: 'virtuous', name: 'Virtuous CRM', category: 'crm', categoryLabel: 'CRM', syncDirection: 'one-way', coverageMode: 'full', auth: 'API Key', domains: ['contacts', 'gifts', 'projects', 'tasks', 'notes'], polling: 'Daily', webhook: true, description: 'Responsive fundraising platform — contacts, gifts, projects, and automation.' },
  { key: 'oracle', name: 'Oracle CRM', category: 'crm', categoryLabel: 'CRM', syncDirection: 'one-way', coverageMode: 'full', auth: 'OAuth 2.0', domains: ['contacts', 'accounts', 'opportunities', 'activities', 'campaigns', 'households'], polling: 'Hourly', webhook: false, description: 'Enterprise CRM (Oracle CX Cloud) — contacts, accounts, opportunities, activities, and campaigns.' },
  { key: 'airtable', name: 'Airtable', category: 'platform', categoryLabel: 'Platform', syncDirection: 'one-way', coverageMode: 'partial', auth: 'API Key', domains: ['records', 'tables', 'relationships', 'attachments'], polling: 'Daily', webhook: true, description: 'Flexible table import — any Airtable structure mapped to CROS relationships.' },

  // Church Management
  { key: 'planningcenter', name: 'Planning Center', category: 'chms', categoryLabel: 'ChMS', syncDirection: 'one-way', coverageMode: 'full', auth: 'OAuth 2.0', domains: ['people', 'households', 'groups', 'check-ins', 'services'], polling: '5 min', webhook: true, description: 'Real-time people and household sync with webhook support.' },
  { key: 'rock', name: 'Rock RMS', category: 'chms', categoryLabel: 'ChMS', syncDirection: 'one-way', coverageMode: 'full', auth: 'API Key', domains: ['people', 'groups', 'households', 'events'], polling: 'Hourly', webhook: false, description: 'Open-source church management — people, groups, and events.' },
  { key: 'breeze', name: 'Breeze ChMS', category: 'chms', categoryLabel: 'ChMS', syncDirection: 'one-way', coverageMode: 'full', auth: 'API Key', domains: ['people', 'families', 'events', 'tags'], polling: 'Daily', webhook: false, description: 'Simple church management — people, families, and tagged events.' },
  { key: 'parishsoft', name: 'ParishSoft', category: 'chms', categoryLabel: 'ChMS', syncDirection: 'one-way', coverageMode: 'partial', auth: 'API Key', domains: ['households', 'members', 'constituents'], polling: 'Nightly', webhook: false, description: 'Catholic parish management — households, members, and constituents.' },
  { key: 'ministryplatform', name: 'MinistryPlatform', category: 'chms', categoryLabel: 'ChMS', syncDirection: 'one-way', coverageMode: 'full', auth: 'OAuth 2.0', domains: ['events', 'households', 'people', 'groups'], polling: 'Hourly', webhook: false, description: 'Full-spectrum ministry management — contacts, households, events.' },
  { key: 'fellowshipone', name: 'FellowshipOne', category: 'chms', categoryLabel: 'ChMS', syncDirection: 'one-way', coverageMode: 'full', auth: 'OAuth 1.0', domains: ['people', 'households', 'activities', 'events'], polling: 'Hourly', webhook: false, description: 'Ministry management — people, households, activities.' },
  { key: 'pushpay', name: 'Pushpay / CCB', category: 'chms', categoryLabel: 'ChMS', syncDirection: 'one-way', coverageMode: 'full', auth: 'API Key', domains: ['people', 'groups', 'events', 'attendance', 'giving'], polling: 'Hourly', webhook: false, description: 'People, groups, events, attendance, and giving — via the CCB API.' },

  // Nonprofit donor CRMs
  { key: 'bloomerang', name: 'Bloomerang', category: 'nonprofit', categoryLabel: 'Nonprofit', syncDirection: 'one-way', coverageMode: 'full', auth: 'API Key', domains: ['constituents', 'donations', 'interactions', 'campaigns', 'funds'], polling: 'Daily', webhook: false, description: 'Donor CRM — constituents, donations, interactions, and campaigns.' },
  { key: 'neoncrm', name: 'NeonCRM', category: 'nonprofit', categoryLabel: 'Nonprofit', syncDirection: 'one-way', coverageMode: 'full', auth: 'API Key', domains: ['accounts', 'donations', 'events', 'memberships', 'volunteers'], polling: 'Daily', webhook: true, description: 'Nonprofit CRM — accounts, donations, events, and volunteer management.' },
  { key: 'lgl', name: 'Little Green Light', category: 'nonprofit', categoryLabel: 'Nonprofit', syncDirection: 'one-way', coverageMode: 'partial', auth: 'API Key', domains: ['constituents', 'gifts', 'appeals', 'groups', 'notes'], polling: 'Daily', webhook: false, description: 'Donor management — constituents, gifts, appeals, and groups.' },
  { key: 'donorperfect', name: 'DonorPerfect', category: 'nonprofit', categoryLabel: 'Nonprofit', syncDirection: 'one-way', coverageMode: 'partial', auth: 'API Key', domains: ['donors', 'gifts', 'pledges', 'contacts'], polling: 'Daily', webhook: false, description: 'Fundraising software — donors, gifts, pledges, and contacts.' },
  { key: 'kindful', name: 'Kindful', category: 'nonprofit', categoryLabel: 'Nonprofit', syncDirection: 'one-way', coverageMode: 'partial', auth: 'OAuth 2.0', domains: ['contacts', 'transactions', 'campaigns', 'groups', 'pledges'], polling: 'Daily', webhook: false, description: 'Nonprofit CRM — contacts, transactions, and campaign tracking.' },

  // WordPress
  { key: 'fluentcrm', name: 'FluentCRM', category: 'wordpress', categoryLabel: 'WordPress', syncDirection: 'one-way', coverageMode: 'partial', auth: 'API Key', domains: ['contacts', 'lists', 'tags', 'campaigns', 'companies'], polling: 'Daily', webhook: false, description: 'Self-hosted WordPress email marketing & contact management.' },
  { key: 'jetpackcrm', name: 'Jetpack CRM', category: 'wordpress', categoryLabel: 'WordPress', syncDirection: 'one-way', coverageMode: 'partial', auth: 'API Key', domains: ['contacts', 'transactions', 'invoices', 'events', 'quotes'], polling: 'Daily', webhook: false, description: 'Lightweight WordPress CRM by Automattic — contacts, invoices, transactions.' },
  { key: 'wperp', name: 'WP ERP', category: 'wordpress', categoryLabel: 'WordPress', syncDirection: 'one-way', coverageMode: 'partial', auth: 'API Key', domains: ['contacts', 'companies', 'activities', 'groups'], polling: 'Daily', webhook: false, description: 'WordPress ERP suite — CRM contacts, companies, and activity logs.' },

  // CSV Migration Only
  { key: 'shelbynext', name: 'ShelbyNext Membership', category: 'csv', categoryLabel: 'CSV Migration', syncDirection: 'csv-only', coverageMode: 'minimal', auth: 'CSV Export', domains: ['members', 'families', 'groups', 'contributions'], polling: 'Manual', webhook: false, description: 'No API available — data migrated via CSV export. Guided setup walks you through every step.' },
  { key: 'servantkeeper', name: 'Servant Keeper', category: 'csv', categoryLabel: 'CSV Migration', syncDirection: 'csv-only', coverageMode: 'minimal', auth: 'CSV Export', domains: ['members', 'families', 'attendance', 'contributions'], polling: 'Manual', webhook: false, description: 'No API available — data migrated via CSV export. CROS maps your fields automatically.' },
  { key: 'apple_contacts', name: 'Apple Contacts / iCloud', category: 'csv', categoryLabel: 'CSV Migration', syncDirection: 'csv-only', coverageMode: 'minimal', auth: 'vCard Export', domains: ['contacts', 'groups'], polling: 'Manual', webhook: false, description: 'No public API — contacts exported as vCard (.vcf) from iCloud and imported into CROS.' },

  // Personal / Address Book
  { key: 'google_contacts', name: 'Google Contacts', category: 'platform', categoryLabel: 'Platform', syncDirection: 'two-way', coverageMode: 'partial', auth: 'OAuth 2.0', domains: ['contacts', 'groups', 'labels'], polling: 'Daily', webhook: false, description: 'Bi-directional sync via Google People API — contacts, groups, and labels flow both ways.' },
  { key: 'outlook_contacts', name: 'Microsoft Outlook Contacts', category: 'platform', categoryLabel: 'Platform', syncDirection: 'two-way', coverageMode: 'partial', auth: 'OAuth 2.0', domains: ['contacts', 'folders', 'categories'], polling: 'Daily', webhook: false, description: 'Bi-directional sync via Microsoft Graph — contacts, folders, and categories flow both ways.' },
  { key: 'monicacrm', name: 'Monica CRM', category: 'crm', categoryLabel: 'CRM', syncDirection: 'one-way', coverageMode: 'partial', auth: 'API Key', domains: ['contacts', 'activities', 'notes', 'reminders', 'tasks'], polling: 'Daily', webhook: false, description: 'Open-source personal relationship manager — contacts, activities, notes, and reminders.' },
  { key: 'contactsplus', name: 'Contacts+', category: 'platform', categoryLabel: 'Platform', syncDirection: 'one-way', coverageMode: 'partial', auth: 'API Key', domains: ['contacts', 'tags', 'notes', 'companies'], polling: 'Daily', webhook: false, description: 'Unified address book — contacts, tags, notes, and social profiles. Formerly FullContact.' },

  // Open-source nonprofit CRM
  { key: 'civicrm', name: 'CiviCRM', category: 'nonprofit', categoryLabel: 'Nonprofit', syncDirection: 'two-way', coverageMode: 'full', auth: 'API Key', domains: ['contacts', 'activities', 'events', 'cases', 'contributions', 'groups', 'tags', 'volunteers'], polling: 'Hourly', webhook: false, description: 'Full bi-directional sync for contacts and activities via APIv4. Contributions read-only. Cases, events, groups, tags, and CiviVolunteer supported.' },
];

const categoryColors: Record<string, string> = {
  crm: 'bg-blue-100 text-blue-700',
  chms: 'bg-violet-100 text-violet-700',
  nonprofit: 'bg-emerald-100 text-emerald-700',
  wordpress: 'bg-orange-100 text-orange-700',
  platform: 'bg-slate-100 text-slate-700',
  csv: 'bg-amber-100 text-amber-700',
};

const coverageBadge: Record<CoverageMode, { label: string; color: string }> = {
  full: { label: 'API Sync', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial: { label: 'Partial Sync', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  minimal: { label: 'CSV Migration', color: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const domainLabels: Record<string, string> = {
  contacts: 'Contacts', companies: 'Companies', accounts: 'Accounts', deals: 'Deals',
  opportunities: 'Opportunities', tasks: 'Tasks', events: 'Events', notes: 'Notes',
  activities: 'Activities', tickets: 'Tickets', people: 'People', households: 'Households',
  groups: 'Groups', 'check-ins': 'Check-ins', services: 'Services', families: 'Families',
  tags: 'Tags', members: 'Members', constituents: 'Constituents', donations: 'Donations',
  interactions: 'Interactions', campaigns: 'Campaigns', funds: 'Funds', memberships: 'Memberships',
  volunteers: 'Volunteers', gifts: 'Gifts', appeals: 'Appeals', donors: 'Donors',
  pledges: 'Pledges', transactions: 'Transactions', lists: 'Lists', invoices: 'Invoices',
  quotes: 'Quotes', records: 'Records', tables: 'Tables', relationships: 'Relationships',
  attachments: 'Attachments', attendance: 'Attendance', giving: 'Giving', contributions: 'Contributions',
  projects: 'Projects', actions: 'Actions', labels: 'Labels', folders: 'Folders',
  categories: 'Categories', reminders: 'Reminders',
};

export default function Integrations() {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="bg-white">
        <SeoHead
          title="Integrations — CROS Bridge™"
          description="See every CRM, ChMS, and nonprofit platform that CROS connects to. 31+ integrations — two-way sync with HubSpot, Salesforce, Dynamics 365, Blackbaud RE NXT, CiviCRM, Google Contacts, and Outlook. Financial data syncs inbound only."
          keywords={['CROS integrations', 'CRM integration', 'church management sync', 'nonprofit CRM bridge', 'Microsoft Dynamics 365', 'Salesforce two-way sync', 'Google Contacts sync', 'Outlook contacts integration', 'CiviCRM integration']}
          canonical="/integrations"
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Pricing', to: '/pricing' }, { label: 'Integrations' }]} />
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(var(--marketing-surface))] border border-[hsl(var(--marketing-border))] mb-4">
              <Link2 className="h-4 w-4 text-[hsl(var(--marketing-blue))]" />
              <span className="text-xs font-medium text-[hsl(var(--marketing-navy)/0.6)]">CROS Bridge™ Add-on</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] mb-4">
              {integrations.length} integrations — companion, complement, or complete
            </h1>
            <p className="text-[hsl(var(--marketing-navy)/0.55)] max-w-xl mx-auto mb-2">
              CROS works alongside your existing tools — or runs the whole show. Whether you need a relationship layer on top of what you have, or a full operating system for your mission, Bridge meets you where you are.
            </p>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.4)] max-w-md mx-auto">
              HubSpot, Salesforce, Microsoft Dynamics 365, Blackbaud RE NXT, Google Contacts, and Outlook Contacts support full two-way sync with conflict detection. All other integrations are read-only narrative companions.
            </p>
          </div>

          {/* Quick stats */}

          {/* Before / After */}
          <div className="grid sm:grid-cols-2 gap-6 mb-14 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-[hsl(var(--marketing-border))] p-6 bg-[hsl(var(--marketing-navy)/0.02)]">
              <p className="text-xs font-semibold text-[hsl(var(--marketing-navy)/0.4)] uppercase tracking-wider mb-2">Before CROS</p>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">
                Data trapped inside disconnected systems. Relationships scattered across spreadsheets, inboxes, and forgotten logins.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 p-6 bg-emerald-50/30">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">After CROS</p>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">
                Memory flows into a living narrative. Every relationship, every touchpoint, every story — connected and purposeful.
              </p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-10 text-xs text-[hsl(var(--marketing-navy)/0.5)]">
            <span className="flex items-center gap-1.5"><ArrowLeftRight className="h-3.5 w-3.5 text-[hsl(var(--marketing-blue))]" /> Two-way sync</span>
            <span className="flex items-center gap-1.5"><ArrowDown className="h-3.5 w-3.5 text-[hsl(var(--marketing-navy)/0.4)]" /> One-way (read-only)</span>
            <span className="flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5 text-amber-600" /> CSV migration</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> Webhook support</span>
          </div>

          {/* Integration cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((int) => (
              <div
                key={int.key}
                className={`rounded-2xl border p-5 transition-all ${
                  int.syncDirection === 'two-way'
                    ? 'border-[hsl(var(--marketing-blue)/0.3)] bg-[hsl(var(--marketing-blue)/0.02)]'
                    : int.syncDirection === 'csv-only'
                    ? 'border-amber-200 bg-amber-50/20'
                    : 'border-[hsl(var(--marketing-border))] bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-sm text-[hsl(var(--marketing-navy))]">{int.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="secondary" className={`text-[10px] ${categoryColors[int.category]}`}>
                        {int.categoryLabel}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${coverageBadge[int.coverageMode].color}`}>
                        {coverageBadge[int.coverageMode].label}
                      </Badge>
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="shrink-0">
                        {int.syncDirection === 'two-way' ? (
                          <ArrowLeftRight className="h-4 w-4 text-[hsl(var(--marketing-blue))]" />
                        ) : int.syncDirection === 'csv-only' ? (
                          <FileSpreadsheet className="h-4 w-4 text-amber-600" />
                        ) : (
                          <ArrowDown className="h-4 w-4 text-[hsl(var(--marketing-navy)/0.3)]" />
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      {int.syncDirection === 'two-way' ? 'Two-way sync — data flows both directions'
                        : int.syncDirection === 'csv-only' ? 'CSV migration — no live API, guided export process'
                        : 'One-way read — CROS listens, never writes back'}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)] mb-3 leading-relaxed">{int.description}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {int.domains.map(d => (
                    <span key={d} className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--marketing-navy)/0.04)] text-[hsl(var(--marketing-navy)/0.5)]">
                      {domainLabels[d] || d}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[hsl(var(--marketing-navy)/0.4)]">
                  <span>{int.auth}</span>
                  <span>·</span>
                  <span>{int.polling} sync</span>
                  {int.webhook && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-600">Webhooks</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Guided Setup Available callout */}
          <div className="mt-10 p-6 rounded-2xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-surface))] text-center max-w-2xl mx-auto">
            <Sparkles className="h-5 w-5 text-[hsl(var(--marketing-blue))] mx-auto mb-3" />
            <p className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-1">
              Guided Setup Available
            </p>
            <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)] mb-4 max-w-md mx-auto">
              Every integration includes a step-by-step setup guide. For CSV-only platforms like ShelbyNext and Servant Keeper, we walk you through the entire export and mapping process.
            </p>
            <p className="text-xs text-[hsl(var(--marketing-navy)/0.4)] italic">
              Feeling overwhelmed? Our Guided Activation service can walk with you.
            </p>
          </div>

          {/* CTA */}
          <div className="mt-16 text-center">
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.5)] mb-4">
              Bridge is available as an add-on to any CROS plan for <strong className="text-[hsl(var(--marketing-navy))]">$49/mo</strong>.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/pricing">
                <Button
                  size="lg"
                  className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
                >
                  View pricing <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/relatio-campaigns">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-white px-8 h-12 text-base"
                >
                  Relatio Campaigns™ <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Don't see yours? */}
          <div className="mt-12 text-center">
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.45)]">
              Don't see your system?{' '}
              <Link to="/contact" className="text-[hsl(var(--marketing-blue))] hover:underline font-medium">
                Let us know →
              </Link>
            </p>
          </div>
        </div>

        <SeoInternalLinks
          heading="Explore More"
          links={[
            { label: 'Pricing', to: '/pricing', description: 'Plans, add-ons, and team capacity.' },
            { label: 'Relatio Campaigns™', to: '/relatio-campaigns', description: 'Relationship-first email outreach.' },
            { label: 'NRI™', to: '/nri', description: 'Narrative Relational Intelligence explained.' },
          ]}
        />
      </div>
    </TooltipProvider>
  );
}
