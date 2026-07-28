/**
 * Microsoft Dynamics 365 Outbound Adapter
 *
 * WHAT: Denormalizes CROS entities to Dynamics 365 OData v4 format for outbound sync.
 * WHERE: relatio-outbound-sync edge function (direct vendor API calls).
 * WHY: Enables CROS → Dynamics 365 write-back for contacts, accounts, tasks, events, activities.
 */

import type { OutboundAdapter, OutboundPayload, FieldDiff, OutboundEntity } from './outboundTypes';
import type {
  NormalizedAccount,
  NormalizedContact,
  NormalizedTask,
  NormalizedEvent,
  NormalizedActivity,
} from './types';

const BASE = '/api/data/v9.2';

export const dynamics365Outbound: OutboundAdapter = {
  key: 'dynamics365',
  displayName: 'Microsoft Dynamics 365',
  supportedEntities: ['account', 'contact', 'task', 'event', 'activity', 'stage'],

  denormalizeAccount(account: NormalizedAccount, isUpdate: boolean): OutboundPayload {
    const body: Record<string, unknown> = {
      name: account.organization,
    };
    if (account.website_url) body.websiteurl = account.website_url;
    if (account.phone) body.telephone1 = account.phone;
    if (account.address) body.address1_line1 = account.address;
    if (account.city) body.address1_city = account.city;
    if (account.state) body.address1_stateorprovince = account.state;
    if (account.postal_code) body.address1_postalcode = account.postal_code;
    if (account.description) body.description = account.description;

    return {
      endpoint: isUpdate ? `${BASE}/accounts(${account.external_id})` : `${BASE}/accounts`,
      method: isUpdate ? 'PATCH' : 'POST',
      body,
      externalId: isUpdate ? account.external_id : undefined,
    };
  },

  denormalizeContact(contact: NormalizedContact, isUpdate: boolean): OutboundPayload {
    const nameParts = contact.name.split(' ');
    const body: Record<string, unknown> = {
      firstname: nameParts[0] || '',
      lastname: nameParts.slice(1).join(' ') || nameParts[0] || '',
    };
    if (contact.email) body.emailaddress1 = contact.email;
    if (contact.phone) body.telephone1 = contact.phone;
    if (contact.title) body.jobtitle = contact.title;
    if (contact.city) body.address1_city = contact.city;
    if (contact.state) body.address1_stateorprovince = contact.state;
    if (contact.account_external_id) {
      body['parentcustomerid_account@odata.bind'] = `/accounts(${contact.account_external_id})`;
    }

    return {
      endpoint: isUpdate ? `${BASE}/contacts(${contact.external_id})` : `${BASE}/contacts`,
      method: isUpdate ? 'PATCH' : 'POST',
      body,
      externalId: isUpdate ? contact.external_id : undefined,
    };
  },

  denormalizeTask(task: NormalizedTask, isUpdate: boolean): OutboundPayload {
    const body: Record<string, unknown> = {
      subject: task.title,
    };
    if (task.description) body.description = task.description;
    if (task.due_date) body.scheduledend = task.due_date;
    if (task.priority) {
      const priorityMap: Record<string, number> = { Low: 0, Normal: 1, High: 2 };
      body.prioritycode = priorityMap[task.priority] ?? 1;
    }

    return {
      endpoint: isUpdate ? `${BASE}/tasks(${task.external_id})` : `${BASE}/tasks`,
      method: isUpdate ? 'PATCH' : 'POST',
      body,
      externalId: isUpdate ? task.external_id : undefined,
    };
  },

  denormalizeEvent(event: NormalizedEvent, isUpdate: boolean): OutboundPayload {
    const body: Record<string, unknown> = {
      subject: event.event_name,
    };
    if (event.start_date) body.scheduledstart = event.start_date;
    if (event.end_date) body.scheduledend = event.end_date;
    if (event.location) body.location = event.location;
    if (event.description) body.description = event.description;

    return {
      endpoint: isUpdate ? `${BASE}/appointments(${event.external_id})` : `${BASE}/appointments`,
      method: isUpdate ? 'PATCH' : 'POST',
      body,
      externalId: isUpdate ? event.external_id : undefined,
    };
  },

  denormalizeActivity(activity: NormalizedActivity, isUpdate: boolean): OutboundPayload {
    const body: Record<string, unknown> = {
      subject: activity.title,
      notetext: activity.body_snippet || '',
    };
    if (activity.parent_external_id) {
      body['objectid_contact@odata.bind'] = `/contacts(${activity.parent_external_id})`;
    }

    return {
      endpoint: isUpdate ? `${BASE}/annotations(${activity.external_id})` : `${BASE}/annotations`,
      method: isUpdate ? 'PATCH' : 'POST',
      body,
      externalId: isUpdate ? activity.external_id : undefined,
    };
  },

  detectConflicts(
    entityType: OutboundEntity,
    crosData: Record<string, unknown>,
    remoteData: Record<string, unknown>
  ): FieldDiff[] {
    const diffs: FieldDiff[] = [];
    const fieldMaps: Record<string, Record<string, string>> = {
      contact: {
        name: 'fullname',
        email: 'emailaddress1',
        phone: 'telephone1',
        title: 'jobtitle',
        city: 'address1_city',
        state: 'address1_stateorprovince',
      },
      account: {
        organization: 'name',
        website_url: 'websiteurl',
        phone: 'telephone1',
        city: 'address1_city',
        state: 'address1_stateorprovince',
      },
    };

    const map = fieldMaps[entityType] || {};
    for (const [crosField, remoteField] of Object.entries(map)) {
      const cVal = crosData[crosField];
      const rVal = remoteData[remoteField];
      if (cVal && rVal && String(cVal).toLowerCase().trim() !== String(rVal).toLowerCase().trim()) {
        diffs.push({ field: crosField, crosValue: cVal, remoteValue: rVal });
      }
    }
    return diffs;
  },
};
