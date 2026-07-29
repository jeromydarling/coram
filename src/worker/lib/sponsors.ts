/**
 * Who could carry this bill.
 *
 * The hardest, most opaque step in the whole process is "who do we even ask",
 * and this is the part of the product that answers it. What it does *not* do is
 * pretend to more certainty than the data supports, and that distinction runs
 * through every function here.
 *
 * ---------------------------------------------------------------------------
 * What this can and cannot do yet, stated plainly
 * ---------------------------------------------------------------------------
 *
 * It can name the committee that would hear a bill, and the people on it, chair
 * first. The chair is the single most actionable fact available: the chair
 * decides whether a bill gets a hearing, which is where most bills die.
 *
 * It cannot yet rank committees by subject. Doing that means deriving a
 * policy-area → committee mapping from historical referral data, which measured
 * 61.5% top-1 and 83.3% top-3 on 10,529 labelled House bills — good enough to
 * ship as a ranked shortlist, and it needs a BILLSTATUS backfill that is not
 * here. The prose `jurisdiction` field on federal committees is not a substitute:
 * it exists for 42 of 49 committees, for none of the 181 subcommittees, and it
 * contradicts practice often enough to mislead (Armed Forces bills go to
 * Veterans' Affairs 52% of the time).
 *
 * So this returns a roster to choose from, not a recommendation. A shortlist
 * a group can act on beats a confident wrong answer, and the difference is
 * visible in the return type: there is no score.
 */

import type { Tx } from './rls';

export interface SyncState {
  source: string;
  /** When the upstream itself was built, where it says. Null where it does not. */
  upstreamAt: string | null;
  fetchedAt: string;
  status: 'ok' | 'failed';
  note: string | null;
  /** Days since the upstream build, or since our fetch when upstream is silent. */
  ageDays: number;
}

export interface CommitteeRoster {
  committeeId: string;
  name: string;
  chamber: string | null;
  classification: string | null;
  parentName: string | null;
  members: Array<{
    personId: string;
    name: string;
    role: string;
    rank: number | null;
  }>;
}

export interface SponsorOptions {
  jurisdiction: string;
  /** Committees, chair first within each. Empty when we hold none for this jurisdiction. */
  committees: CommitteeRoster[];
  /** The chamber roster, for a jurisdiction where we have members but no committees. */
  legislators: Array<{ id: string; name: string; party: string | null; chamber: string | null; district: string | null }>;
  /**
   * Every source these rows came from, with its age. Returned rather than
   * summarised because a UI must be able to date the roster it is showing: Open
   * States refreshes committee membership weekly only while a chamber is in
   * session, and rosters have been observed six months stale across an interim.
   */
  sources: SyncState[];
  /**
   * What is missing and why, in words for a person. Empty when nothing is.
   * Never left implicit — a group shown no committees will conclude none exist.
   */
  limitations: string[];
}

/** Chair, then vice chair, then ranking member, then everyone else by rank. */
const ROLE_ORDER: Record<string, number> = {
  chair: 0,
  'vice chair': 1,
  'ranking member': 2,
  member: 3,
};

function ageInDays(from: string | null, fallback: string): number {
  const at = Date.parse(from ?? fallback);
  return Math.max(0, Math.floor((Date.now() - at) / 86_400_000));
}

export async function loadSyncState(tx: Tx): Promise<SyncState[]> {
  const rows = await tx`
    SELECT source, upstream_at, fetched_at, status, note FROM public.ref_sync ORDER BY source
  `;
  return rows.map((r) => {
    const upstreamAt = r.upstream_at ? new Date(r.upstream_at as string).toISOString() : null;
    const fetchedAt = new Date(r.fetched_at as string).toISOString();
    return {
      source: r.source as string,
      upstreamAt,
      fetchedAt,
      status: r.status as 'ok' | 'failed',
      note: (r.note as string | null) ?? null,
      ageDays: ageInDays(upstreamAt, fetchedAt),
    };
  });
}

/**
 * Which sources matter for this jurisdiction.
 *
 * Federal bills are served by the congress.* sources and state bills by the
 * openstates.* ones. Returning all four regardless would put "state committee
 * rosters are unavailable" in front of someone drafting a federal bill, where it
 * is true and irrelevant.
 */
function relevantSources(all: SyncState[], jurisdiction: string): SyncState[] {
  const prefix = jurisdiction === 'US' ? 'congress.' : 'openstates.';
  return all.filter((s) => s.source.startsWith(prefix));
}

/**
 * The people who could carry this bill in this jurisdiction.
 *
 * Runs under the caller's RLS like everything else, though these tables have
 * none: they are reference data, granted SELECT to coram_app and nothing more.
 */
export async function sponsorOptions(tx: Tx, jurisdiction: string): Promise<SponsorOptions> {
  const code = jurisdiction.trim().toUpperCase();
  const allSources = await loadSyncState(tx);
  const sources = relevantSources(allSources, code);

  const committeeRows = await tx`
    SELECT c.id, c.name, c.chamber, c.classification, p.name AS parent_name
    FROM public.ref_committees c
    LEFT JOIN public.ref_committees p ON p.id = c.parent_id
    WHERE c.jurisdiction = ${code}
    ORDER BY COALESCE(p.name, c.name), c.classification DESC, c.name
  `;

  const memberRows = committeeRows.length
    ? await tx`
        SELECT m.committee_id, m.person_id, m.person_name, m.role, m.rank
        FROM public.ref_committee_members m
        JOIN public.ref_committees c ON c.id = m.committee_id
        WHERE c.jurisdiction = ${code}
      `
    : [];

  const byCommittee = new Map<string, CommitteeRoster['members']>();
  for (const m of memberRows) {
    const list = byCommittee.get(m.committee_id as string) ?? [];
    list.push({
      personId: m.person_id as string,
      name: m.person_name as string,
      role: m.role as string,
      rank: (m.rank as number | null) ?? null,
    });
    byCommittee.set(m.committee_id as string, list);
  }

  const committees: CommitteeRoster[] = committeeRows.map((c) => ({
    committeeId: c.id as string,
    name: c.name as string,
    chamber: (c.chamber as string | null) ?? null,
    classification: (c.classification as string | null) ?? null,
    parentName: (c.parent_name as string | null) ?? null,
    members: (byCommittee.get(c.id as string) ?? []).sort(
      (a, b) =>
        (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
        (a.rank ?? 999) - (b.rank ?? 999) ||
        a.name.localeCompare(b.name),
    ),
  }));

  const legislatorRows = await tx`
    SELECT id, name, party, chamber, district FROM public.ref_legislators
    WHERE jurisdiction = ${code}
    ORDER BY chamber, name
  `;

  const limitations: string[] = [];

  if (committees.length === 0) {
    const failed = sources.find((s) => s.source.endsWith('.committees') && s.status === 'failed');
    limitations.push(
      failed
        ? `We do not have committee rosters for ${code} yet. ${failed.note ?? ''}`.trim()
        : `We do not have committee rosters for ${code} yet. Use the chamber roster below and check ` +
            `the legislature's own committee pages.`,
    );
  }

  if (legislatorRows.length === 0) {
    limitations.push(
      `We have no roster for ${code} at all, so nothing here is a suggestion. Check the ` +
        `legislature's own membership list.`,
    );
  }

  /*
   * The honest statement about what this is. Said every time rather than once in
   * onboarding, because the whole risk of a feature called "sponsor matching" is
   * that people read a list as a recommendation.
   */
  if (committees.length > 0) {
    limitations.push(
      'These are the committees and their members, not a ranked recommendation — we do not yet ' +
        'match a draft’s subject to the committee likely to hear it. The chair is listed first ' +
        'because the chair decides whether a bill gets a hearing.',
    );
  }

  // Any source over eight weeks old is worth saying out loud. A legislature can
  // reorganise its committees in a fortnight.
  for (const s of sources) {
    if (s.status === 'ok' && s.ageDays > 56) {
      limitations.push(
        `${s.source} was last built ${s.ageDays} days ago. Committee membership changes between ` +
          `sessions — confirm anyone you are about to approach.`,
      );
    }
  }

  return {
    jurisdiction: code,
    committees,
    legislators: legislatorRows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      party: (r.party as string | null) ?? null,
      chamber: (r.chamber as string | null) ?? null,
      district: (r.district as string | null) ?? null,
    })),
    sources,
    limitations,
  };
}
