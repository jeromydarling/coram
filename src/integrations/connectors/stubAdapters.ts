/**
 * Stub Connector Adapters
 *
 * WHAT: Minimal ConnectorAdapter stubs for registered connectors without full implementations.
 * WHERE: Migration harness, dry-run validation, registry completeness checks.
 * WHY: Every registered connector should have a testable adapter — stubs use generic field guessing.
 */

import type {
  ConnectorAdapter,
  NormalizedAccount,
  NormalizedContact,
  NormalizedTask,
  NormalizedEvent,
  NormalizedActivity,
  MappingWarning,
} from './types';
import { normalizeDate, safeSnippet, normalizeState } from './types';

function str(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v);
}

function createStubAdapter(key: string, displayName: string): ConnectorAdapter {
  return {
    key,
    displayName,

    normalizeAccount(raw) {
      const warnings: MappingWarning[] = [];
      const name = String(raw.Name ?? raw.name ?? raw.organization ?? raw.company ?? '').trim();
      if (!name) {
        warnings.push({ type: 'missing_required', message: `${displayName}: Account missing name`, field: 'name' });
        return { result: null, warnings };
      }
      const result: NormalizedAccount = {
        external_id: String(raw.Id ?? raw.id ?? ''),
        organization: name,
        website_url: str(raw.Website ?? raw.website),
        phone: str(raw.Phone ?? raw.phone),
        address: str(raw.Address ?? raw.address ?? raw.street),
        city: str(raw.City ?? raw.city),
        state: normalizeState(raw.State ?? raw.state),
        postal_code: str(raw.PostalCode ?? raw.postal_code ?? raw.zip),
        description: safeSnippet(raw.Description ?? raw.description ?? raw.notes),
        org_type: str(raw.Type ?? raw.type),
        industry: str(raw.Industry ?? raw.industry ?? raw.sector),
      };
      return { result, warnings };
    },

    normalizeContact(raw) {
      const warnings: MappingWarning[] = [];
      const first = String(raw.FirstName ?? raw.first_name ?? raw.fname ?? '').trim();
      const last = String(raw.LastName ?? raw.last_name ?? raw.lname ?? '').trim();
      const name = [first, last].filter(Boolean).join(' ') || String(raw.Name ?? raw.name ?? '').trim();
      if (!name) {
        warnings.push({ type: 'missing_required', message: `${displayName}: Contact missing name`, field: 'name' });
        return { result: null, warnings };
      }
      const acctId = raw.AccountId ?? raw.account_id ?? raw.company_id ?? raw.company ?? null;
      if (!acctId) {
        warnings.push({ type: 'orphan_contact', message: `${displayName}: Contact "${name}" has no account link` });
      }
      const emailRaw = raw.Email ?? raw.email;
      const result: NormalizedContact = {
        external_id: String(raw.Id ?? raw.id ?? ''),
        account_external_id: acctId ? String(acctId) : null,
        name,
        email: emailRaw ? String(emailRaw).toLowerCase().trim() : null,
        phone: str(raw.Phone ?? raw.phone),
        title: str(raw.Title ?? raw.title ?? raw.job_title),
        city: str(raw.City ?? raw.city),
        state: normalizeState(raw.State ?? raw.state),
      };
      return { result, warnings };
    },

    normalizeTask(raw) {
      const warnings: MappingWarning[] = [];
      const title = String(raw.Subject ?? raw.title ?? raw.name ?? '').trim();
      if (!title) {
        warnings.push({ type: 'missing_required', message: `${displayName}: Task missing title`, field: 'title' });
        return { result: null, warnings };
      }
      const { date, warning } = normalizeDate(raw.DueDate ?? raw.due_date ?? raw.ActivityDate);
      if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'due_date' });
      const result: NormalizedTask = {
        external_id: String(raw.Id ?? raw.id ?? ''),
        contact_external_id: str(raw.WhoId ?? raw.contact_id),
        account_external_id: str(raw.WhatId ?? raw.account_id),
        title,
        status: str(raw.Status ?? raw.status),
        priority: str(raw.Priority ?? raw.priority),
        due_date: date,
        description: safeSnippet(raw.Description ?? raw.description ?? raw.notes),
      };
      return { result, warnings };
    },

    normalizeEvent(raw) {
      const warnings: MappingWarning[] = [];
      const name = String(raw.Subject ?? raw.title ?? raw.event_name ?? raw.Name ?? '').trim();
      if (!name) {
        warnings.push({ type: 'missing_required', message: `${displayName}: Event missing name`, field: 'name' });
        return { result: null, warnings };
      }
      const { date: start, warning: sw } = normalizeDate(raw.StartDateTime ?? raw.start_date ?? raw.start);
      if (sw) warnings.push({ type: 'invalid_date', message: sw, field: 'start_date' });
      const { date: end, warning: ew } = normalizeDate(raw.EndDateTime ?? raw.end_date ?? raw.end);
      if (ew) warnings.push({ type: 'invalid_date', message: ew, field: 'end_date' });
      const result: NormalizedEvent = {
        external_id: String(raw.Id ?? raw.id ?? ''),
        contact_external_id: str(raw.WhoId ?? raw.contact_id),
        account_external_id: str(raw.WhatId ?? raw.account_id),
        event_name: name,
        start_date: start,
        end_date: end,
        location: str(raw.Location ?? raw.location),
        description: safeSnippet(raw.Description ?? raw.description ?? raw.notes),
      };
      return { result, warnings };
    },

    normalizeActivity(raw) {
      const warnings: MappingWarning[] = [];
      const title = String(raw.Title ?? raw.title ?? raw.Subject ?? raw.Name ?? '').trim();
      if (!title) {
        warnings.push({ type: 'missing_required', message: `${displayName}: Activity missing title`, field: 'title' });
        return { result: null, warnings };
      }
      const { date, warning } = normalizeDate(raw.CreatedDate ?? raw.created_at ?? raw.date);
      if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'created_at' });
      const result: NormalizedActivity = {
        external_id: String(raw.Id ?? raw.id ?? ''),
        parent_external_id: str(raw.ParentId ?? raw.contact_id ?? raw.account_id),
        title,
        body_snippet: safeSnippet(raw.Body ?? raw.body ?? raw.notes ?? raw.description),
        created_date: date,
      };
      return { result, warnings };
    },
  };
}

export const parishsoftAdapter = createStubAdapter('parishsoft', 'ParishSoft');
export const ministryplatformAdapter = createStubAdapter('ministryplatform', 'MinistryPlatform');
export const planningcenterAdapter = createStubAdapter('planningcenter', 'Planning Center');
export const rockAdapter = createStubAdapter('rock', 'Rock RMS');
export const breezeAdapter = createStubAdapter('breeze', 'Breeze ChMS');
export const fellowshiponeAdapter = createStubAdapter('fellowshipone', 'FellowshipOne');
export const pushpayAdapter = createStubAdapter('pushpay', 'Pushpay / CCB');
export const hubspotAdapter = createStubAdapter('hubspot', 'HubSpot');
export const bloomerangAdapter = createStubAdapter('bloomerang', 'Bloomerang');
export const neonCrmAdapter = createStubAdapter('neoncrm', 'NeonCRM');
export const lglAdapter = createStubAdapter('lgl', 'Little Green Light');
export const donorperfectAdapter = createStubAdapter('donorperfect', 'DonorPerfect');
export const kindfulAdapter = createStubAdapter('kindful', 'Kindful');
export const virtuousAdapter = createStubAdapter('virtuous', 'Virtuous CRM');
export const zohoAdapter = createStubAdapter('zoho', 'Zoho CRM');
export const shelbynextAdapter = createStubAdapter('shelbynext', 'ShelbyNext Membership');
export const servantkeeperAdapter = createStubAdapter('servantkeeper', 'Servant Keeper');
export const wildapricotAdapter = createStubAdapter('wildapricot', 'Wild Apricot');
export const oracleAdapter = createStubAdapter('oracle', 'Oracle CRM');
export const blackbaudAdapter = createStubAdapter('blackbaud', 'Blackbaud RE NXT');

/** Registry: all adapters keyed by connector key */
export const STUB_ADAPTERS: Record<string, ConnectorAdapter> = {
  parishsoft: parishsoftAdapter,
  ministryplatform: ministryplatformAdapter,
  planningcenter: planningcenterAdapter,
  rock: rockAdapter,
  breeze: breezeAdapter,
  fellowshipone: fellowshiponeAdapter,
  pushpay: pushpayAdapter,
  hubspot: hubspotAdapter,
  bloomerang: bloomerangAdapter,
  neoncrm: neonCrmAdapter,
  lgl: lglAdapter,
  donorperfect: donorperfectAdapter,
  kindful: kindfulAdapter,
  virtuous: virtuousAdapter,
  zoho: zohoAdapter,
  shelbynext: shelbynextAdapter,
  servantkeeper: servantkeeperAdapter,
  wildapricot: wildapricotAdapter,
  oracle: oracleAdapter,
  blackbaud: blackbaudAdapter,
};
