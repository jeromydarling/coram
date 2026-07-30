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

    for (const [office, outcome, daysAgo, note] of [
      ['Councilmember Alvarez, district 4', 'met', 24, 'Wants a fiscal note before committing.'],
      ['Housing committee staff', 'scheduled', 11, 'Briefing on the 12th.'],
      ['Councilmember Petrakis, district 7', 'no_response', 30, null],
    ] as const) {
      await c.query(
        `INSERT INTO public.bill_outreach (tenant_id, bill_id, office_ref, office_name, outcome, occurred_on, note)
         VALUES ($1,$2,$3,$3,$4::coram.outreach_outcome, current_date - $5::int, $6)`,
        [tenantId, bill.id, office, outcome, daysAgo, note],
      );
    }

    /*
     * A login, so the demo is something you use rather than something you read
     * about.
     *
     * The role is `organizer`, and it used to be `observer`. That was the
     * cautious choice and it made the product look empty: an observer sees no
     * individual contact records by design, so the demo rendered a correct
     * permission boundary on nearly every screen and a visitor came away
     * thinking the software did nothing.
     *
     * `organizer` is also the role most people evaluating Coram would actually
     * hold. It shows the turf-scoped list, the follow-up queue, events and
     * shifts, campaign drafts, channels, the bill — the day-to-day of the
     * thing. What it deliberately does not reach is the steward's ground:
     * destroying the workspace, changing roles, approving money, or the legal
     * role's jail-support cases. A stranger cannot burn this, and the screens
     * that are out of reach explain the access model rather than erroring,
     * which is itself worth seeing.
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

    const [membership] = (
      await c.query(
        `INSERT INTO public.memberships (tenant_id, user_id, role, display_name, turf_ids)
         VALUES ($1, $2, 'organizer', $4, $3::uuid[]) RETURNING id`,
        /*
         * A person's name, not "Demo visitor". The overview greets you by your
         * first name, and "Good to see you, Demo." reads like a placeholder —
         * which on a page meant to show a real workspace is exactly the wrong
         * impression. She is as fictional as the rest of them.
         */
        [tenantId, userId, turfIds, 'Rosa Ibarra'],
      )
    ).rows;
    const membershipId = membership.id as string;

    await seedOrganizerDay(c, tenantId, membershipId, contactIds, eventIds);

    console.log(`Demo workspace ready: ${TENANT_NAME} (${tenantId})`);
    console.log(`Sign in as ${DEMO_EMAIL} / ${DEMO_PASSWORD} — organizer, all three turfs.`);
    console.log('A bill in seeking_sponsor, a decided proposal, a mutual aid fund, four events.');
  } finally {
    c.release();
    await pool.end();
  }
}

/**
 * The parts of a week that are not a headline.
 *
 * A demo made only of finished things — a bill, an adopted proposal, a fund
 * with money in it — reads like a brochure. What an organizer actually opens
 * Coram for is the unglamorous half: four conversations they said they would
 * have, a shift with nobody on the door, a draft nobody has sent. Every screen
 * needs one of those or a visitor concludes the module is unbuilt.
 *
 * Runs after the membership exists, because a follow-up belongs to a person.
 */
async function seedOrganizerDay(
  c: Client,
  tenantId: string,
  membershipId: string,
  contactIds: string[],
  eventIds: string[],
) {
  // --- Vinculum's vocabulary. A workspace configures its own; these are a
  // starting set that reads like the ones groups actually write.
  const outcomeIds: Record<string, string> = {};
  const outcomes: Array<[string, string, boolean, number]> = [
    ['committed', 'Committed to something', true, 0],
    ['interested', 'Interested, not ready', true, 1],
    ['listened', 'Heard them out', true, 2],
    ['no_answer', 'No answer', false, 3],
    ['declined', 'Not interested', false, 4],
  ];
  for (const [code, label, positive, order] of outcomes) {
    const [row] = (
      await c.query(
        `INSERT INTO public.outcome_codes (tenant_id, code, label, is_positive, sort_order)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [tenantId, code, label, positive, order],
      )
    ).rows;
    outcomeIds[code] = row.id as string;
  }

  const [ladder] = (
    await c.query(
      `INSERT INTO public.ladders (tenant_id, name) VALUES ($1, 'Building ladder') RETURNING id`,
      [tenantId],
    )
  ).rows;
  const rungIds: string[] = [];
  for (const [i, name] of ['On the list', 'Comes to things', 'Brings someone', 'Building captain'].entries()) {
    const [row] = (
      await c.query(
        `INSERT INTO public.ladder_rungs (tenant_id, ladder_id, name, position)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [tenantId, ladder.id, name, i],
      )
    ).rows;
    rungIds.push(row.id as string);
  }

  // --- Conversations that happened, and the ones they created.
  const conversations: Array<[number, string, string, string]> = [
    [0, 'committed', 'Bringing two neighbours to the hearing.', ''],
    [1, 'interested', 'Wants to see the ordinance text first.', ''],
    [2, 'listened', 'Worried about retaliation. Sending the rights guide.', ''],
    [3, 'committed', 'Will be a building captain for Perram Row.', ''],
    [4, 'no_answer', '', ''],
  ];
  for (const [i, outcome, nextStep] of conversations) {
    await c.query(
      `INSERT INTO public.one_to_ones
         (tenant_id, contact_id, occurred_at, outcome_code_id, next_step, moved_to_rung_id)
       VALUES ($1,$2, now() - ($3 || ' days')::interval, $4, $5, $6)`,
      [
        tenantId,
        contactIds[i],
        String(3 + i * 4),
        outcomeIds[outcome],
        nextStep || null,
        outcome === 'committed' ? rungIds[2] : null,
      ],
    );
  }

  const owed: Array<[number, string, number, number]> = [
    [0, 'Said she would bring two neighbours — check she has a ride', -4, 0],
    [1, 'Send the ordinance text and ask what she thinks', -1, 0],
    [2, 'Follow up on the retaliation worry', 2, 0],
    [3, 'Confirm the captain role and hand over a sheet', 6, 0],
    [7, 'Ask about childcare for the general meeting', 9, 4],
  ];
  for (const [i, reason, dueInDays, snoozes] of owed) {
    await c.query(
      `INSERT INTO public.follow_ups (tenant_id, contact_id, membership_id, reason, due_at, snooze_count)
       VALUES ($1,$2,$3,$4, now() + ($5 || ' days')::interval, $6)`,
      [tenantId, contactIds[i], membershipId, reason, String(dueInDays), snoozes],
    );
  }

  // --- Consent, on the people the demo panel opens first. §5.1's ledger is the
  // answer to "where did you get my number", and an empty one teaches nothing.
  for (const [i, channel, granted, acquisition] of [
    [0, 'email', true, 'Signed the clipboard at the March 4 meeting'],
    [0, 'sms', true, 'Asked at the door, said texts were fine'],
    [1, 'email', true, 'Petition on the repairs ordinance'],
    [2, 'sms', false, 'Asked to be taken off texts after the November action'],
  ] as const) {
    await c.query(
      `INSERT INTO public.consent_records (tenant_id, contact_id, channel, granted, acquisition, occurred_at)
       VALUES ($1,$2,$3,$4,$5, now() - interval '60 days')`,
      [tenantId, contactIds[i], channel, granted, acquisition],
    );
  }

  // --- Shifts on the hearing, one of them deliberately unfilled.
  const hearing = eventIds[2];
  for (const [name, from, to, slots] of [
    ['Door and sign-in', 17.5, 19, 2],
    ['Speaker wrangling', 18, 20, 1],
    ['Childcare', 18, 20.5, 2],
  ] as const) {
    await c.query(
      `INSERT INTO public.event_shifts (tenant_id, event_id, name, starts_at, ends_at, slots)
       SELECT $1, $2, $3, e.starts_at + ($4 || ' hours')::interval, e.starts_at + ($5 || ' hours')::interval, $6
       FROM public.events e WHERE e.id = $2`,
      [tenantId, hearing, name, String(from - 18), String(to - 18), slots],
    );
  }

  // --- A campaign that has been sent and one still in draft, so Nuntius shows
  // both the composer and the deliverability side.
  await c.query(
    `INSERT INTO public.campaigns (tenant_id, name, channel, subject, body, status)
     VALUES ($1,$2,'email',$3,$4,'draft')`,
    [
      tenantId,
      'Hearing turnout push',
      'Tuesday, 6.30pm, City Hall',
      'The rent board hearing is Tuesday. Public comment opens at 6.30 and we want forty of us in ' +
        'the room. Wear red. Reply if you need a ride and we will sort one.',
    ],
  );

  // --- Channels. The demo account is in one of them and not in the other,
  // which is the clearest way to show that membership is the only key.
  for (const [name, ttl, join] of [
    ['hearing-prep', 14, true],
    ['stewards', 7, false],
  ] as const) {
    const [ch] = (
      await c.query(
        `INSERT INTO public.channels (tenant_id, name, kind, ttl_days, created_by)
         VALUES ($1,$2,'channel',$3,$4) RETURNING id`,
        [tenantId, name, ttl, membershipId],
      )
    ).rows;
    if (join) {
      await c.query(
        `INSERT INTO public.channel_members (channel_id, membership_id, tenant_id) VALUES ($1,$2,$3)`,
        [ch.id, membershipId, tenantId],
      );
    }
  }

  // --- Custos. No jail-support case: most weeks there is not one, and a demo
  // that invents an arrest to fill a screen is in poor taste. The rights guide
  // and the briefing are what a group has on file all the time.
  await c.query(
    `INSERT INTO public.rights_guides (tenant_id, state_code, title, body)
     VALUES ($1,'CA',$2,$3)`,
    [
      tenantId,
      'If a landlord or an officer comes to your door',
      'You do not have to open the door. Ask them to slide any paperwork underneath it.\n\n' +
        'You do not have to say anything beyond identifying yourself where the law requires it. ' +
        '"I am not answering questions and I would like to speak to a lawyer" is a complete answer ' +
        'and repeating it is not obstruction.\n\n' +
        'Write down the time, the names, and what was said, as soon as you can. Memory degrades ' +
        'fast and a contemporaneous note is worth more than a careful one written next week.\n\n' +
        'Call the union line before you sign anything. Nothing they are asking for is so urgent ' +
        'that it cannot wait twenty minutes.',
    ],
  );

  await c.query(
    `INSERT INTO public.risk_briefings (tenant_id, event_id, title, body)
     VALUES ($1,$2,$3,$4)`,
    [
      tenantId,
      hearing,
      'Rent board hearing — what to expect',
      'Public building, public meeting. Security at the door will ask you to sign in; you can use ' +
        'your first name.\n\nThere will be a landlord association turnout. Do not engage with them ' +
        'in the corridor — it is the one clip that ends up online.\n\nTwo legal observers will be ' +
        'in the room in green hats. If anything happens, find one before you leave the building.',
    ],
  );

  // --- Money moving, so Thesaurus shows the dual-approval path rather than a
  // static thermometer. Left at 'proposed' — the second signature is the demo.
  await c.query(
    `INSERT INTO public.disbursements (tenant_id, fund_id, amount_cents, currency, purpose, status)
     SELECT $1, f.id, 42_500, 'USD', $2, 'proposed'
     FROM public.funds f WHERE f.tenant_id = $1 LIMIT 1`,
    [tenantId, 'Filing fees and transport, four households, Perram Row lockout'],
  );

  console.log('Follow-ups, conversations, consent, shifts, a draft, two channels, a briefing.');
}

await main();
