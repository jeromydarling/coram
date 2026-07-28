/**
 * Nuntius schema — outreach (§5.4).
 *
 * Authoritative DDL, the RLS, and the opt-out triggers are in
 * migrations/0004_nuntius.sql.
 *
 * The registration to read here is `suppressions`. It is the only table in the
 * product holding indefinitely that touches contact information at all, and
 * the reason it is allowed to is that it does not actually hold any.
 */

import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { registerTable } from '../retention';
import { contacts, segments } from './membra';
import { tenants, users } from './foundation';

// ---------------------------------------------------------------------------
// suppressions — the ledger
// ---------------------------------------------------------------------------

export const suppressions = pgTable(
  'suppressions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    channel: text('channel').$type<'email' | 'sms' | 'phone' | 'all'>().notNull(),
    /** HMAC-SHA256 under a Worker-held pepper. Never an address. */
    identifierHash: text('identifier_hash').notNull(),
    reason: text('reason').$type<'unsubscribed' | 'complaint' | 'bounce' | 'manual'>().notNull(),
    source: text('source').$type<'self_service' | 'admin' | 'system'>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('suppressions_tenant_channel_hash_key').on(t.tenantId, t.channel, t.identifierHash),
    index('suppressions_lookup_idx').on(t.tenantId, t.identifierHash),
  ],
);

registerTable({
  table: 'suppressions',
  // The one place in this product where indefinite retention is not only
  // acceptable but required. §5.4 says an opt-out lasts forever, and §3.4 says
  // personal data must expire. Both hold here because this table stores a
  // peppered hash and no readable identifier — there is nothing in it to
  // expire. It also survives the purge of the contact it came from, which is
  // the case that matters: unsubscribe, then be forgotten, and still never be
  // contacted again.
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'That someone told us to stop. Held as an unreadable hash so honouring it forever ' +
    'costs us no personal data, and so it outlives the contact record without keeping ' +
    'an address we were asked to delete.',
});

export const unsubscribeTokens = pgTable(
  'unsubscribe_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('unsubscribe_tokens_hash_key').on(t.tokenHash)],
);

registerTable({
  table: 'unsubscribe_tokens',
  // Long enough that a link in an old email still works — people unsubscribe
  // from things they were sent months ago, and a dead link there means they
  // either give up or report it as spam. Short enough that the mapping from
  // token to person does not accumulate.
  retentionDays: 400,
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Lets an unsubscribe link identify who is unsubscribing without putting their ' +
    'address in a URL. Deleted the moment it is used; swept if it never is.',
});

// ---------------------------------------------------------------------------
// campaigns
// ---------------------------------------------------------------------------

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    channel: text('channel').$type<'email' | 'sms'>().notNull(),
    subject: text('subject'),
    /** Merge fields stay unexpanded here; they resolve per recipient at send. */
    body: text('body').notNull(),
    segmentId: uuid('segment_id').references(() => segments.id, { onDelete: 'set null' }),
    status: text('status')
      .$type<'draft' | 'queued' | 'sending' | 'sent' | 'cancelled'>()
      .notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('campaigns_tenant_idx').on(t.tenantId, t.createdAt)],
);

registerTable({
  table: 'campaigns',
  retentionDays: null,
  // The subject is a message the workspace wrote, not a person.
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    "A message the group wrote and who it was aimed at, as a segment rather than a list " +
    'of names. Their own record of what they said. Who received it is campaign_sends.',
});

export const campaignSends = pgTable(
  'campaign_sends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    status: text('status')
      .$type<'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed'>()
      .notNull(),
    failureKind: text('failure_kind'),
    queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('campaign_sends_campaign_contact_key').on(t.campaignId, t.contactId),
    index('campaign_sends_campaign_idx').on(t.campaignId, t.status),
  ],
);

registerTable({
  table: 'campaign_sends',
  retentionDays: 400,
  pii: 'pseudonym',
  timestampColumn: 'queued_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Whether a message reached one person, so bounces and complaints can be acted on. ' +
    'Carries no copy of what was sent. A year and a bit, which is as long as a ' +
    'deliverability problem is worth diagnosing.',
});

// ---------------------------------------------------------------------------
// peer-to-peer texting
// ---------------------------------------------------------------------------

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('conversations_tenant_contact_key').on(t.tenantId, t.contactId),
    index('conversations_assigned_idx').on(t.assignedTo, t.lastMessageAt),
  ],
);

registerTable({
  table: 'conversations',
  retentionDays: 400,
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A texting thread between one volunteer and one supporter. Holds who was talking to ' +
    'whom, not what was said.',
});

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    direction: text('direction').$type<'outbound' | 'inbound'>().notNull(),
    body: text('body').notNull(),
    sentBy: uuid('sent_by').references(() => users.id, { onDelete: 'set null' }),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId, t.sentAt)],
);

registerTable({
  table: 'messages',
  // The shortest window on any table here, and deliberately so. §3.2 keeps
  // message content out of Colloquium entirely; P2P texting cannot go that far
  // because a volunteer needs the thread to hold a conversation. Six months is
  // long enough for a campaign and its follow-up, and short enough that a
  // subpoena a year later finds nothing. There is no archive.
  retentionDays: 180,
  pii: 'contact',
  timestampColumn: 'sent_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'What was actually said in a one-to-one text thread. Kept only while the ' +
    'conversation is live work — six months, then gone, with no archive.',
});

// ---------------------------------------------------------------------------
// phone bank
// ---------------------------------------------------------------------------

export const callScripts = pgTable(
  'call_scripts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Branching tree: nodes with prompts, answers pointing at the next node. */
    tree: jsonb('tree').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('call_scripts_tenant_name_key').on(t.tenantId, t.name)],
);

registerTable({
  table: 'call_scripts',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason: 'What a caller is meant to say, and where each answer leads. About the ask, not the person.',
});

export const callAttempts = pgTable(
  'call_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    scriptId: uuid('script_id').references(() => callScripts.id, { onDelete: 'set null' }),
    callerId: uuid('caller_id').references(() => users.id, { onDelete: 'set null' }),
    outcome: text('outcome').notNull(),
    /** Answers keyed by script node. Chosen from the script, never free text. */
    answers: jsonb('answers').notNull().default(sql`'{}'::jsonb`),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('call_attempts_contact_idx').on(t.contactId, t.attemptedAt)],
);

registerTable({
  table: 'call_attempts',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'attempted_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'That a call happened and how it went, as an outcome code plus answers chosen from ' +
    'the script. No recording and no transcript — there are no columns for either.',
});
