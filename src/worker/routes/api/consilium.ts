/**
 * /api/consilium/* — governance (§5.8).
 *
 * Read docs/ballot-secrecy.md before changing anything that touches a ballot.
 *
 * One dependency worth stating up front: opening a **secret** ballot mints one
 * token per eligible member and hands them to the send queue. Nothing else ever
 * sees them — not the response, not the log, not the steward. Since no delivery
 * provider is wired yet (lib/sender.ts), secret ballots cannot complete
 * end-to-end today. Recorded ballots need no tokens and work now.
 *
 * That is a real gap rather than a rough edge, and the alternative was worse:
 * returning the tokens to whoever opened the ballot would hand them the exact
 * voter-to-token mapping the whole design exists to destroy.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { record } from '../../lib/audit';
import { requireWorkspace } from '../../lib/auth';
import { mintOneTimeToken, sha256Hex } from '../../lib/crypto';
import { ERROR, err, ok } from '../../lib/http';
import {withTenant} from '../../lib/rls';
import { db } from '../../lib/db';

import { canDeliver } from '../../lib/sender';
import { decide, instantRunoff, toTally, type BallotRules, type VoteChoice } from '../../lib/tally';

export const consilium = new Hono<{ Bindings: Env; Variables: Vars }>();

consilium.use('*', requireWorkspace);

const fraction = z.object({
  numerator: z.number().int().positive(),
  denominator: z.number().int().positive(),
});

const createBallotSchema = z.object({
  proposalId: z.string().uuid(),
  method: z.enum([
    'consensus',
    'modified_consensus',
    'simple_majority',
    'supermajority',
    'ranked_choice',
  ]),
  /**
   * Secret by default. A body that wants attribution has to ask for it, rather
   * than secrecy being something you remember to switch on.
   */
  isSecret: z.boolean().default(true),
  quorum: fraction.default({ numerator: 1, denominator: 2 }),
  threshold: fraction.default({ numerator: 1, denominator: 2 }),
  options: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  closesAt: z.string().datetime({ offset: true }),
});

const castSchema = z
  .object({
    /** Secret ballot: the token from the voter's own copy. */
    token: z.string().min(10).max(200).optional(),
    choice: z.enum(['yes', 'no', 'abstain', 'block', 'stand_aside']).optional(),
    rankings: z.array(z.number().int().min(0).max(29)).max(30).optional(),
  })
  .refine((v) => Boolean(v.choice) !== Boolean(v.rankings), {
    message: 'Cast either a choice or a ranking, not both.',
  });

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

consilium.get('/proposals', async (c) => {
  const session = c.get('session')!;

  const sql = db(c);

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT p.id, p.title, p.status, p.created_at, p.decided_at,
             (SELECT count(*) FROM public.proposal_comments pc WHERE pc.proposal_id = p.id)::int AS comments,
             (SELECT count(*) FROM public.amendments a
              WHERE a.proposal_id = p.id AND a.status = 'proposed')::int AS open_amendments
      FROM public.proposals p
      ORDER BY p.created_at DESC
      LIMIT 200
    `,
  );

  return c.json(ok(rows));
});

consilium.post('/proposals', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = z
    .object({
      title: z.string().trim().min(1, 'Give the proposal a title.').max(300),
      body: z.string().trim().min(1, 'Say what is being proposed.').max(50_000),
    })
    .safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }

  const sql = db(c);

  const created = await withTenant(sql, session, async (tx) => {
    const [row] = await tx`
      INSERT INTO public.proposals (tenant_id, title, body, status, proposed_by)
      VALUES (
        coram.current_tenant_id(), ${parsed.data.title}, ${parsed.data.body}, 'discussion',
        (SELECT m.id FROM public.memberships m
         WHERE m.user_id = coram.current_user_id() AND m.tenant_id = coram.current_tenant_id())
      )
      RETURNING id, title, status
    `;
    return row;
  });

  if (!created) return c.json(err('Not permitted to propose here.', ERROR.FORBIDDEN, rid), 403);
  return c.json(ok(created), 201);
});

consilium.get('/proposals/:id', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const sql = db(c);

  const data = await withTenant(sql, session, async (tx) => {
    const [proposal] = await tx`SELECT * FROM public.proposals WHERE id = ${id}::uuid`;
    if (!proposal) return null;

    const comments = await tx`
      SELECT id, parent_id, author_id, body, created_at, edited_at
      FROM public.proposal_comments WHERE proposal_id = ${id}::uuid
      ORDER BY created_at
    `;
    const amendments = await tx`
      SELECT id, body, rationale, status, proposed_by, created_at
      FROM public.amendments WHERE proposal_id = ${id}::uuid ORDER BY created_at
    `;
    const ballots = await tx`
      SELECT id, method, is_secret, closes_at, closed_at, result, eligible_count
      FROM public.ballots WHERE proposal_id = ${id}::uuid ORDER BY created_at DESC
    `;

    return { proposal, comments, amendments, ballots };
  });

  if (!data) return c.json(err('No such proposal.', ERROR.NOT_FOUND, rid), 404);
  return c.json(ok(data));
});

consilium.post('/proposals/:id/comments', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = z
    .object({
      body: z.string().trim().min(1).max(20_000),
      parentId: z.string().uuid().optional(),
    })
    .safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) return c.json(err('Write something.', ERROR.VALIDATION, rid), 400);

  const sql = db(c);

  const created = await withTenant(sql, session, async (tx) => {
    const [row] = await tx`
      INSERT INTO public.proposal_comments (tenant_id, proposal_id, parent_id, author_id, body)
      VALUES (
        coram.current_tenant_id(), ${c.req.param('id')}::uuid,
        ${parsed.data.parentId ?? null}::uuid,
        (SELECT m.id FROM public.memberships m
         WHERE m.user_id = coram.current_user_id() AND m.tenant_id = coram.current_tenant_id()),
        ${parsed.data.body}
      )
      RETURNING id, created_at
    `;
    return row;
  });

  if (!created) {
    return c.json(err('Observers and legal cannot join a deliberation.', ERROR.FORBIDDEN, rid), 403);
  }
  return c.json(ok(created), 201);
});

// ---------------------------------------------------------------------------
// Ballots
// ---------------------------------------------------------------------------

consilium.post('/ballots', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = createBallotSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  if (input.method === 'ranked_choice' && input.options.length < 2) {
    return c.json(err('A ranked ballot needs at least two options.', ERROR.VALIDATION, rid), 400);
  }

  /*
   * Refuse rather than half-open.
   *
   * A secret ballot's tokens are minted here and handed straight to delivery;
   * nothing keeps a copy, deliberately. With no delivery provider configured
   * they would be generated, hashed into the database, and dropped — leaving a
   * ballot that looks open and that nobody on earth can vote in. Failing here
   * is the honest outcome, and it names the fix.
   */
  if (input.isSecret && !canDeliver(c.env)) {
    return c.json(
      err(
        'A secret ballot needs a way to send each member their own voting link, and no ' +
          'delivery provider is configured yet. Open a recorded ballot, or wire delivery first.',
        ERROR.CONFLICT,
        rid,
      ),
      409,
    );
  }

  const sql = db(c);

  try {
    const result = await withTenant(sql, session, async (tx) => {
      const [ballot] = await tx`
        INSERT INTO public.ballots (
          tenant_id, proposal_id, method, is_secret,
          quorum_numerator, quorum_denominator,
          threshold_numerator, threshold_denominator,
          options, closes_at
        ) VALUES (
          coram.current_tenant_id(), ${input.proposalId}::uuid,
          ${input.method}::coram.voting_method, ${input.isSecret},
          ${input.quorum.numerator}, ${input.quorum.denominator},
          ${input.threshold.numerator}, ${input.threshold.denominator},
          -- ::text::jsonb — see lib/rls.ts. A bare ::jsonb arrives double-encoded.
          ${JSON.stringify(input.options)}::text::jsonb, ${input.closesAt}::timestamptz
        )
        RETURNING id
      `;
      if (!ballot) return null;

      const ballotId = ballot.id as string;

      // Count the roll so we know how many tokens to mint.
      const [{ eligible }] = await tx`
        SELECT count(*)::int AS eligible FROM public.memberships m
        WHERE m.tenant_id = coram.current_tenant_id() AND coram.is_in_good_standing(m.id)
      `;

      const tokens = input.isSecret
        ? await Promise.all(Array.from({ length: Number(eligible) }, () => mintOneTimeToken()))
        : [];

      /*
       * Shuffled before insertion. Fisher-Yates over a crypto-random source, so
       * the order the hashes land in carries no relationship to the order the
       * roll was read in — which is the only channel left once the schema has
       * no linking column and the rows have no timestamps.
       */
      const hashes = shuffle(tokens.map((t) => t.hash));

      await tx`SELECT coram.open_ballot(${ballotId}::uuid, ${hashes}::text[])`;
      await record(tx, { action: 'record.export', recordType: 'ballot', recordCount: Number(eligible) });

      return { ballotId, eligible: Number(eligible), tokens: tokens.map((t) => t.token) };
    });

    if (!result) return c.json(err('Only a steward can open a ballot.', ERROR.FORBIDDEN, rid), 403);

    /*
     * The tokens leave this function and are never returned to the caller.
     *
     * Handing them back to whoever opened the ballot would give that person the
     * exact voter-to-token mapping the schema refuses to store. They go to the
     * send queue, which delivers one per member, and this variable goes out of
     * scope.
     */
    if (input.isSecret && result.tokens.length) {
      c.executionCtx.waitUntil(
        c.env.Q_SEND.send({ kind: 'ballot_tokens', ballotId: result.ballotId }).catch(
          () => undefined,
        ),
      );
    }

    return c.json(
      ok(
        { ballotId: result.ballotId, eligible: result.eligible, secret: input.isSecret },
        input.isSecret
          ? {
              message:
                'Ballot open. Each eligible member is being sent their own voting link. ' +
                'Nobody — including you — can see which token went to whom.',
            }
          : { message: 'Ballot open. Votes on this one are recorded against members by name.' },
      ),
      201,
    );
  } catch (error) {
    const detail = String((error as { message?: string })?.message ?? '');
    if (detail.includes('already open')) {
      return c.json(err('That ballot is already open.', ERROR.CONFLICT, rid), 409);
    }
    if (detail.includes('nobody is eligible')) {
      return c.json(
        err('Nobody is currently eligible to vote. Check dues status and standing.', ERROR.CONFLICT, rid),
        409,
      );
    }
    return c.json(err('Could not open that ballot.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/consilium/ballots/:id/cast
// ---------------------------------------------------------------------------

consilium.post('/ballots/:id/cast', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const ballotId = c.req.param('id');

  const parsed = castSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = db(c);

  try {
    const outcome = await withTenant(sql, session, async (tx) => {
      const [ballot] = await tx`
        SELECT is_secret FROM public.ballots WHERE id = ${ballotId}::uuid AND closed_at IS NULL
      `;
      if (!ballot) return 'no_ballot' as const;

      if (ballot.is_secret) {
        if (!input.token) return 'token_required' as const;

        /*
         * cast_secret_vote takes a token hash and has no parameter for who is
         * voting. Not an optional one — none. The session is authenticated on
         * the way in so a stranger cannot spray tokens at the endpoint, and
         * then the identity stops here and goes no further.
         */
        await tx`
          SELECT coram.cast_secret_vote(
            ${ballotId}::uuid,
            ${await sha256Hex(input.token)},
            ${input.choice ?? null}::coram.vote_choice,
            ${input.rankings ? JSON.stringify(input.rankings) : null}::text::jsonb
          )
        `;
        return 'cast' as const;
      }

      await tx`
        INSERT INTO public.votes (ballot_id, tenant_id, membership_id, choice, rankings)
        VALUES (
          ${ballotId}::uuid, coram.current_tenant_id(),
          (SELECT m.id FROM public.memberships m
           WHERE m.user_id = coram.current_user_id() AND m.tenant_id = coram.current_tenant_id()),
          ${input.choice ?? null}::coram.vote_choice,
          ${input.rankings ? JSON.stringify(input.rankings) : null}::text::jsonb
        )
      `;
      return 'cast' as const;
    });

    if (outcome === 'no_ballot') return c.json(err('That ballot is not open.', ERROR.NOT_FOUND, rid), 404);
    if (outcome === 'token_required') {
      return c.json(err('This is a secret ballot. Use your voting link.', ERROR.VALIDATION, rid), 400);
    }

    // The live tally is a Durable Object so a hall full of phones is not
    // re-reading Postgres. It receives a choice and nothing else.
    if (input.choice) {
      const stub = c.env.DO_BALLOT.get(c.env.DO_BALLOT.idFromName(ballotId));
      c.executionCtx.waitUntil(
        stub
          .fetch('https://ballot/record', {
            method: 'POST',
            body: JSON.stringify({ choice: input.choice }),
          })
          .then(() => undefined, () => undefined),
      );
    }

    return c.json(ok(undefined, { message: 'Your vote is in.' }));
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const detail = String((error as { message?: string })?.message ?? '');

    if (code === '23505' || detail.includes('already been used')) {
      return c.json(err('That vote has already been cast.', ERROR.CONFLICT, rid), 409);
    }
    if (detail.includes('not a valid ballot token')) {
      return c.json(err('That voting link is not valid for this ballot.', ERROR.FORBIDDEN, rid), 403);
    }
    if (detail.includes('voting has closed')) {
      return c.json(err('Voting has closed.', ERROR.CONFLICT, rid), 409);
    }
    return c.json(err('Could not record that vote.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/consilium/ballots/:id/tally
// ---------------------------------------------------------------------------

consilium.get('/ballots/:id/tally', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const ballotId = c.req.param('id');

  const sql = db(c);

  const data = await withTenant(sql, session, async (tx) => {
    const [ballot] = await tx`SELECT * FROM public.ballots WHERE id = ${ballotId}::uuid`;
    if (!ballot) return null;

    const rows = await tx`
      SELECT choice, rankings FROM public.votes WHERE ballot_id = ${ballotId}::uuid
    `;
    return { ballot, rows };
  });

  if (!data) return c.json(err('No such ballot.', ERROR.NOT_FOUND, rid), 404);

  const { ballot, rows } = data;
  const open = !ballot.closed_at && new Date(ballot.closes_at as string) > new Date();

  /*
   * A secret ballot shows turnout only while it is open.
   *
   * A visible running split is a quiet form of coercion: it tells the last
   * people to vote how much their vote matters and which way the room has
   * gone, and on a small committee it narrows who has not voted yet. Turnout
   * is enough to know whether quorum is in reach, which is the legitimate
   * reason to look before the close.
   */
  if (ballot.is_secret && open) {
    return c.json(
      ok({
        open: true,
        secret: true,
        turnout: rows.length,
        eligible: ballot.eligible_count,
        tallyWithheld: 'A secret ballot does not show a running count while voting is open.',
      }),
    );
  }

  const rules: BallotRules = {
    method: ballot.method,
    quorum: { numerator: ballot.quorum_numerator, denominator: ballot.quorum_denominator },
    threshold: {
      numerator: ballot.threshold_numerator,
      denominator: ballot.threshold_denominator,
    },
    eligibleCount: Number(ballot.eligible_count ?? 0),
  };

  if (ballot.method === 'ranked_choice') {
    const ballots = rows
      .map((r) => (Array.isArray(r.rankings) ? (r.rankings as number[]) : null))
      .filter((r): r is number[] => r !== null);

    const runoff = instantRunoff(ballots, (ballot.options as string[]).length);
    return c.json(
      ok({
        open,
        secret: ballot.is_secret,
        turnout: rows.length,
        eligible: rules.eligibleCount,
        options: ballot.options,
        runoff,
      }),
    );
  }

  const tally = toTally(rows.map((r) => (r.choice as VoteChoice | null) ?? null));

  return c.json(
    ok({
      open,
      secret: ballot.is_secret,
      eligible: rules.eligibleCount,
      tally,
      result: decide(tally, rules),
    }),
  );
});

// ---------------------------------------------------------------------------
// Proxies
// ---------------------------------------------------------------------------

consilium.post('/proxies', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = z
    .object({
      granteeId: z.string().uuid(),
      ballotId: z.string().uuid().optional(),
    })
    .safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) return c.json(err('Who are you delegating to?', ERROR.VALIDATION, rid), 400);

  const sql = db(c);

  try {
    const created = await withTenant(sql, session, async (tx) => {
      const [row] = await tx`
        INSERT INTO public.proxies (tenant_id, grantor_id, grantee_id, ballot_id)
        VALUES (
          coram.current_tenant_id(),
          (SELECT m.id FROM public.memberships m
           WHERE m.user_id = coram.current_user_id() AND m.tenant_id = coram.current_tenant_id()),
          ${parsed.data.granteeId}::uuid, ${parsed.data.ballotId ?? null}::uuid
        )
        RETURNING id, granted_at
      `;
      return row;
    });

    return c.json(
      ok(created, {
        // Said before it matters rather than discovered afterwards.
        message:
          'Delegated. You can revoke this at any time, but revoking does not retract a vote ' +
          'already cast on your behalf.',
      }),
      201,
    );
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return c.json(err('You have already delegated this.', ERROR.CONFLICT, rid), 409);
    }
    if ((error as { code?: string })?.code === '23514') {
      return c.json(err('You cannot delegate to yourself.', ERROR.VALIDATION, rid), 400);
    }
    return c.json(err('Could not delegate.', ERROR.INTERNAL, rid), 500);
  }
});

consilium.delete('/proxies/:id', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const sql = db(c);

  const revoked = await withTenant(
    sql,
    session,
    async (tx) =>
      (
        await tx`
          UPDATE public.proxies SET revoked_at = now()
          WHERE id = ${c.req.param('id')}::uuid AND revoked_at IS NULL
          RETURNING id
        `
      ).length,
  );

  if (!revoked) return c.json(err('No such active proxy.', ERROR.NOT_FOUND, rid), 404);
  return c.json(ok(undefined, { message: 'Revoked. Any vote already cast for you stands.' }));
});

// ---------------------------------------------------------------------------
// Bylaws
// ---------------------------------------------------------------------------

consilium.get('/bylaws', async (c) => {
  const session = c.get('session')!;

  const sql = db(c);

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT b.id, b.title,
             (SELECT max(v.version) FROM public.bylaw_versions v WHERE v.bylaw_id = b.id) AS current_version,
             (SELECT v.body FROM public.bylaw_versions v
              WHERE v.bylaw_id = b.id ORDER BY v.version DESC LIMIT 1) AS body
      FROM public.bylaws b ORDER BY b.title
    `,
  );

  return c.json(ok(rows));
});

consilium.post('/bylaws/:id/versions', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = z
    .object({
      body: z.string().trim().min(1).max(100_000),
      adoptedByProposalId: z.string().uuid().optional(),
    })
    .safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) return c.json(err('Write the new text.', ERROR.VALIDATION, rid), 400);

  const sql = db(c);

  // Append-only: a new version, never an edit. The history is the reason
  // bylaws live here rather than in a shared document.
  const created = await withTenant(sql, session, async (tx) => {
    const [row] = await tx`
      INSERT INTO public.bylaw_versions
        (tenant_id, bylaw_id, version, body, adopted_by_proposal_id, created_by)
      VALUES (
        coram.current_tenant_id(), ${c.req.param('id')}::uuid,
        coalesce((SELECT max(v.version) FROM public.bylaw_versions v
                  WHERE v.bylaw_id = ${c.req.param('id')}::uuid), 0) + 1,
        ${parsed.data.body}, ${parsed.data.adoptedByProposalId ?? null}::uuid,
        (SELECT m.id FROM public.memberships m
         WHERE m.user_id = coram.current_user_id() AND m.tenant_id = coram.current_tenant_id())
      )
      RETURNING id, version
    `;
    return row;
  });

  if (!created) return c.json(err('Only a steward can amend the bylaws.', ERROR.FORBIDDEN, rid), 403);
  return c.json(ok(created), 201);
});

// ---------------------------------------------------------------------------

/**
 * Fisher-Yates over crypto-random values.
 *
 * `Math.random` would not do here. The order these hashes are inserted in is
 * the last channel through which a voter-to-token link could survive, once the
 * schema has no linking column and the rows carry no timestamps.
 */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
