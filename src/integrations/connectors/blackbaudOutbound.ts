/**
 * Blackbaud RE NXT Outbound Adapter
 *
 * WHAT: Denormalizes CROS entities to Blackbaud SKY API format for outbound sync.
 * WHERE: relatio-outbound-sync edge function (direct vendor API calls).
 * WHY: Enables CROS → Blackbaud write-back for constituents, actions, events, notes.
 */

import type { OutboundAdapter, OutboundPayload, FieldDiff, OutboundEntity } from './outboundTypes';
import type {
  NormalizedAccount,
  NormalizedContact,
  NormalizedTask,
  NormalizedEvent,
  NormalizedActivity,
} from './types';

const BASE = '/constituent/v1';
const ACTION_BASE = '/actionmanagement/v1';

export const blackbaudOutbound: OutboundAdapter = {
  key: 'blackbaud',
  displayName: 'Blackbaud RE NXT',
  supportedEntities: ['account', 'contact', 'task', 'event', 'activity'],

  denormalizeAccount(account: NormalizedAccount, isUpdate: boolean): OutboundPayload {
    const body: Record<string, unknown> = {
      name: account.organization,
      type: 'Organization',
    };
    if (account.website_url) body.website = { address: account.website_url };
    if (account.phone) {
      body.phones = [{ number: account.phone, type: 'Business' }];
    }
    if (account.address || account.city || account.state || account.postal_code) {
      body.addresses = [{
        type: 'Business',
        address_lines: account.address ? [account.address] : undefined,
        city: account.city || undefined,
        state: account.state || undefined,
        postal_code: account.postal_code || undefined,
        country: 'US',
      }];
    }

    return {
      endpoint: isUpdate ? `${BASE}/constituents/${account.external_id}` : `${BASE}/constituents`,
      method: isUpdate ? 'PATCH' : 'POST',
      body,
      externalId: isUpdate ? account.external_id : undefined,
    };
  },

  denormalizeContact(contact: NormalizedContact, isUpdate: boolean): OutboundPayload {
    const nameParts = contact.name.split(' ');
    const body: Record<string, unknown> = {
      first: nameParts[0] || '',
      last: nameParts.slice(1).join(' ') || nameParts[0] || '',
      type: 'Individual',
    };
    if (contact.email) {
      body.email = { address: contact.email, type: 'Email' };
    }
    if (contact.phone) {
      body.phones = [{ number: contact.phone, type: 'Mobile' }];
    }
    if (contact.title) body.title = contact.title;
    if (contact.city || contact.state) {
      body.addresses = [{
        type: 'Home',
        city: contact.city || undefined,
        state: contact.state || undefined,
        country: 'US',
      }];
    }
    if (contact.account_external_id) {
      body.relationships = [{
        relation_id: contact.account_external_id,
        type: 'Employee',
        is_organization_contact: true,
      }];
    }

    return {
      endpoint: isUpdate ? `${BASE}/constituents/${contact.external_id}` : `${BASE}/constituents`,
      method: isUpdate ? 'PATCH' : 'POST',
      body,
      externalId: isUpdate ? contact.external_id : undefined,
    };
  },

  denormalizeTask(task: NormalizedTask, isUpdate: boolean): OutboundPayload {
    const body: Record<string, unknown> = {
      summary: task.title,
      category: 'Task',
    };
    if (task.description) body.description = task.description;
    if (task.due_date) body.date = task.due_date.split('T')[0];
    if (task.status) body.status = task.status === 'Completed' ? 'Completed' : 'Open';
    if (task.priority) body.priority = task.priority;
    if (task.contact_external_id) body.constituent_id = task.contact_external_id;

    return {
      endpoint: isUpdate ? `${ACTION_BASE}/actions/${task.external_id}` : `${ACTION_BASE}/actions`,
      method: isUpdate ? 'PATCH' : 'POST',
      body,
      externalId: isUpdate ? task.external_id : undefined,
    };
  },

  denormalizeEvent(event: NormalizedEvent, isUpdate: boolean): OutboundPayload {
    const body: Record<string, unknown> = {
      name: event.event_name,
      category: 'Meeting',
    };
    if (event.start_date) body.start_date = event.start_date;
    if (event.end_date) body.end_date = event.end_date;
    if (event.location) body.location = event.location;
    if (event.description) body.description = event.description;

    return {
      endpoint: isUpdate ? `/event/v1/events/${event.external_id}` : '/event/v1/events',
      method: isUpdate ? 'PATCH' : 'POST',
      body,
      externalId: isUpdate ? event.external_id : undefined,
    };
  },

  denormalizeActivity(activity: NormalizedActivity, isUpdate: boolean): OutboundPayload {
    const body: Record<string, unknown> = {
      type: 'Note',
      text: `${activity.title}\n\n${activity.body_snippet || ''}`.trim(),
    };
    if (activity.parent_external_id) body.constituent_id = activity.parent_external_id;
    if (activity.created_date) body.date = { d: activity.created_date };

    return {
      endpoint: isUpdate
        ? `${BASE}/constituents/notes/${activity.external_id}`
        : `${BASE}/constituents/notes`,
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
        name: 'name',
        email: 'email.address',
        phone: 'phone.number',
        title: 'title',
      },
      account: {
        organization: 'name',
        website_url: 'website.address',
      },
    };

    const map = fieldMaps[entityType] || {};
    for (const [crosField, remoteField] of Object.entries(map)) {
      const cVal = crosData[crosField];
      // Navigate dotted paths for Blackbaud nested objects
      const rVal = remoteField.includes('.')
        ? (remoteData[remoteField.split('.')[0]] as Record<string, unknown>)?.[remoteField.split('.')[1]]
        : remoteData[remoteField];
      if (cVal && rVal && String(cVal).toLowerCase().trim() !== String(rVal).toLowerCase().trim()) {
        diffs.push({ field: crosField, crosValue: cVal, remoteValue: rVal });
      }
    }
    return diffs;
  },
};
