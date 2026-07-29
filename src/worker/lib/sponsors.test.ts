import { describe, expect, it } from 'vitest';

import { sponsorOptions, type SponsorOptions } from './sponsors';
import type { Tx } from './rls';

/**
 * A tagged-template stand-in for the SQL client.
 *
 * The three queries are told apart by a distinctive fragment of each. Crude, and
 * correct for the purpose: it means a query that is rewritten without updating
 * this fake fails loudly here rather than silently returning the wrong table's
 * rows.
 */
function fakeTx(data: {
  sync?: Array<Record<string, unknown>>;
  committees?: Array<Record<string, unknown>>;
  members?: Array<Record<string, unknown>>;
  legislators?: Array<Record<string, unknown>>;
}): Tx {
  const tx = (strings: TemplateStringsArray) => {
    const sql = strings.join(' ');
    if (sql.includes('ref_sync')) return Promise.resolve(data.sync ?? []);
    if (sql.includes('ref_committee_members')) return Promise.resolve(data.members ?? []);
    if (sql.includes('ref_committees')) return Promise.resolve(data.committees ?? []);
    if (sql.includes('ref_legislators')) return Promise.resolve(data.legislators ?? []);
    throw new Error(`unexpected query: ${sql.slice(0, 80)}`);
  };
  return tx as unknown as Tx;
}

const NOW = new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const OK_SYNC = [
  { source: 'congress.legislators', upstream_at: daysAgo(3), fetched_at: NOW, status: 'ok', note: null },
  { source: 'congress.committees', upstream_at: daysAgo(3), fetched_at: NOW, status: 'ok', note: null },
  { source: 'openstates.people', upstream_at: null, fetched_at: NOW, status: 'ok', note: null },
  {
    source: 'openstates.committees',
    upstream_at: null,
    fetched_at: NOW,
    status: 'failed',
    note: 'OPENSTATES_API_KEY is not set.',
  },
];

describe('ordering', () => {
  /*
   * The chair is the single most actionable row in this module — the chair
   * decides whether a bill gets a hearing, which is where most bills die. A
   * roster that buries them alphabetically has thrown away its own point.
   */
  it('puts the chair first, then vice chair, then ranking member', async () => {
    const result = await sponsorOptions(
      fakeTx({
        sync: OK_SYNC,
        committees: [{ id: 'HSAG', name: 'Agriculture', chamber: 'lower', classification: 'committee', parent_name: null }],
        members: [
          { committee_id: 'HSAG', person_id: 'z', person_name: 'Zoe Member', role: 'member', rank: 4 },
          { committee_id: 'HSAG', person_id: 'r', person_name: 'Ray Ranking', role: 'ranking member', rank: 1 },
          { committee_id: 'HSAG', person_id: 'c', person_name: 'Cal Chair', role: 'chair', rank: 1 },
          { committee_id: 'HSAG', person_id: 'v', person_name: 'Val Vice', role: 'vice chair', rank: 2 },
        ],
        legislators: [],
      }),
      'US',
    );

    expect(result.committees[0].members.map((m) => m.role)).toEqual([
      'chair',
      'vice chair',
      'ranking member',
      'member',
    ]);
  });

  it('breaks a tie on rank, then on name', async () => {
    const result = await sponsorOptions(
      fakeTx({
        sync: OK_SYNC,
        committees: [{ id: 'X', name: 'X', chamber: 'upper', classification: 'committee', parent_name: null }],
        members: [
          { committee_id: 'X', person_id: '3', person_name: 'Ann Third', role: 'member', rank: 3 },
          { committee_id: 'X', person_id: '1', person_name: 'Bob First', role: 'member', rank: 1 },
          { committee_id: 'X', person_id: 'n2', person_name: 'Zed Same', role: 'member', rank: 2 },
          { committee_id: 'X', person_id: 'n1', person_name: 'Amy Same', role: 'member', rank: 2 },
        ],
        legislators: [],
      }),
      'US',
    );
    expect(result.committees[0].members.map((m) => m.name)).toEqual([
      'Bob First',
      'Amy Same',
      'Zed Same',
      'Ann Third',
    ]);
  });
});

describe('it never presents itself as a recommendation', () => {
  /*
   * The whole risk of a feature called "sponsor matching" is that a list gets
   * read as a ranked answer. Subject-to-committee matching is not built — it
   * needs a referral-history backfill — so the payload has to say so, every
   * time, in words.
   */
  it('says it is not ranked whenever it returns committees', async () => {
    const result = await sponsorOptions(
      fakeTx({
        sync: OK_SYNC,
        committees: [{ id: 'A', name: 'A', chamber: 'lower', classification: 'committee', parent_name: null }],
        members: [{ committee_id: 'A', person_id: 'p', person_name: 'P', role: 'chair', rank: 1 }],
        legislators: [{ id: 'p', name: 'P', party: 'X', chamber: 'lower', district: '1' }],
      }),
      'US',
    );

    expect(result.limitations.join(' ')).toMatch(/not a ranked recommendation/i);
    expect(result.limitations.join(' ')).toMatch(/chair decides whether a bill gets a hearing/i);
  });

  it('exposes no score or confidence anywhere in the payload', async () => {
    const result = await sponsorOptions(
      fakeTx({
        sync: OK_SYNC,
        committees: [{ id: 'A', name: 'A', chamber: 'lower', classification: 'committee', parent_name: null }],
        members: [{ committee_id: 'A', person_id: 'p', person_name: 'P', role: 'chair', rank: 1 }],
        legislators: [],
      }),
      'US',
    );
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/"score"|"confidence"|"match"|"likelihood"/i);
  });
});

describe('missing data is explained, never implied', () => {
  /*
   * A group shown an empty committee list will conclude their state has no
   * committees. The note from the failed sync is surfaced so they learn the
   * truth — we do not have the data — rather than a falsehood about their
   * legislature.
   */
  it('explains an absent committee roster using the sync note', async () => {
    const result = await sponsorOptions(
      fakeTx({
        sync: OK_SYNC,
        committees: [],
        members: [],
        legislators: [{ id: 'a', name: 'A Legislator', party: 'D', chamber: 'upper', district: '4' }],
      }),
      'TX',
    );

    expect(result.committees).toEqual([]);
    expect(result.limitations.join(' ')).toMatch(/do not have committee rosters for TX/i);
    expect(result.limitations.join(' ')).toMatch(/OPENSTATES_API_KEY/);
    // The roster we do have is still returned — a partial answer beats none.
    expect(result.legislators).toHaveLength(1);
  });

  it('says so plainly when it has no roster at all', async () => {
    const result = await sponsorOptions(
      fakeTx({ sync: OK_SYNC, committees: [], members: [], legislators: [] }),
      'WY',
    );
    expect(result.limitations.join(' ')).toMatch(/no roster for WY at all/i);
    expect(result.limitations.join(' ')).toMatch(/nothing here is a suggestion/i);
  });
});

describe('staleness', () => {
  /*
   * Open States refreshes committee membership weekly only while a chamber is in
   * session; a 6.5-month interim gap was observed in the research. A group
   * lobbying a chair who left the committee in March has wasted the approach
   * that mattered most, so age is surfaced rather than computed and discarded.
   */
  it('warns when a source is more than eight weeks old', async () => {
    const result = await sponsorOptions(
      fakeTx({
        sync: [
          { source: 'congress.committees', upstream_at: daysAgo(120), fetched_at: NOW, status: 'ok', note: null },
          { source: 'congress.legislators', upstream_at: daysAgo(2), fetched_at: NOW, status: 'ok', note: null },
        ],
        committees: [{ id: 'A', name: 'A', chamber: 'lower', classification: 'committee', parent_name: null }],
        members: [{ committee_id: 'A', person_id: 'p', person_name: 'P', role: 'chair', rank: 1 }],
        legislators: [{ id: 'p', name: 'P', party: 'D', chamber: 'lower', district: '1' }],
      }),
      'US',
    );

    const text = result.limitations.join(' ');
    expect(text).toMatch(/congress\.committees was last built 120 days ago/);
    expect(text).toMatch(/confirm anyone you are about to approach/i);
    // The fresh source must not be warned about.
    expect(text).not.toMatch(/congress\.legislators was last built/);
  });

  it('dates age against the upstream build, not our fetch', async () => {
    const result = await sponsorOptions(
      fakeTx({
        sync: [{ source: 'congress.legislators', upstream_at: daysAgo(30), fetched_at: NOW, status: 'ok', note: null }],
        legislators: [],
      }),
      'US',
    );
    // Fetching today says nothing about the age of a maintainer-run dataset.
    expect(result.sources[0].ageDays).toBe(30);
  });

  it('falls back to the fetch date when upstream gives none', async () => {
    const result = await sponsorOptions(
      fakeTx({
        sync: [{ source: 'openstates.people', upstream_at: null, fetched_at: daysAgo(5), status: 'ok', note: null }],
        legislators: [],
      }),
      'TX',
    );
    expect(result.sources[0].ageDays).toBe(5);
    expect(result.sources[0].upstreamAt).toBeNull();
  });
});

describe('source relevance', () => {
  /*
   * "State committee rosters are unavailable" is true and irrelevant to someone
   * drafting a federal bill, and an irrelevant warning teaches people to ignore
   * the relevant ones.
   */
  it('returns only the sources that bear on this jurisdiction', async () => {
    // Sorted here rather than asserted in order: ordering comes from the query's
    // ORDER BY, which the fake does not reproduce, so asserting it would be
    // testing the fake.
    const federal = await sponsorOptions(fakeTx({ sync: OK_SYNC, legislators: [] }), 'US');
    expect(federal.sources.map((s) => s.source).sort()).toEqual([
      'congress.committees',
      'congress.legislators',
    ]);

    const state = await sponsorOptions(fakeTx({ sync: OK_SYNC, legislators: [] }), 'TX');
    expect(state.sources.map((s) => s.source).sort()).toEqual([
      'openstates.committees',
      'openstates.people',
    ]);
  });

  it('normalises the jurisdiction it was asked about', async () => {
    const result: SponsorOptions = await sponsorOptions(fakeTx({ sync: OK_SYNC, legislators: [] }), ' tx ');
    expect(result.jurisdiction).toBe('TX');
  });
});
