/**
 * Seed the demo workspace: a fictional tenants' union you can click around in.
 *
 * Run: PGURI=postgres://... npx tsx scripts/seed-demo.ts [--reset]
 *
 * ---------------------------------------------------------------------------
 * Everyone in here is invented, and it has to stay that way
 * ---------------------------------------------------------------------------
 *
 * A demo for this product is a strange object: the whole pitch is that we hold
 * as little as possible about real organizers, so a demo populated from anything
 * real would contradict the argument it exists to make. Every name below is
 * generated from a fixed word list, every address is a street that does not
 * exist, and every phone number is in the 555-01xx block reserved for fiction.
 * Email addresses are all @example.org, which is reserved by RFC 2606 and
 * cannot receive mail.
 *
 * That last point matters more than it sounds. Nuntius sends things. A demo
 * seeded with plausible-looking addresses at real domains is one misconfigured
 * environment variable away from mailing strangers, and the reserved domain
 * makes that impossible rather than unlikely.
 *
 * ---------------------------------------------------------------------------
 * Deterministic, so the demo is the same for everyone
 * ---------------------------------------------------------------------------
 *
 * A seeded PRNG rather than Math.random. Two reasons: a screenshot in a deck
 * stays true next month, and a bug someone reports in the demo can be
 * reproduced exactly. Re-running with --reset produces byte-identical data.
 *
 * ---------------------------------------------------------------------------
 * What it deliberately does not seed
 * ---------------------------------------------------------------------------
 *
 * No channel messages and no organiser notes. Both are encrypted in the
 * browser with a passphrase we never hold, so seeding them server-side is not
 * possible — and that is the correct outcome. A demo that showed readable
 * "encrypted" messages would be lying about the one property hardest to
 * believe.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

import { hashPassword } from '../src/worker/lib/crypto';

neonConfig.webSocketConstructor = ws;

interface Client {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  release: () => void;
}

/** Fixed seed. The demo is the same everywhere, every time. */
let seed = 0x5eed_c07a;
function rnd(): number {
  // Mulberry32. Small, fast, and good enough to scatter names about.
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

const GIVEN = [
  'Ada','Marcus','Nadia','Terrence','Priya','Joaquin','Esme','Dario','Fatou','Wren',
  'Ibrahim','Solveig','Ravi','Consuelo','Bo','Anneke','Malik','Ingrid','Tobias','Yusra',
  'Odalys','Kenji','Rosalind','Amara','Petra','Hollis','Junia','Casimir','Neve','Osei',
] as const;
const FAMILY = [
  'Okonkwo','Alvarez','Brennan','Duarte','Fenwick','Haugen','Iyer','Kowalski','Lindqvist',
  'Mbeki','Nakamura','Oyelaran','Petrov','Quintero','Rasmussen','Sultana','Thibault',
  'Ustinov','Villanueva','Whitlock',
] as const;
/** Streets that do not exist, in a city that does not exist. */
const STREETS = [
  'Perram Row','Kestrel Lane','Ashfield Walk','Dunmore Street','Halloway Rise','Tinsmith Court',
  'Beckwith Terrace','Marlowe Way','Corbie Street','Selwyn Road',
] as const;

function person(i: number) {
  const name = `${pick(GIVEN)} ${pick(FAMILY)}`;
  const handle = name.toLowerCase().replace(/[^a-z]+/g, '.');
  return {
    name,
    // RFC 2606 reserved. Cannot receive mail, by design — see the header note.
    email: `${handle}.${i}@example.org`,
    // RFC 3966 / NANP fictional block.
    phone: `+1555010${String(i).padStart(2, '0')}`,
    postal: `0${int(2100, 2199)}`,
    street: `${int(2, 240)} ${pick(STREETS)}`,
  };
}

/** Matches coram.voting_method. Named rather than inlined so a rename fails loudly. */
const VOTING_METHOD = 'simple_majority';

// Shared with the marketing page that publishes them, so the two cannot drift.
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_SLUG, DEMO_TENANT_NAME } from '../src/shared/demo';

const TENANT_NAME = DEMO_TENANT_NAME;

async function main() {
  const uri = process.env.PGURI;
  if (!uri) throw new Error('Set PGURI to a connection string for the database owner.');

  const pool = new Pool({ connectionString: uri });
  const c = (await pool.connect()) as unknown as Client;

  try {
    const existing = await c.query(`SELECT id FROM public.tenants WHERE slug = $1`, [DEMO_SLUG]);

    if (existing.rows.length && !process.argv.includes('--reset')) {
      console.log(`Demo workspace already exists (${existing.rows[0].id}). Pass --reset to rebuild.`);
      return;
    }

    if (existing.rows.length) {
      // The cascade does the work — the same one the burn switch uses, which is
      // a small ongoing test that it actually cascades.
      await c.query(`DELETE FROM public.tenants WHERE slug = $1`, [DEMO_SLUG]);
      console.log('Removed the previous demo workspace.');
    }

    seed = 0x5eed_c07a; // reset, so --reset is genuinely idempotent

    const [tenant] = (
      await c.query(
        `INSERT INTO public.tenants (name, slug, tier) VALUES ($1, $2, 'local') RETURNING id`,
        [TENANT_NAME, DEMO_SLUG],
      )
    ).rows;
    const tenantId = tenant.id as string;

    // Turfs, so the demo shows the thing most CRMs get wrong: an organizer sees
    // their patch and not the whole list.
    const turfIds: string[] = [];
    for (const name of ['North of the tracks', 'Riverside blocks', 'Hillcrest']) {
      const [t] = (
        await c.query(
          `INSERT INTO public.turfs (tenant_id, name) VALUES ($1, $2) RETURNING id`,
          [tenantId, name],
        )
      ).rows;
      turfIds.push(t.id as string);
    }

    const contactIds: string[] = [];
    for (let i = 1; i <= 240; i += 1) {
      const p = person(i);
      const [row] = (
        await c.query(
          `INSERT INTO public.contacts
             (tenant_id, turf_id, display_name, email, phone, postal_code, custom_fields)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [
            tenantId,
            turfIds[i % turfIds.length],
            p.name,
            p.email,
            p.phone,
            p.postal,
            JSON.stringify({ building: p.street, joined_via: pick(['door knock', 'meeting', 'referral', 'petition']) }),
          ],
        )
      ).rows;
      contactIds.push(row.id as string);
    }
    console.log(`${contactIds.length} contacts across ${turfIds.length} turfs.`);

    // Events: two behind, two ahead, so the demo has history as well as a diary.
    const events: Array<[string, string, number, string]> = [
      ['Building captains check-in', 'Fifteen minutes per block. Bring your sheet.', -21, 'Community room, Perram Row'],
      ['Know your rights training', 'What to do when a notice arrives. Legal observers attending.', -7, 'Eastside Library, room 2'],
      ['Rent board hearing', 'Public comment opens at 6.30. Wear red.', 6, 'City Hall, chamber B'],
      ['Monthly general meeting', 'Repairs campaign vote, then food.', 20, 'Union hall, Dunmore Street'],
    ];
    const eventIds: string[] = [];
    for (const [title, description, offsetDays, location] of events) {
      const [row] = (
        await c.query(
          `INSERT INTO public.events (tenant_id, title, description, starts_at, location_name, capacity)
           VALUES ($1,$2,$3, now() + ($4 || ' days')::interval, $5, $6) RETURNING id`,
          [tenantId, title, description, String(offsetDays), location, 120],
        )
      ).rows;
      eventIds.push(row.id as string);
    }

    let rsvps = 0;
    for (const eventId of eventIds) {
      for (const contactId of contactIds.slice(0, int(40, 90))) {
        if (rnd() > 0.72) continue;
        await c.query(
          `INSERT INTO public.rsvps (tenant_id, event_id, contact_id, status, needs_ride, can_offer_ride, ride_seats)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
          [tenantId, eventId, contactId, pick(['going', 'going', 'going', 'waitlist', 'declined']), rnd() > 0.85, rnd() > 0.9, int(0, 3)],
        );
        rsvps += 1;
      }
    }
    console.log(`${eventIds.length} events, ${rsvps} RSVPs.`);

    // A decision the group actually took, so Consilium has something to show.
    const [proposal] = (
      await c.query(
        `INSERT INTO public.proposals (tenant_id, title, body, status, decided_at)
         VALUES ($1,$2,$3,'adopted', now() - interval '9 days') RETURNING id`,
        [
          tenantId,
          'Adopt the 30-day repairs standard as our position',
          'That the union adopts the 30-day repair deadline with a rent-withholding remedy as its ' +
            'formal position, and authorises the repairs committee to seek a sponsor for it.',
        ],
      )
    ).rows;

    await c.query(
      // opens_at must be set explicitly: it defaults to now(), and the schema
      // requires closes_at to follow it — a ballot that closed nine days ago
      // cannot have opened this morning.
      `INSERT INTO public.ballots
         (tenant_id, proposal_id, method, is_secret, eligible_count, result, opens_at, closes_at, closed_at)
       VALUES ($1,$2,$3::coram.voting_method,true,$4,'adopted',
               now() - interval '16 days', now() - interval '9 days', now() - interval '9 days')`,
      [tenantId, proposal.id, VOTING_METHOD, 186],
    );

    // A mutual aid fund, because §5.6 takes no fee from these and the demo
    // should show the tier that costs nothing.
    await c.query(
      `INSERT INTO public.funds (tenant_id, name, description, kind, goal_cents, raised_cents, currency)
       VALUES ($1,$2,$3,'mutual_aid',$4,$5,'USD')`,
      [
        tenantId,
        'Eviction defence fund',
        'Filing fees, transport to court, and a night in a motel when a lockout happens on a Friday.',
        500_000,
        318_400,
      ],
    );

    // The bill the group is drafting — the newest module, and the one that
    // makes the demo feel like it goes somewhere.
    const [bill] = (
      await c.query(
        `INSERT INTO public.bills (tenant_id, working_name, jurisdiction, locality, route, stage, problem, intent)
         VALUES ($1,$2,'CA',$3,'local','seeking_sponsor',$4,$5) RETURNING id`,
        [
          tenantId,
          'The repairs ordinance',
          'Eastside',
          'Landlords delay repairs for months. The only remedy tenants have is to move out, which ' +
            'is not a remedy. 186 members voted to make a 30-day standard our position.',
          'A 30-day repair deadline with rent withholding as the remedy, enforced by the housing ' +
            'department rather than by tenants going to court one at a time.',
        ],
      )
    ).rows;

    const sections: Array<[string, number, string, string]> = [
      ['short_title', 0, 'Short title', 'The Eastside Repairs Ordinance'],
      ['enacting_clause', 1, 'Enacting clause', 'The people of the State of California do enact as follows:'],
      ['definitions', 2, 'Definitions',
        '"Covered Landlord" means an owner of four or more residential rental units.\n' +
        '"Habitability Defect" means a condition that materially affects health or safety.'],
      ['operative', 3, 'Repair timelines',
        'A Covered Landlord shall remedy a Habitability Defect within 30 days of written notice from a tenant.'],
      ['operative', 4, 'Remedy',
        'If a Covered Landlord fails to comply, the tenant may withhold rent until the defect is remedied.'],
      ['severability', 5, 'Severability',
        'If any provision of this ordinance is held invalid, the remainder shall not be affected.'],
      ['effective_date', 6, 'Effective date',
        'This ordinance takes effect on the first day of January following its adoption.'],
    ];
    for (const [kind, position, heading, body] of sections) {
      await c.query(
        `INSERT INTO public.bill_sections (tenant_id, bill_id, kind, position, heading, body)
         VALUES ($1,$2,$3::coram.bill_section_kind,$4,$5,$6)`,
        [tenantId, bill.id, kind, position, heading, body],
      );
    }

    for (const [org, isPublic] of [
      ['Eastside Tenants Union', true],
      ['Riverside Mutual Aid', true],
      ['Local 1199 housing committee', false],
    ] as const) {
      await c.query(
        `INSERT INTO public.bill_endorsements (tenant_id, bill_id, org_name, public)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [tenantId, bill.id, org, isPublic],
      );
    }

    /*
     * A login, so the demo is something you use rather than something you read
     * about. The role is `observer` — §4.1's read-only aggregate role, which
     * sees no individual contact records.
     *
     * That is the honest choice for a public demo. A steward login would let
     * any visitor burn the workspace or export 240 contacts, and even though
     * every one of them is invented, a product arguing for data minimisation
     * should not hand out an export button to strangers. The trade-off is that
     * the demo shows the shape of the thing rather than every field in it, and
     * the sign-in page says so.
     *
     * The password is hashed with exactly the same function the app uses, so
     * this is a real account and not a special case in the auth path — there is
     * no demo bypass to get wrong.
     */
    const [demoUser] = (
      await c.query(
        `INSERT INTO public.users (email, password_hash, email_verified_at)
         VALUES ($1, $2, now())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [DEMO_EMAIL, await hashPassword(DEMO_PASSWORD)],
      )
    ).rows;

    const userId =
      (demoUser?.id as string | undefined) ??
      ((await c.query(`SELECT id FROM public.users WHERE email = $1`, [DEMO_EMAIL])).rows[0]
        .id as string);

    await c.query(
      `INSERT INTO public.memberships (tenant_id, user_id, role, display_name)
       VALUES ($1, $2, 'observer', 'Demo visitor')`,
      [tenantId, userId],
    );

    console.log(`Demo workspace ready: ${TENANT_NAME} (${tenantId})`);
    console.log(`Sign in as ${DEMO_EMAIL} / ${DEMO_PASSWORD} — observer, read-only.`);
    console.log('A bill in seeking_sponsor, a decided proposal, a mutual aid fund, four events.');
  } finally {
    c.release();
    await pool.end();
  }
}

await main();
