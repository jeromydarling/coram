/**
 * Salesforce Connector Adapter
 * 
 * WHAT: Normalizes Salesforce CSV export data to CROS entities.
 * WHERE: Migration harness + fixture pack tests.
 * WHY: Deterministic, testable mapping from Salesforce objects to CROS spine.
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

export const salesforceAdapter: ConnectorAdapter = {
  key: 'salesforce',
  displayName: 'Salesforce',

  normalizeAccount(raw) {
    const warnings: MappingWarning[] = [];
    const name = String(raw.Name ?? raw.name ?? '').trim();
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Account missing Name', field: 'Name' });
      return { result: null, warnings };
    }

    const state = normalizeState(raw.BillingState);
    if (raw.BillingState && state !== String(raw.BillingState).trim()) {
      warnings.push({ type: 'normalization', message: `State normalized: ${raw.BillingState} → ${state}`, field: 'BillingState' });
    }

    return {
      result: {
        external_id: String(raw.Id ?? ''),
        organization: name,
        website_url: raw.Website ? String(raw.Website) : null,
        phone: raw.Phone ? String(raw.Phone) : null,
        address: raw.BillingStreet ? String(raw.BillingStreet) : null,
        city: raw.BillingCity ? String(raw.BillingCity) : null,
        state,
        postal_code: raw.BillingPostalCode ? String(raw.BillingPostalCode) : null,
        description: safeSnippet(raw.Description),
        org_type: raw.Type ? String(raw.Type) : null,
        industry: raw.Industry ? String(raw.Industry) : null,
      },
      warnings,
    };
  },

  normalizeContact(raw) {
    const warnings: MappingWarning[] = [];
    const first = String(raw.FirstName ?? raw.first_name ?? '').trim();
    const last = String(raw.LastName ?? raw.last_name ?? '').trim();
    const name = [first, last].filter(Boolean).join(' ');
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Contact missing name fields', field: 'Name' });
      return { result: null, warnings };
    }

    if (!raw.AccountId && !raw.account_id) {
      warnings.push({ type: 'orphan_contact', message: `Contact "${name}" has no AccountId — will be placed in Unlinked bucket` });
    }

    const title = raw.Title ? String(raw.Title).trim() : null;
    if (title === '(no title)') {
      warnings.push({ type: 'normalization', message: `Placeholder title removed for "${name}"`, field: 'Title' });
    }

    return {
      result: {
        external_id: String(raw.Id ?? ''),
        account_external_id: raw.AccountId ? String(raw.AccountId) : (raw.account_id ? String(raw.account_id) : null),
        name,
        email: raw.Email ? String(raw.Email).toLowerCase().trim() : null,
        phone: raw.Phone ? String(raw.Phone) : null,
        title: title === '(no title)' ? null : title,
        city: raw.MailingCity ? String(raw.MailingCity) : null,
        state: normalizeState(raw.MailingState),
      },
      warnings,
    };
  },

  normalizeTask(raw) {
    const warnings: MappingWarning[] = [];
    const subject = String(raw.Subject ?? '').trim();
    if (!subject) {
      warnings.push({ type: 'missing_required', message: 'Task missing Subject', field: 'Subject' });
      return { result: null, warnings };
    }

    const { date, warning } = normalizeDate(raw.ActivityDate);
    if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'ActivityDate', value: String(raw.ActivityDate) });

    return {
      result: {
        external_id: String(raw.Id ?? ''),
        contact_external_id: raw.WhoId ? String(raw.WhoId) : null,
        account_external_id: raw.WhatId ? String(raw.WhatId) : null,
        title: subject,
        status: raw.Status ? String(raw.Status) : null,
        priority: raw.Priority ? String(raw.Priority) : null,
        due_date: date,
        description: safeSnippet(raw.Description),
      },
      warnings,
    };
  },

  normalizeEvent(raw) {
    const warnings: MappingWarning[] = [];
    const subject = String(raw.Subject ?? '').trim();
    if (!subject) {
      warnings.push({ type: 'missing_required', message: 'Event missing Subject', field: 'Subject' });
      return { result: null, warnings };
    }

    const { date: start, warning: sw } = normalizeDate(raw.StartDateTime);
    if (sw) warnings.push({ type: 'invalid_date', message: sw, field: 'StartDateTime' });
    const { date: end, warning: ew } = normalizeDate(raw.EndDateTime);
    if (ew) warnings.push({ type: 'invalid_date', message: ew, field: 'EndDateTime' });

    return {
      result: {
        external_id: String(raw.Id ?? ''),
        contact_external_id: raw.WhoId ? String(raw.WhoId) : null,
        account_external_id: raw.WhatId ? String(raw.WhatId) : null,
        event_name: subject,
        start_date: start,
        end_date: end,
        location: raw.Location ? String(raw.Location) : null,
        description: safeSnippet(raw.Description),
      },
      warnings,
    };
  },

  normalizeActivity(raw) {
    const warnings: MappingWarning[] = [];
    const title = String(raw.Title ?? '').trim();
    if (!title) {
      warnings.push({ type: 'missing_required', message: 'Note missing Title', field: 'Title' });
      return { result: null, warnings };
    }

    const { date, warning } = normalizeDate(raw.CreatedDate);
    if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'CreatedDate' });

    return {
      result: {
        external_id: String(raw.Id ?? ''),
        parent_external_id: raw.ParentId ? String(raw.ParentId) : null,
        title,
        body_snippet: safeSnippet(raw.Body),
        created_date: date,
      },
      warnings,
    };
  },
};
