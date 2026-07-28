/**
 * Jetpack CRM Connector Adapter
 *
 * WHAT: Normalizes Jetpack CRM (WordPress) export/API data to CROS entities.
 * WHERE: Migration harness + fixture tests.
 * WHY: Lightweight WordPress CRM by Automattic — contacts, transactions, events.
 */

import type {
  ConnectorAdapter,
  MappingWarning,
} from './types';
import { normalizeDate, safeSnippet, normalizeState } from './types';

export const jetpackcrmAdapter: ConnectorAdapter = {
  key: 'jetpackcrm',
  displayName: 'Jetpack CRM',

  normalizeAccount(raw) {
    const warnings: MappingWarning[] = [];
    // Jetpack CRM uses "companies" or contact-level company fields
    const name = String(raw.name ?? raw.company ?? raw.coname ?? '').trim();
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Company missing name', field: 'name' });
      return { result: null, warnings };
    }

    return {
      result: {
        external_id: String(raw.id ?? ''),
        organization: name,
        website_url: raw.homeurl ? String(raw.homeurl) : null,
        phone: raw.maintel ? String(raw.maintel) : null,
        address: raw.addr1 ? String(raw.addr1) : null,
        city: raw.city ? String(raw.city) : null,
        state: normalizeState(raw.county ?? raw.state),
        postal_code: raw.postcode ? String(raw.postcode) : null,
        description: safeSnippet(raw.notes),
        org_type: null,
        industry: null,
      },
      warnings,
    };
  },

  normalizeContact(raw) {
    const warnings: MappingWarning[] = [];
    // Jetpack CRM "customers" endpoint: fname, lname, email, etc.
    const first = String(raw.fname ?? raw.first_name ?? '').trim();
    const last = String(raw.lname ?? raw.last_name ?? '').trim();
    const name = [first, last].filter(Boolean).join(' ');
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Customer missing name', field: 'fname' });
      return { result: null, warnings };
    }

    if (!raw.company && !raw.coname) {
      warnings.push({ type: 'orphan_contact', message: `Contact "${name}" has no company` });
    }

    return {
      result: {
        external_id: String(raw.id ?? ''),
        account_external_id: raw.company ? String(raw.company) : (raw.coname ? String(raw.coname) : null),
        name,
        email: raw.email ? String(raw.email).toLowerCase().trim() : null,
        phone: raw.hometel ? String(raw.hometel) : (raw.worktel ? String(raw.worktel) : null),
        title: raw.jobTitle ? String(raw.jobTitle) : null,
        city: raw.city ? String(raw.city) : null,
        state: normalizeState(raw.county ?? raw.state),
      },
      warnings,
    };
  },

  normalizeTask(raw) {
    const warnings: MappingWarning[] = [];
    // Jetpack CRM "events" serve as tasks
    const title = String(raw.title ?? raw.name ?? '').trim();
    if (!title) {
      warnings.push({ type: 'missing_required', message: 'Task missing title', field: 'title' });
      return { result: null, warnings };
    }

    const { date, warning } = normalizeDate(raw.to ?? raw.end);
    if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'to' });

    return {
      result: {
        external_id: String(raw.id ?? ''),
        contact_external_id: raw.customer ? String(raw.customer) : null,
        account_external_id: null,
        title,
        status: raw.complete === 1 || raw.complete === '1' ? 'completed' : 'open',
        priority: null,
        due_date: date,
        description: safeSnippet(raw.notes ?? raw.desc),
      },
      warnings,
    };
  },

  normalizeEvent(raw) {
    const warnings: MappingWarning[] = [];
    const name = String(raw.title ?? raw.name ?? '').trim();
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Event missing title', field: 'title' });
      return { result: null, warnings };
    }

    const { date: start, warning: sw } = normalizeDate(raw.from ?? raw.start);
    if (sw) warnings.push({ type: 'invalid_date', message: sw, field: 'from' });
    const { date: end, warning: ew } = normalizeDate(raw.to ?? raw.end);
    if (ew) warnings.push({ type: 'invalid_date', message: ew, field: 'to' });

    return {
      result: {
        external_id: String(raw.id ?? ''),
        contact_external_id: raw.customer ? String(raw.customer) : null,
        account_external_id: null,
        event_name: name,
        start_date: start,
        end_date: end,
        location: null,
        description: safeSnippet(raw.notes ?? raw.desc),
      },
      warnings,
    };
  },

  normalizeActivity(raw) {
    const warnings: MappingWarning[] = [];
    // Jetpack CRM "transactions" or activity logs
    const title = String(raw.title ?? raw.ref ?? raw.desc ?? '').trim();
    if (!title) {
      warnings.push({ type: 'missing_required', message: 'Activity missing title', field: 'title' });
      return { result: null, warnings };
    }

    const { date, warning } = normalizeDate(raw.date ?? raw.created);
    if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'date' });

    return {
      result: {
        external_id: String(raw.id ?? ''),
        parent_external_id: raw.customer ? String(raw.customer) : null,
        title,
        body_snippet: safeSnippet(raw.notes ?? raw.desc),
        created_date: date,
      },
      warnings,
    };
  },
};
