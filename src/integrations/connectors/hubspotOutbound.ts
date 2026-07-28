/**
 * HubSpot Outbound Adapter
 *
 * WHAT: Denormalizes CROS entities to HubSpot CRM API v3 format for outbound sync.
 * WHERE: relatio-outbound-sync edge function (direct vendor API calls).
 * WHY: Enables CROS → HubSpot write-back for contacts, companies, deals, tasks, notes.
 */

import type { OutboundAdapter, OutboundPayload, FieldDiff, OutboundEntity } from './outboundTypes';
import type {
  NormalizedAccount,
  NormalizedContact,
  NormalizedTask,
  NormalizedEvent,
  NormalizedActivity,
} from './types';

const BASE = '/crm/v3/objects';

export const hubspotOutbound: OutboundAdapter = {
  key: 'hubspot',
  displayName: 'HubSpot',
  supportedEntities: ['account', 'contact', 'task', 'event', 'activity'],

  denormalizeAccount(account: NormalizedAccount, isUpdate: boolean): OutboundPayload {
    const properties: Record<string, unknown> = {
      name: account.organization,
    };
    if (account.website_url) properties.domain = account.website_url;
    if (account.phone) properties.phone = account.phone;
    if (account.address) properties.address = account.address;
    if (account.city) properties.city = account.city;
    if (account.state) properties.state = account.state;
    if (account.postal_code) properties.zip = account.postal_code;
    if (account.description) properties.description = account.description;
    if (account.industry) properties.industry = account.industry;
    if (account.org_type) properties.type = account.org_type;

    return {
      endpoint: isUpdate ? `${BASE}/companies/${account.external_id}` : `${BASE}/companies`,
      method: isUpdate ? 'PATCH' : 'POST',
      body: { properties },
      externalId: isUpdate ? account.external_id : undefined,
    };
  },

  denormalizeContact(contact: NormalizedContact, isUpdate: boolean): OutboundPayload {
    const nameParts = contact.name.split(' ');
    const properties: Record<string, unknown> = {
      firstname: nameParts[0] || '',
      lastname: nameParts.slice(1).join(' ') || nameParts[0] || '',
    };
    if (contact.email) properties.email = contact.email;
    if (contact.phone) properties.phone = contact.phone;
    if (contact.title) properties.jobtitle = contact.title;
    if (contact.city) properties.city = contact.city;
    if (contact.state) properties.state = contact.state;

    return {
      endpoint: isUpdate ? `${BASE}/contacts/${contact.external_id}` : `${BASE}/contacts`,
      method: isUpdate ? 'PATCH' : 'POST',
      body: { properties },
      externalId: isUpdate ? contact.external_id : undefined,
    };
  },

  denormalizeTask(task: NormalizedTask, isUpdate: boolean): OutboundPayload {
    const properties: Record<string, unknown> = {
      hs_task_subject: task.title,
      hs_task_type: 'TODO',
    };
    if (task.description) properties.hs_task_body = task.description;
    if (task.due_date) properties.hs_timestamp = new Date(task.due_date).getTime();
    if (task.status) {
      properties.hs_task_status = task.status === 'Completed' ? 'COMPLETED' : 'NOT_STARTED';
    }
    if (task.priority) {
      const pMap: Record<string, string> = { High: 'HIGH', Normal: 'MEDIUM', Low: 'LOW' };
      properties.hs_task_priority = pMap[task.priority] || 'MEDIUM';
    }

    return {
      endpoint: isUpdate ? `${BASE}/tasks/${task.external_id}` : `${BASE}/tasks`,
      method: isUpdate ? 'PATCH' : 'POST',
      body: { properties },
      externalId: isUpdate ? task.external_id : undefined,
    };
  },

  denormalizeEvent(event: NormalizedEvent, isUpdate: boolean): OutboundPayload {
    const properties: Record<string, unknown> = {
      hs_meeting_title: event.event_name,
    };
    if (event.start_date) properties.hs_meeting_start_time = event.start_date;
    if (event.end_date) properties.hs_meeting_end_time = event.end_date;
    if (event.location) properties.hs_meeting_location = event.location;
    if (event.description) properties.hs_meeting_body = event.description;

    return {
      endpoint: isUpdate ? `${BASE}/meetings/${event.external_id}` : `${BASE}/meetings`,
      method: isUpdate ? 'PATCH' : 'POST',
      body: { properties },
      externalId: isUpdate ? event.external_id : undefined,
    };
  },

  denormalizeActivity(activity: NormalizedActivity, isUpdate: boolean): OutboundPayload {
    const properties: Record<string, unknown> = {
      hs_note_body: `<strong>${activity.title}</strong><br/>${activity.body_snippet || ''}`,
    };
    if (activity.created_date) {
      properties.hs_timestamp = new Date(activity.created_date).getTime();
    }

    return {
      endpoint: isUpdate ? `${BASE}/notes/${activity.external_id}` : `${BASE}/notes`,
      method: isUpdate ? 'PATCH' : 'POST',
      body: { properties },
      externalId: isUpdate ? activity.external_id : undefined,
    };
  },

  detectConflicts(
    entityType: OutboundEntity,
    crosData: Record<string, unknown>,
    remoteData: Record<string, unknown>
  ): FieldDiff[] {
    const diffs: FieldDiff[] = [];
    // HubSpot wraps data inside properties
    const remoteProps = (remoteData.properties as Record<string, unknown>) || remoteData;
    const fieldMaps: Record<string, Record<string, string>> = {
      contact: {
        name: 'firstname',
        email: 'email',
        phone: 'phone',
        title: 'jobtitle',
        city: 'city',
        state: 'state',
      },
      account: {
        organization: 'name',
        website_url: 'domain',
        phone: 'phone',
        city: 'city',
        state: 'state',
      },
    };

    const map = fieldMaps[entityType] || {};
    for (const [crosField, remoteField] of Object.entries(map)) {
      const cVal = crosData[crosField];
      const rVal = remoteProps[remoteField];
      if (cVal && rVal && String(cVal).toLowerCase().trim() !== String(rVal).toLowerCase().trim()) {
        diffs.push({ field: crosField, crosValue: cVal, remoteValue: rVal });
      }
    }
    return diffs;
  },
};
