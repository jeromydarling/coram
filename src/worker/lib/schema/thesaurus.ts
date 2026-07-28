/**
 * Thesaurus schema — fundraising, dues, and mutual aid (§5.6).
 *
 * Authoritative DDL, the take-rate trigger, and the dual-approval functions are
 * in migrations/0005_thesaurus.sql.
 *
 * The retention windows here are the longest in the product, and they are the
 * one place where a rule outside CLAUDE.md sets the number. See the note on
 * `contributions`.
 */

import { bigint, boolean, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { registerTable } from '../retention';
import { contacts } from './membra';
import { tenants, users } from './foundation';
import type { FundKind } from '../takerate';

// ---------------------------------------------------------------------------
// funds
// ---------------------------------------------------------------------------

export const funds = pgTable(
  'funds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    kind: text('kind').$type<FundKind>().notNull(),
    goalCents: bigint('goal_cents', { mode: 'number' }),
    currency: text('currency').notNull().default('USD'),
    /** Escrow balances, maintained by trigger. Net of the take. */
    raisedCents: bigint('raised_cents', { mode: 'number' }).notNull().default(0),
    disbursedCents: bigint('disbursed_cents', { mode: 'number' }).notNull().default(0),
    isPublic: boolean('is_public').notNull().default(false),
    publicSlug: text('public_slug'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('funds_tenant_idx').on(t.tenantId, t.createdAt),
    uniqueIndex('funds_public_slug_key').on(t.publicSlug),
  ],
);

registerTable({
  table: 'funds',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A fundraising campaign or an escrowed pot: its name, target, and running total. ' +
    'The workspace\'s own financial record. Who gave is contributions.',
});

// ---------------------------------------------------------------------------
// contributions
// ---------------------------------------------------------------------------

export const contributions = pgTable(
  'contributions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    fundId: uuid('fund_id')
      .notNull()
      .references(() => funds.id, { onDelete: 'cascade' }),
    /** Null for an anonymous gift, which is a supported case, not a gap. */
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    /** Computed by trigger from coram.take_basis_points. Never set by the app. */
    takeCents: bigint('take_cents', { mode: 'number' }).notNull().default(0),
    rail: text('rail').$type<'stripe' | 'lightning'>().notNull().default('stripe'),
    status: text('status').$type<'pending' | 'settled' | 'refunded' | 'failed'>().notNull(),
    externalRef: text('external_ref'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
  },
  (t) => [
    index('contributions_fund_idx').on(t.fundId, t.occurredAt),
    uniqueIndex('contributions_external_ref_key').on(t.tenantId, t.externalRef),
  ],
);

registerTable({
  table: 'contributions',
  /*
   * Seven years — by a distance the longest window in the product, and the
   * only one set by something other than CLAUDE.md.
   *
   * A US nonprofit has to be able to substantiate its receipts on audit, and a
   * donor claiming a deduction may be asked for a record years later. Purging
   * at the two-year mark we use elsewhere would leave groups unable to file and
   * donors unable to prove a gift, which is not data minimization — it is
   * handing them a different problem.
   *
   * What keeps it defensible is the shape of the row rather than its age: an
   * amount, a fund, a timestamp, and a contact id. No card details, no bank
   * details, no address, no billing name. Everything identifying about the
   * payment stayed with the processor. If the contact is purged at its own
   * two-year mark the reference nulls out, and what survives is an
   * unattributed number in a ledger.
   */
  retentionDays: 2555,
  pii: 'pseudonym',
  timestampColumn: 'occurred_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'That a gift was made, to which fund, and for how much. Kept seven years because ' +
    'charity audit and donor substantiation require it. Holds no payment instrument and ' +
    'no billing details — those never leave the processor.',
});

// ---------------------------------------------------------------------------
// recurring giving and dues
// ---------------------------------------------------------------------------

export const recurringGifts = pgTable(
  'recurring_gifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    fundId: uuid('fund_id')
      .notNull()
      .references(() => funds.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('USD'),
    interval: text('interval').$type<'monthly' | 'quarterly' | 'annual'>().notNull(),
    externalRef: text('external_ref'),
    status: text('status').$type<'active' | 'paused' | 'cancelled'>().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => [index('recurring_gifts_fund_idx').on(t.fundId, t.status)],
);

registerTable({
  table: 'recurring_gifts',
  retentionDays: 2555,
  pii: 'pseudonym',
  timestampColumn: 'started_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A standing gift and its schedule. Same seven-year audit window as the contributions ' +
    'it produces. The card lives with the processor; this is a reference and an amount.',
});

export const duesSchedules = pgTable(
  'dues_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('USD'),
    interval: text('interval').$type<'monthly' | 'quarterly' | 'annual'>().notNull(),
    /** Which band of the workspace's scale they picked. Never their income. */
    scaleBand: text('scale_band'),
    hardshipWaiver: boolean('hardship_waiver').notNull().default(false),
    externalRef: text('external_ref'),
    status: text('status').$type<'active' | 'paused' | 'cancelled'>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('dues_schedules_tenant_contact_key').on(t.tenantId, t.contactId)],
);

registerTable({
  table: 'dues_schedules',
  retentionDays: 2555,
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'What a member pays and how often, plus whether they have a hardship waiver. ' +
    'Records the band they chose, never their income. Seven years to match the rest of ' +
    'the financial record.',
});

// ---------------------------------------------------------------------------
// disbursements
// ---------------------------------------------------------------------------

export const disbursements = pgTable(
  'disbursements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    fundId: uuid('fund_id')
      .notNull()
      .references(() => funds.id, { onDelete: 'cascade' }),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    /** Free text. The composer warns against naming a person — see the reason. */
    purpose: text('purpose').notNull(),
    status: text('status')
      .$type<'proposed' | 'approved' | 'paid' | 'rejected' | 'cancelled'>()
      .notNull(),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (t) => [index('disbursements_fund_idx').on(t.fundId, t.status)],
);

registerTable({
  table: 'disbursements',
  retentionDays: 2555,
  // `purpose` is free text, and a careless one could name a bail recipient —
  // which under §5.9 would belong in Custos behind a 30-day purge, not here for
  // seven years. The schema cannot stop that, so the UI says so at the point of
  // writing and this classification assumes the worst case rather than the
  // best.
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'That money left an escrowed fund, for how much and what for, and who approved it. ' +
    'Required for audit and for a group to be accountable to its own members about a ' +
    'mutual aid fund.',
});

export const disbursementApprovals = pgTable(
  'disbursement_approvals',
  {
    disbursementId: uuid('disbursement_id')
      .notNull()
      .references(() => disbursements.id, { onDelete: 'cascade' }),
    approverId: uuid('approver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.disbursementId, t.approverId] })],
);

registerTable({
  table: 'disbursement_approvals',
  retentionDays: 2555,
  pii: 'pseudonym',
  timestampColumn: 'approved_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Which two stewards signed off on a payment. Kept as long as the disbursement — an ' +
    'approval that outlives its record, or dies before it, proves nothing.',
});
