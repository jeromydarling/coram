/**
 * Custos schema — safety infrastructure (§5.9).
 *
 * Authoritative DDL and RLS are in migrations/0009_custos.sql. Those policies
 * admit the `legal` role and nobody else, steward included; the reasoning is in
 * the migration header.
 *
 * Every retention window here measures from `closed_at`, not from creation.
 * That is what makes §5.9's "30-day hard purge after case close" fall out of
 * the ordinary nightly sweep instead of needing its own job: an open case has a
 * NULL closed_at, NULL fails the age comparison, and the row survives until
 * somebody closes it.
 */

import { bigint, date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { registerTable } from '../retention';
import { events } from './convocare';
import { memberships, tenants } from './foundation';

// ---------------------------------------------------------------------------
// Legal observation
// ---------------------------------------------------------------------------

export const observerReports = pgTable(
  'observer_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    narrative: text('narrative').notNull(),
    /** A place a human would name. Never coordinates (§3.7). */
    locationName: text('location_name'),
    occurredOn: date('occurred_on').notNull(),
    /** Nullable: an anonymous report is often the only one someone will file. */
    observerId: uuid('observer_id').references(() => memberships.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [index('observer_reports_tenant_idx').on(t.tenantId, t.occurredOn)],
);

registerTable({
  table: 'observer_reports',
  retentionDays: 30,
  pii: 'protected',
  // From closure, not creation. An open matter keeps its evidence; a closed one
  // stops being ours to hold thirty days later.
  timestampColumn: 'closed_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'What a legal observer saw at an action, so a lawyer can act on it. Purged thirty ' +
    'days after the matter closes — this is the material most likely to be sought by ' +
    'the people it describes.',
});

// ---------------------------------------------------------------------------
// Jail support
// ---------------------------------------------------------------------------

export const jailSupportCases = pgTable(
  'jail_support_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** A name, because you cannot bail out a uuid. Not a contacts reference. */
    personName: text('person_name').notNull(),
    facility: text('facility'),
    bookingRef: text('booking_ref'),
    status: text('status').$type<'held' | 'released' | 'transferred' | 'unknown'>().notNull(),
    needsBailCents: bigint('needs_bail_cents', { mode: 'number' }),
    nextHearingOn: date('next_hearing_on'),
    notes: text('notes'),
    arrestedOn: timestamp('arrested_on', { withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => memberships.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** The clock. Set by coram.close_jail_support_case. */
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [index('jail_support_open_idx').on(t.tenantId, t.status)],
);

registerTable({
  table: 'jail_support_cases',
  retentionDays: 30,
  pii: 'protected',
  timestampColumn: 'closed_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  // Deliberately not linked to contacts. An arrest must not write itself into
  // the CRM, where it would be visible to every organizer holding that turf and
  // kept for two years instead of thirty days. §3.7 permits criminal history
  // only as "active jail-support status", and this table is exactly that scope
  // and no wider.
  reason:
    'That someone is being held, where, and what it takes to get them out. The narrowest ' +
    'thing that lets a support crew act. Thirty days after the case closes it is gone — ' +
    'no soft-delete, no archive, no export first.',
});

// ---------------------------------------------------------------------------
// Emergency contact trees
// ---------------------------------------------------------------------------

export const contactTrees = pgTable(
  'contact_trees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('contact_trees_tenant_name_key').on(t.tenantId, t.name)],
);

registerTable({
  table: 'contact_trees',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A named call-down list. The structure only — who is on it is contact_tree_nodes, ' +
    'which ages out on its own.',
});

export const contactTreeNodes = pgTable(
  'contact_tree_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    treeId: uuid('tree_id')
      .notNull()
      .references(() => contactTrees.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    displayName: text('display_name').notNull(),
    phone: text('phone'),
    email: text('email'),
    roleNote: text('role_note'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('contact_tree_nodes_tree_idx').on(t.treeId, t.parentId, t.position)],
);

registerTable({
  table: 'contact_tree_nodes',
  retentionDays: 730,
  pii: 'contact',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  // Held here rather than referenced from contacts on purpose: an emergency
  // contact is often a partner or a lawyer who is not a supporter of the group
  // and must not become a CRM record by virtue of being someone's next of kin.
  reason:
    "Who to call when something happens to someone, and in what order. Kept apart from " +
    'the CRM because a lawyer or a partner is not a supporter and should not become one.',
});

// ---------------------------------------------------------------------------
// Documents the whole group can read
// ---------------------------------------------------------------------------

export const rightsGuides = pgTable(
  'rights_guides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    stateCode: text('state_code').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('rights_guides_tenant_state_title_key').on(t.tenantId, t.stateCode, t.title)],
);

registerTable({
  table: 'rights_guides',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'updated_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'What to say and do if you are stopped, by state. A document the group wrote for ' +
    'itself, readable by everyone — a rights guide the members cannot open does nothing.',
});

export const riskBriefings = pgTable(
  'risk_briefings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [index('risk_briefings_tenant_idx').on(t.tenantId, t.createdAt)],
);

registerTable({
  table: 'risk_briefings',
  retentionDays: 90,
  pii: 'none',
  timestampColumn: 'closed_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'What could go wrong at a particular action and what to do about it. Cleared ninety ' +
    'days after the action is closed out — a stale assessment read as current is worse ' +
    'than none.',
});
