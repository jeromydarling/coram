/**
 * Sync reference data: who holds office, and which committees they sit on.
 *
 * Run: PGURI=postgres://... npx tsx scripts/sync-refdata.ts [source ...]
 *
 * ---------------------------------------------------------------------------
 * Why this is a script and not a Worker cron
 * ---------------------------------------------------------------------------
 *
 * This is not request-path work and it is not tenant data. It fetches a few
 * megabytes from four upstreams, parses them, and replaces four tables that are
 * identical for every workspace. Doing that in a Worker cron would buy nothing
 * and would put a job with unbounded upstream latency inside a runtime with a
 * CPU ceiling — and it would need write credentials for reference tables in the
 * same binding that serves requests. The repo already does out-of-band work
 * this way (see `imagery:generate`).
 *
 * It connects as the database owner. `coram_app` has SELECT and nothing else on
 * these tables, deliberately: a workspace that could UPDATE a committee roster
 * would be changing what every other workspace sees.
 *
 * ---------------------------------------------------------------------------
 * Failure is recorded, never papered over
 * ---------------------------------------------------------------------------
 *
 * Each source is independent, and a source that fails leaves its previous rows
 * in place and writes status='failed' with the reason. Stale data carrying an
 * honest date beats an empty table: a group shown "no committees found" will
 * conclude none exist, where a group shown a roster dated eleven weeks ago knows
 * exactly how much to trust it. `ref_sync` is read by the API and surfaced to
 * the user on every roster.
 *
 * ---------------------------------------------------------------------------
 * Vocabularies are normalised on the way in
 * ---------------------------------------------------------------------------
 *
 * Open States says 'upper' / 'lower' / 'legislature'. congress-legislators says
 * 'sen' / 'rep'. Both are mapped to Open States' vocabulary here rather than at
 * every read, so one query answers "who is in the upper chamber" whether the
 * jurisdiction is Texas or the United States. The alternative is a CASE
 * expression in every caller, which is the kind of thing that is right in four
 * places and wrong in the fifth.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - ws ships no types and this script is the only consumer.
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const CONGRESS = 'https://unitedstates.github.io/congress-legislators';
const OS_PEOPLE = 'https://data.openstates.org/people/current';
const OS_API = 'https://v3.openstates.org';

/** 50 states + DC. Matches the field guide in src/shared/legislative. */
const STATES =
  'al ak az ar ca co ct de dc fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy'.split(
    ' ',
  );

interface Legislator {
  id: string;
  jurisdiction: string;
  chamber: string | null;
  district: string | null;
  name: string;
  party: string | null;
}

interface Committee {
  id: string;
  jurisdiction: string;
  chamber: string | null;
  name: string;
  classification: string | null;
  parentId: string | null;
  systemCode: string | null;
  jurisdictionText: string | null;
}

interface Membership {
  committeeId: string;
  personId: string;
  personName: string;
  role: string;
  rank: number | null;
}

/** congress-legislators term type -> Open States chamber vocabulary. */
function federalChamber(type: string): string | null {
  if (type === 'sen') return 'upper';
  if (type === 'rep') return 'lower';
  return null;
}

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<{ body: T; lastModified: string | null }> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return { body: (await res.json()) as T, lastModified: res.headers.get('last-modified') };
}

/**
 * Minimal CSV reader, quote-aware.
 *
 * A dependency would be fine here, but the Open States legislator CSV has
 * quoted fields containing commas (biographies) and nothing else exotic, and
 * this is small enough to read in one sitting. It returns objects keyed by the
 * header row.
 */
function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

async function federalLegislators(): Promise<{ legislators: Legislator[]; upstreamAt: string | null }> {
  const { body, lastModified } = await getJson<
    Array<{
      id: { bioguide: string };
      name: { official_full?: string; first: string; last: string };
      terms: Array<{ type: string; state: string; district?: number; party?: string }>;
    }>
  >(`${CONGRESS}/legislators-current.json`);

  const legislators = body.map((p) => {
    const term = p.terms[p.terms.length - 1];
    return {
      id: p.id.bioguide,
      jurisdiction: 'US',
      chamber: federalChamber(term.type),
      // Senators have no district. A House member's district 0 is an at-large
      // seat and must not be rendered as a falsy blank.
      district: term.district === undefined || term.district === null ? null : String(term.district),
      name: p.name.official_full ?? `${p.name.first} ${p.name.last}`,
      party: term.party ?? null,
    };
  });

  return { legislators, upstreamAt: lastModified };
}

async function federalCommittees(): Promise<{
  committees: Committee[];
  memberships: Membership[];
  upstreamAt: string | null;
}> {
  const { body: cs, lastModified } = await getJson<
    Array<{
      type: string;
      name: string;
      thomas_id: string;
      jurisdiction?: string;
      subcommittees?: Array<{ name: string; thomas_id: string }>;
    }>
  >(`${CONGRESS}/committees-current.json`);

  const { body: members } = await getJson<
    Record<string, Array<{ name: string; bioguide: string; title?: string; rank?: number }>>
  >(`${CONGRESS}/committee-membership-current.json`);

  const committees: Committee[] = [];
  for (const c of cs) {
    committees.push({
      id: c.thomas_id,
      jurisdiction: 'US',
      chamber: c.type === 'senate' ? 'upper' : c.type === 'house' ? 'lower' : 'legislature',
      name: c.name,
      classification: 'committee',
      parentId: null,
      /*
       * A bill's referral names `hsag00`; this roster names `HSAG`. Deriving the
       * referral code here is what makes the two joinable at all — see the note
       * in 0013_refdata.sql. Full committees take the "00" suffix; a
       * subcommittee's own thomas_id already carries its two digits.
       */
      systemCode: `${c.thomas_id.toLowerCase()}00`,
      jurisdictionText: c.jurisdiction ?? null,
    });

    for (const sub of c.subcommittees ?? []) {
      const id = `${c.thomas_id}${sub.thomas_id}`;
      committees.push({
        id,
        jurisdiction: 'US',
        chamber: committees[committees.length - 1].chamber,
        name: sub.name,
        classification: 'subcommittee',
        parentId: c.thomas_id,
        systemCode: id.toLowerCase(),
        // No federal subcommittee publishes jurisdiction prose. Verified: 0 of 181.
        jurisdictionText: null,
      });
    }
  }

  const known = new Set(committees.map((c) => c.id));
  const memberships: Membership[] = [];
  for (const [committeeId, roster] of Object.entries(members)) {
    // The membership file is keyed by thomas_id and includes committees that
    // may not appear in committees-current.json. Skipping rather than failing:
    // a roster with no committee to hang on is not worth aborting the run for.
    if (!known.has(committeeId)) continue;
    for (const m of roster) {
      memberships.push({
        committeeId,
        personId: m.bioguide,
        personName: m.name,
        role: normaliseRole(m.title),
        rank: m.rank ?? null,
      });
    }
  }

  return { committees, memberships, upstreamAt: lastModified };
}

/**
 * Role, normalised to four values.
 *
 * The chair is the one that matters: the chair decides whether a bill gets a
 * hearing, which is where most bills die. Everything else collapses to 'member'
 * rather than preserving thirty variants of vice-chairmanship.
 */
function normaliseRole(title?: string | null): string {
  const t = (title ?? '').toLowerCase();
  if (t.includes('ranking')) return 'ranking member';
  if (t.includes('vice') || t.includes('deputy')) return 'vice chair';
  if (t.includes('chair')) return 'chair';
  return 'member';
}

async function stateLegislators(): Promise<{ legislators: Legislator[]; skipped: string[] }> {
  const legislators: Legislator[] = [];
  const skipped: string[] = [];

  for (const code of STATES) {
    try {
      const res = await fetch(`${OS_PEOPLE}/${code}.csv`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      for (const row of parseCsv(await res.text())) {
        if (!row.id) continue;
        legislators.push({
          id: row.id,
          jurisdiction: code.toUpperCase(),
          chamber: row.current_chamber || null,
          district: row.current_district || null,
          name: row.name,
          party: row.current_party || null,
        });
      }
    } catch (error) {
      // One state failing must not lose the other fifty.
      skipped.push(`${code.toUpperCase()}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { legislators, skipped };
}

/**
 * State committees, via the Open States v3 API.
 *
 * This is the one source that needs a credential — set OPENSTATES_API_KEY. The
 * research suggested syncing committees from the CC0 git repository instead,
 * which is true and gives change history for free, but it means cloning a repo:
 * fine on a developer's machine, wrong for a scheduled job that should depend on
 * one documented interface. The API is that interface.
 *
 * Rate limits are real and undocumented publicly: 10 requests/minute and 250/day
 * on the free tier, with max_per_page=20 on /committees. Fifty-one jurisdictions
 * at up to a few pages each will exceed the free daily allowance, so this paces
 * itself and reports honestly when it runs out rather than writing a partial
 * roster and calling it done.
 */
async function stateCommittees(apiKey: string): Promise<{
  committees: Committee[];
  memberships: Membership[];
  skipped: string[];
}> {
  const committees: Committee[] = [];
  const memberships: Membership[] = [];
  const skipped: string[] = [];

  for (const code of STATES) {
    let page = 1;
    try {
      for (;;) {
        const url = `${OS_API}/committees?jurisdiction=${code}&include=memberships&per_page=20&page=${page}`;
        const res = await fetch(url, { headers: { 'X-API-KEY': apiKey } });

        if (res.status === 429) {
          // Wait out the per-minute window rather than hammering it.
          await new Promise((r) => setTimeout(r, 61_000));
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const body = (await res.json()) as {
          results: Array<{
            id: string;
            name: string;
            chamber?: string;
            classification?: string;
            parent_id?: string | null;
            memberships?: Array<{ person?: { id: string; name: string } | null; person_name?: string; role?: string }>;
          }>;
          pagination: { max_page: number };
        };

        for (const c of body.results) {
          committees.push({
            id: c.id,
            jurisdiction: code.toUpperCase(),
            chamber: c.chamber ?? null,
            name: c.name,
            classification: c.classification ?? 'committee',
            parentId: c.parent_id ?? null,
            systemCode: null,
            jurisdictionText: null,
          });
          for (const m of c.memberships ?? []) {
            const personId = m.person?.id;
            // A membership with no resolvable person is 0.02% of the data. Keep
            // the name — a roster reads fine without an id and is still the
            // answer to "who is on this committee".
            memberships.push({
              committeeId: c.id,
              personId: personId ?? `unresolved:${c.id}:${m.person_name ?? m.role ?? 'unknown'}`,
              personName: m.person?.name ?? m.person_name ?? 'Unknown',
              role: normaliseRole(m.role),
              rank: null,
            });
          }
        }

        if (page >= (body.pagination?.max_page ?? 1)) break;
        page += 1;
        // 10/min on the free tier.
        await new Promise((r) => setTimeout(r, 6_500));
      }
      await new Promise((r) => setTimeout(r, 6_500));
    } catch (error) {
      skipped.push(`${code.toUpperCase()}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { committees, memberships, skipped };
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

/**
 * Just the surface this script uses. The driver's own client type resolves to
 * void under this tsconfig, and inventing a cast would hide a real mismatch —
 * naming the two methods actually called is both smaller and more honest.
 */
interface Client {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  release: () => void;
}

/**
 * Claim the sync row before loading anything.
 *
 * The data tables carry a foreign key to ref_sync(source), so the row has to
 * exist before the first insert — the first version of this wrote it last and
 * every source failed on the constraint.
 *
 * It is claimed as 'failed', which is not a placeholder but the truth: nothing
 * has succeeded yet. If the process is killed mid-load, the row already says so
 * rather than leaving a half-loaded table looking authoritative.
 */
async function beginSync(c: Client, source: string) {
  await c.query(
    `INSERT INTO public.ref_sync (source, fetched_at, rows_loaded, status, note)
     VALUES ($1, now(), 0, 'failed', 'in progress')
     ON CONFLICT (source) DO UPDATE SET
       fetched_at = now(), status = 'failed', note = 'in progress'`,
    [source],
  );
}

async function recordSync(
  c: Client,
  source: string,
  status: 'ok' | 'failed',
  rows: number,
  upstreamAt: string | null,
  note: string | null,
) {
  await c.query(
    `INSERT INTO public.ref_sync (source, upstream_at, fetched_at, rows_loaded, status, note)
     VALUES ($1, $2, now(), $3, $4, $5)
     ON CONFLICT (source) DO UPDATE SET
       upstream_at = EXCLUDED.upstream_at, fetched_at = EXCLUDED.fetched_at,
       rows_loaded = EXCLUDED.rows_loaded, status = EXCLUDED.status, note = EXCLUDED.note`,
    [source, upstreamAt ? new Date(upstreamAt).toISOString() : null, rows, status, note],
  );
}

async function loadLegislators(c: Client, source: string, rows: Legislator[]) {
  await c.query(`DELETE FROM public.ref_legislators WHERE source = $1`, [source]);
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const values = slice
      .map((_, j) => {
        const b = j * 6;
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},'${source}')`;
      })
      .join(',');
    await c.query(
      `INSERT INTO public.ref_legislators (id, jurisdiction, chamber, district, name, party, source)
       VALUES ${values}
       ON CONFLICT (id) DO UPDATE SET
         jurisdiction = EXCLUDED.jurisdiction, chamber = EXCLUDED.chamber,
         district = EXCLUDED.district, name = EXCLUDED.name, party = EXCLUDED.party,
         source = EXCLUDED.source, updated_at = now()`,
      slice.flatMap((r) => [r.id, r.jurisdiction, r.chamber, r.district, r.name, r.party]),
    );
  }
}

async function loadCommittees(c: Client, source: string, committees: Committee[], memberships: Membership[]) {
  // Members cascade from committees, so deleting the committees clears both.
  await c.query(`DELETE FROM public.ref_committees WHERE source = $1`, [source]);

  /*
   * Parents before children. A subcommittee's parent_id is a foreign key to
   * this same table, so inserting a subcommittee first fails — and would fail
   * only for the jurisdictions that have subcommittees, which is the kind of
   * bug that passes on one state and breaks on another.
   */
  const ordered = [...committees].sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0));

  for (const t of ordered) {
    await c.query(
      `INSERT INTO public.ref_committees
         (id, jurisdiction, chamber, name, classification, parent_id, system_code, jurisdiction_text, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         jurisdiction = EXCLUDED.jurisdiction, chamber = EXCLUDED.chamber, name = EXCLUDED.name,
         classification = EXCLUDED.classification, parent_id = EXCLUDED.parent_id,
         system_code = EXCLUDED.system_code, jurisdiction_text = EXCLUDED.jurisdiction_text,
         source = EXCLUDED.source, updated_at = now()`,
      [t.id, t.jurisdiction, t.chamber, t.name, t.classification, t.parentId, t.systemCode, t.jurisdictionText, source],
    );
  }

  const seen = new Set<string>();
  for (const m of memberships) {
    const key = `${m.committeeId} ${m.personId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await c.query(
      `INSERT INTO public.ref_committee_members
         (committee_id, person_id, person_name, role, rank, source)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (committee_id, person_id) DO UPDATE SET
         person_name = EXCLUDED.person_name, role = EXCLUDED.role, rank = EXCLUDED.rank,
         source = EXCLUDED.source, updated_at = now()`,
      [m.committeeId, m.personId, m.personName, m.role, m.rank, source],
    );
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const uri = process.env.PGURI;
  if (!uri) throw new Error('Set PGURI to a connection string for the database owner.');

  const only = process.argv.slice(2);
  const wanted = (name: string) => only.length === 0 || only.includes(name);

  const pool = new Pool({ connectionString: uri });
  const c = (await pool.connect()) as unknown as Client;

  try {
    if (wanted('congress.legislators')) {
      const source = 'congress.legislators';
      try {
        await beginSync(c, source);
        const { legislators, upstreamAt } = await federalLegislators();
        await loadLegislators(c, source, legislators);
        await recordSync(c, source, 'ok', legislators.length, upstreamAt, null);
        console.log(`${source}: ${legislators.length} members (upstream ${upstreamAt ?? 'unknown'})`);
      } catch (error) {
        const note = error instanceof Error ? error.message : String(error);
        await recordSync(c, source, 'failed', 0, null, note);
        console.error(`${source}: FAILED — ${note}`);
      }
    }

    if (wanted('congress.committees')) {
      const source = 'congress.committees';
      try {
        await beginSync(c, source);
        const { committees, memberships, upstreamAt } = await federalCommittees();
        await loadCommittees(c, source, committees, memberships);
        await recordSync(c, source, 'ok', memberships.length, upstreamAt, `${committees.length} committees`);
        console.log(
          `${source}: ${committees.length} committees, ${memberships.length} seats (upstream ${upstreamAt ?? 'unknown'})`,
        );
      } catch (error) {
        const note = error instanceof Error ? error.message : String(error);
        await recordSync(c, source, 'failed', 0, null, note);
        console.error(`${source}: FAILED — ${note}`);
      }
    }

    if (wanted('openstates.people')) {
      const source = 'openstates.people';
      try {
        await beginSync(c, source);
        const { legislators, skipped } = await stateLegislators();
        if (legislators.length === 0) throw new Error('no rows fetched');
        await loadLegislators(c, source, legislators);
        await recordSync(
          c,
          source,
          skipped.length ? 'failed' : 'ok',
          legislators.length,
          null,
          skipped.length ? `skipped ${skipped.length}: ${skipped.join('; ').slice(0, 400)}` : null,
        );
        console.log(`${source}: ${legislators.length} legislators, ${skipped.length} jurisdictions skipped`);
        for (const s of skipped) console.warn(`  skipped ${s}`);
      } catch (error) {
        const note = error instanceof Error ? error.message : String(error);
        await recordSync(c, source, 'failed', 0, null, note);
        console.error(`${source}: FAILED — ${note}`);
      }
    }

    if (wanted('openstates.committees')) {
      const source = 'openstates.committees';
      await beginSync(c, source);
      const key = process.env.OPENSTATES_API_KEY;
      if (!key) {
        /*
         * Recorded as a failure rather than skipped silently. The API returns
         * ref_sync to the user, and "we have no state committee rosters and here
         * is why" is a true and useful thing for a UI to say. Absent rows with
         * no explanation would read as "this state has no committees".
         */
        await recordSync(
          c,
          source,
          'failed',
          0,
          null,
          'OPENSTATES_API_KEY is not set. Request a key at https://open.pluralpolicy.com/accounts/profile/ ' +
            '— the free tier is 250 requests/day, which is not enough for all 51 jurisdictions in one run.',
        );
        console.warn(`${source}: no OPENSTATES_API_KEY, recorded as unavailable`);
      } else {
        try {
          const { committees, memberships, skipped } = await stateCommittees(key);
          if (committees.length === 0) throw new Error('no committees fetched');
          await loadCommittees(c, source, committees, memberships);
          await recordSync(
            c,
            source,
            skipped.length ? 'failed' : 'ok',
            memberships.length,
            null,
            skipped.length
              ? `${committees.length} committees; skipped ${skipped.length}: ${skipped.join('; ').slice(0, 400)}`
              : `${committees.length} committees`,
          );
          console.log(`${source}: ${committees.length} committees, ${memberships.length} seats, ${skipped.length} skipped`);
        } catch (error) {
          const note = error instanceof Error ? error.message : String(error);
          await recordSync(c, source, 'failed', 0, null, note);
          console.error(`${source}: FAILED — ${note}`);
        }
      }
    }

    const { rows } = await c.query(
      `SELECT source, status, rows_loaded, upstream_at, fetched_at FROM public.ref_sync ORDER BY source`,
    );
    console.table(rows);
  } finally {
    c.release();
    await pool.end();
  }
}

await main();
