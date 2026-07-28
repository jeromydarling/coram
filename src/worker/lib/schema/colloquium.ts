/**
 * Colloquium schema — secure internal comms (§5.7).
 *
 * Authoritative DDL and RLS are in migrations/0008_colloquium.sql.
 *
 * There is no message body table here because there is no message body column
 * anywhere (§3.2). What Postgres holds is envelopes; the ciphertext lives in
 * ChannelDO for the channel's TTL and then stops existing.
 */

import { index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { registerTable } from '../retention';
import { memberships, tenants } from './foundation';

export const channels = pgTable(
  'channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name'),
    kind: text('kind').$type<'channel' | 'dm'>().notNull(),
    /** Capped at 30 by a CHECK — a channel cannot opt out of §3.2. */
    ttlDays: integer('ttl_days').notNull().default(30),
    createdBy: uuid('created_by').references(() => memberships.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [index('channels_tenant_idx').on(t.tenantId)],
);

registerTable({
  table: 'channels',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'That a room exists, what it is called, and how long its messages live. Holds no ' +
    'message and no member — those are channel_members and message_envelopes.',
});

export const channelMembers = pgTable(
  'channel_members',
  {
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.membershipId] })],
);

registerTable({
  table: 'channel_members',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'joined_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Who is in which room. Required to deliver anything at all, and it is also the ' +
    'social graph of a group, so it ages out rather than persisting.',
});

export const messageEnvelopes = pgTable(
  'message_envelopes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').references(() => memberships.id, { onDelete: 'set null' }),
    /** Rounded to 256-byte buckets on write. Exact lengths leak. */
    byteLength: integer('byte_length').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('message_envelopes_channel_idx').on(t.channelId, t.sentAt)],
);

registerTable({
  table: 'message_envelopes',
  // §3.2 names thirty days and this is it. The shortest window in the product
  // alongside jail support, and for the same reason: what survives here is a
  // map of who talks to whom inside an organizing group, which is worth more
  // to an adversary than most message content would be.
  retentionDays: 30,
  pii: 'pseudonym',
  timestampColumn: 'sent_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'That someone said something of roughly this size in this room at roughly this time. ' +
    'No body, no subject, no preview — there is no column for one. Purged at thirty days ' +
    'per §3.2.',
});

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    /** Tenant-first, so jobs/purge.ts finds it on a burn. */
    r2Key: text('r2_key').notNull(),
    byteLength: integer('byte_length').notNull(),
    /** The label, encrypted client-side. Never the filename. */
    sealedLabel: text('sealed_label'),
    nonce: text('nonce'),
    uploadedBy: uuid('uploaded_by').references(() => memberships.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex('attachments_r2_key').on(t.r2Key), index('attachments_channel_idx').on(t.channelId)],
);

registerTable({
  table: 'attachments',
  retentionDays: 30,
  pii: 'pseudonym',
  timestampColumn: 'uploaded_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  // The row goes at thirty days; the R2 object has to go too, and that is a
  // separate deletion the purge job performs. A row deleted without its object
  // would leave a file in a bucket with nothing pointing at it — unreachable
  // through the app and still there for a subpoena.
  reason:
    'A file shared in a room, as an R2 key and a sealed label. The filename is never ' +
    'stored: "eviction-notice-marquez.pdf" says everything the encryption was for.',
});
