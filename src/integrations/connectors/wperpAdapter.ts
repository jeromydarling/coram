/**
 * WP ERP Connector Adapter
 *
 * WHAT: Normalizes WP ERP (WordPress) export/API data to CROS entities.
 * WHERE: Migration harness + fixture tests.
 * WHY: WordPress ERP suite — CRM contacts, companies, activity logs, lifecycle stages.
 */

import type {
  ConnectorAdapter,
  MappingWarning,
} from './types';
import { normalizeDate, safeSnippet, normalizeState } from './types';

export const wperpAdapter: ConnectorAdapter = {
  key: 'wperp',
  displayName: 'WP ERP',

  normalizeAccount(raw) {
    const warnings: MappingWarning[] = [];
    // WP ERP /crm/companies endpoint
    const name = String(raw.company ?? raw.name ?? '').trim();
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Company missing name', field: 'company' });
      return { result: null, warnings };
    }

    return {
      result: {
        external_id: String(raw.id ?? ''),
        organization: name,
        website_url: raw.website ? String(raw.website) : null,
        phone: raw.phone ? String(raw.phone) : (raw.mobile ? String(raw.mobile) : null),
        address: raw.street_1 ? String(raw.street_1) : null,
        city: raw.city ? String(raw.city) : null,
        state: normalizeState(raw.state),
        postal_code: raw.postal_code ? String(raw.postal_code) : null,
        description: safeSnippet(raw.notes ?? raw.description),
        org_type: raw.life_stage ? String(raw.life_stage) : null,
        industry: null,
      },
      warnings,
    };
  },

  normalizeContact(raw) {
    const warnings: MappingWarning[] = [];
    // WP ERP /crm/contacts endpoint: first_name, last_name, email
    const first = String(raw.first_name ?? '').trim();
    const last = String(raw.last_name ?? '').trim();
    const name = [first, last].filter(Boolean).join(' ');
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Contact missing name', field: 'first_name' });
      return { result: null, warnings };
    }

    if (!raw.company_id && !raw.company) {
      warnings.push({ type: 'orphan_contact', message: `Contact "${name}" has no company` });
    }

    return {
      result: {
        external_id: String(raw.id ?? ''),
        account_external_id: raw.company_id ? String(raw.company_id) : (raw.company ? String(raw.company) : null),
        name,
        email: raw.email ? String(raw.email).toLowerCase().trim() : null,
        phone: raw.phone ? String(raw.phone) : (raw.mobile ? String(raw.mobile) : null),
        title: raw.designation ? String(raw.designation) : null,
        city: raw.city ? String(raw.city) : null,
        state: normalizeState(raw.state),
      },
      warnings,
    };
  },

  normalizeTask(raw) {
    const warnings: MappingWarning[] = [];
    // WP ERP uses activities with type "task"
    const title = String(raw.log_type === 'task' ? (raw.message ?? raw.title ?? '') : (raw.title ?? '')).trim();
    if (!title) {
      warnings.push({ type: 'missing_required', message: 'Task missing title', field: 'title' });
      return { result: null, warnings };
    }

    const { date, warning } = normalizeDate(raw.start_date ?? raw.due_date);
    if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'start_date' });

    return {
      result: {
        external_id: String(raw.id ?? ''),
        contact_external_id: raw.contact_id ? String(raw.contact_id) : null,
        account_external_id: raw.company_id ? String(raw.company_id) : null,
        title,
        status: raw.status ? String(raw.status) : null,
        priority: raw.priority ? String(raw.priority) : null,
        due_date: date,
        description: safeSnippet(raw.extra ?? raw.message),
      },
      warnings,
    };
  },

  normalizeEvent(raw) {
    const warnings: MappingWarning[] = [];
    const name = String(raw.title ?? raw.message ?? '').trim();
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Event missing title', field: 'title' });
      return { result: null, warnings };
    }

    const { date: start, warning: sw } = normalizeDate(raw.start_date);
    if (sw) warnings.push({ type: 'invalid_date', message: sw, field: 'start_date' });
    const { date: end, warning: ew } = normalizeDate(raw.end_date);
    if (ew) warnings.push({ type: 'invalid_date', message: ew, field: 'end_date' });

    return {
      result: {
        external_id: String(raw.id ?? ''),
        contact_external_id: raw.contact_id ? String(raw.contact_id) : null,
        account_external_id: raw.company_id ? String(raw.company_id) : null,
        event_name: name,
        start_date: start,
        end_date: end,
        location: raw.location ? String(raw.location) : null,
        description: safeSnippet(raw.extra ?? raw.message),
      },
      warnings,
    };
  },

  normalizeActivity(raw) {
    const warnings: MappingWarning[] = [];
    // WP ERP /crm/activities endpoint
    const title = String(raw.message ?? raw.title ?? raw.log_type ?? '').trim();
    if (!title) {
      warnings.push({ type: 'missing_required', message: 'Activity missing title', field: 'message' });
      return { result: null, warnings };
    }

    const { date, warning } = normalizeDate(raw.created_at ?? raw.start_date);
    if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'created_at' });

    return {
      result: {
        external_id: String(raw.id ?? ''),
        parent_external_id: raw.contact_id ? String(raw.contact_id) : null,
        title,
        body_snippet: safeSnippet(raw.extra ?? raw.message),
        created_date: date,
      },
      warnings,
    };
  },
};
