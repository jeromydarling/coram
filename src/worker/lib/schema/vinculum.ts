/**
 * Vinculum schema — relational organizing (§5.2).
 *
 * Authoritative DDL and RLS are in migrations/0006_vinculum.sql.
 *
 * `relationship_edges` is ported from CROS at commit 1ff1e33. The shape is
 * theirs; the tenant column and the policies are not. See docs/porting-map.md.
 */

import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { registerTable } from '../retention';
import { contacts } from './membra';
import { memberships, tenants, users } from './foundation';

// ---------------------------------------------------------------------------
// Configuration — outcome codes and ladders
// ---------------------------------------------------------------------------

export const outcomeCodes = pgTable(
  'outcome_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    label: text('label').notNull(),
    isPositive: boolean('is_positive').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('outcome_codes_tenant_code_key').on(t.tenantId, t.code)],
);

registerTable({
  table: 'outcome_codes',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'How a workspace names the ways a conversation can go — "committed", "not now", ' +
    "\"wants to host\". Their own vocabulary. Which code a person got is one_to_ones.",
});

export const ladders = pgTable(
  'ladders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ladders_tenant_name_key').on(t.tenantId, t.name)],
);

registerTable({
  table: 'ladders',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A ladder of engagement the workspace defined for itself. Structure, not people — ' +
    'who is on which rung is ladder_placements.',
});

export const ladderRungs = pgTable(
  'ladder_rungs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    ladderId: uuid('ladder_id')
      .notNull()
      .references(() => ladders.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ladder_rungs_ladder_position_key').on(t.ladderId, t.position)],
);

registerTable({
  table: 'ladder_rungs',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'The steps on a ladder, in order. Deleted with the ladder it belongs to; never ' +
    'swept on its own, because a rung outliving or predeceasing its ladder is nonsense.',
});

// ---------------------------------------------------------------------------
// About people
// ---------------------------------------------------------------------------

export const ladderPlacements = pgTable(
  'ladder_placements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    ladderId: uuid('ladder_id')
      .notNull()
      .references(() => ladders.id, { onDelete: 'cascade' }),
    rungId: uuid('rung_id')
      .notNull()
      .references(() => ladderRungs.id, { onDelete: 'cascade' }),
    movedAt: timestamp('moved_at', { withTimezone: true }).notNull().defaultNow(),
    movedBy: uuid('moved_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [uniqueIndex('ladder_placements_contact_ladder_key').on(t.contactId, t.ladderId)],
);

registerTable({
  table: 'ladder_placements',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'moved_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    "Where one person currently stands on one ladder. Current position only — the route " +
    'they took is not kept, because a permanent record of someone\'s political development ' +
    'is not something we want to hold.',
});

export const oneToOnes = pgTable(
  'one_to_ones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    organizerId: uuid('organizer_id').references(() => users.id, { onDelete: 'set null' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    outcomeCodeId: uuid('outcome_code_id').references(() => outcomeCodes.id, {
      onDelete: 'set null',
    }),
    /** What was agreed. About the work, not about the person. */
    nextStep: text('next_step'),
    movedToRungId: uuid('moved_to_rung_id').references(() => ladderRungs.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('one_to_ones_contact_idx').on(t.contactId, t.occurredAt)],
);

registerTable({
  table: 'one_to_ones',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'occurred_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  // There is no notes column, and that is the point. A subpoena here returns
  // "47 conversations, outcomes coded", not 47 paragraphs about named people's
  // politics, families, and fears. Those live in contact_notes, encrypted
  // under a key the server does not hold (§3.3).
  reason:
    'That a conversation happened, how it went as a coded outcome, and what was agreed ' +
    'next. Holds no account of what was said — that is the encrypted vault.',
});

export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [uniqueIndex('assignments_contact_membership_key').on(t.contactId, t.membershipId)],
);

registerTable({
  table: 'assignments',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'assigned_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Which organizer holds the relationship with which supporter. Points at a membership ' +
    'rather than a user, so it dies when someone leaves the workspace.',
});

export const followUps = pgTable(
  'follow_ups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'set null' }),
    reason: text('reason').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    snoozeCount: integer('snooze_count').notNull().default(0),
    escalatedAt: timestamp('escalated_at', { withTimezone: true }),
    escalatedTo: uuid('escalated_to').references(() => memberships.id, { onDelete: 'set null' }),
    status: text('status').$type<'open' | 'done' | 'dropped'>().notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('follow_ups_contact_idx').on(t.contactId)],
);

registerTable({
  table: 'follow_ups',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A reminder that someone is owed a conversation, and by whom. Ages out with the ' +
    'contact — an unclosed follow-up from three years ago is not a task, it is a reproach.',
});

// ---------------------------------------------------------------------------
// relationship_edges
// ---------------------------------------------------------------------------

export const relationshipEdges = pgTable(
  'relationship_edges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The column CROS did not have. Without it the policy could not be right. */
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    sourceType: text('source_type').$type<'contact' | 'event' | 'fund' | 'turf'>().notNull(),
    sourceId: uuid('source_id').notNull(),
    targetType: text('target_type').$type<'contact' | 'event' | 'fund' | 'turf'>().notNull(),
    targetId: uuid('target_id').notNull(),
    edgeReason: text('edge_reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('relationship_edges_unique').on(
      t.tenantId,
      t.sourceType,
      t.sourceId,
      t.targetType,
      t.targetId,
    ),
    index('relationship_edges_source_idx').on(t.tenantId, t.sourceType, t.sourceId),
  ],
);

registerTable({
  table: 'relationship_edges',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'That two things in the workspace are connected, and why — two people at the same ' +
    'meeting, one who invited another. Observed connections only, never inferred ones. ' +
    'Ages out with the contacts it joins.',
});
