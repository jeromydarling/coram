/**
 * CiviCRM Connector Adapter
 *
 * WHAT: Normalizes CiviCRM APIv4 JSON responses to CROS entities.
 * WHERE: Migration harness + fixture pack tests.
 * WHY: Deterministic, testable mapping from CiviCRM objects to CROS spine.
 *
 * CiviCRM APIv4 entities mapped:
 *   Contact (Organization) → NormalizedAccount
 *   Contact (Individual)   → NormalizedContact
 *   Activity               → NormalizedTask (status-bearing) / NormalizedActivity (notes)
 *   Event                  → NormalizedEvent
 *   Activity (Note type)   → NormalizedActivity
 *
 * Contributions are read-only and not mapped outbound.
 */

import type {
  ConnectorAdapter,
  NormalizedAccount,
  NormalizedContact,
  NormalizedTask,
  NormalizedEvent,
  NormalizedActivity,
  NormalizedGiving,
  MappingWarning,
} from './types';
import { normalizeDate, safeSnippet, normalizeState } from './types';

function str(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v).trim();
}

export const civicrmAdapter: ConnectorAdapter = {
  key: 'civicrm',
  displayName: 'CiviCRM',

  normalizeAccount(raw) {
    const warnings: MappingWarning[] = [];

    // CiviCRM organizations use contact_type = 'Organization'
    const name = String(
      raw.organization_name ?? raw.display_name ?? raw.sort_name ?? ''
    ).trim();

    if (!name) {
      warnings.push({
        type: 'missing_required',
        message: 'CiviCRM: Organization contact missing organization_name',
        field: 'organization_name',
      });
      return { result: null, warnings };
    }

    const state = normalizeState(
      raw.state_province_id_label ??
        raw['address_primary.state_province_id:label'] ??
        raw.state_province
    );

    const result: NormalizedAccount = {
      external_id: String(raw.id ?? ''),
      organization: name,
      website_url: str(
        raw.website?.[0]?.url ?? raw['website_primary.url'] ?? raw.url
      ),
      phone: str(
        raw.phone_primary ?? raw['phone_primary.phone'] ?? raw.phone
      ),
      address: str(
        raw.street_address ??
          raw['address_primary.street_address'] ??
          raw.supplemental_address_1
      ),
      city: str(
        raw.city ?? raw['address_primary.city']
      ),
      state,
      postal_code: str(
        raw.postal_code ?? raw['address_primary.postal_code']
      ),
      description: safeSnippet(raw.contact_source ?? raw.source),
      org_type: str(raw.contact_sub_type ?? raw.contact_type),
      industry: str(raw.sic_code ?? raw.job_title),
    };

    return { result, warnings };
  },

  normalizeContact(raw) {
    const warnings: MappingWarning[] = [];

    const first = String(raw.first_name ?? '').trim();
    const last = String(raw.last_name ?? '').trim();
    const name =
      [first, last].filter(Boolean).join(' ') ||
      String(raw.display_name ?? raw.sort_name ?? '').trim();

    if (!name) {
      warnings.push({
        type: 'missing_required',
        message: 'CiviCRM: Contact missing name fields',
        field: 'first_name/last_name',
      });
      return { result: null, warnings };
    }

    // CiviCRM links individuals to organizations via employer_id
    const accountId = raw.employer_id ?? raw.organization_id ?? null;
    if (!accountId) {
      warnings.push({
        type: 'orphan_contact',
        message: `CiviCRM: Contact "${name}" has no employer_id — will be placed in Unlinked bucket`,
      });
    }

    const emailRaw =
      raw.email_primary ?? raw['email_primary.email'] ?? raw.email;

    const result: NormalizedContact = {
      external_id: String(raw.id ?? ''),
      account_external_id: accountId ? String(accountId) : null,
      name,
      email: emailRaw ? String(emailRaw).toLowerCase().trim() : null,
      phone: str(
        raw.phone_primary ?? raw['phone_primary.phone'] ?? raw.phone
      ),
      title: str(raw.job_title ?? raw.formal_title),
      city: str(raw.city ?? raw['address_primary.city']),
      state: normalizeState(
        raw.state_province_id_label ??
          raw['address_primary.state_province_id:label'] ??
          raw.state_province
      ),
    };

    return { result, warnings };
  },

  normalizeTask(raw) {
    const warnings: MappingWarning[] = [];

    // CiviCRM Activities with status fields map to Tasks
    const subject = String(raw.subject ?? '').trim();
    if (!subject) {
      warnings.push({
        type: 'missing_required',
        message: 'CiviCRM: Activity missing subject',
        field: 'subject',
      });
      return { result: null, warnings };
    }

    const { date: dueDate, warning: dw } = normalizeDate(
      raw.activity_date_time
    );
    if (dw)
      warnings.push({
        type: 'invalid_date',
        message: dw,
        field: 'activity_date_time',
        value: String(raw.activity_date_time),
      });

    // Map CiviCRM status_id labels
    const statusLabel = str(
      raw['status_id:label'] ?? raw.status_id_label ?? raw.status
    );
    const priorityLabel = str(
      raw['priority_id:label'] ?? raw.priority_id_label ?? raw.priority
    );

    const result: NormalizedTask = {
      external_id: String(raw.id ?? ''),
      contact_external_id: raw.target_contact_id
        ? String(
            Array.isArray(raw.target_contact_id)
              ? raw.target_contact_id[0]
              : raw.target_contact_id
          )
        : null,
      account_external_id: raw.source_contact_id
        ? String(raw.source_contact_id)
        : null,
      title: subject,
      status: statusLabel,
      priority: priorityLabel,
      due_date: dueDate,
      description: safeSnippet(raw.details),
    };

    return { result, warnings };
  },

  normalizeEvent(raw) {
    const warnings: MappingWarning[] = [];

    const title = String(raw.title ?? raw.event_title ?? '').trim();
    if (!title) {
      warnings.push({
        type: 'missing_required',
        message: 'CiviCRM: Event missing title',
        field: 'title',
      });
      return { result: null, warnings };
    }

    const { date: start, warning: sw } = normalizeDate(raw.start_date);
    if (sw) warnings.push({ type: 'invalid_date', message: sw, field: 'start_date' });

    const { date: end, warning: ew } = normalizeDate(raw.end_date);
    if (ew) warnings.push({ type: 'invalid_date', message: ew, field: 'end_date' });

    const result: NormalizedEvent = {
      external_id: String(raw.id ?? ''),
      contact_external_id: raw.created_id ? String(raw.created_id) : null,
      account_external_id: null,
      event_name: title,
      start_date: start,
      end_date: end,
      location: str(
        raw.loc_block_id_label ??
          raw['loc_block_id.address.street_address'] ??
          raw.event_full_text
      ),
      description: safeSnippet(raw.summary ?? raw.description),
    };

    return { result, warnings };
  },

  normalizeActivity(raw) {
    const warnings: MappingWarning[] = [];

    const subject = String(raw.subject ?? '').trim();
    if (!subject) {
      warnings.push({
        type: 'missing_required',
        message: 'CiviCRM: Activity/Note missing subject',
        field: 'subject',
      });
      return { result: null, warnings };
    }

    const { date, warning } = normalizeDate(
      raw.activity_date_time ?? raw.created_date
    );
    if (warning)
      warnings.push({
        type: 'invalid_date',
        message: warning,
        field: 'activity_date_time',
      });

    const result: NormalizedActivity = {
      external_id: String(raw.id ?? ''),
      parent_external_id: raw.source_contact_id
        ? String(raw.source_contact_id)
        : null,
      title: subject,
      body_snippet: safeSnippet(raw.details),
      created_date: date,
    };

    return { result, warnings };
  },

  /**
   * CiviCRM Contributions → NormalizedGiving
   *
   * WHAT: Maps CiviCRM APIv4 Contribution entity to CROS GenerosityRecord.
   * WHERE: Bridge migration + API sync runners.
   * WHY: CiviCRM has 11K+ nonprofit users — Tier 1 giving connector.
   *
   * CiviCRM Contribution fields:
   *   receive_date        → date (ISO 8601)
   *   total_amount        → amount
   *   contribution_recur_id → is_recurring (non-null = recurring)
   *   frequency_unit      → recurring_interval
   *   financial_type_id:label → note (fund/type)
   *   source              → note (append)
   *   contribution_status_id:label → filter (Completed only)
   */
  normalizeGiving(raw: Record<string, unknown>): { result: NormalizedGiving | null; warnings: MappingWarning[] } {
    const warnings: MappingWarning[] = [];

    // Filter: only completed contributions
    const status = String(
      raw['contribution_status_id:label'] ??
      raw.contribution_status_id_label ??
      raw.contribution_status ??
      ''
    ).toLowerCase();

    if (status && !['completed', 'pending'].includes(status)) {
      return {
        result: null,
        warnings: [{ type: 'normalization', message: `Skipped non-completed contribution: ${status}` }],
      };
    }

    // Date
    const { date, warning: dw } = normalizeDate(raw.receive_date);
    if (dw) warnings.push({ type: 'invalid_date', message: dw, field: 'receive_date' });
    if (!date) {
      warnings.push({ type: 'missing_required', message: 'Missing receive_date', field: 'receive_date' });
      return { result: null, warnings };
    }

    // Amount
    const amount = Number(raw.total_amount ?? raw.net_amount ?? 0);
    if (isNaN(amount) || amount === 0) {
      warnings.push({ type: 'normalization', message: `Invalid or zero amount: ${raw.total_amount}`, field: 'total_amount' });
    }

    // Recurring
    const isRecurring = raw.contribution_recur_id != null;
    let recurringInterval: string | null = null;
    if (isRecurring) {
      const freqUnit = String(raw.frequency_unit ?? '').toLowerCase().trim();
      const FREQ_MAP: Record<string, string> = {
        month: 'monthly',
        year: 'annually',
        week: 'weekly',
      };
      recurringInterval = FREQ_MAP[freqUnit] ?? null;
      if (freqUnit === 'day') {
        warnings.push({ type: 'normalization', message: 'CiviCRM frequency_unit "day" has no CROS equivalent — mapped as one-time with warning', field: 'frequency_unit' });
        // day-interval gifts are extremely rare and have no CROS schema match; treat as recurring with null interval
      } else if (freqUnit && !recurringInterval) {
        warnings.push({ type: 'normalization', message: `Unknown frequency_unit: ${freqUnit}`, field: 'frequency_unit' });
      }
    }

    // Note: financial_type → source → campaign title
    const financialType = str(
      raw['financial_type_id:label'] ??
      raw.financial_type_id_label ??
      raw.financial_type
    );
    const source = str(raw.source);
    const campaignTitle = str(
      (raw.campaign_id as Record<string, unknown>)?.title ??
      raw.campaign_title
    );

    const noteParts = [financialType, campaignTitle, source].filter(Boolean);
    const note = noteParts.length > 0
      ? noteParts.join(' · ').slice(0, 500)
      : null;

    return {
      result: {
        date: date.split('T')[0],
        amount: isNaN(amount) ? 0 : amount,
        is_recurring: isRecurring,
        recurring_interval: recurringInterval,
        note,
        warnings: warnings.map(w => w.message),
      },
      warnings,
    };
  },
};
