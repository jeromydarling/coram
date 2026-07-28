/**
 * Airtable Connector Adapter
 * 
 * WHAT: Normalizes Airtable export data to CROS entities.
 * WHERE: Migration harness + fixture tests.
 * WHY: Proves the adapter pattern works across connectors.
 */

import type {
  ConnectorAdapter,
  MappingWarning,
} from './types';
import { normalizeDate, safeSnippet, normalizeState } from './types';

export const airtableAdapter: ConnectorAdapter = {
  key: 'airtable',
  displayName: 'Airtable',

  normalizeAccount(raw) {
    const warnings: MappingWarning[] = [];
    const name = String(raw['Organization Name'] ?? raw.Name ?? raw.name ?? '').trim();
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Record missing Name', field: 'Name' });
      return { result: null, warnings };
    }

    return {
      result: {
        external_id: String(raw.id ?? raw['Record ID'] ?? ''),
        organization: name,
        website_url: raw.Website ? String(raw.Website) : null,
        phone: raw.Phone ? String(raw.Phone) : null,
        address: raw.Address ? String(raw.Address) : null,
        city: raw.City ? String(raw.City) : null,
        state: normalizeState(raw.State),
        postal_code: raw['Zip Code'] ? String(raw['Zip Code']) : null,
        description: safeSnippet(raw.Notes ?? raw.Description),
        org_type: raw.Type ? String(raw.Type) : null,
        industry: raw.Sector ? String(raw.Sector) : null,
      },
      warnings,
    };
  },

  normalizeContact(raw) {
    const warnings: MappingWarning[] = [];
    const first = String(raw.FirstName ?? raw.first_name ?? '').trim();
    const last = String(raw.LastName ?? raw.last_name ?? '').trim();
    const name = [first, last].filter(Boolean).join(' ') || String(raw.Name ?? raw['Full Name'] ?? raw.name ?? '').trim();
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Contact missing Name', field: 'Name' });
      return { result: null, warnings };
    }

    if (!raw['Organization'] && !raw['Account'] && !raw['account_id'] && !raw['AccountId']) {
      warnings.push({ type: 'orphan_contact', message: `Contact "${name}" has no linked organization` });
    }

    return {
      result: {
        external_id: String(raw.id ?? raw['Record ID'] ?? ''),
        account_external_id: raw['Organization'] ? String(raw['Organization']) : (raw['Account'] ? String(raw['Account']) : (raw['account_id'] ? String(raw['account_id']) : (raw['AccountId'] ? String(raw['AccountId']) : null))),
        name,
        email: raw.Email ? String(raw.Email).toLowerCase().trim() : null,
        phone: raw.Phone ? String(raw.Phone) : null,
        title: raw.Title ? String(raw.Title) : null,
        city: raw.City ? String(raw.City) : null,
        state: normalizeState(raw.State),
      },
      warnings,
    };
  },

  normalizeTask(raw) {
    const warnings: MappingWarning[] = [];
    const title = String(raw.Name ?? raw.Task ?? raw.Title ?? '').trim();
    if (!title) {
      warnings.push({ type: 'missing_required', message: 'Task missing title', field: 'Name' });
      return { result: null, warnings };
    }

    const { date, warning } = normalizeDate(raw['Due Date'] ?? raw.Deadline);
    if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'Due Date' });

    return {
      result: {
        external_id: String(raw.id ?? raw['Record ID'] ?? ''),
        contact_external_id: raw.Assignee ? String(raw.Assignee) : null,
        account_external_id: raw.Organization ? String(raw.Organization) : null,
        title,
        status: raw.Status ? String(raw.Status) : null,
        priority: raw.Priority ? String(raw.Priority) : null,
        due_date: date,
        description: safeSnippet(raw.Notes ?? raw.Description),
      },
      warnings,
    };
  },

  normalizeEvent(raw) {
    const warnings: MappingWarning[] = [];
    const name = String(raw['Event Name'] ?? raw.Name ?? '').trim();
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Event missing name', field: 'Name' });
      return { result: null, warnings };
    }

    const { date: start, warning: sw } = normalizeDate(raw['Start Date'] ?? raw.Date);
    if (sw) warnings.push({ type: 'invalid_date', message: sw, field: 'Start Date' });
    const { date: end, warning: ew } = normalizeDate(raw['End Date']);
    if (ew) warnings.push({ type: 'invalid_date', message: ew, field: 'End Date' });

    return {
      result: {
        external_id: String(raw.id ?? raw['Record ID'] ?? ''),
        contact_external_id: null,
        account_external_id: raw.Organization ? String(raw.Organization) : null,
        event_name: name,
        start_date: start,
        end_date: end,
        location: raw.Location ? String(raw.Location) : null,
        description: safeSnippet(raw.Notes ?? raw.Description),
      },
      warnings,
    };
  },

  normalizeActivity(raw) {
    const warnings: MappingWarning[] = [];
    const title = String(raw.Title ?? raw.Subject ?? raw.Name ?? '').trim();
    if (!title) {
      warnings.push({ type: 'missing_required', message: 'Activity missing title', field: 'Title' });
      return { result: null, warnings };
    }

    const { date, warning } = normalizeDate(raw.Date ?? raw['Created Date']);
    if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'Date' });

    return {
      result: {
        external_id: String(raw.id ?? raw['Record ID'] ?? ''),
        parent_external_id: raw.Organization ? String(raw.Organization) : null,
        title,
        body_snippet: safeSnippet(raw.Notes ?? raw.Body),
        created_date: date,
      },
      warnings,
    };
  },
};
