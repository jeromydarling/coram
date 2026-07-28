/**
 * OperatorNexusIntegrations — Operator-only integration registry.
 *
 * WHAT: Internal reference for connector notes, field maps, CSV templates, and QA readiness.
 * WHERE: /operator/nexus/integrations
 * WHY: Operators need a single view of all integration caveats without tenant-facing UI.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Plug, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ConnectorInfo {
  key: string;
  name: string;
  description: string;
  csvTemplate?: string;
  fieldNotes: string[];
  migrationCaveats: string[];
  qaReady: boolean;
}

// Static connector registry — extend as connectors are added
const connectors: ConnectorInfo[] = [
  {
    key: 'hubspot',
    name: 'HubSpot',
    description: 'Two-way sync via API. Supports companies, contacts, deals, and notes.',
    fieldNotes: [
      'Companies → Opportunities (org name, domain, lifecycle stage)',
      'Contacts → People (name, email, phone, title, company association)',
      'Deals → Pipeline entries (deal name, amount, stage, close date)',
      'Notes → Reflections (body text, associated contact/company)',
    ],
    migrationCaveats: [
      'HubSpot lifecycle stages do not map 1:1 to CROS journey stages — manual review needed',
      'Custom properties are ignored by default; add explicit mappings if needed',
      'Rate limited to 100 requests per 10 seconds on free tier',
    ],
    qaReady: true,
  },
  {
    key: 'salesforce',
    name: 'Salesforce',
    description: 'One-way import via CSV export. Supports accounts, contacts, opportunities.',
    csvTemplate: 'Account Name, Website, Phone, Industry, Type\nContact First Name, Last Name, Email, Phone, Title, Account Name',
    fieldNotes: [
      'Accounts → Opportunities (name, website, phone, industry → partner_tier)',
      'Contacts → People (name, email, phone, title, account association)',
      'Opportunities → Pipeline (name, amount, stage, close date)',
    ],
    migrationCaveats: [
      'CSV exports may include picklist values that need normalization',
      'Account-Contact relationships rely on matching Account Name strings',
      'Duplicate detection uses domain and email matching',
    ],
    qaReady: true,
  },
  {
    key: 'bloomerang',
    name: 'Bloomerang',
    description: 'One-way import via CSV. Donor and constituent data.',
    fieldNotes: [
      'Constituents → People (name, email, phone, address)',
      'Interactions → Activities (type, date, notes)',
    ],
    migrationCaveats: [
      'Bloomerang exports use "Constituent ID" as unique identifier',
      'Donation data is ignored — CROS is not a donor management system',
      'Address fields are concatenated into a single notes field',
    ],
    qaReady: false,
  },
  {
    key: 'airtable',
    name: 'Airtable',
    description: 'One-way import via CSV. Flexible schema mapping.',
    fieldNotes: [
      'User must map Airtable columns to CROS fields manually',
      'Linked records become text references (not relational)',
    ],
    migrationCaveats: [
      'Airtable field types (attachment, multi-select) need flattening',
      'Empty rows are common in Airtable exports — filter before import',
    ],
    qaReady: false,
  },
  {
    key: 'flocknote',
    name: 'Flocknote',
    description: 'CSV import for faith community contact lists.',
    csvTemplate: 'First Name, Last Name, Email, Phone, Group',
    fieldNotes: [
      'Groups → tag on People records',
      'No org-level data — all contacts are individual',
    ],
    migrationCaveats: [
      'Group memberships become comma-separated tags',
      'Phone format varies widely — normalization required',
    ],
    qaReady: true,
  },
  {
    key: 'csv_generic',
    name: 'Generic CSV',
    description: 'Manual CSV upload with column mapping wizard.',
    fieldNotes: [
      'User maps columns to: name, email, phone, organization, title, notes',
      'Unmapped columns are stored in a metadata JSONB field',
    ],
    migrationCaveats: [
      '50,000 row limit enforced',
      'Duplicate detection uses email as primary key',
      'Date columns must be ISO 8601 or MM/DD/YYYY',
    ],
    qaReady: true,
  },
  {
    key: 'google_contacts',
    name: 'Google Contacts',
    description: 'Two-way sync via Google People API. Contacts, groups, labels.',
    fieldNotes: [
      'Contacts → People (name, email, phone, organization)',
      'Contact Groups → Tags',
      'Labels → metadata tags',
    ],
    migrationCaveats: [
      'OAuth2 requires Google Cloud project setup',
      'Personal vs. organizational contacts treated the same',
      'Rate limited to 90 requests per minute',
    ],
    qaReady: false,
  },
  {
    key: 'outlook_contacts',
    name: 'Microsoft Outlook Contacts',
    description: 'Two-way sync via Microsoft Graph. Contacts, folders, categories.',
    fieldNotes: [
      'Contacts → People (name, email, phone, company, title)',
      'Contact Folders → Tags',
      'Categories → metadata tags',
    ],
    migrationCaveats: [
      'Azure AD app registration required',
      'Admin consent needed for organizational accounts',
      'Contacts.ReadWrite permission required for two-way sync',
    ],
    qaReady: false,
  },
  {
    key: 'apple_contacts',
    name: 'Apple Contacts / iCloud',
    description: 'vCard export from iCloud. No live API — manual re-import.',
    csvTemplate: 'Export as vCard (.vcf) from icloud.com/contacts',
    fieldNotes: [
      'vCard contacts → People (name, email, phone, address)',
      'Contact groups → Tags',
    ],
    migrationCaveats: [
      'No public API — manual export required',
      'vCard v3 and v4 formats both supported',
      'Photos are not imported',
    ],
    qaReady: false,
  },
  {
    key: 'monicacrm',
    name: 'Monica CRM',
    description: 'One-way import via API. Personal relationship data.',
    fieldNotes: [
      'Contacts → People (name, email, phone, relationships)',
      'Activities → Activities (type, date, notes)',
      'Notes → Reflections (body text, contact association)',
      'Reminders → Tasks',
    ],
    migrationCaveats: [
      'Self-hosted users must provide their instance URL',
      'Relationship types mapped to CROS journey stages manually',
      'Debt records are ignored',
    ],
    qaReady: false,
  },
  {
    key: 'contactsplus',
    name: 'Contacts+',
    description: 'One-way import via API. Unified address book.',
    fieldNotes: [
      'Contacts → People (name, email, phone, social profiles)',
      'Tags → Tags on People records',
      'Companies → Opportunities (company name, domain)',
    ],
    migrationCaveats: [
      'Paid plan may be required for API access',
      'Social profile URLs stored as metadata',
      'Duplicate contacts are common — dedup recommended',
    ],
    qaReady: false,
  },
  {
    key: 'civicrm',
    name: 'CiviCRM',
    description: 'Two-way sync via APIv4. Contacts, activities, events, cases, volunteers. Contributions read-only.',
    fieldNotes: [
      'Contact (Individual) → People (name, email, phone, address)',
      'Contact (Organization) → Opportunities (org name, domain)',
      'Activity → Activities (type, date, subject, notes)',
      'Event / Participant → Events & attendance',
      'Note (private) → Reflections (body text, contact association)',
      'CiviVolunteer → Volunteers (if extension installed)',
      'Case → Journey chapters (case type, status, roles)',
      'Group / Tag → Tags on People records',
      'Contribution → read-only donation context (amount, date, fund)',
    ],
    migrationCaveats: [
      'Requires CiviCRM v5.36+ with AuthX support',
      'Dedicated API user must be created with correct CMS permissions',
      'Contribution/payment data is strictly read-only — CROS never modifies financial records',
      'CiviVolunteer extension must be installed separately if volunteer sync is needed',
      'Custom fields require explicit mapping — not imported by default',
      'WordPress and Drupal CMS have slightly different permission setup paths',
    ],
    qaReady: false,
  },
];

export default function OperatorNexusIntegrations() {
  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif">Relatio Integration Registry</h1>
        <p className="text-sm text-muted-foreground">
          Internal reference for all connectors — field mappings, CSV templates, migration caveats, and QA readiness.
        </p>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {connectors.map((c) => (
          <AccordionItem key={c.key} value={c.key} className="border rounded-lg px-1">
            <AccordionTrigger className="hover:no-underline py-3 px-3">
              <div className="flex items-center gap-3 text-left w-full">
                <div className="p-1.5 rounded-md bg-muted shrink-0">
                  <Plug className="w-4 h-4 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{c.description}</span>
                </div>
                <Badge variant="outline" className={`shrink-0 text-xs ${c.qaReady ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  {c.qaReady ? 'QA Ready' : 'Needs QA'}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-4 space-y-4">
              <p className="text-sm text-muted-foreground">{c.description}</p>

              {c.csvTemplate && (
                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                    <FileSpreadsheet className="w-3 h-3" /> CSV Template
                  </h4>
                  <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap font-mono">
                    {c.csvTemplate}
                  </pre>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Field Mappings</h4>
                <ul className="space-y-1">
                  {c.fieldNotes.map((note, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary shrink-0">•</span>{note}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Migration Caveats
                </h4>
                <ul className="space-y-1">
                  {c.migrationCaveats.map((caveat, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-amber-500 shrink-0">⚠</span>{caveat}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {c.qaReady ? (
                  <><CheckCircle2 className="w-3 h-3 text-green-500" /> QA smoke test fixtures available</>
                ) : (
                  <><AlertCircle className="w-3 h-3 text-amber-500" /> QA smoke test fixtures not yet created</>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
