/**
 * Retention registration for reference data (migration 0013).
 *
 * The first `scope: 'reference'` tables in the product. They hold published
 * facts — who currently holds which public office, and which committees they
 * sit on — identical for every workspace, with no tenant column and nothing for
 * the nightly sweep to age out. The ingest replaces them wholesale.
 *
 * `pii: 'public_record'` rather than 'none', because pretending a legislator's
 * name is not personal data would be the wrong kind of convenient. It is
 * personal data about a person acting in a public office, published by a
 * government that will go on publishing it — so deleting our copy protects
 * nobody, which is why indefinite retention is allowed for this class and not
 * for 'contact'.
 *
 * What makes that acceptable is the line the registry now enforces: a reference
 * table may not declare contact-class data, and none of these ingest the email,
 * phone, address, or social columns the sources publish alongside the roster.
 * See the header note in 0013_refdata.sql.
 */

import { registerTable } from '../retention';

registerTable({
  table: 'ref_sync',
  retentionDays: null,
  pii: 'none',
  scope: 'reference',
  timestampColumn: 'fetched_at',
  purge: 'delete',
  reason:
    'One row per upstream source recording what was fetched, when it was built upstream, and ' +
    'whether it worked. Sponsor matching shows this date beside every roster: Open States ' +
    'refreshes committee membership weekly only while a chamber is in session, and a roster ' +
    'presented without a date will be read as current when it can be months old.',
});

registerTable({
  table: 'ref_legislators',
  retentionDays: null,
  pii: 'public_record',
  scope: 'reference',
  timestampColumn: 'updated_at',
  purge: 'delete',
  reason:
    'The current roster — name, party, chamber, district — for all fifty states, DC and ' +
    'Congress. Sponsor matching cannot name a possible sponsor without it. Deliberately holds no ' +
    'contact details, so that 0012_petitio.sql’s promise that we hold none stays true.',
});

registerTable({
  table: 'ref_committees',
  retentionDays: null,
  pii: 'none',
  scope: 'reference',
  timestampColumn: 'updated_at',
  purge: 'delete',
  reason:
    'Committees and subcommittees per jurisdiction, with the referral system code needed to join ' +
    'a bill’s committee to its roster. A bill lives or dies in committee, so this is the table ' +
    'that makes "who would actually hear this" answerable. Holds no personal data.',
});

registerTable({
  table: 'ref_committee_members',
  retentionDays: null,
  pii: 'public_record',
  scope: 'reference',
  timestampColumn: 'updated_at',
  purge: 'delete',
  reason:
    'Who sits on each committee and in what role. The chair is the single most actionable fact ' +
    'in the whole module — the chair decides whether a bill gets a hearing — and this is the only ' +
    'place it is recorded. Names and roles only, no contact details.',
});
