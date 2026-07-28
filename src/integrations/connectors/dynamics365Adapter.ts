/**
 * Microsoft Dynamics 365 CRM Connector Adapter
 *
 * WHAT: Normalizes Dynamics 365 OData v4 export data to CROS entities.
 * WHERE: Migration harness + fixture pack tests + bi-directional sync.
 * WHY: Deterministic, testable mapping from Dynamics 365 objects to CROS spine.
 *
 * Field mappings sourced from CROS Dynamics 365 Integration Guide v1.0.
 * Auth: OAuth 2.0 via Azure AD (client credentials flow).
 * Rate limit: 6,000 req / 5-min sliding window.
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

export const dynamics365Adapter: ConnectorAdapter = {
  key: 'dynamics365',
  displayName: 'Microsoft Dynamics 365',

  normalizeAccount(raw) {
    const warnings: MappingWarning[] = [];
    const name = String(raw.name ?? raw.Name ?? '').trim();
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Account missing name', field: 'name' });
      return { result: null, warnings };
    }

    const state = normalizeState(raw.address1_stateorprovince);
    if (raw.address1_stateorprovince && state !== String(raw.address1_stateorprovince).trim()) {
      warnings.push({
        type: 'normalization',
        message: `State normalized: ${raw.address1_stateorprovince} → ${state}`,
        field: 'address1_stateorprovince',
      });
    }

    return {
      result: {
        external_id: String(raw.accountid ?? raw.Id ?? ''),
        organization: name,
        website_url: raw.websiteurl ? String(raw.websiteurl) : null,
        phone: raw.telephone1 ? String(raw.telephone1) : null,
        address: raw.address1_line1 ? String(raw.address1_line1) : null,
        city: raw.address1_city ? String(raw.address1_city) : null,
        state,
        postal_code: raw.address1_postalcode ? String(raw.address1_postalcode) : null,
        description: safeSnippet(raw.description),
        org_type: raw.customertypecode != null ? String(raw.customertypecode) : null,
        industry: raw.industrycode != null ? String(raw.industrycode) : null,
      },
      warnings,
    };
  },

  normalizeContact(raw) {
    const warnings: MappingWarning[] = [];
    const first = String(raw.firstname ?? raw.first_name ?? raw.FirstName ?? '').trim();
    const last = String(raw.lastname ?? raw.last_name ?? raw.LastName ?? '').trim();
    const name = [first, last].filter(Boolean).join(' ');
    if (!name) {
      warnings.push({ type: 'missing_required', message: 'Contact missing name fields', field: 'Name' });
      return { result: null, warnings };
    }

    // parentcustomerid is a lookup GUID to Account
    const acctId = raw._parentcustomerid_value ?? raw.parentcustomerid ?? raw.account_id ?? raw.AccountId ?? null;
    if (!acctId) {
      warnings.push({
        type: 'orphan_contact',
        message: `Contact "${name}" has no parentcustomerid — will be placed in Unlinked bucket`,
      });
    }

    // statecode: 0 = Active, 1 = Inactive
    if (raw.statecode != null && Number(raw.statecode) === 1) {
      warnings.push({
        type: 'normalization',
        message: `Contact "${name}" is inactive (statecode=1)`,
        field: 'statecode',
      });
    }

    return {
      result: {
        external_id: String(raw.contactid ?? raw.Id ?? ''),
        account_external_id: acctId ? String(acctId) : null,
        name,
        email: raw.emailaddress1 ? String(raw.emailaddress1).toLowerCase().trim() : (raw.email ? String(raw.email).toLowerCase().trim() : null),
        phone: raw.telephone1 ? String(raw.telephone1) : (raw.mobilephone ? String(raw.mobilephone) : null),
        title: raw.jobtitle ? String(raw.jobtitle).trim() : null,
        city: raw.address1_city ? String(raw.address1_city) : null,
        state: normalizeState(raw.address1_stateorprovince),
      },
      warnings,
    };
  },

  normalizeTask(raw) {
    const warnings: MappingWarning[] = [];
    const subject = String(raw.subject ?? '').trim();
    if (!subject) {
      warnings.push({ type: 'missing_required', message: 'Task missing subject', field: 'subject' });
      return { result: null, warnings };
    }

    // Dynamics uses scheduledend for task due date
    const { date, warning } = normalizeDate(raw.scheduledend ?? raw.actualend);
    if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'scheduledend', value: String(raw.scheduledend) });

    // statecode: 0=Open, 1=Completed, 2=Canceled
    const statusMap: Record<string, string> = { '0': 'Open', '1': 'Completed', '2': 'Canceled' };
    const status = raw.statecode != null ? (statusMap[String(raw.statecode)] ?? String(raw.statecode)) : null;

    // prioritycode: 0=Low, 1=Normal, 2=High
    const priorityMap: Record<string, string> = { '0': 'Low', '1': 'Normal', '2': 'High' };
    const priority = raw.prioritycode != null ? (priorityMap[String(raw.prioritycode)] ?? String(raw.prioritycode)) : null;

    return {
      result: {
        external_id: String(raw.activityid ?? raw.Id ?? ''),
        contact_external_id: raw._regardingobjectid_value ? String(raw._regardingobjectid_value) : null,
        account_external_id: null,
        title: subject,
        status,
        priority,
        due_date: date,
        description: safeSnippet(raw.description),
      },
      warnings,
    };
  },

  normalizeEvent(raw) {
    const warnings: MappingWarning[] = [];
    const subject = String(raw.subject ?? '').trim();
    if (!subject) {
      warnings.push({ type: 'missing_required', message: 'Appointment missing subject', field: 'subject' });
      return { result: null, warnings };
    }

    const { date: start, warning: sw } = normalizeDate(raw.scheduledstart);
    if (sw) warnings.push({ type: 'invalid_date', message: sw, field: 'scheduledstart' });
    const { date: end, warning: ew } = normalizeDate(raw.scheduledend);
    if (ew) warnings.push({ type: 'invalid_date', message: ew, field: 'scheduledend' });

    return {
      result: {
        external_id: String(raw.activityid ?? raw.Id ?? ''),
        contact_external_id: raw._regardingobjectid_value ? String(raw._regardingobjectid_value) : null,
        account_external_id: null,
        event_name: subject,
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
    const subject = String(raw.subject ?? '').trim();
    if (!subject) {
      warnings.push({ type: 'missing_required', message: 'Activity missing subject', field: 'subject' });
      return { result: null, warnings };
    }

    const { date, warning } = normalizeDate(raw.createdon);
    if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'createdon' });

    return {
      result: {
        external_id: String(raw.activityid ?? raw.Id ?? ''),
        parent_external_id: raw._regardingobjectid_value ? String(raw._regardingobjectid_value) : null,
        title: subject,
        body_snippet: safeSnippet(raw.description),
        created_date: date,
      },
      warnings,
    };
  },
};
