/**
 * Federatio schema — the coalition layer (§5.11).
 *
 * Authoritative DDL and RLS are in migrations/0010_federatio.sql.
 *
 * Nothing here is personal data. That is the point of the module: a federation
 * is a set of relationships between *workspaces*, and the tenant boundary from
 * 0001 is untouched by it.
 */

import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { registerTable } from '../retention';
import { segments } from './membra';
import { memberships, tenants } from './foundation';

export const federations = pgTable(
  'federations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentTenantId: uuid('parent_tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('federations_parent_key').on(t.parentTenantId)],
);

registerTable({
  table: 'federations',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'parent_tenant_id',
  purge: 'delete',
  reason:
    'That a workspace acts as a coalition parent. A name and a pointer — being a parent ' +
    'grants no access by itself.',
});

export const federationChapters = pgTable(
  'federation_chapters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    federationId: uuid('federation_id')
      .notNull()
      .references(() => federations.id, { onDelete: 'cascade' }),
    chapterTenantId: uuid('chapter_tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
    /** Null until the chapter's own steward accepts. */
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('federation_chapters_key').on(t.federationId, t.chapterTenantId),
    index('federation_chapters_tenant_idx').on(t.chapterTenantId),
  ],
);

registerTable({
  table: 'federation_chapters',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'invited_at',
  tenantColumn: 'chapter_tenant_id',
  purge: 'delete',
  reason:
    'That a chapter was invited to a coalition and whether it accepted. Two-sided by ' +
    'construction — a parent cannot add a chapter to itself.',
});

export const federationGrants = pgTable(
  'federation_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    federationId: uuid('federation_id')
      .notNull()
      .references(() => federations.id, { onDelete: 'cascade' }),
    chapterTenantId: uuid('chapter_tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    scope: text('scope').$type<'contacts' | 'events' | 'funds'>().notNull(),
    segmentId: uuid('segment_id').references(() => segments.id, { onDelete: 'cascade' }),
    grantedBy: uuid('granted_by').references(() => memberships.id, { onDelete: 'set null' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('federation_grants_lookup_idx').on(t.federationId, t.chapterTenantId, t.scope)],
);

registerTable({
  table: 'federation_grants',
  // Kept rather than swept. A revoked grant is the evidence that a chapter once
  // shared something and then stopped — purging it would erase the record of an
  // access that happened, which is the opposite of what an audit needs.
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'granted_at',
  tenantColumn: 'chapter_tenant_id',
  purge: 'delete',
  reason:
    'That a chapter explicitly permitted a coalition to see a scope of its records, and ' +
    'when that stopped. The only door from a parent into a child, and its own audit trail.',
});

export const sharedSegments = pgTable(
  'shared_segments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    federationId: uuid('federation_id')
      .notNull()
      .references(() => federations.id, { onDelete: 'cascade' }),
    chapterTenantId: uuid('chapter_tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    segmentId: uuid('segment_id')
      .notNull()
      .references(() => segments.id, { onDelete: 'cascade' }),
    sharedAt: timestamp('shared_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('shared_segments_key').on(t.federationId, t.segmentId)],
);

registerTable({
  table: 'shared_segments',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'shared_at',
  tenantColumn: 'chapter_tenant_id',
  purge: 'delete',
  reason:
    'That a chapter published a segment definition to its coalition. The definition ' +
    'travels; the membership stays home, and reaching it still needs a grant.',
});
