/**
 * Salesforce Outbound Adapter
 *
 * WHAT: Denormalizes CROS entities to Salesforce REST API format for outbound sync.
 * WHERE: relatio-outbound-sync edge function (direct vendor API calls).
 * WHY: Enables CROS → Salesforce write-back for contacts, accounts, tasks, events, activities.
 */

import type { OutboundAdapter, OutboundPayload, FieldDiff, OutboundEntity } from './outboundTypes';
import type {
  NormalizedAccount,
  NormalizedContact,
  NormalizedTask,
  NormalizedEvent,
  NormalizedActivity,
} from './types';

const BASE = '/services/data/v59.0/sobjects';

export const salesforceOutbound: OutboundAdapter = {
  key: 'salesforce',
  displayName: 'Salesforce',
  supportedEntities: ['account', 'contact', 'task', 'event', 'activity', 'stage'],

  denormalizeAccount(account: NormalizedAccount, isUpdate: boolean): OutboundPayload {
    const body: Record<string, unknown> = {
      Name: account.organization,
    };
    if (account.website_url) body.Website = account.website_url;
    if (account.phone) body.Phone = account.phone;
    if (account.address) body.BillingStreet = account.address;
    if (account.city) body.BillingCity = account.city;
    if (account.state) body.BillingState = account.state;
    if (account.postal_code) body.BillingPostalCode = account.postal_code;
    if (account.description) body.Description = account.description;
    if (account.industry) body.Industry = account.industry;
    if (account.org_type) body.Type = account.org_type;

    return {
      endpoint: isUpdate ? `${BASE}/Account/${account.external_id}` : `${BASE}/Account`,
      method: isUpdate ? 'PATCH' : 'POST',
      body,
      externalId: isUpdate ? account.external_id : undefined,
    };
  },

  denormalizeContact(contact: NormalizedContact, isUpdate: boolean): OutboundPayload {
    const nameParts = contact.name.split(' ');
    const body: Record<string, unknown> = {
      FirstName: nameParts[0] || '',
      LastName: nameParts.slice(1).join(' ') || nameParts[0] || '',
    };
    if (contact.email) body.Email = contact.email;
    if (contact.phone) body.Phone = contact.phone;
    if (contact.title) body.Title = contact.title;
    if (contact.city) body.MailingCity = contact.city;
    if (contact.state) body.MailingState = contact.state;
    if (contact.account_external_id) body.AccountId = contact.account_external_id;

    return {
      endpoint: isUpdate ? `${BASE}/Contact/${contact.external_id}` : `${BASE}/Contact`,
      method: isUpdate ? 'PATCH' : 'POST',
      body,
      externalId: isUpdate ? contact.external_id : undefined,
    };
  },

  denormalizeTask(task: NormalizedTask, isUpdate: boolean): OutboundPayload {
    const body: Record<string, unknown> = {
      Subject: task.title,
    };
    if (task.description) body.Description = task.description;
    if (task.due_date) body.ActivityDate = task.due_date.split('T')[0]; // Salesforce uses date-only
    if (task.status) body.Status = task.status;
    if (task.priority) body.Priority = task.priority;
    if (task.contact_external_id) body.WhoId = task.contact_external_id;
    if (task.account_external_id) body.WhatId = task.account_external_id;

    return {
      endpoint: isUpdate ? `${BASE}/Task/${task.external_id}` : `${BASE}/Task`,
      method: isUpdate ? 'PATCH' : 'POST',
      body,
      externalId: isUpdate ? task.external_id : undefined,
    };
  },

  denormalizeEvent(event: NormalizedEvent, isUpdate: boolean): OutboundPayload {
    const body: Record<string, unknown> = {
      Subject: event.event_name,
    };
    if (event.start_date) body.StartDateTime = event.start_date;
    if (event.end_date) body.EndDateTime = event.end_date;
    if (event.location) body.Location = event.location;
    if (event.description) body.Description = event.description;
    if (event.contact_external_id) body.WhoId = event.contact_external_id;
    if (event.account_external_id) body.WhatId = event.account_external_id;

    return {
      endpoint: isUpdate ? `${BASE}/Event/${event.external_id}` : `${BASE}/Event`,
      method: isUpdate ? 'PATCH' : 'POST',
      body,
      externalId: isUpdate ? event.external_id : undefined,
    };
  },

  denormalizeActivity(activity: NormalizedActivity, isUpdate: boolean): OutboundPayload {
    const body: Record<string, unknown> = {
      Title: activity.title,
      Body: activity.body_snippet || '',
    };
    if (activity.parent_external_id) body.ParentId = activity.parent_external_id;

    return {
      endpoint: isUpdate ? `${BASE}/Note/${activity.external_id}` : `${BASE}/Note`,
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
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        title: 'Title',
        city: 'MailingCity',
        state: 'MailingState',
      },
      account: {
        organization: 'Name',
        website_url: 'Website',
        phone: 'Phone',
        city: 'BillingCity',
        state: 'BillingState',
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
