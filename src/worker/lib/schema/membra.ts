/**
 * Membra schema — the supporter CRM (§5.1).
 *
 * Authoritative DDL and the RLS policies are in migrations/0002_membra.sql.
 * These definitions exist for query typing, and — more importantly — so that
 * every table declares its retention position beside itself (§3.4).
 *
 * Two of the retention windows below deserve to be read rather than skimmed:
 * `contacts` measures age from `updated_at`, so an active supporter list never
 * ages out while a list nobody has touched in two years does. And
 * `consent_records` outlives contacts on purpose — see its reason.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { registerTable } from '../retention';
import { tenants, users } from './foundation';

// ---------------------------------------------------------------------------
// turfs
// ---------------------------------------------------------------------------

export const turfs = pgTable(
  'turfs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** GeoJSON polygon, for drawing. Not used for containment queries yet. */
    boundary: jsonb('boundary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('turfs_tenant_name_key').on(t.tenantId, t.name)],
);

registerTable({
  table: 'turfs',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A named area an organizer is responsible for, and the polygon drawn around it. ' +
    'Describes ground, not people. §3.1 keeps it an assignment rather than a location trail.',
});

// ---------------------------------------------------------------------------
// contacts
// ---------------------------------------------------------------------------

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    turfId: uuid('turf_id').references(() => turfs.id, { onDelete: 'set null' }),
    /** Set only when this contact also has a login. Most never do. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

    displayName: text('display_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    /** The coarsest location held. No street address, ever (§3.7). */
    postalCode: text('postal_code'),

    customFields: jsonb('custom_fields').notNull().default(sql`'{}'::jsonb`),

    /** Explicitly logged interactions only. Never opens, clicks, or page views. */
    lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }),

    importBatchId: uuid('import_batch_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('contacts_tenant_idx').on(t.tenantId),
    index('contacts_turf_idx').on(t.tenantId, t.turfId),
    uniqueIndex('contacts_tenant_email_key').on(t.tenantId, sql`lower(${t.email})`),
  ],
);

registerTable({
  table: 'contacts',
  retentionDays: 730,
  pii: 'contact',
  // From updated_at, not created_at. A contact worked with last month survives
  // however old the record is; one untouched for two years does not.
  timestampColumn: 'updated_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'The supporter record. Name and at least one way to reach someone is what makes ' +
    'every other module possible. Two years from last touch, so a list nobody has ' +
    'organized with in that long stops being a list we are holding on someone.',
});

// ---------------------------------------------------------------------------
// tags
// ---------------------------------------------------------------------------

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tags_tenant_name_key').on(t.tenantId, t.name)],
);

registerTable({
  table: 'tags',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    "A workspace's own vocabulary — 'steering committee', 'spanish speaker'. Label " +
    'definitions only; which person carries which label lives in contact_tags.',
});

export const contactTags = pgTable(
  'contact_tags',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.tagId] }), index('contact_tags_tag_idx').on(t.tagId)],
);

registerTable({
  table: 'contact_tags',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Which supporter carries which label. This is the row that says someone is in a ' +
    'group, so it matches the contacts window rather than the looser tags one.',
});

// ---------------------------------------------------------------------------
// custom_field_defs, segments
// ---------------------------------------------------------------------------

export const customFieldDefs = pgTable(
  'custom_field_defs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    fieldType: text('field_type').$type<'text' | 'number' | 'boolean' | 'date' | 'select'>().notNull(),
    options: jsonb('options').notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('custom_field_defs_tenant_key').on(t.tenantId, t.key)],
);

registerTable({
  table: 'custom_field_defs',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Field definitions a workspace added to its own contact records. Shape, not content — ' +
    'the values live in contacts.custom_fields and age out with the contact.',
});

export const segments = pgTable(
  'segments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** A stored filter, never a stored result set. */
    definition: jsonb('definition').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('segments_tenant_name_key').on(t.tenantId, t.name)],
);

registerTable({
  table: 'segments',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A saved filter. Storing the query rather than its membership means a segment cannot ' +
    'become a second, stale copy of who is on a list.',
});

// ---------------------------------------------------------------------------
// consent_records
// ---------------------------------------------------------------------------

export const consentRecords = pgTable(
  'consent_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    channel: text('channel').$type<'email' | 'sms' | 'phone' | 'post' | 'any'>().notNull(),
    granted: boolean('granted').notNull(),
    acquisition: text('acquisition').notNull(),
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    recordedBy: uuid('recorded_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [index('consent_records_contact_idx').on(t.contactId, t.occurredAt)],
);

registerTable({
  table: 'consent_records',
  retentionDays: 1095,
  pii: 'pseudonym',
  timestampColumn: 'occurred_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  // Longer than contacts on purpose, and it needs saying why. These rows
  // cascade when a contact is deleted, so in practice they die with the
  // contact and this window never fires for a live one. Its real job is to
  // sweep records orphaned by a migration or a partial restore. Set shorter
  // than contacts, it would instead delete the proof that a supporter opted
  // in while we were still emailing them — which is exactly backwards.
  reason:
    'Evidence of how a supporter was acquired and what they agreed to. Protects the ' +
    'person as much as the workspace. Cascades with the contact; this window only ' +
    'sweeps orphans.',
});

// ---------------------------------------------------------------------------
// contact_notes and vault_keys — §3.3
// ---------------------------------------------------------------------------

export const contactNotes = pgTable(
  'contact_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    /** AES-GCM ciphertext, base64. The Worker never decrypts this. */
    ciphertext: text('ciphertext').notNull(),
    nonce: text('nonce').notNull(),
    keyId: uuid('key_id').notNull(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('contact_notes_contact_idx').on(t.contactId, t.createdAt)],
);

registerTable({
  table: 'contact_notes',
  retentionDays: 1095,
  // Classified by what the *server* can see, which is a contact id, a byte
  // length and a timestamp. The content is sealed with a key we do not hold.
  // Calling this 'contact' would overstate what a database disclosure yields.
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    "An organizer's notes on a person, encrypted in the browser with a key the server " +
    'never receives. Cascades with the contact. We store ciphertext because we want to ' +
    'be unable to read it, not merely unwilling.',
});

export const vaultKeys = pgTable(
  'vault_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** The data-encryption key, wrapped by a passphrase-derived key. */
    wrappedDek: text('wrapped_dek').notNull(),
    wrapNonce: text('wrap_nonce').notNull(),
    kdfSalt: text('kdf_salt').notNull(),
    kdfIterations: integer('kdf_iterations').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
  },
  (t) => [index('vault_keys_tenant_idx').on(t.tenantId)],
);

registerTable({
  table: 'vault_keys',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A wrapped key and its KDF parameters. No personal data, and useless without the ' +
    'passphrase. Kept while the workspace lives because purging it would destroy every ' +
    'note it seals.',
});

// ---------------------------------------------------------------------------
// import_batches
// ---------------------------------------------------------------------------

export const importBatches = pgTable(
  'import_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** An organizer-chosen label. Never the uploaded filename. */
    label: text('label').notNull(),
    status: text('status').$type<'previewed' | 'committed' | 'rolled_back'>().notNull(),
    rowCount: integer('row_count').notNull().default(0),
    createdCount: integer('created_count').notNull().default(0),
    updatedCount: integer('updated_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    committedAt: timestamp('committed_at', { withTimezone: true }),
  },
  (t) => [index('import_batches_tenant_idx').on(t.tenantId, t.createdAt)],
);

registerTable({
  table: 'import_batches',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Groups the contacts one import created so the whole batch can be undone. Matches the ' +
    'contacts window — a batch outliving its rows can no longer roll anything back.',
});
