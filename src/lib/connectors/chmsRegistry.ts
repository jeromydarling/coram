/**
 * chmsRegistry — Registry of Church Management System connectors for Relatio.
 *
 * WHAT: Defines supported ChMS platforms, their auth methods, polling cadence, and domains.
 * WHERE: Used by NarrativeCompanionSetupCard, Settings integrations, relatio-sync-runner.
 * WHY: CROS acts as a silent Narrative Companion — never a replacement CRM.
 */

export interface ChmsConnectorConfig {
  label: string;
  description: string;
  auth: 'api_key' | 'oauth2' | 'oauth1' | 'csv_only';
  polling: 'nightly' | 'hourly' | '5min' | 'daily' | 'manual';
  webhook?: boolean;
  domains: string[];
  rateLimit?: number;
  icon: string;
  /** full = API sync + narrative signals, partial = contacts + activities, minimal = CSV migration only */
  coverageMode: 'full' | 'partial' | 'minimal';
}

export const CHMS_CONNECTORS: Record<string, ChmsConnectorConfig> = {
  parishsoft: {
    label: 'ParishSoft',
    description: 'Catholic parish management — families, members, constituents.',
    auth: 'api_key',
    polling: 'nightly',
    domains: ['households', 'members', 'constituents'],
    rateLimit: 100,
    icon: 'church',
    coverageMode: 'partial',
  },
  ministryplatform: {
    label: 'MinistryPlatform',
    description: 'Full-spectrum ministry management — contacts, households, events.',
    auth: 'oauth2',
    polling: 'hourly',
    domains: ['events', 'households', 'people', 'groups'],
    icon: 'building-2',
    coverageMode: 'full',
  },
  planningcenter: {
    label: 'Planning Center',
    description: 'People, households, check-ins, services, and calendars.',
    auth: 'oauth2',
    polling: '5min',
    webhook: true,
    domains: ['people', 'households', 'groups', 'check_ins', 'services'],
    rateLimit: 100,
    icon: 'calendar',
    coverageMode: 'full',
  },
  rock: {
    label: 'Rock RMS',
    description: 'Open-source church management — people, groups, events.',
    auth: 'api_key',
    polling: 'hourly',
    domains: ['people', 'groups', 'households', 'events'],
    icon: 'mountain',
    coverageMode: 'full',
  },
  breeze: {
    label: 'Breeze ChMS',
    description: 'Simple church management — people, families, events.',
    auth: 'api_key',
    polling: 'daily',
    domains: ['people', 'families', 'events', 'tags'],
    rateLimit: 20,
    icon: 'wind',
    coverageMode: 'full',
  },
  fellowshipone: {
    label: 'FellowshipOne',
    description: 'Ministry management — people, households, activities.',
    auth: 'oauth1',
    polling: 'hourly',
    domains: ['people', 'households', 'activities', 'events'],
    icon: 'users',
    coverageMode: 'full',
  },
  pushpay: {
    label: 'Pushpay / Church Community Builder',
    description: 'People, groups, events, attendance, giving — via the CCB API.',
    auth: 'api_key',
    polling: 'hourly',
    domains: ['people', 'groups', 'events', 'attendance', 'giving'],
    rateLimit: 120,
    icon: 'church',
    coverageMode: 'full',
  },
  salesforce: {
    label: 'Salesforce',
    description: 'The world\'s most popular CRM — contacts, accounts, opportunities, tasks.',
    auth: 'oauth2',
    polling: 'hourly',
    domains: ['contacts', 'accounts', 'opportunities', 'tasks', 'events', 'notes'],
    rateLimit: 100,
    icon: 'cloud',
    coverageMode: 'full',
  },
  hubspot: {
    label: 'HubSpot',
    description: 'Marketing & CRM platform — contacts, companies, deals, activities.',
    auth: 'api_key',
    polling: 'hourly',
    domains: ['contacts', 'companies', 'deals', 'tickets', 'activities'],
    rateLimit: 500,
    icon: 'target',
    coverageMode: 'full',
  },
  airtable: {
    label: 'Airtable',
    description: 'Flexible database platform — any table structure, records, and relationships.',
    auth: 'api_key',
    polling: 'daily',
    webhook: true,
    domains: ['records', 'tables', 'relationships', 'attachments'],
    rateLimit: 5,
    icon: 'table',
    coverageMode: 'partial',
  },
  bloomerang: {
    label: 'Bloomerang',
    description: 'Donor CRM — constituents, donations, interactions, and campaigns.',
    auth: 'api_key',
    polling: 'daily',
    domains: ['constituents', 'donations', 'interactions', 'campaigns', 'funds'],
    icon: 'heart',
    coverageMode: 'full',
  },
  neoncrm: {
    label: 'NeonCRM',
    description: 'Nonprofit CRM — accounts, donations, events, memberships, and volunteers.',
    auth: 'api_key',
    polling: 'daily',
    webhook: true,
    domains: ['accounts', 'donations', 'events', 'memberships', 'households', 'volunteers'],
    icon: 'sparkles',
    coverageMode: 'full',
  },
  lgl: {
    label: 'Little Green Light',
    description: 'Donor management — constituents, gifts, appeals, and groups.',
    auth: 'api_key',
    polling: 'daily',
    domains: ['constituents', 'gifts', 'appeals', 'groups', 'notes'],
    icon: 'leaf',
    coverageMode: 'partial',
  },
  donorperfect: {
    label: 'DonorPerfect',
    description: 'Fundraising software — donors, gifts, pledges, and contacts (XML API).',
    auth: 'api_key',
    polling: 'daily',
    domains: ['donors', 'gifts', 'pledges', 'contacts'],
    icon: 'gem',
    coverageMode: 'partial',
  },
  kindful: {
    label: 'Kindful',
    description: 'Nonprofit CRM — contacts, transactions, campaigns, and groups.',
    auth: 'oauth2',
    polling: 'daily',
    domains: ['contacts', 'transactions', 'campaigns', 'groups', 'pledges'],
    icon: 'hand-heart',
    coverageMode: 'partial',
  },
  virtuous: {
    label: 'Virtuous CRM',
    description: 'Responsive fundraising platform — contacts, gifts, projects, and automation.',
    auth: 'api_key',
    polling: 'daily',
    domains: ['contacts', 'gifts', 'projects', 'tasks', 'notes'],
    rateLimit: 500,
    icon: 'heart-handshake',
    coverageMode: 'full',
  },
  zoho: {
    label: 'Zoho CRM',
    description: 'General CRM — contacts, accounts, deals, activities, and custom modules.',
    auth: 'oauth2',
    polling: 'hourly',
    domains: ['contacts', 'accounts', 'deals', 'activities', 'notes'],
    rateLimit: 100,
    icon: 'zap',
    coverageMode: 'full',
  },
  fluentcrm: {
    label: 'FluentCRM',
    description: 'Self-hosted WordPress email marketing & contact management — lists, tags, automations.',
    auth: 'api_key',
    polling: 'daily',
    domains: ['contacts', 'lists', 'tags', 'campaigns', 'companies'],
    rateLimit: 60,
    icon: 'mail',
    coverageMode: 'partial',
  },
  jetpackcrm: {
    label: 'Jetpack CRM',
    description: 'Lightweight WordPress CRM by Automattic — contacts, invoices, transactions, events.',
    auth: 'api_key',
    polling: 'daily',
    domains: ['contacts', 'transactions', 'invoices', 'events', 'quotes'],
    rateLimit: 60,
    icon: 'rocket',
    coverageMode: 'partial',
  },
  wperp: {
    label: 'WP ERP',
    description: 'WordPress ERP suite — CRM contacts, companies, activity logs, and lifecycle stages.',
    auth: 'api_key',
    polling: 'daily',
    domains: ['contacts', 'companies', 'activities', 'groups'],
    rateLimit: 30,
    icon: 'briefcase',
    coverageMode: 'partial',
  },
  shelbynext: {
    label: 'ShelbyNext Membership',
    description: 'Church management — members, families, groups, giving. CSV export only.',
    auth: 'csv_only',
    polling: 'manual',
    domains: ['members', 'families', 'groups', 'contributions'],
    icon: 'file-spreadsheet',
    coverageMode: 'minimal',
  },
  servantkeeper: {
    label: 'Servant Keeper',
    description: 'Church management — members, families, attendance, giving. CSV export only.',
    auth: 'csv_only',
    polling: 'manual',
    domains: ['members', 'families', 'attendance', 'contributions'],
    icon: 'file-spreadsheet',
    coverageMode: 'minimal',
  },
  wildapricot: {
    label: 'Wild Apricot',
    description: 'Cloud membership management by Personify — contacts, events, memberships, donations.',
    auth: 'oauth2',
    polling: 'daily',
    domains: ['contacts', 'events', 'memberships', 'donations', 'invoices'],
    rateLimit: 60,
    icon: 'flower-2',
    coverageMode: 'full',
  },
  oracle: {
    label: 'Oracle CRM',
    description: 'Enterprise CRM (Oracle CX Cloud) — contacts, accounts, opportunities, activities, campaigns.',
    auth: 'oauth2',
    polling: 'hourly',
    domains: ['contacts', 'accounts', 'opportunities', 'activities', 'campaigns', 'households', 'notes'],
    rateLimit: 500,
    icon: 'database',
    coverageMode: 'full',
  },
  blackbaud: {
    label: 'Blackbaud RE NXT',
    description: 'Fundraising & constituent management — constituents, gifts, actions, events, notes via SKY API.',
    auth: 'oauth2',
    polling: 'hourly',
    webhook: true,
    domains: ['constituents', 'gifts', 'actions', 'events', 'notes', 'households', 'campaigns'],
    rateLimit: 500,
    icon: 'heart-handshake',
    coverageMode: 'full',
  },
  google_contacts: {
    label: 'Google Contacts',
    description: 'Personal & organizational contacts via Google People API — contacts, groups, labels.',
    auth: 'oauth2',
    polling: 'daily',
    domains: ['contacts', 'groups', 'labels'],
    rateLimit: 90,
    icon: 'mail',
    coverageMode: 'partial',
  },
  outlook_contacts: {
    label: 'Microsoft Outlook Contacts',
    description: 'Outlook / Microsoft 365 contacts via Microsoft Graph API — contacts, folders, categories.',
    auth: 'oauth2',
    polling: 'daily',
    domains: ['contacts', 'folders', 'categories'],
    rateLimit: 100,
    icon: 'mail',
    coverageMode: 'partial',
  },
  apple_contacts: {
    label: 'Apple Contacts / iCloud',
    description: 'Apple Contacts via vCard export from iCloud — contacts, groups. No public API — CSV/vCard migration only.',
    auth: 'csv_only',
    polling: 'manual',
    domains: ['contacts', 'groups'],
    icon: 'smartphone',
    coverageMode: 'minimal',
  },
  monicacrm: {
    label: 'Monica CRM',
    description: 'Open-source personal relationship manager — contacts, activities, notes, reminders, debts.',
    auth: 'api_key',
    polling: 'daily',
    domains: ['contacts', 'activities', 'notes', 'reminders', 'tasks'],
    rateLimit: 60,
    icon: 'heart',
    coverageMode: 'partial',
  },
  contactsplus: {
    label: 'Contacts+',
    description: 'Unified address book — contacts, tags, notes, social profiles. Formerly FullContact.',
    auth: 'api_key',
    polling: 'daily',
    domains: ['contacts', 'tags', 'notes', 'companies'],
    rateLimit: 60,
    icon: 'contact',
    coverageMode: 'partial',
  },
  civicrm: {
    label: 'CiviCRM',
    description: 'Open-source nonprofit CRM — contacts, activities, events, cases, contributions (read-only), volunteers via APIv4.',
    auth: 'api_key',
    polling: 'hourly',
    domains: ['contacts', 'activities', 'events', 'cases', 'contributions', 'groups', 'tags', 'volunteers'],
    rateLimit: 100,
    icon: 'heart-handshake',
    coverageMode: 'full',
  },
};

export type ChmsConnectorKey = keyof typeof CHMS_CONNECTORS;

/**
 * Returns human-friendly connector name.
 */
export function getConnectorLabel(key: string): string {
  return CHMS_CONNECTORS[key]?.label ?? key;
}

/**
 * Returns all connector keys suitable for a given archetype.
 * Church/ministry archetypes see all. Others see a subset.
 */
export function getConnectorsForArchetype(archetype?: string | null): string[] {
  const churchArchetypes = ['church', 'ministry_outreach'];
  const crmKeys = ['salesforce', 'hubspot', 'airtable', 'zoho', 'virtuous', 'oracle', 'blackbaud', 'civicrm'];
  const personalKeys = ['google_contacts', 'outlook_contacts', 'apple_contacts', 'monicacrm', 'contactsplus'];
  const wpKeys = ['fluentcrm', 'jetpackcrm', 'wperp'];
  const nonprofitKeys = ['bloomerang', 'neoncrm', 'lgl', 'donorperfect', 'kindful', 'wildapricot'];
  if (archetype && churchArchetypes.includes(archetype)) {
    return Object.keys(CHMS_CONNECTORS);
  }
  // Non-church orgs see generic connectors + CRM + WordPress + nonprofit donor platforms + personal
  return ['planningcenter', 'rock', 'breeze', ...crmKeys, ...wpKeys, ...nonprofitKeys, ...personalKeys];
}

/** Returns human-readable coverage label */
export function getCoverageLabel(mode: ChmsConnectorConfig['coverageMode']): string {
  switch (mode) {
    case 'full': return 'API Sync';
    case 'partial': return 'Partial Sync';
    case 'minimal': return 'CSV Migration';
  }
}

/** Returns coverage mode badge color class */
export function getCoverageColor(mode: ChmsConnectorConfig['coverageMode']): string {
  switch (mode) {
    case 'full': return 'bg-emerald-100 text-emerald-700';
    case 'partial': return 'bg-amber-100 text-amber-700';
    case 'minimal': return 'bg-slate-100 text-slate-600';
  }
}
