/**
 * Convocare schema — events and shifts (§5.3).
 *
 * Authoritative DDL and RLS are in migrations/0003_convocare.sql.
 *
 * The registration worth reading here is `check_ins`. It is the first table in
 * the product to purge by anonymizing rather than deleting, and the reason is
 * in its comment.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { registerTable } from '../retention';
import { contacts } from './membra';
import { tenants, users } from './foundation';

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    title: text('title').notNull(),
    description: text('description'),

    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),

    locationName: text('location_name'),
    locationAddress: text('location_address'),

    capacity: integer('capacity'),

    isPublic: boolean('is_public').notNull().default(false),
    publicSlug: text('public_slug'),

    /** §5.3. Tri-state: unanswered must not read as "no". */
    accessTransit: boolean('access_transit'),
    accessStepFree: boolean('access_step_free'),
    accessAsl: boolean('access_asl'),
    accessQuietSpace: boolean('access_quiet_space'),
    accessNotes: text('access_notes'),

    recurrenceRule: text('recurrence_rule'),
    parentEventId: uuid('parent_event_id'),

    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('events_tenant_start_idx').on(t.tenantId, t.startsAt),
    uniqueIndex('events_public_slug_key').on(t.publicSlug),
  ],
);

registerTable({
  table: 'events',
  retentionDays: null,
  // The subject is an event, not a person. `created_by` is authorship.
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    "A gathering: when, where, and whether the room is reachable. The workspace's own " +
    'record of what it did. Who attended lives in rsvps and check_ins, which age out.',
});

export const eventShifts = pgTable(
  'event_shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    slots: integer('slots').notNull().default(1),
    requiredSkills: text('required_skills').array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('event_shifts_event_idx').on(t.eventId, t.startsAt)],
);

registerTable({
  table: 'event_shifts',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A slot needing volunteers, and what it takes to fill it. Describes the work, not ' +
    'who signed up — that is shift_signups.',
});

// ---------------------------------------------------------------------------
// rsvps and signups
// ---------------------------------------------------------------------------

export const rsvps = pgTable(
  'rsvps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),

    status: text('status').$type<'going' | 'waitlist' | 'declined' | 'cancelled'>().notNull(),
    guestCount: integer('guest_count').notNull().default(0),

    needsRide: boolean('needs_ride').notNull().default(false),
    canOfferRide: boolean('can_offer_ride').notNull().default(false),
    rideSeats: integer('ride_seats').notNull().default(0),

    /** A count. No ages, no names (§3, rule 4). */
    childcareChildren: integer('childcare_children').notNull().default(0),
    accessNeeds: text('access_needs'),

    /** Hash of the QR token. The token itself is only ever in the QR code. */
    checkinTokenHash: text('checkin_token_hash'),

    respondedAt: timestamp('responded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('rsvps_event_contact_key').on(t.eventId, t.contactId),
    index('rsvps_event_status_idx').on(t.eventId, t.status),
  ],
);

registerTable({
  table: 'rsvps',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'responded_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'That a person said they were coming, plus what they need to get there — a lift, ' +
    'childcare, a step-free room. Matches the contacts window; two years on, the fact ' +
    'that someone once needed a ride is not something worth still holding.',
});

export const shiftSignups = pgTable(
  'shift_signups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => eventShifts.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('shift_signups_shift_contact_key').on(t.shiftId, t.contactId)],
);

registerTable({
  table: 'shift_signups',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason: 'That a person took a shift. Ages out with the contact record it points at.',
});

// ---------------------------------------------------------------------------
// check_ins
// ---------------------------------------------------------------------------

export const checkIns = pgTable(
  'check_ins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    /** Nullable so the row can outlive the identity — see the registration. */
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('check_ins_event_idx').on(t.eventId)],
);

registerTable({
  table: 'check_ins',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'checked_in_at',
  tenantColumn: 'tenant_id',
  // The first table in the product to anonymize rather than delete, and the
  // only kind of case that justifies it: an aggregate depends on the row
  // existing. Attendance counts are what a group reports to its funders and to
  // itself, and they must not quietly change the night a purge runs. Nulling
  // the contact keeps "47 people came" true while ending our holding of who
  // they were. Deleting the row would rewrite history; keeping the contact
  // would hold a person's attendance record indefinitely. Neither is right.
  purge: 'anonymize',
  anonymizeColumns: ['contact_id'],
  reason:
    'That someone attended — a boolean and a timestamp, never a location (§3.1). ' +
    'Anonymized rather than deleted so historical attendance counts stay honest after ' +
    'the identities are gone.',
});
