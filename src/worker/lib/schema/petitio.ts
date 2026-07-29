/**
 * Retention registration for Petitio (migration 0012).
 *
 * A bill is a political position a group is trying to make law. It is meant to
 * outlive the campaign — a measure that failed in 2026 is the starting point
 * for the 2028 attempt, and expiring it would throw away the most valuable
 * thing the group produced. So the drafts, their sections and their
 * endorsements have no expiry and leave with the workspace.
 *
 * The outreach log is the exception, and the reason is the same reason the
 * migration's header note exists: it is the one table here that records what a
 * named person did.
 */

import { registerTable } from '../retention';

registerTable({
  table: 'bills',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A draft bill and the problem it addresses. The group’s own political position, meant to ' +
    'outlive the campaign — a measure that failed this session is the starting point for the ' +
    'next one. No personal data. Removed with the tenant by cascade.',
});

registerTable({
  table: 'bill_sections',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'The statutory language itself, one row per section. Kept for as long as the bill is, for the ' +
    'same reason. Cascades from bills and from the tenant.',
});

registerTable({
  table: 'bill_endorsements',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Organisations that have endorsed a bill, by name and with their own public URL. An ' +
    'organisation is not a person, and an endorsement is a statement made to be attributed — ' +
    'this is the credibility artefact a legislator’s staff asks to see. Individual supporters ' +
    'are never recorded here; they are contacts in Membra.',
});

/*
 * Two years, and the shortest retention of anything in this module.
 *
 * This table names one of our own members against a public office they
 * approached. That is a smaller record than the relationship graph the original
 * brief asked for — there is no tie-strength score and no note about a named
 * staffer — but it is still a log of who lobbied whom, and §3.4 does not let a
 * table like that sit forever because nobody got round to expiring it.
 *
 * Two years rather than one because a legislative cycle is two years in most
 * states and a biennium in several: expiring at twelve months would delete the
 * record of last session's approach exactly when the group returns to the same
 * office to try again, which is when it is most useful. Beyond one cycle it is
 * history, and history here is a liability rather than an asset.
 */
registerTable({
  table: 'bill_outreach',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Which public office was approached, what came of it, and which of our members did it. Kept ' +
    'two years — one legislative cycle in most states — so a group returning to the same office ' +
    'next session knows what happened last time. Deleted after that: it is a record of who ' +
    'lobbied whom, and past one cycle it is a liability rather than an asset. Deliberately holds ' +
    'no assessment of any named staffer and no measure of anyone’s influence.',
});
