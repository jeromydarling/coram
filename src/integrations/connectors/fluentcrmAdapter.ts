/**
 * FluentCRM Connector Adapter
 *
 * WHAT: Normalizes FluentCRM (WordPress) export/API data to CROS entities.
 * WHERE: Migration harness + fixture tests.
 * WHY: Self-hosted WordPress CRM — contacts, lists, tags, companies.
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

export const fluentcrmAdapter: ConnectorAdapter = {
  key: 'fluentcrm',
  displayName: 'FluentCRM',

  normalizeAccount(raw) {
    const warnings: MappingWarning[] = [];
    // FluentCRM "companies" endpoint: name, email, phone, address, etc.
    const name = String(raw.name ?? raw.company_name ?? '').trim();
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Company missing name', field: 'name' });
      return { result: null, warnings };
    }

    return {
      result: {
        external_id: String(raw.id ?? ''),
        organization: name,
        website_url: raw.website ? String(raw.website) : null,
        phone: raw.phone ? String(raw.phone) : null,
        address: raw.address_line_1 ? String(raw.address_line_1) : null,
        city: raw.city ? String(raw.city) : null,
        state: normalizeState(raw.state),
        postal_code: raw.postal_code ? String(raw.postal_code) : null,
        description: safeSnippet(raw.description ?? raw.note),
        org_type: raw.type ? String(raw.type) : null,
        industry: raw.industry ? String(raw.industry) : null,
      },
      warnings,
    };
  },

  normalizeContact(raw) {
    const warnings: MappingWarning[] = [];
    // FluentCRM subscribers: first_name, last_name, email, phone, etc.
    const first = String(raw.first_name ?? '').trim();
    const last = String(raw.last_name ?? '').trim();
    const name = [first, last].filter(Boolean).join(' ');
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Subscriber missing name', field: 'first_name' });
      return { result: null, warnings };
    }

    if (!raw.company_id) {
      warnings.push({ type: 'orphan_contact', message: `Contact "${name}" has no company_id` });
    }

    return {
      result: {
        external_id: String(raw.id ?? ''),
        account_external_id: raw.company_id ? String(raw.company_id) : null,
        name,
        email: raw.email ? String(raw.email).toLowerCase().trim() : null,
        phone: raw.phone ? String(raw.phone) : null,
        title: raw.job_title ? String(raw.job_title) : null,
        city: raw.city ? String(raw.city) : null,
        state: normalizeState(raw.state),
      },
      warnings,
    };
  },

  normalizeTask(raw) {
    const warnings: MappingWarning[] = [];
    // FluentCRM doesn't have native tasks — map from custom fields or notes
    const title = String(raw.title ?? raw.subject ?? '').trim();
    if (!title) {
      warnings.push({ type: 'missing_required', message: 'Task missing title', field: 'title' });
      return { result: null, warnings };
    }

    const { date, warning } = normalizeDate(raw.due_date ?? raw.scheduled_at);
    if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'due_date' });

    return {
      result: {
        external_id: String(raw.id ?? ''),
        contact_external_id: raw.subscriber_id ? String(raw.subscriber_id) : null,
        account_external_id: raw.company_id ? String(raw.company_id) : null,
        title,
        status: raw.status ? String(raw.status) : null,
        priority: raw.priority ? String(raw.priority) : null,
        due_date: date,
        description: safeSnippet(raw.description ?? raw.body),
      },
      warnings,
    };
  },

  normalizeEvent(raw) {
    const warnings: MappingWarning[] = [];
    const name = String(raw.title ?? raw.event_name ?? '').trim();
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Event missing title', field: 'title' });
      return { result: null, warnings };
    }

    const { date: start, warning: sw } = normalizeDate(raw.start_at ?? raw.start_date);
    if (sw) warnings.push({ type: 'invalid_date', message: sw, field: 'start_at' });
    const { date: end, warning: ew } = normalizeDate(raw.end_at ?? raw.end_date);
    if (ew) warnings.push({ type: 'invalid_date', message: ew, field: 'end_at' });

    return {
      result: {
        external_id: String(raw.id ?? ''),
        contact_external_id: raw.subscriber_id ? String(raw.subscriber_id) : null,
        account_external_id: raw.company_id ? String(raw.company_id) : null,
        event_name: name,
        start_date: start,
        end_date: end,
        location: raw.location ? String(raw.location) : null,
        description: safeSnippet(raw.description),
      },
      warnings,
    };
  },

  normalizeActivity(raw) {
    const warnings: MappingWarning[] = [];
    // FluentCRM track-event endpoint or activity log
    const title = String(raw.title ?? raw.event ?? raw.subject ?? '').trim();
    if (!title) {
      warnings.push({ type: 'missing_required', message: 'Activity missing title', field: 'title' });
      return { result: null, warnings };
    }

    const { date, warning } = normalizeDate(raw.created_at ?? raw.date);
    if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'created_at' });

    return {
      result: {
        external_id: String(raw.id ?? ''),
        parent_external_id: raw.subscriber_id ? String(raw.subscriber_id) : null,
        title,
        body_snippet: safeSnippet(raw.description ?? raw.body ?? raw.value),
        created_date: date,
      },
      warnings,
    };
  },
};
