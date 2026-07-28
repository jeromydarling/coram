/**
 * Consilium schema — governance (§5.8).
 *
 * Authoritative DDL, the RLS, and the ballot functions are in
 * migrations/0007_consilium.sql. docs/ballot-secrecy.md explains the three-table
 * separation and what it does and does not guarantee.
 *
 * The registrations worth reading are `ballot_tokens` and `votes`. Their
 * retention is set by ballot secrecy rather than by data minimization, and in
 * one case that means keeping something longer than the usual rule would.
 */

import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { registerTable } from '../retention';
import { memberships, tenants } from './foundation';
import type { VotingMethod, VoteChoice } from '../tally';

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export const proposals = pgTable(
  'proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    status: text('status')
      .$type<'draft' | 'discussion' | 'voting' | 'adopted' | 'rejected' | 'withdrawn'>()
      .notNull(),
    proposedBy: uuid('proposed_by').references(() => memberships.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [index('proposals_tenant_idx').on(t.tenantId, t.createdAt)],
);

registerTable({
  table: 'proposals',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    "What a body decided and what it was asked to decide. A group's own governance " +
    'record, which it needs indefinitely to know what its own rules are.',
});

export const proposalComments = pgTable(
  'proposal_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    authorId: uuid('author_id').references(() => memberships.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
  },
  (t) => [index('proposal_comments_proposal_idx').on(t.proposalId, t.createdAt)],
);

registerTable({
  table: 'proposal_comments',
  // Longer than most personal data because a deliberation is only legible with
  // its argument attached — minutes recording "adopted 40-12" and nothing else
  // tell a group in five years what it decided but not why.
  retentionDays: 2555,
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'What members said to each other while deciding. Attributed on purpose — a ' +
    'deliberation is a record of who argued what. Kept as long as the decision it ' +
    'belongs to is likely to be cited.',
});

export const amendments = pgTable(
  'amendments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    rationale: text('rationale'),
    status: text('status').$type<'proposed' | 'accepted' | 'rejected' | 'withdrawn'>().notNull(),
    proposedBy: uuid('proposed_by').references(() => memberships.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [index('amendments_proposal_idx').on(t.proposalId)],
);

registerTable({
  table: 'amendments',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A change someone moved to a proposal. Kept with the proposal so what was actually ' +
    'voted on stays legible after the fact.',
});

// ---------------------------------------------------------------------------
// Ballots and the three unlinked tables
// ---------------------------------------------------------------------------

export const ballots = pgTable(
  'ballots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    method: text('method').$type<VotingMethod>().notNull(),
    isSecret: boolean('is_secret').notNull().default(true),
    quorumNumerator: integer('quorum_numerator').notNull(),
    quorumDenominator: integer('quorum_denominator').notNull(),
    thresholdNumerator: integer('threshold_numerator').notNull(),
    thresholdDenominator: integer('threshold_denominator').notNull(),
    options: jsonb('options').notNull(),
    opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
    closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
    /** Frozen at open — quorum against a moving roll is not a quorum. */
    eligibleCount: integer('eligible_count'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    result: text('result').$type<'adopted' | 'rejected' | 'no_quorum' | 'blocked'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ballots_proposal_idx').on(t.proposalId)],
);

registerTable({
  table: 'ballots',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'How a decision was taken: the method, the quorum, the bar, and the outcome. The ' +
    'group needs this to know its own decisions are valid.',
});

export const ballotEnrollments = pgTable(
  'ballot_enrollments',
  {
    ballotId: uuid('ballot_id')
      .notNull()
      .references(() => ballots.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Whether a token was handed over. Not when — a time would correlate. */
    collected: boolean('collected').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.ballotId, t.membershipId] })],
);

registerTable({
  table: 'ballot_enrollments',
  retentionDays: 2555,
  pii: 'pseudonym',
  // No timestamp of its own, by design — see the migration. Ages against the
  // ballot it belongs to, which is what a sweep should measure anyway.
  timestampColumn: 'ballot_id',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Who was eligible for a ballot and whether they took a token. Says nothing about how ' +
    'anyone voted. Kept with the ballot so turnout stays auditable.',
});

export const ballotTokens = pgTable(
  'ballot_tokens',
  {
    ballotId: uuid('ballot_id')
      .notNull()
      .references(() => ballots.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    spentAt: timestamp('spent_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.ballotId, t.tokenHash] })],
);

registerTable({
  table: 'ballot_tokens',
  /*
   * Purged aggressively — 90 days after the ballot — and for an unusual reason.
   *
   * Most retention here is about not holding personal data. This is the
   * opposite: the table holds no personal data at all, and the risk is that
   * `spent_at` is a timeline of when votes arrived. Correlated against anything
   * else that timestamps a person, a long-lived spend log erodes the very
   * secrecy the token scheme exists to provide. The coarse `cast_hour` on
   * `votes` closes one half of that; deleting the fine-grained spend times
   * closes the other.
   *
   * Nothing needs them once the ballot has closed and the result is recorded.
   */
  retentionDays: 90,
  pii: 'none',
  timestampColumn: 'spent_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Valid ballot tokens and whether each was spent. Holds no voter. Deleted soon after ' +
    'the ballot closes because the spend times are a correlation risk, not because they ' +
    'are personal.',
});

export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ballotId: uuid('ballot_id')
      .notNull()
      .references(() => ballots.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Secret ballot: the voter is this and nothing else. */
    tokenHash: text('token_hash'),
    /** Recorded ballot: attributed on purpose. */
    membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'cascade' }),
    choice: text('choice').$type<VoteChoice>(),
    rankings: jsonb('rankings'),
    /** Rounded to the hour. A precise time narrows who cast it. */
    castHour: timestamp('cast_hour', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('votes_token_key').on(t.ballotId, t.tokenHash),
    uniqueIndex('votes_membership_key').on(t.ballotId, t.membershipId),
  ],
);

registerTable({
  table: 'votes',
  retentionDays: null,
  // For a secret ballot this is a token hash and a choice — no person in it.
  // A recorded ballot does carry a membership, but that is the explicit
  // governance choice of a body that wants its delegates accountable, and
  // purging those would destroy the record it asked for.
  pii: 'none',
  timestampColumn: 'cast_hour',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'The votes themselves. Kept indefinitely because a decision a group cannot recount ' +
    'is a decision it cannot defend. Secret ballots carry a token hash and no voter.',
});

// ---------------------------------------------------------------------------
// Proxies, bylaws, minutes
// ---------------------------------------------------------------------------

export const proxies = pgTable(
  'proxies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    grantorId: uuid('grantor_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    granteeId: uuid('grantee_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    ballotId: uuid('ballot_id').references(() => ballots.id, { onDelete: 'cascade' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('proxies_grantee_idx').on(t.granteeId)],
);

registerTable({
  table: 'proxies',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'granted_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'That one member may act for another, and whether it has been revoked. Who trusts ' +
    'whom is a political fact about a person, so it ages out rather than accumulating.',
});

export const bylaws = pgTable(
  'bylaws',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('bylaws_tenant_title_key').on(t.tenantId, t.title)],
);

registerTable({
  table: 'bylaws',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason: "A rule the group binds itself by. Its own constitution; it keeps it as long as it exists.",
});

export const bylawVersions = pgTable(
  'bylaw_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    bylawId: uuid('bylaw_id')
      .notNull()
      .references(() => bylaws.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    body: text('body').notNull(),
    adoptedByProposalId: uuid('adopted_by_proposal_id').references(() => proposals.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => memberships.id, { onDelete: 'set null' }),
  },
  (t) => [uniqueIndex('bylaw_versions_bylaw_version_key').on(t.bylawId, t.version)],
);

registerTable({
  table: 'bylaw_versions',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Every version a bylaw has had, and which proposal adopted it. Append-only — the ' +
    'history is the reason this lives here rather than in a shared document.',
});

export const minutes = pgTable(
  'minutes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    proposalId: uuid('proposal_id').references(() => proposals.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    metOn: timestamp('met_on', { withTimezone: false }).notNull(),
    /** Generated as a draft; a human adopts them. */
    adoptedAt: timestamp('adopted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('minutes_tenant_idx').on(t.tenantId, t.metOn)],
);

registerTable({
  table: 'minutes',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'The record of a meeting. Generated as a draft and adopted by a human, because §5.8 ' +
    'asks for automatic generation, not automatic authority.',
});
